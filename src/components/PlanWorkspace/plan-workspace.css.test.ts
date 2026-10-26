import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "plan-workspace.css"), "utf-8");
const tokens = readFileSync(join(here, "../../styles/tokens.css"), "utf-8");

/** The declarations of a rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.[\]"=()*+?^$|\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[1];
}

/** The text of the first top-level `:root` or `.dark` block. */
function block(theme: ":root" | ".dark"): string {
  const start = tokens.search(new RegExp(`(?:^|\\n)${theme.replace(".", "\\.")}\\s*\\{`));
  if (start === -1) throw new Error(`no ${theme} block`);
  return tokens.slice(start, tokens.indexOf("\n}", start));
}

/** A token's hex value as a theme sees it: its own block first, then the `:root` defaults. */
function token(theme: ":root" | ".dark", name: string): string {
  const pattern = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`);
  const match = block(theme).match(pattern) ?? block(":root").match(pattern);
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

/** The colour a `color: var(--x, fallback)` declaration resolves to in one theme's tokens. */
function resolvedColor(declarations: string, theme: ":root" | ".dark"): string {
  const match = declarations.match(/(?:^|[\s;])color:\s*var\((--[\w-]+)/);
  if (!match) throw new Error(`no colour in ${declarations}`);
  return token(theme, match[1]);
}

describe("PlanWorkspace overflow menu danger item", () => {
  it.each(['.pws-menu-item[data-danger="true"]', '.dark .pws-menu-item[data-danger="true"]'])(
    "does not use the solid --destructive fill as text (%s)",
    (selector) => {
      expect(rule(selector)).not.toMatch(/color:\s*var\(--(pws-danger|destructive)\s*[,)]/);
    },
  );

  it.each([
    [":root", '.pws-menu-item[data-danger="true"]'],
    [".dark", '.dark .pws-menu-item[data-danger="true"]'],
  ] as const)("reads at 4.5:1 or better on the %s popover", (theme, selector) => {
    const text = resolvedColor(rule(selector), theme);
    const surface = token(theme, "--popover");
    expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
  });
});
