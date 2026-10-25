import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const STYLES = resolve(__dirname, "..", "src/styles");
const scrollLock = readFileSync(resolve(STYLES, "scroll-lock.css"), "utf-8");

/** The CSS with comments removed, so prose in the file's header cannot satisfy an assertion. */
const code = scrollLock.replace(/\/\*[\s\S]*?\*\//g, "");

describe("scroll-lock.css", () => {
  it("reserves the scrollbar gutter so a modal removing the scrollbar cannot move the layout", () => {
    expect(code).toMatch(/html\s*\{[^}]*scrollbar-gutter:\s*stable/);
  });

  it("switches off react-remove-scroll's margin compensation, which would double-count the gutter", () => {
    // `html body[...]` out-ranks the library's `body[data-scroll-locked]`; both are !important.
    expect(code).toMatch(/html body\[data-scroll-locked\]\s*\{[^}]*margin-right:\s*0\s*!important/);
  });

  it("stays unlayered: an important declaration inside @layer would lose to the library's", () => {
    expect(code).not.toContain("@layer");
  });

  it.each(["globals.css", "index.css"])("is imported by %s", (entry) => {
    const css = readFileSync(resolve(STYLES, entry), "utf-8");
    expect(css).toMatch(/@import\s+"\.\/scroll-lock\.css";/);
  });
});
