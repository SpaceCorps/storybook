import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Colour arithmetic for tests that hold a stylesheet to WCAG contrast. jsdom does no cascade and no
 * `var()` substitution, so a test that wants "does this text read on that background, in this theme"
 * has to evaluate the authored declarations itself: a token lookup against `tokens.css`, `#rrggbb`,
 * `rgb()`, `hsl()` and `color-mix(in srgb, ...)`, which is the subset the plan stylesheets are written in.
 * Anything else throws rather than guessing, so a new colour syntax shows up as a failing test and
 * not as a quiet pass.
 */

export type Theme = "light" | "dark";
/** Channels 0-255 and alpha 0-1, not premultiplied. */
export type Rgba = [number, number, number, number];

const root = resolve(__dirname, "..");
const tokensCss = readFileSync(resolve(root, "src/styles/tokens.css"), "utf-8");
const blocks: Record<Theme, string> = {
  light: /^:root\s*\{([^}]+)\}/m.exec(tokensCss)?.[1] ?? "",
  dark: /^\.dark\s*\{([^}]+)\}/m.exec(tokensCss)?.[1] ?? "",
};

/** A custom property's authored value in a theme; the dark block inherits the root for what it omits. */
export function tokenText(theme: Theme, name: string): string | undefined {
  const pattern = new RegExp(`(?:^|[\\s;])${name}:\\s*([^;]+);`);
  return pattern.exec(blocks[theme])?.[1].trim() ?? pattern.exec(blocks.light)?.[1].trim();
}

/** Splits on commas that are not inside parentheses. */
function splitArguments(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let at = 0; at < text.length; at++) {
    if (text[at] === "(") depth++;
    else if (text[at] === ")") depth--;
    else if (text[at] === "," && depth === 0) {
      parts.push(text.slice(start, at).trim());
      start = at + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - chroma / 2;
  const sector = Math.floor((((h % 360) + 360) % 360) / 60);
  const [r, g, b] = [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x],
  ][sector];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/**
 * The colour a declaration value resolves to in a theme. `scope` holds custom properties declared
 * on the rule itself (`--pmv-alert-rule`), which win over the theme's tokens.
 */
export function evaluate(value: string, theme: Theme, scope: Record<string, string> = {}): Rgba {
  const text = value.replace(/!important/g, "").trim();

  if (text === "transparent") return [0, 0, 0, 0];

  const hex = /^#([0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }

  // jsdom writes a hex colour set through `style` back as `rgb()`.
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?\s*\)$/.exec(text);
  if (rgb)
    return [
      Number(rgb[1]),
      Number(rgb[2]),
      Number(rgb[3]),
      rgb[4] === undefined ? 1 : Number(rgb[4]),
    ];

  const hsl = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*(?:\/\s*([\d.]+)\s*)?\)$/.exec(text);
  if (hsl) {
    const [r, g, b] = hslToRgb(Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100);
    return [r, g, b, hsl[4] === undefined ? 1 : Number(hsl[4])];
  }

  const reference = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/s.exec(text);
  if (reference) {
    const declared = scope[reference[1]] ?? tokenText(theme, reference[1]) ?? reference[2];
    if (declared === undefined)
      throw new Error(`${reference[1]} is not defined and has no fallback`);
    return evaluate(declared, theme, scope);
  }

  const mix = /^color-mix\(\s*in srgb\s*,(.+)\)$/s.exec(text);
  if (mix) {
    const [first, second] = splitArguments(mix[1]).map((part) => {
      const percent = /\s(\d+(?:\.\d+)?)%$/.exec(part);
      return {
        color: evaluate(percent ? part.slice(0, percent.index) : part, theme, scope),
        percent: percent ? Number(percent[1]) / 100 : undefined,
      };
    });
    const firstShare = first.percent ?? (second.percent === undefined ? 0.5 : 1 - second.percent);
    const secondShare = second.percent ?? 1 - firstShare;
    // Premultiplied, as CSS mixes: a transparent side contributes alpha and no colour.
    const alpha = first.color[3] * firstShare + second.color[3] * secondShare;
    const channel = (at: number) =>
      (first.color[at] * first.color[3] * firstShare +
        second.color[at] * second.color[3] * secondShare) /
      alpha;
    return [channel(0), channel(1), channel(2), alpha];
  }

  throw new Error(`cannot evaluate colour: ${text}`);
}

/** `over` painted onto an opaque `under`, the way a translucent fill sits on its page. */
export function composite(over: Rgba, under: Rgba): Rgba {
  const a = over[3];
  return [
    over[0] * a + under[0] * (1 - a),
    over[1] * a + under[1] * (1 - a),
    over[2] * a + under[2] * (1 - a),
    1,
  ];
}

function luminance([r, g, b]: Rgba): number {
  const [rl, gl, bl] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

export function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The declarations of the first rule whose selector is exactly `selector`, comments removed. */
export function ruleBody(css: string, selector: string): string | undefined {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`)
    .exec(css)?.[1]
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/** A property's value inside a rule body; `color` does not match `background-color`. */
export function declaration(body: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[\\s;{])${escaped}\\s*:\\s*([^;]+);`).exec(body)?.[1].trim();
}

/** Selector prefixes the plan stylesheets use to scope a rule to the dark theme. */
const DARK_SCOPES = [":root.dark ", ":where(.dark, .dark *) ", ".dark "];

/**
 * The value `property` has on `selector` in a theme: the dark-scoped rule's if the theme is dark and
 * that rule sets it, else the plain rule's. Throws if neither does, so a renamed selector fails loudly.
 */
export function valueFor(
  css: string,
  selector: string,
  property: string,
  theme: Theme,
): string | undefined {
  if (theme === "dark") {
    for (const scope of DARK_SCOPES) {
      const body = ruleBody(css, `${scope}${selector}`);
      const value = body === undefined ? undefined : declaration(body, property);
      if (value !== undefined) return value;
    }
  }
  const body = ruleBody(css, selector);
  if (body === undefined) throw new Error(`no rule for ${selector}`);
  return declaration(body, property);
}
