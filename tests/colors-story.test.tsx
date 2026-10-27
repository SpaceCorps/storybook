import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  AA_TEXT_CONTRAST,
  AllColors,
  LightAndDark,
  NAMED_COLORS,
  TextOnBackground,
  contrastRatio,
  formatRatio,
  textOnPage,
} from "../src/stories/colors.stories.tsx";
import tokensCss from "../src/styles/tokens.css?raw";

// Vite serves `?raw` as the file's text; Vitest, which does not process CSS, serves it as "". The story
// and this file both import the stylesheet that way, so hand both the real text.
vi.mock("../src/styles/tokens.css?raw", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  return { default: readFileSync(resolve(__dirname, "..", "src/styles/tokens.css"), "utf-8") };
});

// What the Colors stories promise axe in CI: no swatch caption is dimmed below AA, and no named color
// is ever set as text where it would not clear AA against the page background of the mode showing it.
// jsdom does no layout and no Tailwind, so the stories are held to their classes and data attributes;
// the colors those classes resolve to come from the stylesheet, checked below against a second reading.

type Story = { render?: unknown };

function renderStory(story: Story) {
  const Render = story.render as React.FC;
  return render(<Render />);
}

const NAMES = NAMED_COLORS.map((color) => color.name);
const MODE_COUNT = 2; // light and dark

// An independent oracle: the formula from design-tokens.test.ts, fed from the inlined stylesheet text
// rather than from the story's own parser.
function oracleRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((at) => {
      const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const declared = (block: string, name: string) =>
  new RegExp(`--${name}:\\s*([^;]+);`).exec(block)?.[1].trim();
const rootBlock = /^:root\s*\{([^}]+)\}/m.exec(tokensCss)?.[1] ?? "";
const darkBlock = /^\.dark\s*\{([^}]+)\}/m.exec(tokensCss)?.[1] ?? "";

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for a color on itself, in either order", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#00cc92", "#00cc92")).toBe(1);
  });

  it("reads #rgb the same as #rrggbb", () => {
    expect(contrastRatio("#fff", "#336699")).toBe(contrastRatio("#ffffff", "#336699"));
  });

  it("matches the figures axe reports for the pairs that used to fail", () => {
    // axe truncates its figures too, which is why formatRatio does.
    expect(formatRatio(contrastRatio("#00cc92", "#ffffff"))).toBe("2.08:1");
    expect(formatRatio(contrastRatio("#000000", "#09090b"))).toBe("1.05:1");
  });

  it("names the value it cannot read instead of returning NaN", () => {
    expect(() => contrastRatio("oklch(0.5 0.1 200)", "#ffffff")).toThrow(/oklch/);
  });
});

describe("formatRatio", () => {
  it("truncates to two places so a near miss never prints as the 4.50 that passes", () => {
    expect(formatRatio(4.4999)).toBe("4.49:1");
    expect(formatRatio(AA_TEXT_CONTRAST)).toBe("4.50:1");
    expect(formatRatio(21)).toBe("21.00:1");
  });
});

describe("textOnPage", () => {
  const css = `
    /*
:root { --fg: #ffffff; }
    */
    :root {
      --background: #ffffff;
      --fg: #000000;
      --both-fail: #ffffff;
    }
    .dark {
      --background: #000000;
      --both-fail: #000000;
    }
  `;

  it("reads light from :root and dark from .dark laid over it", () => {
    const result = textOnPage(["fg", "both-fail"], css);

    // `--fg` is not redeclared in .dark, so the :root value carries over onto the dark background.
    expect(result.light.fg.passes).toBe(true);
    expect(result.dark.fg.passes).toBe(false);
    expect(result.light["both-fail"].passes).toBe(false);
    expect(result.dark["both-fail"].passes).toBe(false);
    expect(result.light.fg.ratio).toBeCloseTo(21, 5);
  });

  it("passes at exactly the AA threshold and not below it", () => {
    // #767676 on white is the textbook 4.54:1; #777777 is 4.48:1.
    const edge = (hex: string) =>
      textOnPage(
        ["x"],
        `:root {\n--background: #ffffff;\n--x: ${hex};\n}\n.dark {\n--background: #000000;\n}\n`,
      );

    expect(edge("#767676").light.x.passes).toBe(true);
    expect(edge("#777777").light.x.passes).toBe(false);
  });

  it("fails loudly on a token it cannot find", () => {
    expect(() => textOnPage(["missing"], css)).toThrow(/--missing/);
  });
});

describe("the page the stories are measured against", () => {
  const pairings = textOnPage(NAMES, tokensCss);

  it.each(NAMES)(
    "%s: the story's figures match a second reading of the tokens, both modes",
    (name) => {
      const [lightBg, darkBg] = [
        declared(rootBlock, "background")!,
        declared(darkBlock, "background")!,
      ];
      const light = declared(rootBlock, name)!;
      const dark = declared(darkBlock, name) ?? light;

      expect(pairings.light[name].ratio).toBeCloseTo(oracleRatio(light, lightBg), 10);
      expect(pairings.dark[name].ratio).toBeCloseTo(oracleRatio(dark, darkBg), 10);
    },
  );

  it("knows which named colors cannot be text on which page", () => {
    // Not a policy, a snapshot of what the palette measures today: this is the list the story
    // withholds from text. A token rework that changes it should change this line on purpose.
    const failing = (mode: "light" | "dark") =>
      NAMES.filter((name) => !pairings[mode][name].passes);

    expect(failing("light")).toEqual(["ivy-green", "white"]);
    expect(failing("dark")).toEqual(["black"]);
  });
});

// The classes a swatch or its captions may carry besides the colors the swatch is built from: type,
// spacing and shape, none of which can recolor or dim text. It is a list of what is allowed rather than
// of what is forbidden, so a utility nobody thought of (an `opacity-*`, an alpha modifier such as
// `text-current/80`, a `text-muted-foreground`, a `dark:` variant of any of them) fails until someone
// has looked at it and added it here on purpose.
const INERT_CLASSES = [
  /^font-(sans|mono|medium|semibold|bold|normal)$/,
  /^text-(xs|sm|base|lg|xl|\[\d+px\])$/,
  /^(p|px|py|pt|pb|m|mt|mb|gap)-\d+(\.\d+)?$/,
  /^(rounded|rounded-box|border|uppercase)$/,
  /^(tracking|leading)-[\w-]+$/,
];

// The classes of `el` that are neither in `allowed` nor inert, plus an inline style if it has one.
function strays(el: Element, allowed: readonly string[]): string[] {
  return [
    ...[...el.classList].filter(
      (cls) => !allowed.includes(cls) && !INERT_CLASSES.some((inert) => inert.test(cls)),
    ),
    ...(el.hasAttribute("style") ? [`style="${el.getAttribute("style")}"`] : []),
  ];
}

describe("swatch captions", () => {
  it("allows a class by name and refuses the ways of dimming text", () => {
    const probe = (className: string, allowed: string[] = []) => {
      const el = document.createElement("div");
      el.className = className;
      return strays(el, allowed);
    };

    expect(probe("font-mono text-[10px]")).toEqual([]);
    expect(
      probe("bg-orange text-orange-foreground", ["bg-orange", "text-orange-foreground"]),
    ).toEqual([]);
    expect(probe("opacity-80")).toEqual(["opacity-80"]);
    expect(probe("dark:opacity-80")).toEqual(["dark:opacity-80"]);
    expect(probe("text-current/80")).toEqual(["text-current/80"]);
    expect(probe("text-orange-foreground/80", ["text-orange-foreground"])).toEqual([
      "text-orange-foreground/80",
    ]);
    expect(probe("text-muted-foreground")).toEqual(["text-muted-foreground"]);
  });

  it.each([
    ["AllColors", AllColors],
    ["LightAndDark", LightAndDark],
  ])("%s: every swatch prints its captions in its own -foreground, undimmed", (_n, story) => {
    const { container } = renderStory(story);

    for (const color of NAMED_COLORS) {
      const swatches = [...container.querySelectorAll("div")].filter(
        (el) => el.classList.contains(color.bg) && el.classList.contains(color.fg),
      );
      expect(swatches.length, `swatch for ${color.name}`).toBeGreaterThan(0);

      for (const swatch of swatches) {
        // The swatch sets the text color once (its -foreground) and the captions inherit it. Dimming
        // them blends them into the fill: white at 80% on orange measured 3.85:1 at this size.
        expect(
          strays(swatch, [color.bg, color.fg, "border-border"]),
          `${color.name} swatch`,
        ).toEqual([]);
        // ...and nothing around the swatch fades it as a whole either.
        for (let up = swatch.parentElement; up && up !== container; up = up.parentElement) {
          expect(
            [...up.classList].filter((cls) => /(^|:)opacity-/.test(cls)),
            `${color.name} swatch ancestor`,
          ).toEqual([]);
          expect(up.hasAttribute("style"), `${color.name} swatch ancestor style`).toBe(false);
        }
        const captions = [...swatch.querySelectorAll("*")];
        expect(captions.length, `${color.name} captions`).toBeGreaterThan(0);
        for (const caption of captions) {
          expect(strays(caption, []), `${color.name} caption "${caption.textContent}"`).toEqual([]);
        }
      }
    }
  });
});

describe("named colors as text on the page background", () => {
  const stories = [
    ["AllColors", AllColors],
    ["LightAndDark", LightAndDark],
    ["TextOnBackground", TextOnBackground],
  ] as const;
  const pairings = textOnPage(NAMES, tokensCss);

  it.each(stories)(
    "%s: every entry carries a verdict for both modes that matches the contrast",
    (_n, story) => {
      const { container } = renderStory(story);

      for (const color of NAMED_COLORS) {
        const entries = [...container.querySelectorAll("li")].filter((li) =>
          li.querySelector(`[data-mode] .${color.bg}, [data-mode] .${color.text}`),
        );
        expect(entries.length, `entry for ${color.name}`).toBeGreaterThan(0);

        for (const entry of entries) {
          const variants = [...entry.querySelectorAll<HTMLElement>("[data-mode]")];
          expect(variants.map((v) => v.dataset.mode)).toEqual(["light", "dark"]);

          for (const variant of variants) {
            const mode = variant.dataset.mode as "light" | "dark";
            const { ratio, passes } = pairings[mode][color.name];

            expect(variant.dataset.passes, `${color.name} ${mode}`).toBe(String(passes));
            expect(variant).toHaveTextContent(formatRatio(ratio));
            expect(variant).toHaveTextContent(passes ? "passes AA" : "below AA");
          }
        }
      }
    },
  );

  it.each(stories)("%s: a color is set as text only in the mode where it passes", (_n, story) => {
    const { container } = renderStory(story);

    for (const color of NAMED_COLORS) {
      for (const el of container.querySelectorAll<HTMLElement>(`.${color.text}`)) {
        const variant = el.closest<HTMLElement>("[data-mode]");
        expect(variant, `${color.name} used as text outside a verdict`).not.toBeNull();
        expect(variant!.dataset.passes, `${color.name} as text in ${variant!.dataset.mode}`).toBe(
          "true",
        );
      }
    }
  });

  // Axe measures exactly these elements, so the test reads each verdict the way a reader does: the name
  // line is either the color itself (it passes) or a neutral name beside a dot of the color (it does
  // not), and the line under it is neutral either way.
  it.each(stories)("%s: each verdict is built the way its contrast calls for", (_n, story) => {
    const { container } = renderStory(story);
    const paletteText = (el: Element) => NAMED_COLORS.some((c) => el.classList.contains(c.text));

    // Found by the name each verdict prints, never by the classes under test: a verdict that lost its
    // dot or its color class must be caught here, not skipped for no longer looking like one.
    const variants = [...container.querySelectorAll<HTMLElement>("[data-mode]")];
    const lists = container.querySelectorAll("ul").length;
    expect(variants).toHaveLength(NAMES.length * MODE_COUNT * lists);

    for (const variant of variants) {
      const [name, verdict] = [variant.firstElementChild!, variant.lastElementChild!];
      const color = NAMED_COLORS.find((c) => c.name === name.textContent);
      expect(color, `a palette color named "${name.textContent}"`).toBeDefined();

      const label = `${color!.name} ${variant.dataset.mode}`;
      const { passes } = pairings[variant.dataset.mode as "light" | "dark"][color!.name];
      const asText = [...variant.querySelectorAll("*")].filter(paletteText);
      const fills = [...variant.querySelectorAll("*")].filter((el) =>
        [...el.classList].some((cls) => cls.startsWith("bg-")),
      );

      expect(verdict, label).toHaveClass("text-muted-foreground");

      if (passes) {
        // Legible on the page: the name is set in the color, and nothing is filled with it.
        expect(asText, `${label} text`).toEqual([name]);
        expect(name, label).toHaveClass(color!.text);
        expect(fills, `${label} fills`).toEqual([]);
      } else {
        // Not legible: the name stays neutral, and the color is a decorative dot beside it.
        expect(asText, `${label} text`).toEqual([]);
        expect(name, label).toHaveClass("text-foreground");
        expect(fills, `${label} fills`).toHaveLength(1);
        expect(fills[0], `${label} dot`).toHaveClass(color!.bg);
        expect(fills[0], `${label} dot`).toHaveAttribute("aria-hidden", "true");
        expect(fills[0], `${label} dot`).toBeEmptyDOMElement();
      }
    }
  });

  it.each(stories)("%s: each verdict is shown only in its own mode", (_n, story) => {
    const { container } = renderStory(story);

    for (const variant of container.querySelectorAll<HTMLElement>("[data-mode]")) {
      const shown = variant.className.split(/\s+/);
      if (variant.dataset.mode === "light") {
        expect(shown).toContain("dark:hidden");
        expect(shown).not.toContain("hidden");
      } else {
        expect(shown).toContain("hidden");
        expect(shown).toContain("dark:flex");
      }
    }
  });

  it("TextOnBackground keeps the light and the dark panel", () => {
    const { container } = renderStory(TextOnBackground);

    expect(container.querySelectorAll("ul")).toHaveLength(2);
    expect(container.querySelector(".dark ul")).not.toBeNull();
    for (const list of container.querySelectorAll("ul")) {
      expect(list.querySelectorAll(":scope > li")).toHaveLength(NAMES.length);
    }
  });
});
