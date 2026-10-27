import type { Meta, StoryObj } from "@storybook/react";
import { Check, X } from "lucide-react";
// The authored token blocks, read as text so the contrast figures below come from the same values the
// stylesheet ships rather than from a second copy that could drift from it.
import tokensCss from "../styles/tokens.css?raw";

/**
 * Every named palette color defined in `styles/globals.css`, with the literal Tailwind class names
 * spelled out so the scanner emits them. A token that is missing a `--color-*` alias renders as a
 * transparent, unstyled swatch, which makes the gap immediately visible.
 */
export const NAMED_COLORS = [
  {
    name: "ivy-green",
    bg: "bg-ivy-green",
    fg: "text-ivy-green-foreground",
    text: "text-ivy-green",
  },
  { name: "slate", bg: "bg-slate", fg: "text-slate-foreground", text: "text-slate" },
  { name: "gray", bg: "bg-gray", fg: "text-gray-foreground", text: "text-gray" },
  { name: "zinc", bg: "bg-zinc", fg: "text-zinc-foreground", text: "text-zinc" },
  { name: "neutral", bg: "bg-neutral", fg: "text-neutral-foreground", text: "text-neutral" },
  { name: "stone", bg: "bg-stone", fg: "text-stone-foreground", text: "text-stone" },
  { name: "black", bg: "bg-black", fg: "text-black-foreground", text: "text-black" },
  { name: "white", bg: "bg-white", fg: "text-white-foreground", text: "text-white" },
  { name: "red", bg: "bg-red", fg: "text-red-foreground", text: "text-red" },
  { name: "orange", bg: "bg-orange", fg: "text-orange-foreground", text: "text-orange" },
  { name: "amber", bg: "bg-amber", fg: "text-amber-foreground", text: "text-amber" },
  { name: "yellow", bg: "bg-yellow", fg: "text-yellow-foreground", text: "text-yellow" },
  { name: "lime", bg: "bg-lime", fg: "text-lime-foreground", text: "text-lime" },
  { name: "green", bg: "bg-green", fg: "text-green-foreground", text: "text-green" },
  { name: "emerald", bg: "bg-emerald", fg: "text-emerald-foreground", text: "text-emerald" },
  { name: "teal", bg: "bg-teal", fg: "text-teal-foreground", text: "text-teal" },
  { name: "cyan", bg: "bg-cyan", fg: "text-cyan-foreground", text: "text-cyan" },
  { name: "sky", bg: "bg-sky", fg: "text-sky-foreground", text: "text-sky" },
  { name: "blue", bg: "bg-blue", fg: "text-blue-foreground", text: "text-blue" },
  { name: "indigo", bg: "bg-indigo", fg: "text-indigo-foreground", text: "text-indigo" },
  { name: "violet", bg: "bg-violet", fg: "text-violet-foreground", text: "text-violet" },
  { name: "purple", bg: "bg-purple", fg: "text-purple-foreground", text: "text-purple" },
  { name: "fuchsia", bg: "bg-fuchsia", fg: "text-fuchsia-foreground", text: "text-fuchsia" },
  { name: "pink", bg: "bg-pink", fg: "text-pink-foreground", text: "text-pink" },
  { name: "rose", bg: "bg-rose", fg: "text-rose-foreground", text: "text-rose" },
] as const;

export type Mode = "light" | "dark";

const MODES: readonly Mode[] = ["light", "dark"];

/** WCAG 2.1 AA for text. Everything printed on this page is below the 18.66px bold / 24px "large" size. */
export const AA_TEXT_CONTRAST = 4.5;

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const digits = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())?.[1];
  if (!digits) {
    throw new Error(`Expected a #rgb or #rrggbb color, got "${hex}"`);
  }
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : digits;
  const [r, g, b] = [0, 2, 4].map((at) => channel(Number.parseInt(full.slice(at, at + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio between two opaque `#rgb` / `#rrggbb` colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** The ratio as printed. Truncated, never rounded: 4.499 must not read as the 4.50 that passes. */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
}

const TOKEN_BLOCKS = {
  light: /^[ \t]*:root\s*\{([^}]*)\}/m,
  dark: /^[ \t]*\.dark\s*\{([^}]*)\}/m,
} as const;

/** The custom properties declared in the top-level `:root` (light) or `.dark` block of `css`. */
function declarationsOf(css: string, mode: Mode): Map<string, string> {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const block = TOKEN_BLOCKS[mode].exec(bare)?.[1];
  if (block === undefined) {
    throw new Error(
      `No top-level ${mode === "light" ? ":root" : ".dark"} block in the token stylesheet; ` +
        "the contrast figures are read from it",
    );
  }
  return new Map(
    [...block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value.trim(),
    ]),
  );
}

export interface TextPairing {
  ratio: number;
  passes: boolean;
}

/**
 * How each named color reads as text on the page background (`--background`) in each mode, from the
 * values `css` declares: the `:root` block for light, `.dark` laid over it for dark.
 */
export function textOnPage(
  names: readonly string[],
  css: string,
): Record<Mode, Record<string, TextPairing>> {
  const root = declarationsOf(css, "light");
  const dark = declarationsOf(css, "dark");
  const valueOf = (mode: Mode, token: string): string => {
    const value = (mode === "dark" ? dark.get(token) : undefined) ?? root.get(token);
    if (value === undefined) {
      throw new Error(`--${token} is not declared for the ${mode} theme`);
    }
    return value;
  };

  const pairings = (mode: Mode) =>
    Object.fromEntries(
      names.map((name) => {
        const ratio = contrastRatio(valueOf(mode, name), valueOf(mode, "background"));
        return [name, { ratio, passes: ratio >= AA_TEXT_CONTRAST }];
      }),
    );
  return { light: pairings("light"), dark: pairings("dark") };
}

function SwatchGrid() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {NAMED_COLORS.map((color) => (
        <div
          key={color.name}
          className={`${color.bg} ${color.fg} rounded-box border border-border p-3`}
        >
          <div className="font-sans text-xs font-medium">{color.name}</div>
          {/* Full strength: dimming the foreground (it was opacity-80) took the tighter pairs, white on
              orange or amber, from AA to under 4:1 at this size. */}
          <div className="font-mono text-[10px]">--{color.name}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Whether a color can be read as text depends on the mode, and the mode is a class on an ancestor
 * (the toolbar flips it on <html>, the stories below pin it with a `.dark` wrapper), which a render
 * cannot see. So each entry carries both verdicts and CSS shows the one for the mode it sits in.
 */
const SHOWN_IN: Record<Mode, string> = {
  light: "flex dark:hidden",
  dark: "hidden dark:flex",
};

function TextOnBackgroundNote() {
  return (
    <p className="text-xs text-muted-foreground">
      The usage that drives the per-mode values: named colors as syntax and label colors on the page
      background. Each is measured against the background of the mode it sits in. Below{" "}
      {AA_TEXT_CONTRAST}:1 it is shown as a dot beside its name instead of as text: use it as a fill
      with its <code>-foreground</code> pair.
    </p>
  );
}

function TextOnBackgroundRow() {
  const pairings = textOnPage(
    NAMED_COLORS.map((color) => color.name),
    tokensCss,
  );

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-box border border-border bg-background p-4 sm:grid-cols-3 lg:grid-cols-5">
      {NAMED_COLORS.map((color) => (
        <li key={color.name}>
          {MODES.map((mode) => {
            const { ratio, passes } = pairings[mode][color.name];
            return (
              <div
                key={mode}
                data-mode={mode}
                data-passes={passes}
                className={`${SHOWN_IN[mode]} flex-col gap-0.5`}
              >
                {passes ? (
                  <span className={`${color.text} font-sans text-sm`}>{color.name}</span>
                ) : (
                  <span className="flex items-center gap-1.5 font-sans text-sm text-foreground">
                    <span
                      aria-hidden="true"
                      className={`${color.bg} size-3 shrink-0 rounded-full border border-border`}
                    />
                    {color.name}
                  </span>
                )}
                <span className="flex flex-wrap items-center gap-x-1 font-mono text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    {passes ? (
                      <Check aria-hidden="true" className="size-3" />
                    ) : (
                      <X aria-hidden="true" className="size-3" />
                    )}
                    {formatRatio(ratio)}
                  </span>
                  <span className="whitespace-nowrap">{passes ? "passes AA" : "below AA"}</span>
                </span>
              </div>
            );
          })}
        </li>
      ))}
    </ul>
  );
}

function ColorShowcase() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="font-sans text-3xl font-bold tracking-tight">Named Colors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The {NAMED_COLORS.length} named palette tokens and their <code>-foreground</code> pairs.
          Each pair meets WCAG 2.1 AA contrast (&gt;= 4.5:1) in both modes.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="border-b border-border pb-2 font-sans text-xl font-semibold">Swatches</h2>
        <SwatchGrid />
      </section>

      <section className="space-y-3">
        <h2 className="border-b border-border pb-2 font-sans text-xl font-semibold">
          Text on background
        </h2>
        <TextOnBackgroundNote />
        <TextOnBackgroundRow />
      </section>
    </div>
  );
}

function LightAndDarkShowcase() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="bg-background text-foreground">
        <div className="px-6 pt-6 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Light
        </div>
        <ColorShowcase />
      </div>
      <div className="dark bg-background text-foreground">
        <div className="px-6 pt-6 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Dark
        </div>
        <ColorShowcase />
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Foundation/Colors",
  component: ColorShowcase,
  // These exports serve `tests/design-tokens.test.ts` and `tests/colors-story.test.tsx`, not the
  // sidebar. Without this, CSF reads each one as a story and it shows up there and in the visual
  // snapshot run.
  excludeStories: [
    "NAMED_COLORS",
    "AA_TEXT_CONTRAST",
    "contrastRatio",
    "formatRatio",
    "textOnPage",
  ],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj;

export const AllColors: Story = {
  render: () => <ColorShowcase />,
};

export const LightAndDark: Story = {
  render: () => <LightAndDarkShowcase />,
};

export const TextOnBackground: Story = {
  render: () => (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <TextOnBackgroundNote />
      <TextOnBackgroundRow />
      <div className="dark rounded-box bg-background p-4">
        <TextOnBackgroundRow />
      </div>
    </div>
  ),
};
