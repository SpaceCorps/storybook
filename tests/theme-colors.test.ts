import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCSSVariable,
  getSystemThemePreference,
  getThemeColors,
  isDarkMode,
} from "../src/lib/theme";
import { readCssInlined } from "./read-css";

/**
 * echarts draws to a canvas, so it cannot read `var(--primary)` — every colour handed to it has to
 * be a resolved value. These tests inject the package's own token stylesheet into jsdom and assert
 * that `getThemeColors()` comes back with real values rather than the empty strings you get when the
 * custom properties are missing, which is the failure mode that would silently paint every chart
 * black.
 */

const GLOBALS_CSS = resolve(import.meta.dirname, "../src/styles/globals.css");

/** Tokens spanning each block of `ThemeColors`: base, semantic, neutral, chromatic. */
const REPRESENTATIVE_TOKENS = [
  "background",
  "foreground",
  "primary",
  "mutedForeground",
  "red",
  "emerald",
  "slate",
] as const;

const HEX = /^#[0-9a-f]{3,8}$/i;

/**
 * What `border` and `input` come back as: the `color-mix()` recipe over the foreground. A browser
 * hands back the foreground already substituted as a hex; jsdom does no `var()` substitution and hands
 * back the `var(--foreground)` text, so the pattern takes either, and spacing around the commas
 * varies between the two.
 */
const COLOR_MIX_OVER_FOREGROUND =
  /^color-mix\(in oklab,\s*(?:var\(--foreground\)|#[0-9a-f]{3,8})\s+(\d+)%,\s*transparent\)$/i;

function injectTokenStylesheet(): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = readCssInlined(GLOBALS_CSS);
  document.head.appendChild(style);
  return style;
}

describe("theme colors", () => {
  let stylesheet: HTMLStyleElement;

  beforeEach(() => {
    stylesheet = injectTokenStylesheet();
  });

  afterEach(() => {
    // Unstub first: the `document`/`window` cases below leave the global undefined, and both this
    // teardown and the shared `cleanup()` in tests/setup.ts need the real one back.
    vi.unstubAllGlobals();
    stylesheet.remove();
    document.documentElement.classList.remove("dark");
  });

  it("resolves the representative tokens to real values, not empty strings", () => {
    const colors = getThemeColors();

    for (const token of REPRESENTATIVE_TOKENS) {
      expect(colors[token], token).toMatch(HEX);
    }
  });

  it("resolves the dark palette when the dark class is applied", () => {
    const light = getThemeColors();
    document.documentElement.classList.add("dark");
    const dark = getThemeColors();

    for (const token of REPRESENTATIVE_TOKENS) {
      expect(dark[token], token).toMatch(HEX);
      expect(dark[token], token).not.toBe(light[token]);
    }
  });

  describe("border and input", () => {
    // These two are derived from the foreground, so unlike every other colour they are not a hex. The
    // fields document it; this pins it, because a consumer that hands them to echarts (zrender parses
    // no color-mix) or to khroma (it throws) needs to be able to rely on knowing which they are.
    it("come back as a color-mix recipe over the foreground, not a hex", () => {
      const { border, input } = getThemeColors();

      expect(border).toMatch(COLOR_MIX_OVER_FOREGROUND);
      expect(input).toMatch(COLOR_MIX_OVER_FOREGROUND);
      expect(border).not.toMatch(HEX);
      expect(input).not.toMatch(HEX);
    });

    it("keep the soft and the control tier apart, and weaken the control tier in dark", () => {
      const percent = (value: string) => Number(COLOR_MIX_OVER_FOREGROUND.exec(value)?.[1]);

      const light = getThemeColors();
      document.documentElement.classList.add("dark");
      const dark = getThemeColors();

      expect(percent(light.border)).toBe(14);
      expect(percent(dark.border)).toBe(14);
      expect(percent(light.input)).toBe(46);
      expect(percent(dark.input)).toBe(38);
    });

    it("lifts card and popover in dark but not in light, as plain hex colours", () => {
      const light = getThemeColors();
      expect(light.card).toBe(light.background);
      expect(light.popover).toBe(light.background);

      document.documentElement.classList.add("dark");
      const dark = getThemeColors();
      for (const surface of [dark.card, dark.popover]) {
        expect(surface).toMatch(HEX);
        expect(surface).not.toBe(dark.background);
      }
    });
  });

  it("resolves non-colour tokens such as the radius", () => {
    expect(getThemeColors().radius).not.toBe("");
  });

  it("returns every field of ThemeColors non-empty", () => {
    const colors = getThemeColors();
    const empty = Object.entries(colors)
      .filter(([, value]) => value === "")
      .map(([key]) => key);

    expect(empty).toEqual([]);
  });

  describe("getCSSVariable", () => {
    it("reads a single custom property", () => {
      expect(getCSSVariable("--primary")).toMatch(HEX);
    });

    it("returns an empty string for an undeclared property", () => {
      expect(getCSSVariable("--not-a-real-token")).toBe("");
    });

    it("returns an empty string when there is no document", () => {
      vi.stubGlobal("document", undefined);
      expect(getCSSVariable("--primary")).toBe("");
    });
  });

  describe("isDarkMode", () => {
    it("follows the documentElement class list", () => {
      expect(isDarkMode()).toBe(false);
      document.documentElement.classList.add("dark");
      expect(isDarkMode()).toBe(true);
      document.documentElement.classList.remove("dark");
      expect(isDarkMode()).toBe(false);
    });

    it("returns false when there is no document", () => {
      vi.stubGlobal("document", undefined);
      expect(isDarkMode()).toBe(false);
    });
  });

  describe("getSystemThemePreference", () => {
    it("reports the media query result", () => {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query === "(prefers-color-scheme: dark)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));

      expect(getSystemThemePreference()).toBe("dark");
    });

    it("falls back to light when the preference is not set", () => {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));

      expect(getSystemThemePreference()).toBe("light");
    });

    it("returns light when there is no window", () => {
      vi.stubGlobal("window", undefined);
      expect(getSystemThemePreference()).toBe("light");
    });
  });
});
