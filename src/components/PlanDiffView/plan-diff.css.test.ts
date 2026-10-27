import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const cssPath = join(dirname(fileURLToPath(import.meta.url)), "plan-diff.css");
const css = readFileSync(cssPath, "utf-8");

function gutterAfterBlock(source: string): string {
  const start = source.indexOf("td.diff-gutter-normal::after,");
  const end = source.indexOf("}", start);
  return source.slice(start, end + 1);
}

describe("plan-diff.css gutter add-comment button", () => {
  const block = gutterAfterBlock(css);

  it("does not draw the plus with a text glyph", () => {
    expect(block).not.toContain('content: "+"');
  });

  it("draws the plus geometrically with centered background bars", () => {
    expect(block).toMatch(/background-size:\s*8px 2px,\s*2px 8px/);
    expect(block).toMatch(/background-position:\s*center center/);
  });
});

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string, from = css): string {
  const escaped = selector.replace(/[.:()[\]]/g, "\\$&");
  const match = from.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[1];
}

const tokens = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../styles/tokens.css"),
  "utf-8",
);

function tokenBlock(theme: ":root" | ".dark"): string {
  const start = tokens.search(new RegExp(`(?:^|\\n)${theme.replace(".", "\\.")}\\s*\\{`));
  return tokens.slice(start, tokens.indexOf("\n}", start));
}

function token(theme: ":root" | ".dark", name: string): string {
  const pattern = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`);
  const match = tokenBlock(theme).match(pattern) ?? tokenBlock(":root").match(pattern);
  if (!match) throw new Error(`no ${name} in ${theme}`);
  return match[1];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("plan-diff.css selected file in the changed-files tree", () => {
  const bar = () => rule(".ivy-changes-tree-row-selected::before");

  it("marks the selected row with a bar, not only a tint", () => {
    expect(bar()).toMatch(/content:\s*""/);
    expect(bar()).toMatch(/position:\s*absolute/);
    expect(bar()).toMatch(/left:\s*0\s*;/);
    // At least 3px, so it reads as a mark rather than a hairline.
    expect(Number(bar().match(/width:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(3);
    expect(rule(".ivy-changes-tree-row")).toMatch(/position:\s*relative\s*;/);
  });

  it("draws the bar in the text colour, which is at least 3:1 on the tint in both themes", () => {
    expect(bar()).toMatch(/background-color:\s*var\(--foreground\)/);
    for (const theme of [":root", ".dark"] as const) {
      expect(
        contrast(token(theme, "--foreground"), token(theme, "--accent")),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrast(token(theme, "--foreground"), token(theme, "--background")),
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the bar in forced-colors mode, where a custom colour is dropped, in a system colour", () => {
    const start = css.indexOf(
      "@media (forced-colors: active) {\n  .ivy-changes-tree-row-selected::before",
    );
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf("\n}\n", start));
    expect(block).toMatch(/background-color:\s*Highlight\s*;/);
  });

  it("does not let the bar take presses", () => {
    expect(bar()).toMatch(/pointer-events:\s*none\s*;/);
  });
});
