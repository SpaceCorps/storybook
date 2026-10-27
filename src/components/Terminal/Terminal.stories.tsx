import type { Meta, StoryObj } from "@storybook/react";
import { expect, waitFor } from "@storybook/test";
import { useEffect, useRef, useState } from "react";
import { Terminal, type TerminalHandle } from "./Terminal.tsx";

const meta: Meta<typeof Terminal> = {
  title: "Components/Terminal",
  component: Terminal,
  parameters: {
    layout: "fullscreen",
    // The emulator renders text with a measured font, so the pixels differ by platform.
    visual: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof Terminal>;

const encoder = new TextEncoder();

/** The emulator is fetched on mount, so a slow machine is slow here, not wrong. */
const PAINT_TIMEOUT_MS = 10_000;

/**
 * Waits until the emulator has painted `text` inside `within` (a selector in the story). The test
 * runner measures the page the moment a story and its play function have finished, and xterm.js is
 * imported after mount and paints a frame after that: without this wait axe runs against an empty
 * terminal, finds nothing to measure, and passes whatever the colours are.
 */
async function expectPainted(canvasElement: HTMLElement, within: string, text: string) {
  await waitFor(
    () =>
      expect(canvasElement.querySelector(within), `${within} in the terminal`).toHaveTextContent(
        text,
      ),
    { timeout: PAINT_TIMEOUT_MS },
  );
}

/** A frame of coloured output, as a dev server would actually write it. */
const BOOT_LOG = [
  "\x1b[1m\x1b[32m  VITE v7.0.0\x1b[0m  ready in \x1b[1m412\x1b[0m ms\r\n",
  "\r\n",
  "  \x1b[32m➜\x1b[0m  \x1b[1mLocal\x1b[0m:   \x1b[36mhttp://localhost:5173/\x1b[0m\r\n",
  "  \x1b[32m➜\x1b[0m  \x1b[1mNetwork\x1b[0m: use \x1b[1m--host\x1b[0m to expose\r\n",
];

export const BootLog: Story = {
  render: () => {
    const ref = useRef<TerminalHandle>(null);

    useEffect(() => {
      for (const line of BOOT_LOG) {
        ref.current?.write(encoder.encode(line));
      }
    }, []);

    return (
      <div style={{ height: "100vh" }}>
        <Terminal ref={ref} />
      </div>
    );
  },
  play: ({ canvasElement }) => expectPainted(canvasElement, ".xterm-rows", "to expose"),
};

/**
 * A progress line rewritten in place with a bare `\r`. This is the case a line-oriented log view
 * cannot show: every update would arrive as another line.
 */
export const ProgressRedraw: Story = {
  render: () => {
    const ref = useRef<TerminalHandle>(null);

    useEffect(() => {
      let percent = 0;
      const timer = setInterval(() => {
        percent = (percent + 4) % 104;
        const filled = "█".repeat(Math.floor(percent / 4));
        const empty = "░".repeat(25 - Math.floor(percent / 4));
        ref.current?.write(encoder.encode(`\rbuilding ${filled}${empty} ${percent}% `));
      }, 120);
      return () => clearInterval(timer);
    }, []);

    return (
      <div style={{ height: "100vh" }}>
        <Terminal ref={ref} />
      </div>
    );
  },
  play: ({ canvasElement }) => expectPainted(canvasElement, ".xterm-rows", "building"),
};

/**
 * Typing goes somewhere: the story echoes it back the way a pty's line discipline would, so the
 * round trip a review action depends on is visible without a server.
 */
export const Interactive: Story = {
  render: () => {
    const ref = useRef<TerminalHandle>(null);
    const [size, setSize] = useState<{ rows: number; cols: number } | null>(null);

    useEffect(() => {
      ref.current?.write(
        encoder.encode("Continue? \x1b[2m(type an answer and press Enter)\x1b[0m\r\n$ "),
      );
    }, []);

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <div style={{ padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
          {size ? `${size.cols}x${size.rows}` : "not measured yet"}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Terminal
            ref={ref}
            onInput={(data) => {
              // CR on Enter, which a terminal turns into a newline on the way out.
              ref.current?.write(encoder.encode(data === "\r" ? "\r\n$ " : data));
            }}
            onResize={(rows, cols) => setSize({ rows, cols })}
          />
        </div>
      </div>
    );
  },
  // The only dim text in any story is the hint here, and dim text is what the contrast fix is about.
  play: ({ canvasElement }) => expectPainted(canvasElement, ".xterm-dim", "type an answer"),
};

export const ReadOnly: Story = {
  render: () => {
    const ref = useRef<TerminalHandle>(null);

    useEffect(() => {
      ref.current?.write(encoder.encode("This terminal drops keystrokes.\r\n"));
    }, []);

    return (
      <div style={{ height: "100vh" }}>
        <Terminal
          ref={ref}
          readOnly
          onInput={() => {
            throw new Error("a read-only terminal must not report input");
          }}
        />
      </div>
    );
  },
  play: ({ canvasElement }) => expectPainted(canvasElement, ".xterm-rows", "drops keystrokes"),
};
