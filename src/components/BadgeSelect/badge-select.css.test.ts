import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const cssPath = join(dirname(fileURLToPath(import.meta.url)), "badge-select.css");
const css = readFileSync(cssPath, "utf-8");

describe("badge-select.css dropdown search input styling", () => {
  it("forces 2.25rem left padding on search input to prevent overlapping the icon", () => {
    expect(css).toContain("padding-left: 2.25rem !important;");
  });

  it("vertically centers search icon and disables pointer events", () => {
    expect(css).toContain("top: 50% !important;");
    expect(css).toContain("transform: translateY(-50%) !important;");
    expect(css).toContain("pointer-events: none !important;");
  });
});

/** The declarations of the rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.]/g, "\\.");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[1];
}

// jsdom has no layout, so the geometry is pinned in the stylesheet and measured in a browser (the
// WithPreselected story): the remove button's hit area is 24px square around a 12px glyph.
describe("badge-select.css remove button hit area", () => {
  const button = rule(".bselect-badge-x");

  it("is at least 24 by 24 CSS pixels", () => {
    expect(button).toMatch(/width:\s*24px\s*;/);
    expect(button).toMatch(/height:\s*24px\s*;/);
  });

  it("takes the extra size back out of the layout with a negative margin", () => {
    expect(button).toMatch(/margin:\s*-6px\s*;/);
  });

  it("leaves the badge row room for the taller hit area, which overflow would otherwise clip", () => {
    expect(rule(".bselect-badges")).toMatch(/padding-block:\s*4px\s*;/);
    expect(rule(".bselect-badges")).toMatch(/margin-block:\s*-4px\s*;/);
  });
});
