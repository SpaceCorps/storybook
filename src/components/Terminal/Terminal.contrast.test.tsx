import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { render, waitFor } from "@testing-library/react";
import type * as React from "react";
import { Terminal } from "./Terminal.tsx";
import { BootLog, Interactive, ProgressRedraw, ReadOnly } from "./Terminal.stories.tsx";

/**
 * Unlike Terminal.test.tsx this runs the real xterm.js. How dim text looks is not this component's
 * wiring but what xterm derives from the theme it is given, and a mock would only check the test's
 * own arithmetic against itself. jsdom has no layout, so nothing is measured: the stylesheet xterm
 * writes and the colour it paints behind the rows are read back and the contrast worked out from them.
 *
 * Found in a real browser: axe flagged `.xterm-dim` at 4.43:1 on the Interactive story, whose
 * `\x1b[2m` text is the only dim text in any story.
 *
 * Two things stand between that arithmetic and the pixels, and the last two groups pin them. Vitest
 * does not load terminal.css, so a rule in it could recolour the text without this file noticing; and
 * the Storybook accessibility run, the only check on the pixels, measures whatever is on the page
 * when the story's play function returns, which is nothing unless the play function waits for the
 * emulator.
 */

/** WCAG AA for text below 18.66px bold or 24px regular. */
const AA = 4.5;
/** Room for 8-bit rounding of the half-opacity blend and for a renderer that rounds the other way. */
const MARGIN = 0.25;

type Rgb = [number, number, number];

/** `#rrggbb`, or `#rrggbbaa` as xterm writes the dim colour; alpha defaults to opaque. */
function parseHex(css: string): { rgb: Rgb; alpha: number } {
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(css);
  if (!match) {
    throw new Error(`not a hex colour: ${css}`);
  }
  const value = Number.parseInt(match[1], 16);
  return {
    rgb: [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff],
    alpha: match[2] ? Number.parseInt(match[2], 16) / 255 : 1,
  };
}

function luminance([r, g, b]: Rgb): number {
  const linear = (channel: number) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** The colour as it lands on `backdrop`: what a browser paints for a translucent foreground. */
function over({ rgb, alpha }: { rgb: Rgb; alpha: number }, backdrop: Rgb): Rgb {
  return rgb.map((channel, i) => channel * alpha + backdrop[i] * (1 - alpha)) as Rgb;
}

/** What xterm paints, read from its own output: the contrast of its dim colour, and the backdrop. */
async function renderTerminalColours() {
  const { container } = render(<Terminal />);
  const stylesheet = () =>
    [...document.querySelectorAll("style")].map((style) => style.textContent).join("\n");

  // xterm.js is imported on mount, so its stylesheet is not there until the import has resolved.
  await waitFor(() => expect(stylesheet()).toContain("xterm-dim"), { timeout: 5000 });
  const css = stylesheet();

  const dim = /\.xterm-rows \.xterm-dim \{ color: (#[0-9a-f]{6,8});/i.exec(css)?.[1];
  const backdrop = container.querySelector<HTMLElement>(".xterm-scrollable-element")?.style
    .backgroundColor;
  const backdropRgb = /^rgb\((\d+), (\d+), (\d+)\)$/
    .exec(backdrop ?? "")
    ?.slice(1, 4)
    .map(Number);

  expect(dim, "xterm's dim colour").toBeDefined();
  expect(backdropRgb, "the colour painted behind the rows").toHaveLength(3);

  const background = backdropRgb as Rgb;
  return { dim: contrast(over(parseHex(dim!), background), background), backdrop: background };
}

beforeEach(() => {
  // xterm reads the device pixel ratio through matchMedia, which jsdom does not have, and paints
  // colour swatches on a canvas it does not have either; neither matters to what is read back.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Terminal text contrast", () => {
  it("keeps dim text at WCAG AA contrast against the terminal background", async () => {
    const colours = await renderTerminalColours();

    expect(colours.dim).toBeGreaterThanOrEqual(AA + MARGIN);
  });
});

describe("terminal.css", () => {
  // The browser paints terminal.css over what xterm writes, and vitest never loads it, so the
  // measurement above knows nothing of it. Read as text, like the other stylesheet tests here.
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "terminal.css"), "utf-8")
    // Prose must not satisfy or trip a pattern.
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("paints the colour behind the emulator that the theme gives its rows", async () => {
    const { backdrop } = await renderTerminalColours();
    const container = /(?:^|\n)\.ivy-terminal\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    const declared = /\bbackground:\s*(#[0-9a-f]{6})\s*;/i.exec(container)?.[1];

    // axe measures the text against the box terminal.css paints, while the measurement above reads
    // the theme's colour, and the two are written down separately.
    expect(declared, "the .ivy-terminal background in terminal.css").toBeDefined();
    expect(parseHex(declared!).rgb).toEqual(backdrop);
  });

  it("leaves the colour of the emulator's text to its theme", () => {
    // A rule here that recoloured or faded xterm's text would change what the browser paints and
    // leave the stylesheet xterm writes, which is what the test above reads, exactly as it was.
    expect(css).not.toMatch(/(?:^|[;{\s])(?:color|opacity)\s*:/);
    expect(css).not.toMatch(/xterm-(?:dim|rows)/);
  });
});

describe("Terminal stories", () => {
  // The Storybook test runner runs axe the moment a story and its play function have finished. The
  // emulator is imported after mount and paints a frame after that, so a story that returns early
  // hands axe an empty terminal, which passes whatever the colours are.
  const stories = [
    ["BootLog", BootLog, ".xterm-rows", "to expose"],
    ["ProgressRedraw", ProgressRedraw, ".xterm-rows", "building"],
    ["Interactive", Interactive, ".xterm-dim", "type an answer"],
    ["ReadOnly", ReadOnly, ".xterm-rows", "drops keystrokes"],
  ] as const;

  it.each(stories)(
    "%s has painted its output when its play function returns",
    async (_name, story, selector, text) => {
      const Render = story.render as unknown as React.FC;
      const { container } = render(<Render />);
      expect(story.play, "the story's play function").toBeDefined();
      // Nothing is there yet, which is why there is something to wait for.
      expect(container.querySelector(".xterm-rows")).toBeNull();

      await story.play?.({ canvasElement: container } as never);

      expect(container.querySelector(selector)?.textContent).toContain(text);
    },
  );
});
