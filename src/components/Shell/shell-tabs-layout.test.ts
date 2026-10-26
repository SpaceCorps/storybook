import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "shell.css"), "utf-8");

/** The declarations of the rule whose selector list is exactly `selector` (one line per selector). */
function rule(...selectors: string[]): string {
  const list = selectors.map((selector) => selector.replace(/[.[\]()-]/g, "\\$&")).join(",\\s*");
  const match = css.match(new RegExp(`(?:^|\\n)${list}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`no rule for ${selectors.join(", ")}`);
  return match[1];
}

// The layout itself is checked in a browser (the ManyAgentSessions and TwentyFourAgentSessions
// stories); jsdom has no layout, so this pins the declarations that keep the strip legible.
describe("ShellTabs strip layout", () => {
  const columns = () => rule(".tsh-tablist", ".tsh-tab-closes");

  it("gives every tab a width between a floor and 200px, so it shrinks but never to nothing", () => {
    const match = columns().match(/grid-auto-columns:\s*minmax\((\d+)px,\s*200px\)\s*;/);
    expect(match).not.toBeNull();
    // Below this a label is a few letters and the close button crowds the icon; the tab's own
    // padding, icon and gap take 76px of it.
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(120);
  });

  it("does not let the columns shrink to zero, which is what overlapped 20 tabs", () => {
    expect(columns()).not.toMatch(/grid-auto-columns:\s*minmax\(0\b/);
    expect(columns()).not.toMatch(/min-width:\s*0\s*;/);
  });

  it("scrolls the strip sideways instead of squeezing past the floor", () => {
    const strip = rule(".tsh-tabstrip");
    expect(strip).toMatch(/overflow-x:\s*auto\s*;/);
    expect(strip).toMatch(/min-width:\s*0\s*;/);
  });

  it("hides the scrollbar, which would take its height out of the 40px row", () => {
    expect(rule(".tsh-tabstrip")).toMatch(/scrollbar-width:\s*none\s*;/);
    expect(rule(".tsh-tabstrip::-webkit-scrollbar")).toMatch(/display:\s*none\s*;/);
  });

  it("keeps the new-session button from being squeezed, outside the scrolling strip", () => {
    expect(rule(".tsh-tab-new")).toMatch(/flex-shrink:\s*0\s*;/);
  });
});

describe("ShellTabs close button hit area", () => {
  const close = () => rule(".tsh-tab-close");

  it("is at least 24 by 24 CSS pixels", () => {
    expect(close()).toMatch(/width:\s*24px\s*;/);
    expect(close()).toMatch(/height:\s*24px\s*;/);
  });

  it("paints its hover chip on the 16px glyph box only, not the whole hit area", () => {
    expect(close()).toMatch(/padding:\s*4px\s*;/);
    expect(close()).toMatch(/background-clip:\s*content-box\s*;/);
  });

  it("keeps the tab's label clear of the whole hit area", () => {
    const padding = rule(".tsh-tab-main").match(/padding:\s*\d+px\s+(\d+)px\s+\d+px\s+\d+px\s*;/);
    // The box ends 12px from the tab's edge and is 24px wide.
    expect(Number(padding?.[1])).toBeGreaterThanOrEqual(36);
  });
});
