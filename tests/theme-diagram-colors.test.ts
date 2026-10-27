import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { readCssInlined } from "./read-css";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }),
  },
}));

import mermaid from "mermaid";
import { renderMermaid } from "../src/lib/diagram";

/**
 * `--border` is a `color-mix()` recipe now, and mermaid is the one place in the package that reads it
 * back (`gridColor`). Mermaid writes `gridColor` into the diagram's stylesheet untouched, which takes
 * color-mix, but derives colours from every other theme variable with khroma, which throws on it
 * ("Unsupported color format"). So the variables must not drift onto a derived token by accident.
 */

const HEX = /^#[0-9a-f]{3,8}$/i;

describe("renderMermaid theme variables", () => {
  let stylesheet: HTMLStyleElement;

  beforeEach(() => {
    stylesheet = document.createElement("style");
    stylesheet.textContent = readCssInlined(
      resolve(import.meta.dirname, "../src/styles/globals.css"),
    );
    document.head.appendChild(stylesheet);
  });

  afterEach(() => {
    stylesheet.remove();
    document.documentElement.classList.remove("dark");
    vi.mocked(mermaid.initialize).mockClear();
  });

  async function themeVariables(): Promise<Record<string, string>> {
    await renderMermaid("gantt\n  dateFormat YYYY-MM-DD\n  section A\n  Task :2026-01-01, 1d");
    const config = vi.mocked(mermaid.initialize).mock.calls.at(-1)?.[0] as
      | { themeVariables: Record<string, string> }
      | undefined;
    return config?.themeVariables ?? {};
  }

  it.each(["light", "dark"] as const)(
    "%s: only gridColor carries the color-mix border, every other variable is a hex",
    async (theme) => {
      document.documentElement.classList.toggle("dark", theme === "dark");
      const { gridColor, ...parsedByKhroma } = await themeVariables();

      expect(gridColor).toMatch(/^color-mix\(/);
      expect(Object.keys(parsedByKhroma).length).toBeGreaterThan(5);
      for (const [name, value] of Object.entries(parsedByKhroma)) {
        expect(value, name).toMatch(HEX);
      }
    },
  );
});
