import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { NAMED_COLORS } from "../src/stories/colors.stories.tsx";
import { readCssInlined } from "./read-css.ts";

// The token blocks live in `tokens.css`, which globals.css imports and shares with index.css, so this
// reads the stylesheet with its relative imports inlined — the text a bundler ends up compiling.
const globalsCss: string = readCssInlined(resolve(__dirname, "..", "src/styles/globals.css"));

/** Same extraction the contrast assertions in button.test.tsx use. */
const rootBlock = /:root\s*\{([^}]+)\}/s.exec(globalsCss)?.[1] ?? "";
const darkBlock = /\.dark\s*\{([^}]+)\}/s.exec(globalsCss)?.[1] ?? "";
const themeBlock = /@theme inline\s*\{([^}]+)\}/s.exec(globalsCss)?.[1] ?? "";

const NAMES = NAMED_COLORS.map((color) => color.name);

function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
  const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
  const b = parseInt(cleanHex.slice(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getRelativeLuminance(color1);
  const lum2 = getRelativeLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function declaration(block: string, name: string): string | undefined {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(block)?.[1].trim();
}

describe("globals.css block structure", () => {
  it("declares exactly one top-level :root and one .dark block", () => {
    // The single-block invariant the `[^}]+` contrast regexes in button.test.tsx depend on. It is now
    // `tokens.css` that supplies these blocks; the assertion holds on the inlined text, which is what
    // those regexes are handed.
    expect(globalsCss.match(/^:root \{/gm)).toHaveLength(1);
    expect(globalsCss.match(/^\.dark \{/gm)).toHaveLength(1);
    expect(globalsCss.match(/^@theme inline \{/gm)).toHaveLength(1);
  });
});

describe("named color tokens", () => {
  it("covers the whole palette", () => {
    expect(NAMES).toHaveLength(25);
    expect(new Set(NAMES).size).toBe(NAMES.length);
  });

  it.each(NAMES)("light mode declares --%s and its -foreground pair at AA contrast", (name) => {
    const color = declaration(rootBlock, name);
    const foreground = declaration(rootBlock, `${name}-foreground`);

    expect(color).toBeDefined();
    expect(foreground).toBeDefined();
    expect(getContrastRatio(color!, foreground!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NAMES)("dark mode declares --%s and its -foreground pair at AA contrast", (name) => {
    const color = declaration(darkBlock, name);
    const foreground = declaration(darkBlock, `${name}-foreground`);

    expect(color).toBeDefined();
    expect(foreground).toBeDefined();
    expect(getContrastRatio(color!, foreground!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NAMES)("@theme inline aliases --color-%s and its -foreground pair", (name) => {
    expect(themeBlock).toContain(`--color-${name}: var(--${name});`);
    expect(themeBlock).toContain(`--color-${name}-foreground: var(--${name}-foreground);`);
  });
});

describe("remaining framework tokens", () => {
  it.each([
    "badge-tint-bg-light",
    "badge-tint-fg-light",
    "badge-tint-bg-dark",
    "badge-tint-fg-dark",
  ])(":root declares --%s", (name) => {
    expect(declaration(rootBlock, name)).toBeDefined();
  });

  it("defines the .badge-tinted utility for both modes", () => {
    expect(globalsCss).toMatch(
      /\.badge-tinted\s*\{[^}]*background-color:\s*var\(--badge-tint-bg-light\);/s,
    );
    expect(globalsCss).toMatch(
      /\.dark \.badge-tinted\s*\{[^}]*background-color:\s*var\(--badge-tint-bg-dark\);/s,
    );
  });

  it.each(["text-body", "text-large-body", "text-large-label", "text-small-label"])(
    "@theme inline declares --%s",
    (name) => {
      expect(declaration(themeBlock, name)).toBeDefined();
    },
  );

  it("declares a concrete --tracking-normal base plus the derived tracking scale", () => {
    expect(declaration(rootBlock, "tracking-normal")).toBe("0em");
    for (const [name, delta] of [
      ["tracking-tighter", "- 0.05em"],
      ["tracking-tight", "- 0.025em"],
      ["tracking-wide", "+ 0.025em"],
      ["tracking-wider", "+ 0.05em"],
      ["tracking-widest", "+ 0.1em"],
    ]) {
      expect(declaration(themeBlock, name)).toBe(`calc(var(--tracking-normal) ${delta})`);
    }
  });

  const shadows = [
    "shadow-2xs",
    "shadow-xs",
    "shadow-sm",
    "shadow",
    "shadow-md",
    "shadow-lg",
    "shadow-xl",
    "shadow-2xl",
  ];

  it.each(shadows)("declares --%s in both modes and aliases it", (name) => {
    expect(declaration(rootBlock, name)).toBeDefined();
    // Flat, but never the keyword `none`: it is invalid inside Tailwind's `box-shadow` list and wipes
    // out the focus ring on every element that also carries a `shadow-*` class.
    expect(declaration(darkBlock, name)).toBe("0 0 #0000");
    expect(themeBlock).toContain(`--${name}: var(--${name});`);
  });

  it("keeps the existing component shadow tokens pointing at their own values", () => {
    expect(declaration(rootBlock, "shadow-boxes")).toBe("0 1px 3px 0 rgb(0 0 0 / 0.1)");
    expect(declaration(rootBlock, "shadow-fields")).toBe("0 1px 2px 0 rgb(0 0 0 / 0.05)");
    expect(declaration(rootBlock, "shadow-selectors")).toBe("0 1px 2px 0 rgb(0 0 0 / 0.05)");
  });

  it("declares --font-serif and aliases it as a font family", () => {
    expect(declaration(rootBlock, "font-serif")).toBe('"Geist Variable", "Geist", serif');
    expect(themeBlock).toContain("--font-family-serif: var(--font-serif);");
  });

  it("declares --spacing and per-mode --toolbox", () => {
    expect(declaration(rootBlock, "spacing")).toBe("0.27rem");
    expect(declaration(rootBlock, "toolbox")).toBe("#38363a");
    expect(declaration(darkBlock, "toolbox")).toBe("#edeaf1");
  });

  it("declares the indeterminate animation, its keyframes, and a reduced-motion guard", () => {
    expect(declaration(themeBlock, "animate-indeterminate")).toBe(
      "indeterminate 1.5s ease-in-out infinite",
    );
    expect(globalsCss).toMatch(/@keyframes indeterminate\s*\{/);
    expect(globalsCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.animate-indeterminate\s*\{[^}]*animation:\s*none;/s,
    );
  });
});

/**
 * `--border` and `--input` are not colours but `color-mix()` recipes over `--foreground`, so the
 * contrast figures below composite them the way a browser paints them: the foreground at the stated
 * alpha over the surface, in sRGB.
 */
const MIX = /^color-mix\(in oklab, var\(--foreground\) (\d+)%, transparent\)$/;

function mixPercent(block: string, name: string): number {
  const value = declaration(block, name);
  const match = value === undefined ? null : MIX.exec(value);
  if (match === null) {
    throw new Error(
      `--${name} is ${value}, not color-mix(in oklab, var(--foreground) N%, transparent)`,
    );
  }
  return Number(match[1]) / 100;
}

/** `foreground` at `alpha` painted over `surface`, as a hex colour. */
function composite(foreground: string, alpha: number, surface: string): string {
  const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [f, s] = [channels(foreground), channels(surface)];
  const mixed = f.map((value, i) => Math.round(value * alpha + s[i] * (1 - alpha)));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

describe("derived border tokens", () => {
  const modes = [
    ["light", rootBlock],
    ["dark", darkBlock],
  ] as const;

  it.each(modes)(
    "%s declares --border, --input and --sidebar-border as recipes over --foreground",
    (_mode, block) => {
      // Declared in BOTH blocks, not inherited: a custom property holding color-mix(var(--foreground))
      // is resolved on the element that declares it, so a nested .dark subtree that did not redeclare
      // it would keep the root's already-resolved border.
      expect(declaration(block, "border")).toMatch(MIX);
      expect(declaration(block, "input")).toMatch(MIX);
      expect(declaration(block, "sidebar-border")).toBe("var(--border)");
    },
  );

  it("keeps the soft tier at 14% and the control tier at 46% in light, 38% in dark", () => {
    expect(mixPercent(rootBlock, "border")).toBe(0.14);
    expect(mixPercent(darkBlock, "border")).toBe(0.14);
    expect(mixPercent(rootBlock, "input")).toBe(0.46);
    expect(mixPercent(darkBlock, "input")).toBe(0.38);
  });

  it.each(modes)(
    "%s --input clears the 3:1 non-text contrast of WCAG 1.4.11 on every surface a field sits on",
    (_mode, block) => {
      const foreground = declaration(block, "foreground")!;
      for (const surface of ["background", "card", "popover", "muted"]) {
        // A light-mode token is only declared in :root, so the dark block inherits what it omits.
        const fill = declaration(block, surface) ?? declaration(rootBlock, surface)!;
        const edge = composite(foreground, mixPercent(block, "input"), fill);
        expect(
          getContrastRatio(edge, fill),
          `--input on --${surface} ${fill}`,
        ).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it.each(modes)(
    "%s --border stays a soft line: visible on the page and card, under 2:1",
    (_mode, block) => {
      const foreground = declaration(block, "foreground")!;
      for (const surface of ["background", "card"]) {
        const fill = declaration(block, surface) ?? declaration(rootBlock, surface)!;
        const edge = composite(foreground, mixPercent(block, "border"), fill);
        const ratio = getContrastRatio(edge, fill);
        expect(ratio, `--border on --${surface}`).toBeGreaterThanOrEqual(1.3);
        expect(ratio, `--border on --${surface}`).toBeLessThan(2);
      }
    },
  );

  it("separates the dark muted fill from its own border (the old #27272a pair was 1.00:1)", () => {
    const muted = declaration(darkBlock, "muted")!;
    const edge = composite(
      declaration(darkBlock, "foreground")!,
      mixPercent(darkBlock, "border"),
      muted,
    );
    expect(getContrastRatio(edge, muted)).toBeGreaterThanOrEqual(1.3);
  });
});

describe("raised dark surfaces", () => {
  it("lifts dark --card and --popover one step above the page", () => {
    const page = declaration(darkBlock, "background")!;
    for (const name of ["card", "popover"]) {
      const surface = declaration(darkBlock, name)!;
      expect(surface, `--${name}`).not.toBe(page);
      expect(getContrastRatio(surface, page), `--${name} against the page`).toBeGreaterThan(1.02);
      // A step, not a different surface: past RioRec's 1.09:1 ceiling the page stops being the page.
      expect(getContrastRatio(surface, page), `--${name} against the page`).toBeLessThan(1.1);
    }
  });

  it("keeps light surfaces flat, where a shadow and the border already do the lifting", () => {
    expect(declaration(rootBlock, "card")).toBe(declaration(rootBlock, "background"));
    expect(declaration(rootBlock, "popover")).toBe(declaration(rootBlock, "background"));
  });

  it("keeps text on the lifted dark surfaces at AA", () => {
    for (const surface of ["card", "popover"]) {
      const fill = declaration(darkBlock, surface)!;
      for (const text of ["foreground", "muted-foreground", `${surface}-foreground`]) {
        expect(
          getContrastRatio(declaration(darkBlock, text)!, fill),
          `--${text} on --${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("invalid control borders", () => {
  it("dark --red, the invalid border colour, outdoes the valid --input edge on every surface", () => {
    // `--destructive` is tuned as a button fill under light text (1.99:1 on the page), so a border
    // using it would be weaker than a valid field's 3.4:1. The named red is what controls use.
    const red = declaration(darkBlock, "red")!;
    const foreground = declaration(darkBlock, "foreground")!;
    for (const surface of ["background", "card", "popover"]) {
      const fill = declaration(darkBlock, surface)!;
      const valid = getContrastRatio(
        composite(foreground, mixPercent(darkBlock, "input"), fill),
        fill,
      );
      const invalid = getContrastRatio(red, fill);
      expect(invalid, `--red on --${surface}`).toBeGreaterThanOrEqual(3);
      expect(invalid, `--red on --${surface}`).toBeGreaterThan(valid);
    }
  });

  it("light --destructive, the invalid border colour, clears 3:1 on the page", () => {
    expect(
      getContrastRatio(
        declaration(rootBlock, "destructive")!,
        declaration(rootBlock, "background")!,
      ),
    ).toBeGreaterThanOrEqual(3);
  });
});
