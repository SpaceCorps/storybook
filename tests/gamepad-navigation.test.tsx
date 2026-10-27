import { act, fireEvent, render, screen } from "@testing-library/react";
import * as RadixTabs from "@radix-ui/react-tabs";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  GAMEPAD_FOCUS_ATTRIBUTE,
  GamepadNavigationProvider,
  INPUT_MODALITY_ATTRIBUTE,
  gamepadFocusRingClass,
  useGamepadNavigation,
  type GamepadNavigationProviderProps,
  type InputModality,
} from "../src/components/ui/gamepad-navigation";
import { GAMEPAD_BUTTON } from "../src/components/ui/gamepad-navigation/gamepad-logic";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../src/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "../src/components/ui/radio-group";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../src/components/ui/resizable";
import { Slider } from "../src/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/ui/tabs";
import { TimeCalendar } from "../src/components/ui/time-calendar";
import { ToggleGroup, ToggleGroupItem } from "../src/components/ui/toggle";

// Timing: vite.config.ts sets `test.testTimeout` to 20 s for every suite, up from vitest's 5 s, because
// a few other suites spawn tsx or drive Radix overlays on a loaded runner. This file needs none of it
// (it runs on fake timers, in about three seconds), but a test here that hangs now takes 20 s to say so.

/**
 * A stand-in for the browser's Gamepad API. `navigator.getGamepads()` returns whatever `pads`
 * holds, and each pad's buttons and axes are plain data a test flips between frames. Nothing here
 * proves a physical controller works; it proves the layer reacts correctly to the data the API
 * would report for one.
 */
interface MockPad {
  id: string;
  index: number;
  connected: boolean;
  mapping: string;
  timestamp: number;
  buttons: Array<{ pressed: boolean; touched: boolean; value: number }>;
  axes: number[];
  press(...buttons: number[]): void;
  release(): void;
  stick(x: number, y: number): void;
}

const { a: A, b: B, leftBumper: LB, rightBumper: RB } = GAMEPAD_BUTTON;
const { dpadUp: UP, dpadDown: DOWN, dpadLeft: LEFT, dpadRight: RIGHT } = GAMEPAD_BUTTON;

function createMockPad(
  id = "Mock Pad (STANDARD GAMEPAD Vendor: 0000 Product: 0000)",
  index = 0,
): MockPad {
  const pad: MockPad = {
    id,
    index,
    connected: true,
    mapping: "standard",
    timestamp: 0,
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    axes: [0, 0, 0, 0],
    press(...buttons) {
      for (const index of buttons) {
        pad.buttons[index] = { pressed: true, touched: true, value: 1 };
      }
    },
    release() {
      pad.buttons.forEach((_, index) => {
        pad.buttons[index] = { pressed: false, touched: false, value: 0 };
      });
      pad.axes = [0, 0, 0, 0];
    },
    stick(x, y) {
      pad.axes = [x, y, 0, 0];
    },
  };
  return pad;
}

let pads: Array<MockPad | null> = [];
let getGamepads: ReturnType<typeof vi.fn>;

function connect(pad: MockPad) {
  pads = [pad];
  act(() => {
    window.dispatchEvent(Object.assign(new Event("gamepadconnected"), { gamepad: pad }));
  });
}

/** Plugs `pad` in beside the pads already there. */
function connectAlso(pad: MockPad) {
  pads = [...pads, pad];
  act(() => {
    window.dispatchEvent(Object.assign(new Event("gamepadconnected"), { gamepad: pad }));
  });
}

function disconnect(pad: MockPad) {
  pad.connected = false;
  pads = [];
  act(() => {
    window.dispatchEvent(Object.assign(new Event("gamepaddisconnected"), { gamepad: pad }));
  });
}

/** Lets `ms` of fake time pass; the loop polls once per 16 ms frame. */
function elapse(ms = 16) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Presses the buttons for one frame and releases them on the next. */
function tap(pad: MockPad, ...buttons: number[]) {
  pad.press(...buttons);
  elapse();
  pad.release();
  elapse();
}

/** Lets queued microtasks (tab selection waits one for React to render) and Radix's timers run. */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 4; i += 1) {
      await Promise.resolve();
    }
    vi.advanceTimersByTime(1);
  });
}

/** jsdom has no layout, so a test says where each element is. */
function place(element: HTMLElement, left: number, top: number, width = 100, height = 40) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  });
}

/** Gives the elements 16 px boxes in a row or a column, 30 px apart, from (left, top). */
function lineUp(elements: HTMLElement[], axis: "row" | "column", left = 0, top = 0) {
  elements.forEach((element, index) => {
    place(
      element,
      left + (axis === "row" ? index * 30 : 0),
      top + (axis === "column" ? index * 30 : 0),
      16,
      16,
    );
  });
}

const html = document.documentElement;

beforeEach(() => {
  pads = [];
  getGamepads = vi.fn(() => pads);
  Object.defineProperty(navigator, "getGamepads", { configurable: true, value: getGamepads });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (navigator as { getGamepads?: unknown }).getGamepads;
  html.removeAttribute(INPUT_MODALITY_ATTRIBUTE);
});

function Layer(props: Partial<GamepadNavigationProviderProps> & { children?: React.ReactNode }) {
  return <GamepadNavigationProvider enabled {...props} />;
}

/** Four buttons in a 2 x 2 grid: a b over c d. */
function Grid({ onClick }: { onClick?: (name: string) => void }) {
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  React.useLayoutEffect(() => {
    const spots: Record<string, [number, number]> = {
      a: [0, 0],
      b: [116, 0],
      c: [0, 56],
      d: [116, 56],
    };
    for (const [name, [left, top]] of Object.entries(spots)) {
      place(refs.current[name]!, left, top);
    }
  }, []);
  return (
    <div>
      {["a", "b", "c", "d"].map((name) => (
        <button
          key={name}
          ref={(node) => {
            refs.current[name] = node;
          }}
          onClick={() => onClick?.(name)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

const focused = () => document.activeElement?.textContent;

describe("GamepadNavigationProvider: off by default", () => {
  it("registers nothing and polls nothing when not enabled", () => {
    const addListener = vi.spyOn(window, "addEventListener");
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const onClick = vi.fn();
    const pad = createMockPad();
    pads = [pad];

    render(
      <GamepadNavigationProvider>
        <button onClick={onClick}>Go</button>
      </GamepadNavigationProvider>,
    );
    screen.getByRole("button").focus();
    connect(pad);
    pad.press(A);
    elapse(200);

    expect(addListener.mock.calls.filter(([type]) => String(type).startsWith("gamepad"))).toEqual(
      [],
    );
    expect(raf).not.toHaveBeenCalled();
    expect(getGamepads).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    expect(html.hasAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe(false);
  });

  it("reports a disabled layer through the hook, with or without a provider", () => {
    function Probe() {
      return <output>{JSON.stringify(useGamepadNavigation())}</output>;
    }
    const { rerender } = render(<Probe />);
    expect(JSON.parse(screen.getByRole("status").textContent!)).toMatchObject({
      enabled: false,
      connected: false,
      padId: null,
    });
    rerender(
      <GamepadNavigationProvider>
        <Probe />
      </GamepadNavigationProvider>,
    );
    expect(JSON.parse(screen.getByRole("status").textContent!).enabled).toBe(false);
  });

  it("renders on the server without touching the browser", () => {
    expect(
      renderToString(
        <GamepadNavigationProvider enabled>
          <p>Server markup</p>
        </GamepadNavigationProvider>,
      ),
    ).toContain("Server markup");
  });
});

describe("GamepadNavigationProvider: connecting", () => {
  it("only listens for connection events until a pad shows up", () => {
    const raf = vi.spyOn(window, "requestAnimationFrame");
    render(<Layer />);

    elapse(100);
    expect(raf).not.toHaveBeenCalled();
    expect(getGamepads).toHaveBeenCalled();
    getGamepads.mockClear();
    elapse(100);
    expect(getGamepads).not.toHaveBeenCalled();
  });

  it("publishes the pad id and starts polling when one connects", () => {
    function Probe() {
      const state = useGamepadNavigation();
      return <output>{`${state.connected}|${state.padId}`}</output>;
    }
    render(
      <Layer>
        <Probe />
      </Layer>,
    );
    expect(screen.getByRole("status").textContent).toBe("false|null");

    const pad = createMockPad("Test Pad 9000");
    connect(pad);
    expect(screen.getByRole("status").textContent).toBe("true|Test Pad 9000");

    getGamepads.mockClear();
    elapse(64);
    expect(getGamepads.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("picks up a pad that was already awake when the layer was switched on", () => {
    const pad = createMockPad();
    pads = [pad];
    const onClick = vi.fn();
    render(
      <Layer>
        <button onClick={onClick}>Go</button>
      </Layer>,
    );
    screen.getByRole("button").focus();

    tap(pad, A);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("stops polling and reports the pad gone when it disconnects", () => {
    function Probe() {
      return <output>{String(useGamepadNavigation().connected)}</output>;
    }
    const pad = createMockPad();
    render(
      <Layer>
        <Probe />
      </Layer>,
    );
    connect(pad);
    expect(screen.getByRole("status").textContent).toBe("true");

    disconnect(pad);
    expect(screen.getByRole("status").textContent).toBe("false");
    getGamepads.mockClear();
    elapse(200);
    expect(getGamepads).not.toHaveBeenCalled();
  });

  it("does not act on the button that woke the pad until it has been released and pressed again", () => {
    const pad = createMockPad();
    const onClick = vi.fn();
    render(
      <Layer>
        <button onClick={onClick}>Go</button>
      </Layer>,
    );
    screen.getByRole("button").focus();

    pad.press(A);
    connect(pad);
    elapse(100);
    expect(onClick).not.toHaveBeenCalled();

    pad.release();
    elapse();
    tap(pad, A);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("GamepadNavigationProvider: moving focus", () => {
  it("moves focus spatially with the D-pad", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <Grid />
      </Layer>,
    );
    connect(pad);
    screen.getByText("a").focus();

    tap(pad, RIGHT);
    expect(focused()).toBe("b");
    tap(pad, DOWN);
    expect(focused()).toBe("d");
    tap(pad, LEFT);
    expect(focused()).toBe("c");
    tap(pad, UP);
    expect(focused()).toBe("a");
  });

  it("moves focus with the left stick too", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <Grid />
      </Layer>,
    );
    connect(pad);
    screen.getByText("a").focus();

    pad.stick(0.9, 0);
    elapse();
    expect(focused()).toBe("b");
    pad.release();
    elapse();
    pad.stick(0, 0.9);
    elapse();
    expect(focused()).toBe("d");
  });

  it("ignores a stick inside the dead zone and honours the deadZone prop", () => {
    const pad = createMockPad();
    const { rerender } = render(
      <Layer>
        <Grid />
      </Layer>,
    );
    connect(pad);
    screen.getByText("a").focus();

    pad.stick(0.5, 0);
    elapse(100);
    expect(focused()).toBe("a");
    pad.stick(0.45, -0.3);
    elapse(100);
    expect(focused()).toBe("a");

    pad.stick(0.6, 0);
    elapse();
    expect(focused()).toBe("b");
    pad.release();
    elapse();

    rerender(
      <Layer deadZone={0.8}>
        <Grid />
      </Layer>,
    );
    screen.getByText("a").focus();
    pad.stick(0.6, 0);
    elapse(100);
    expect(focused()).toBe("a");
    pad.stick(0.85, 0);
    elapse();
    expect(focused()).toBe("b");
  });

  it("falls back to document order when no layout says what is nearby", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <button>one</button>
        <button>two</button>
        <button>three</button>
      </Layer>,
    );
    connect(pad);
    screen.getByText("one").focus();

    tap(pad, DOWN);
    expect(focused()).toBe("two");
    tap(pad, RIGHT);
    expect(focused()).toBe("three");
    tap(pad, DOWN);
    expect(focused()).toBe("three");
    tap(pad, UP);
    expect(focused()).toBe("two");
    tap(pad, LEFT);
    expect(focused()).toBe("one");
  });

  it("starts at the first control when nothing has focus", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <button>one</button>
        <button>two</button>
      </Layer>,
    );
    connect(pad);

    tap(pad, DOWN);
    expect(focused()).toBe("one");
  });

  it("skips disabled, hidden and tabindex=-1 elements", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <button>one</button>
        <button disabled>two</button>
        <button hidden>three</button>
        <div aria-hidden="true">
          <button>four</button>
        </div>
        <button tabIndex={-1}>five</button>
        <button>six</button>
      </Layer>,
    );
    connect(pad);
    screen.getByText("one").focus();

    tap(pad, DOWN);
    expect(focused()).toBe("six");
  });

  it("repeats a held direction after 400 ms and then every 120 ms", () => {
    const pad = createMockPad();
    const moves: number[] = [];
    render(
      <Layer>
        {Array.from({ length: 8 }, (_, index) => (
          <button
            key={index}
            ref={(node) => {
              if (node) {
                place(node, 0, index * 56);
              }
            }}
            onFocus={() => moves.push(Date.now())}
          >
            {index}
          </button>
        ))}
      </Layer>,
    );
    connect(pad);
    screen.getByText("0").focus();
    moves.length = 0;

    pad.press(DOWN);
    elapse(16 * 60);

    // One move on the press, then the first repeat 400 ms later, then one every 120 ms.
    expect(moves.length).toBeGreaterThanOrEqual(5);
    const gaps = moves.slice(1).map((time, index) => time - moves[index]!);
    expect(gaps[0]).toBeGreaterThanOrEqual(400);
    expect(gaps[0]).toBeLessThan(400 + 16);
    for (const gap of gaps.slice(1)) {
      expect(gap).toBeGreaterThanOrEqual(120);
      expect(gap).toBeLessThan(120 + 16);
    }
  });

  it("does not repeat before 400 ms have passed", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <Grid />
      </Layer>,
    );
    connect(pad);
    screen.getByText("a").focus();

    pad.press(RIGHT);
    elapse(16);
    expect(focused()).toBe("b");
    pad.press(LEFT);
    pad.buttons[RIGHT] = { pressed: false, touched: false, value: 0 };
    elapse(16);
    expect(focused()).toBe("a");
    pad.press(RIGHT);
    pad.buttons[LEFT] = { pressed: false, touched: false, value: 0 };
    elapse(16 * 20);
    // 20 frames is 320 ms: still just the one move from the press, no repeat yet.
    expect(focused()).toBe("b");
  });

  it("honours the repeat props", () => {
    const pad = createMockPad();
    const moves: number[] = [];
    render(
      <Layer initialRepeatDelay={100} repeatInterval={32}>
        {Array.from({ length: 10 }, (_, index) => (
          <button
            key={index}
            ref={(node) => {
              if (node) {
                place(node, 0, index * 56);
              }
            }}
            onFocus={() => moves.push(Date.now())}
          >
            {index}
          </button>
        ))}
      </Layer>,
    );
    connect(pad);
    screen.getByText("0").focus();
    moves.length = 0;

    pad.press(DOWN);
    elapse(16 * 12);
    const gaps = moves.slice(1).map((time, index) => time - moves[index]!);
    expect(gaps[0]).toBeGreaterThanOrEqual(100);
    expect(gaps[0]).toBeLessThan(116);
    expect(gaps[1]).toBeGreaterThanOrEqual(32);
    expect(gaps[1]).toBeLessThan(48);
  });
});

describe("GamepadNavigationProvider: activating", () => {
  it("clicks the focused button with A, once however long A is held", () => {
    const pad = createMockPad();
    const onClick = vi.fn();
    render(
      <Layer>
        <button onClick={onClick}>Save</button>
      </Layer>,
    );
    connect(pad);
    screen.getByText("Save").focus();

    pad.press(A);
    elapse(2000);
    expect(onClick).toHaveBeenCalledTimes(1);
    pad.release();
    elapse();
    tap(pad, A);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("toggles a checkbox and follows a link", () => {
    const pad = createMockPad();
    const onLink = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(
      <Layer>
        <input type="checkbox" aria-label="Remember me" />
        <a href="#next" onClick={onLink}>
          Next
        </a>
      </Layer>,
    );
    connect(pad);
    screen.getByLabelText("Remember me").focus();

    tap(pad, A);
    expect((screen.getByLabelText("Remember me") as HTMLInputElement).checked).toBe(true);
    screen.getByText("Next").focus();
    tap(pad, A);
    expect(onLink).toHaveBeenCalledTimes(1);
  });

  it("submits the form from a text field with A", () => {
    const pad = createMockPad();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <Layer>
        <form onSubmit={onSubmit}>
          <input aria-label="Username" />
          <button type="submit">Sign in</button>
        </form>
      </Layer>,
    );
    connect(pad);
    screen.getByLabelText("Username").focus();

    tap(pad, A);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("leaves a text field's own Enter handling alone when the page takes the key", () => {
    const pad = createMockPad();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onKeyDown = vi.fn((event: React.KeyboardEvent) => event.preventDefault());
    render(
      <Layer>
        <form onSubmit={onSubmit}>
          <input aria-label="Search" onKeyDown={onKeyDown} />
        </form>
      </Layer>,
    );
    connect(pad);
    screen.getByLabelText("Search").focus();

    tap(pad, A);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onKeyDown.mock.calls[0]![0].key).toBe("Enter");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("opens a Radix-style popup trigger through its Enter handler, not a click", () => {
    const pad = createMockPad();
    const onKeyDown = vi.fn((event: React.KeyboardEvent) => event.preventDefault());
    const onClick = vi.fn();
    render(
      <Layer>
        <button aria-haspopup="menu" onKeyDown={onKeyDown} onClick={onClick}>
          Menu
        </button>
      </Layer>,
    );
    connect(pad);
    screen.getByText("Menu").focus();

    tap(pad, A);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("clicks a popup trigger that ignores the key", () => {
    const pad = createMockPad();
    const onClick = vi.fn();
    render(
      <Layer>
        <button aria-haspopup="dialog" onClick={onClick}>
          Open
        </button>
      </Layer>,
    );
    connect(pad);
    screen.getByText("Open").focus();

    tap(pad, A);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does nothing on a textarea, which would only gain a newline", () => {
    const pad = createMockPad();
    const onKeyDown = vi.fn();
    render(
      <Layer>
        <textarea aria-label="Notes" onKeyDown={onKeyDown} />
      </Layer>,
    );
    connect(pad);
    screen.getByLabelText("Notes").focus();

    tap(pad, A);
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it("focuses the first control when A is pressed with nothing focused", () => {
    const pad = createMockPad();
    const onClick = vi.fn();
    render(
      <Layer>
        <button onClick={onClick}>one</button>
      </Layer>,
    );
    connect(pad);

    tap(pad, A);
    expect(focused()).toBe("one");
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("GamepadNavigationProvider: dispatched keys", () => {
  it("releases a dispatched key a moment after pressing it, like a tap", () => {
    const pad = createMockPad();
    const events: string[] = [];
    render(
      <Layer>
        <button
          onKeyDown={(event) => events.push(`down:${event.key}`)}
          onKeyUp={(event) => events.push(`up:${event.key}`)}
        >
          Field
        </button>
      </Layer>,
    );
    connect(pad);
    screen.getByText("Field").focus();

    pad.press(B);
    elapse(16);
    expect(events).toEqual(["down:Escape"]);
    elapse(64);
    expect(events).toEqual(["down:Escape", "up:Escape"]);
  });

  it("sends the pending keyup straight away when the layer is torn down", () => {
    const pad = createMockPad();
    const events: string[] = [];
    const { unmount } = render(
      <Layer>
        <button>Field</button>
      </Layer>,
    );
    document.addEventListener("keyup", (event) => events.push(event.key));
    connect(pad);
    screen.getByText("Field").focus();

    pad.press(B);
    elapse(16);
    expect(events).toEqual([]);
    unmount();
    expect(events).toEqual(["Escape"]);
  });

  it("survives a browser that throws from getGamepads", () => {
    getGamepads.mockImplementation(() => {
      throw new DOMException("Gamepad access is not allowed", "SecurityError");
    });
    expect(() => render(<Layer />)).not.toThrow();
    elapse(100);
  });
});

describe("GamepadNavigationProvider: B", () => {
  it("dispatches a real Escape keydown on the focused element", () => {
    const pad = createMockPad();
    const onKeyDown = vi.fn();
    render(
      <Layer>
        <button onKeyDown={onKeyDown}>Field</button>
      </Layer>,
    );
    connect(pad);
    screen.getByText("Field").focus();

    tap(pad, B);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    const event = onKeyDown.mock.calls[0]![0] as React.KeyboardEvent;
    expect(event.key).toBe("Escape");
    expect(event.code).toBe("Escape");
  });

  it("closes a Radix Dialog", async () => {
    const pad = createMockPad();
    const onOpenChange = vi.fn();
    function Harness() {
      const [open, setOpen] = React.useState(true);
      return (
        <Dialog
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit invoice</DialogTitle>
            </DialogHeader>
            <button>Save</button>
          </DialogContent>
        </Dialog>
      );
    }
    render(
      <Layer>
        <Harness />
      </Layer>,
    );
    await settle();
    connect(pad);
    expect(screen.getByRole("dialog")).toBeTruthy();

    tap(pad, B);
    await settle();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reports whether anything responded", () => {
    function Probe() {
      const { lastAction } = useGamepadNavigation();
      return <output>{lastAction ? `${lastAction.action}:${lastAction.handled}` : "none"}</output>;
    }
    const pad = createMockPad();
    render(
      <Layer>
        <button>Field</button>
        <Probe />
      </Layer>,
    );
    connect(pad);
    screen.getByText("Field").focus();

    tap(pad, B);
    expect(screen.getByRole("status").textContent).toBe("cancel:false");
  });
});

describe("GamepadNavigationProvider: composite widgets", () => {
  function TabsDemo() {
    return (
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
          <TabsTrigger value="three">Three</TabsTrigger>
        </TabsList>
        <TabsContent value="one">
          <button>Inside one</button>
        </TabsContent>
        <TabsContent value="two">
          <button>Inside two</button>
        </TabsContent>
        <TabsContent value="three">
          <button>Inside three</button>
        </TabsContent>
      </Tabs>
    );
  }
  const selected = () => screen.getByRole("tab", { selected: true }).textContent;

  it("switches to the next and previous tab with RB and LB, wrapping at the ends", async () => {
    const pad = createMockPad();
    render(
      <Layer>
        <TabsDemo />
      </Layer>,
    );
    connect(pad);
    screen.getByText("Inside one").focus();
    expect(selected()).toBe("One");

    tap(pad, RB);
    await settle();
    expect(selected()).toBe("Two");
    expect(focused()).toBe("Two");

    tap(pad, RB);
    await settle();
    expect(selected()).toBe("Three");

    tap(pad, RB);
    await settle();
    expect(selected()).toBe("One");

    tap(pad, LB);
    await settle();
    expect(selected()).toBe("Three");
    tap(pad, LB);
    await settle();
    expect(selected()).toBe("Two");
  });

  it("selects hand-rolled tabs, which react to a click and not to focus", async () => {
    function HandRolled() {
      const [value, setValue] = React.useState("a");
      return (
        <div role="tablist">
          {["a", "b", "c"].map((id) => (
            <button key={id} role="tab" aria-selected={value === id} onClick={() => setValue(id)}>
              {id}
            </button>
          ))}
        </div>
      );
    }
    const pad = createMockPad();
    render(
      <Layer>
        <HandRolled />
      </Layer>,
    );
    connect(pad);
    screen.getByRole("tab", { name: "a" }).focus();

    tap(pad, RB);
    await settle();
    expect(selected()).toBe("b");
    tap(pad, LB);
    await settle();
    expect(selected()).toBe("a");
  });

  it("selects Radix tabs in manual activation mode, which wait for Enter", async () => {
    const pad = createMockPad();
    render(
      <Layer>
        <RadixTabs.Root defaultValue="a" activationMode="manual">
          <RadixTabs.List>
            <RadixTabs.Trigger value="a">a</RadixTabs.Trigger>
            <RadixTabs.Trigger value="b">b</RadixTabs.Trigger>
          </RadixTabs.List>
          <RadixTabs.Content value="a">panel a</RadixTabs.Content>
          <RadixTabs.Content value="b">panel b</RadixTabs.Content>
        </RadixTabs.Root>
      </Layer>,
    );
    connect(pad);
    screen.getByRole("tab", { name: "a" }).focus();

    tap(pad, RB);
    await settle();
    expect(selected()).toBe("b");
    expect(screen.getByText("panel b")).toBeTruthy();
  });

  it("does nothing on LB and RB when the page has no tabs", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <button>Alone</button>
      </Layer>,
    );
    connect(pad);
    screen.getByText("Alone").focus();

    tap(pad, RB);
    tap(pad, LB);
    expect(focused()).toBe("Alone");
  });

  it("sends the horizontal D-pad directions to a focused tab as arrow keys", async () => {
    const pad = createMockPad();
    const keys: string[] = [];
    render(
      <Layer>
        <TabsDemo />
      </Layer>,
    );
    document.addEventListener("keydown", (event) => keys.push(event.key));
    connect(pad);
    screen.getByRole("tab", { name: "One" }).focus();

    tap(pad, RIGHT);
    await settle();
    expect(keys).toContain("ArrowRight");
    expect(focused()).toBe("Two");
    expect(selected()).toBe("Two");

    tap(pad, LEFT);
    await settle();
    expect(keys).toContain("ArrowLeft");
    expect(focused()).toBe("One");
  });

  it("moves focus out of a horizontal tablist on the vertical directions", async () => {
    const pad = createMockPad();
    const keys: string[] = [];
    render(
      <Layer>
        <TabsDemo />
      </Layer>,
    );
    document.addEventListener("keydown", (event) => keys.push(event.key));
    connect(pad);
    const [one] = screen.getAllByRole("tab");
    place(one!, 0, 0);
    place(screen.getByText("Inside one"), 0, 56);
    one!.focus();

    tap(pad, DOWN);
    await settle();
    expect(keys).not.toContain("ArrowDown");
    expect(focused()).toBe("Inside one");
  });

  it("moves between and selects radios in a RadioGroup whose layout is not known", async () => {
    const pad = createMockPad();
    const onValueChange = vi.fn();
    render(
      <Layer>
        <RadioGroup defaultValue="a" onValueChange={onValueChange} aria-label="Plan">
          <RadioGroupItem value="a" aria-label="Alpha" />
          <RadioGroupItem value="b" aria-label="Beta" />
          <RadioGroupItem value="c" aria-label="Gamma" />
        </RadioGroup>
      </Layer>,
    );
    connect(pad);
    screen.getByRole("radio", { name: "Alpha" }).focus();

    tap(pad, DOWN);
    await settle();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Beta" }));
    expect(onValueChange).toHaveBeenLastCalledWith("b");

    tap(pad, RIGHT);
    await settle();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Gamma" }));
    expect(onValueChange).toHaveBeenLastCalledWith("c");

    tap(pad, UP);
    await settle();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Beta" }));
  });

  it("sends up and down to a focused table row, whose arrows move between rows", () => {
    const pad = createMockPad();
    const keys: string[] = [];
    render(
      <Layer>
        <table>
          <tbody>
            <tr tabIndex={0} onKeyDown={(event) => keys.push(event.key)}>
              <td>first</td>
            </tr>
            <tr tabIndex={-1} onKeyDown={(event) => keys.push(event.key)}>
              <td>second</td>
            </tr>
          </tbody>
        </table>
      </Layer>,
    );
    connect(pad);
    (screen.getByText("first").closest("tr") as HTMLElement).focus();

    tap(pad, DOWN);
    tap(pad, UP);
    expect(keys).toEqual(["ArrowDown", "ArrowUp"]);
  });

  it("steps native radios, selects and ranges, which ignore dispatched arrow keys", () => {
    const pad = createMockPad();
    const onSelect = vi.fn();
    const onRange = vi.fn();
    render(
      <Layer>
        <input type="radio" name="size" aria-label="Small" defaultChecked />
        <input type="radio" name="size" aria-label="Large" />
        <select aria-label="Colour" onChange={(event) => onSelect(event.target.value)}>
          <option value="red">red</option>
          <option value="green">green</option>
          <option value="blue">blue</option>
        </select>
        <input
          type="range"
          aria-label="Volume"
          min={0}
          max={10}
          defaultValue={5}
          onChange={(event) => onRange(event.target.value)}
        />
      </Layer>,
    );
    connect(pad);

    screen.getByLabelText("Small").focus();
    tap(pad, DOWN);
    expect(document.activeElement).toBe(screen.getByLabelText("Large"));
    expect((screen.getByLabelText("Large") as HTMLInputElement).checked).toBe(true);

    // Left and right change a select; up and down are left to move on (see the leaving tests).
    screen.getByLabelText("Colour").focus();
    tap(pad, RIGHT);
    expect(onSelect).toHaveBeenLastCalledWith("green");
    tap(pad, LEFT);
    expect(onSelect).toHaveBeenLastCalledWith("red");
    // Stops at the end rather than wrapping.
    tap(pad, LEFT);
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(screen.getByLabelText("Colour"));

    screen.getByLabelText("Volume").focus();
    tap(pad, RIGHT);
    expect(onRange).toHaveBeenLastCalledWith("6");
    tap(pad, LEFT);
    tap(pad, LEFT);
    expect(onRange).toHaveBeenLastCalledWith("4");
  });
});

/**
 * A pad has no Tab key, so a widget that swallowed a direction for good would be somewhere you can
 * never leave. These tests go widget by widget and check that a person can both use it and get out.
 * The table of who keeps which direction is on `compositeDirections`.
 */
describe("GamepadNavigationProvider: leaving widgets", () => {
  describe("radio groups", () => {
    function Group({ orientation }: { orientation?: "horizontal" | "vertical" }) {
      return (
        <>
          <button>before</button>
          <RadioGroup defaultValue="b" aria-label="Plan" orientation={orientation}>
            <RadioGroupItem value="a" aria-label="Alpha" />
            <RadioGroupItem value="b" aria-label="Beta" />
            <RadioGroupItem value="c" aria-label="Gamma" />
          </RadioGroup>
          <button>after</button>
        </>
      );
    }
    const radio = (name: string) => screen.getByRole("radio", { name });
    const checked = () => screen.getByRole("radio", { checked: true }).getAttribute("aria-label");
    const isRadio = () => document.activeElement?.getAttribute("role") === "radio";

    it("steps along a row with left and right, and lets up and down leave from the middle", async () => {
      const pad = createMockPad();
      render(
        <Layer>
          <Group />
        </Layer>,
      );
      connect(pad);
      lineUp(screen.getAllByRole("radio"), "row");
      place(screen.getByText("before"), 0, -56);
      place(screen.getByText("after"), 0, 56);

      radio("Beta").focus();
      tap(pad, RIGHT);
      await settle();
      expect(document.activeElement).toBe(radio("Gamma"));
      expect(checked()).toBe("Gamma");

      radio("Beta").focus();
      tap(pad, DOWN);
      await settle();
      expect(focused()).toBe("after");

      radio("Beta").focus();
      tap(pad, UP);
      await settle();
      expect(focused()).toBe("before");
    });

    it("steps down a column with up and down, and lets left and right leave from the middle", async () => {
      const pad = createMockPad();
      render(
        <Layer>
          <Group />
        </Layer>,
      );
      connect(pad);
      lineUp(screen.getAllByRole("radio"), "column", 0, 0);
      place(screen.getByText("before"), 0, -56);
      place(screen.getByText("after"), 0, 120);

      radio("Beta").focus();
      tap(pad, DOWN);
      await settle();
      expect(document.activeElement).toBe(radio("Gamma"));

      radio("Beta").focus();
      tap(pad, RIGHT);
      await settle();
      expect(isRadio()).toBe(false);
      radio("Beta").focus();
      tap(pad, LEFT);
      await settle();
      expect(isRadio()).toBe(false);
    });

    it("moves on past the last radio and before the first instead of wrapping round", async () => {
      const pad = createMockPad();
      render(
        <Layer>
          <Group />
        </Layer>,
      );
      connect(pad);
      lineUp(screen.getAllByRole("radio"), "column", 0, 0);
      place(screen.getByText("before"), 0, -56);
      place(screen.getByText("after"), 0, 120);

      radio("Gamma").focus();
      tap(pad, DOWN);
      await settle();
      expect(focused()).toBe("after");
      // The value is whatever the last step chose; nothing wrapped round to the first radio.
      expect(checked()).toBe("Beta");

      radio("Alpha").focus();
      tap(pad, UP);
      await settle();
      expect(focused()).toBe("before");
    });

    it("trusts the orientation a group declares over its layout", async () => {
      const pad = createMockPad();
      render(
        <Layer>
          <Group orientation="vertical" />
        </Layer>,
      );
      connect(pad);
      // Laid out as a row, but declared vertical: up and down step, left and right leave.
      lineUp(screen.getAllByRole("radio"), "row");

      radio("Beta").focus();
      tap(pad, RIGHT);
      await settle();
      expect(isRadio()).toBe(false);

      radio("Beta").focus();
      tap(pad, DOWN);
      await settle();
      expect(document.activeElement).toBe(radio("Gamma"));
    });

    it("offers a group of unknown layout every direction until its first or last radio", async () => {
      const pad = createMockPad();
      render(
        <Layer>
          <Group />
        </Layer>,
      );
      connect(pad);

      radio("Alpha").focus();
      tap(pad, UP);
      await settle();
      expect(focused()).toBe("before");

      radio("Gamma").focus();
      tap(pad, LEFT);
      await settle();
      expect(document.activeElement).toBe(radio("Beta"));

      radio("Gamma").focus();
      tap(pad, RIGHT);
      await settle();
      expect(focused()).toBe("after");
      radio("Gamma").focus();
      tap(pad, DOWN);
      await settle();
      expect(focused()).toBe("after");
    });

    it("lets any direction leave a group with a single radio", async () => {
      const pad = createMockPad();
      render(
        <Layer>
          <button>before</button>
          <RadioGroup defaultValue="a" aria-label="Opt in">
            <RadioGroupItem value="a" aria-label="Yes" />
          </RadioGroup>
          <button>after</button>
        </Layer>,
      );
      connect(pad);

      for (const [direction, expected] of [
        [DOWN, "after"],
        [RIGHT, "after"],
        [UP, "before"],
        [LEFT, "before"],
      ] as const) {
        screen.getByRole("radio").focus();
        tap(pad, direction);
        await settle();
        expect(focused(), String(direction)).toBe(expected);
      }
    });
  });

  describe("sliders", () => {
    const thumb = () => screen.getByRole("slider");
    const value = () => thumb().getAttribute("aria-valuenow");

    it("changes with left and right, and lets up and down leave", async () => {
      const pad = createMockPad();
      render(
        <Layer>
          <button>before</button>
          <Slider aria-label="Seats" defaultValue={[5]} max={20} step={1} />
          <button>after</button>
        </Layer>,
      );
      connect(pad);

      thumb().focus();
      tap(pad, RIGHT);
      await settle();
      expect(value()).toBe("6");
      tap(pad, LEFT);
      tap(pad, LEFT);
      await settle();
      expect(value()).toBe("4");

      tap(pad, DOWN);
      await settle();
      expect(focused()).toBe("after");
      expect(value()).toBe("4");

      thumb().focus();
      tap(pad, UP);
      await settle();
      expect(focused()).toBe("before");
      expect(value()).toBe("4");
    });

    it("changes a vertical slider with up and down, and lets left and right leave", async () => {
      const pad = createMockPad();
      render(
        <Layer>
          <button>before</button>
          <Slider aria-label="Level" defaultValue={[5]} max={20} step={1} orientation="vertical" />
          <button>after</button>
        </Layer>,
      );
      connect(pad);

      thumb().focus();
      tap(pad, UP);
      await settle();
      expect(value()).toBe("6");
      tap(pad, DOWN);
      tap(pad, DOWN);
      await settle();
      expect(value()).toBe("4");

      tap(pad, RIGHT);
      await settle();
      expect(focused()).toBe("after");
      thumb().focus();
      tap(pad, LEFT);
      await settle();
      expect(focused()).toBe("before");
      expect(value()).toBe("4");
    });

    it("stops at the end of the track rather than leaving, since up and down are free", async () => {
      const pad = createMockPad();
      render(
        <Layer>
          <Slider aria-label="Seats" defaultValue={[19]} max={20} step={1} />
          <button>after</button>
        </Layer>,
      );
      connect(pad);

      thumb().focus();
      tap(pad, RIGHT);
      tap(pad, RIGHT);
      tap(pad, RIGHT);
      await settle();
      expect(value()).toBe("20");
      expect(document.activeElement).toBe(thumb());
    });
  });

  describe("finding a slider", () => {
    it("takes the slider's track for its place, so Down from above reaches it before the field beneath", () => {
      const pad = createMockPad();
      render(
        <Layer>
          <button>before</button>
          <Slider aria-label="Seats" defaultValue={[5]} max={20} step={1} />
          <input aria-label="Wide field" />
        </Layer>,
      );
      connect(pad);
      const thumb = screen.getByRole("slider");
      const track = thumb.parentElement!.closest("[data-orientation]") as HTMLElement;
      place(screen.getByText("before"), 0, 0, 60, 40);
      place(track, 0, 56, 400, 16);
      // The thumb is a small box a quarter of the way along, well off to the side of the button.
      place(thumb, 100, 56, 16, 16);
      place(screen.getByLabelText("Wide field"), 0, 80, 400, 40);

      screen.getByText("before").focus();
      tap(pad, DOWN);
      expect(document.activeElement).toBe(thumb);
    });
  });

  describe("native controls", () => {
    it("changes a select with left and right, and lets up and down move on without touching it", () => {
      const pad = createMockPad();
      const onChange = vi.fn();
      render(
        <Layer>
          <button>before</button>
          <select aria-label="Colour" onChange={(event) => onChange(event.target.value)}>
            <option value="red">red</option>
            <option value="green">green</option>
            <option value="blue">blue</option>
          </select>
          <button>after</button>
        </Layer>,
      );
      connect(pad);
      const select = screen.getByLabelText("Colour") as HTMLSelectElement;

      select.focus();
      tap(pad, DOWN);
      expect(focused()).toBe("after");
      select.focus();
      tap(pad, UP);
      expect(focused()).toBe("before");
      expect(onChange).not.toHaveBeenCalled();

      select.focus();
      tap(pad, RIGHT);
      tap(pad, RIGHT);
      tap(pad, RIGHT);
      expect(select.value).toBe("blue");
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(document.activeElement).toBe(select);
    });

    it("skips the disabled options of a select", () => {
      const pad = createMockPad();
      render(
        <Layer>
          <select aria-label="Colour">
            <option value="red">red</option>
            <option value="green" disabled>
              green
            </option>
            <optgroup label="Dark" disabled>
              <option value="navy">navy</option>
            </optgroup>
            <option value="blue">blue</option>
          </select>
        </Layer>,
      );
      connect(pad);
      const select = screen.getByLabelText("Colour") as HTMLSelectElement;

      select.focus();
      tap(pad, RIGHT);
      expect(select.value).toBe("blue");
      tap(pad, LEFT);
      expect(select.value).toBe("red");
    });

    it("changes a range with left and right, and lets up and down leave", () => {
      const pad = createMockPad();
      const onChange = vi.fn();
      render(
        <Layer>
          <button>before</button>
          <input
            type="range"
            aria-label="Volume"
            min={0}
            max={10}
            defaultValue={5}
            onChange={(event) => onChange(event.target.value)}
          />
          <button>after</button>
        </Layer>,
      );
      connect(pad);
      const range = screen.getByLabelText("Volume") as HTMLInputElement;

      range.focus();
      tap(pad, RIGHT);
      expect(onChange).toHaveBeenLastCalledWith("6");
      tap(pad, DOWN);
      expect(focused()).toBe("after");
      range.focus();
      tap(pad, UP);
      expect(focused()).toBe("before");
      expect(range.value).toBe("6");
    });

    it("stops a range at its ends without announcing a change that did not happen", () => {
      const pad = createMockPad();
      const onChange = vi.fn();
      render(
        <Layer>
          <input
            type="range"
            aria-label="Volume"
            min={0}
            max={10}
            defaultValue={10}
            onChange={() => onChange()}
          />
        </Layer>,
      );
      connect(pad);

      screen.getByLabelText("Volume").focus();
      tap(pad, RIGHT);
      expect(onChange).not.toHaveBeenCalled();
      expect((screen.getByLabelText("Volume") as HTMLInputElement).value).toBe("10");
    });

    it("moves a range with step=any by a hundredth of its span instead of throwing", () => {
      const pad = createMockPad();
      const onChange = vi.fn();
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      render(
        <Layer>
          <input
            type="range"
            step="any"
            aria-label="Opacity"
            min={0}
            max={10}
            defaultValue={5}
            onChange={(event) => onChange(event.target.value)}
          />
          <button>after</button>
        </Layer>,
      );
      connect(pad);

      screen.getByLabelText("Opacity").focus();
      tap(pad, RIGHT);
      expect(onChange).toHaveBeenLastCalledWith("5.1");
      tap(pad, LEFT);
      tap(pad, LEFT);
      expect(onChange).toHaveBeenLastCalledWith("4.9");
      // The pad is still alive afterwards.
      tap(pad, DOWN);
      expect(focused()).toBe("after");
      expect(errors).not.toHaveBeenCalled();
    });

    it("steps native radios along a row and lets the other axis leave", () => {
      const pad = createMockPad();
      render(
        <Layer>
          <button>before</button>
          <input type="radio" name="size" aria-label="Small" />
          <input type="radio" name="size" aria-label="Medium" defaultChecked />
          <input type="radio" name="size" aria-label="Large" />
          <button>after</button>
        </Layer>,
      );
      connect(pad);
      const radios = ["Small", "Medium", "Large"].map((name) => screen.getByLabelText(name));
      lineUp(radios, "row");
      place(screen.getByText("before"), 0, -56);
      place(screen.getByText("after"), 0, 56);

      radios[1]!.focus();
      tap(pad, RIGHT);
      expect(document.activeElement).toBe(radios[2]);
      expect((radios[2] as HTMLInputElement).checked).toBe(true);
      // Past the last radio the pad moves on; it does not wrap round to the first.
      tap(pad, RIGHT);
      expect(focused()).toBe("after");
      expect((radios[0] as HTMLInputElement).checked).toBe(false);

      radios[1]!.focus();
      tap(pad, DOWN);
      expect(focused()).toBe("after");
      radios[1]!.focus();
      tap(pad, UP);
      expect(focused()).toBe("before");
    });

    it("steps native radios down a column and lets the other axis leave", () => {
      const pad = createMockPad();
      render(
        <Layer>
          <button>before</button>
          <input type="radio" name="size" aria-label="Small" />
          <input type="radio" name="size" aria-label="Medium" defaultChecked />
          <input type="radio" name="size" aria-label="Large" />
          <button>after</button>
        </Layer>,
      );
      connect(pad);
      const radios = ["Small", "Medium", "Large"].map((name) => screen.getByLabelText(name));
      lineUp(radios, "column");
      place(screen.getByText("before"), 0, -56);
      place(screen.getByText("after"), 0, 120);

      radios[1]!.focus();
      tap(pad, DOWN);
      expect(document.activeElement).toBe(radios[2]);
      tap(pad, DOWN);
      expect(focused()).toBe("after");

      radios[1]!.focus();
      tap(pad, LEFT);
      expect(document.activeElement?.localName).toBe("button");
    });

    it("reaches a native radio group once, at its checked radio", () => {
      const pad = createMockPad();
      render(
        <Layer>
          <button>before</button>
          <input type="radio" name="size" aria-label="Small" />
          <input type="radio" name="size" aria-label="Medium" defaultChecked />
          <input type="radio" name="size" aria-label="Large" />
          <button>after</button>
        </Layer>,
      );
      connect(pad);
      const radios = ["Small", "Medium", "Large"].map((name) => screen.getByLabelText(name));
      lineUp(radios, "column", 0, 56);
      place(screen.getByText("before"), 0, 0);
      place(screen.getByText("after"), 0, 200);

      screen.getByText("before").focus();
      tap(pad, DOWN);
      expect(document.activeElement).toBe(radios[1]);
    });

    it("treats an unnamed radio as a group of its own", () => {
      const pad = createMockPad();
      render(
        <Layer>
          <input type="radio" aria-label="One" />
          <input type="radio" aria-label="Two" />
        </Layer>,
      );
      connect(pad);

      screen.getByLabelText("One").focus();
      tap(pad, RIGHT);
      expect(document.activeElement).toBe(screen.getByLabelText("Two"));
      expect((screen.getByLabelText("One") as HTMLInputElement).checked).toBe(false);
      expect((screen.getByLabelText("Two") as HTMLInputElement).checked).toBe(false);
    });
  });

  describe("grids, trees and treegrids", () => {
    /**
     * A widget that takes ArrowUp and ArrowDown when there is a neighbour that way, and nothing else:
     * no key it does not use is prevented, which is what a well-behaved ARIA widget does.
     */
    function Roving({ role, itemRole }: { role: string; itemRole: string }) {
      const [active, setActive] = React.useState(0);
      const items = React.useRef<Array<HTMLElement | null>>([]);
      return (
        <>
          <button>before</button>
          <div role={role} aria-label="Widget">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                role={itemRole}
                tabIndex={index === active ? 0 : -1}
                ref={(node) => {
                  items.current[index] = node;
                }}
                onFocus={() => setActive(index)}
                onKeyDown={(event) => {
                  const next =
                    event.key === "ArrowDown"
                      ? index + 1
                      : event.key === "ArrowUp"
                        ? index - 1
                        : -1;
                  if (items.current[next]) {
                    event.preventDefault();
                    items.current[next]!.focus();
                  }
                }}
              >
                item {index}
              </div>
            ))}
          </div>
          <button>after</button>
        </>
      );
    }

    it.each([
      ["grid", "gridcell"],
      ["treegrid", "gridcell"],
      ["tree", "treeitem"],
    ])("moves inside a %s and leaves it where the widget does not move", (role, itemRole) => {
      const pad = createMockPad();
      const keys: string[] = [];
      render(
        <Layer>
          <Roving role={role} itemRole={itemRole} />
        </Layer>,
      );
      document.addEventListener("keydown", (event) => keys.push(event.key));
      connect(pad);
      const item = (index: number) => screen.getByText(`item ${index}`);

      item(0).focus();
      tap(pad, DOWN);
      expect(document.activeElement).toBe(item(1));
      expect(keys).toContain("ArrowDown");

      // The widget ignores left and right: they must not be swallowed.
      tap(pad, RIGHT);
      expect(focused()).toBe("after");
      item(1).focus();
      tap(pad, LEFT);
      expect(document.activeElement?.textContent).not.toMatch(/^item/);

      // And it does nothing for down on its last item, or up on its first: those leave too.
      item(2).focus();
      tap(pad, DOWN);
      expect(focused()).toBe("after");
      item(0).focus();
      tap(pad, UP);
      expect(focused()).toBe("before");
    });

    it("lets B step out of a calendar that takes every arrow key for ever", () => {
      const pad = createMockPad();
      const onKeyDown = vi.fn((event: React.KeyboardEvent) => {
        if (event.key.startsWith("Arrow")) {
          event.preventDefault();
        }
      });
      render(
        <Layer>
          <button>before</button>
          <div role="grid" aria-label="Month">
            <div role="gridcell" tabIndex={0} onKeyDown={onKeyDown}>
              today
            </div>
          </div>
          <button>after</button>
        </Layer>,
      );
      connect(pad);

      screen.getByText("today").focus();
      for (const direction of [UP, DOWN, LEFT, RIGHT]) {
        tap(pad, direction);
        expect(focused()).toBe("today");
      }

      tap(pad, B);
      expect(focused()).toBe("before");
    });

    it("steps out of a grid to the control after it when nothing comes before it", () => {
      const pad = createMockPad();
      render(
        <Layer>
          <div role="grid" aria-label="Month">
            <div role="gridcell" tabIndex={0}>
              today
            </div>
          </div>
          <button>after</button>
        </Layer>,
      );
      connect(pad);

      screen.getByText("today").focus();
      tap(pad, B);
      expect(focused()).toBe("after");
    });

    it("leaves a grid inside a tree together with the tree", () => {
      const pad = createMockPad();
      render(
        <Layer>
          <button>before</button>
          <div role="tree" aria-label="Files">
            <div role="treeitem" tabIndex={-1}>
              folder
            </div>
            <div role="grid" aria-label="Details">
              <div role="gridcell" tabIndex={0}>
                detail
              </div>
            </div>
          </div>
          <button>after</button>
        </Layer>,
      );
      connect(pad);

      screen.getByText("detail").focus();
      tap(pad, B);
      expect(focused()).toBe("before");
    });

    it("keeps B for whatever handles Escape first", () => {
      const pad = createMockPad();
      const onEscape = vi.fn();
      render(
        <Layer>
          <button>before</button>
          <div role="grid" aria-label="Month">
            <div
              role="gridcell"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onEscape();
                }
              }}
            >
              today
            </div>
          </div>
        </Layer>,
      );
      connect(pad);

      screen.getByText("today").focus();
      tap(pad, B);
      expect(onEscape).toHaveBeenCalledTimes(1);
      expect(focused()).toBe("today");
    });

    it("does not steer B anywhere outside a grid or tree", () => {
      const pad = createMockPad();
      render(
        <Layer>
          <button>before</button>
          <button>here</button>
        </Layer>,
      );
      connect(pad);

      screen.getByText("here").focus();
      tap(pad, B);
      expect(focused()).toBe("here");
    });
  });

  describe("table rows", () => {
    it("keeps up and down for the rows and lets left and right leave", () => {
      const pad = createMockPad();
      const keys: string[] = [];
      render(
        <Layer>
          <table>
            <tbody>
              <tr tabIndex={0} onKeyDown={(event) => keys.push(event.key)}>
                <td>first</td>
              </tr>
              <tr tabIndex={-1} onKeyDown={(event) => keys.push(event.key)}>
                <td>second</td>
              </tr>
            </tbody>
          </table>
          <button>after</button>
        </Layer>,
      );
      connect(pad);

      (screen.getByText("first").closest("tr") as HTMLElement).focus();
      tap(pad, RIGHT);
      expect(keys).toEqual([]);
      expect(focused()).toBe("after");
    });
  });

  describe("window splitters", () => {
    function Split({ direction }: { direction: "horizontal" | "vertical" }) {
      return (
        <>
          <button>before</button>
          <ResizablePanelGroup direction={direction}>
            <ResizablePanel defaultSize={50}>a</ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50}>b</ResizablePanel>
          </ResizablePanelGroup>
          <button>after</button>
        </>
      );
    }
    const handle = () => screen.getByRole("separator");

    it("resizes side-by-side panels with left and right, and lets up and down leave", () => {
      const pad = createMockPad();
      const keys: string[] = [];
      render(
        <Layer>
          <Split direction="horizontal" />
        </Layer>,
      );
      document.addEventListener("keydown", (event) => keys.push(event.key));
      connect(pad);
      expect(handle().getAttribute("data-panel-group-direction")).toBe("horizontal");

      // jsdom has no layout, so the panels themselves cannot be seen to move here; the arrow key
      // reaching the handle is what the pad is responsible for.
      handle().focus();
      tap(pad, RIGHT);
      expect(keys).toEqual(["ArrowRight"]);
      expect(document.activeElement).toBe(handle());

      keys.length = 0;
      tap(pad, DOWN);
      expect(keys).toEqual([]);
      expect(focused()).toBe("after");
      handle().focus();
      tap(pad, UP);
      expect(focused()).toBe("before");
    });

    it("resizes stacked panels with up and down, and lets left and right leave", () => {
      const pad = createMockPad();
      const keys: string[] = [];
      render(
        <Layer>
          <Split direction="vertical" />
        </Layer>,
      );
      document.addEventListener("keydown", (event) => keys.push(event.key));
      connect(pad);
      expect(handle().getAttribute("data-panel-group-direction")).toBe("vertical");

      handle().focus();
      tap(pad, DOWN);
      expect(keys).toEqual(["ArrowDown"]);
      expect(document.activeElement).toBe(handle());

      keys.length = 0;
      tap(pad, RIGHT);
      expect(keys).toEqual([]);
      expect(focused()).toBe("after");
    });

    it("prefers a separator's own aria-orientation to the direction of the panels", () => {
      const pad = createMockPad();
      const keys: string[] = [];
      render(
        <Layer>
          <div
            role="separator"
            tabIndex={0}
            aria-orientation="horizontal"
            data-panel-group-direction="horizontal"
          />
        </Layer>,
      );
      document.addEventListener("keydown", (event) => keys.push(event.key));
      connect(pad);

      screen.getByRole("separator").focus();
      tap(pad, UP);
      expect(keys).toEqual(["ArrowUp"]);
    });
  });
});

describe("GamepadNavigationProvider: modal layers", () => {
  it("keeps focus inside an open dialog", async () => {
    const pad = createMockPad();
    render(
      <Layer>
        <button>Behind one</button>
        <button>Behind two</button>
        <Dialog open>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm</DialogTitle>
            </DialogHeader>
            <button>First inside</button>
            <button>Second inside</button>
          </DialogContent>
        </Dialog>
      </Layer>,
    );
    await settle();
    connect(pad);
    const dialog = screen.getByRole("dialog");
    place(screen.getByText("Behind one"), 0, 300);
    place(screen.getByText("Behind two"), 0, 356);
    place(screen.getByText("First inside"), 0, 0);
    place(screen.getByText("Second inside"), 0, 56);
    screen.getByText("First inside").focus();

    for (const direction of [DOWN, DOWN, DOWN, UP, UP, UP]) {
      tap(pad, direction);
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it("goes back to the page once the dialog is gone", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <button>Page one</button>
        <button>Page two</button>
      </Layer>,
    );
    connect(pad);
    screen.getByText("Page one").focus();
    tap(pad, DOWN);
    expect(focused()).toBe("Page two");
  });
});

describe("GamepadNavigationProvider: input modality and focus ring", () => {
  it("marks <html> and the focused element while the pad is in use", () => {
    const onModalityChange = vi.fn();
    const pad = createMockPad();
    render(
      <Layer onModalityChange={onModalityChange}>
        <Grid />
      </Layer>,
    );
    connect(pad);
    screen.getByText("a").focus();
    expect(html.hasAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe(false);

    tap(pad, RIGHT);

    expect(html.getAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe("gamepad");
    expect(onModalityChange).toHaveBeenCalledWith("gamepad");
    expect(screen.getByText("b").hasAttribute(GAMEPAD_FOCUS_ATTRIBUTE)).toBe(true);
    expect(document.querySelectorAll(`[${GAMEPAD_FOCUS_ATTRIBUTE}]`)).toHaveLength(1);
    for (const token of gamepadFocusRingClass.split(" ")) {
      expect(html.classList.contains(token), token).toBe(true);
    }

    tap(pad, DOWN);
    expect(screen.getByText("b").hasAttribute(GAMEPAD_FOCUS_ATTRIBUTE)).toBe(false);
    expect(screen.getByText("d").hasAttribute(GAMEPAD_FOCUS_ATTRIBUTE)).toBe(true);
  });

  it("hands the ring back when the keyboard or mouse is used", () => {
    const changes: InputModality[] = [];
    const pad = createMockPad();
    render(
      <Layer onModalityChange={(modality) => changes.push(modality)}>
        <Grid />
      </Layer>,
    );
    connect(pad);
    screen.getByText("a").focus();
    tap(pad, RIGHT);

    fireEvent.keyDown(document.body, { key: "Tab" });
    expect(html.getAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe("keyboard");
    expect(document.querySelector(`[${GAMEPAD_FOCUS_ATTRIBUTE}]`)).toBeNull();
    expect(html.classList.contains("[&_[data-gamepad-focus]]:outline-2!")).toBe(false);

    tap(pad, RIGHT);
    expect(html.getAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe("gamepad");

    fireEvent.pointerDown(document.body);
    expect(html.getAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe("pointer");
    expect(changes).toEqual(["gamepad", "keyboard", "gamepad", "pointer"]);
  });

  it("does not mistake the arrow keys it dispatches for the keyboard", async () => {
    const pad = createMockPad();
    render(
      <Layer>
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
          </TabsList>
        </Tabs>
      </Layer>,
    );
    connect(pad);
    screen.getByRole("tab", { name: "One" }).focus();

    tap(pad, RIGHT);
    await settle();
    expect(html.getAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe("gamepad");
  });

  it("falls back to keyboard when the last pad is unplugged mid-use", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <Grid />
      </Layer>,
    );
    connect(pad);
    screen.getByText("a").focus();
    tap(pad, RIGHT);
    expect(html.getAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe("gamepad");

    disconnect(pad);
    expect(html.getAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe("keyboard");
    expect(document.querySelector(`[${GAMEPAD_FOCUS_ATTRIBUTE}]`)).toBeNull();
  });

  it("leaves the ring classes off when ringClassName is empty", () => {
    const pad = createMockPad();
    render(
      <Layer ringClassName="">
        <Grid />
      </Layer>,
    );
    connect(pad);
    screen.getByText("a").focus();
    tap(pad, RIGHT);

    expect(html.className).not.toContain("data-gamepad-focus");
    expect(screen.getByText("b").hasAttribute(GAMEPAD_FOCUS_ATTRIBUTE)).toBe(true);
  });

  it("describes the last action for a readout", () => {
    function Probe() {
      const { lastAction } = useGamepadNavigation();
      return (
        <output>
          {lastAction ? `${lastAction.sequence}|${lastAction.action}|${lastAction.target}` : "-"}
        </output>
      );
    }
    const pad = createMockPad();
    render(
      <Layer>
        <Grid />
        <Probe />
      </Layer>,
    );
    connect(pad);
    screen.getByText("a").focus();

    tap(pad, RIGHT);
    expect(screen.getByRole("status").textContent).toBe('1|right|button "b"');
    // Nothing lies right of b, so document order takes over.
    tap(pad, RIGHT);
    expect(screen.getByRole("status").textContent).toBe('2|right|button "c"');
  });
});

describe("GamepadNavigationProvider: a stick near a diagonal", () => {
  it("moves once and waits out the repeat delay while the stick wobbles between two directions", () => {
    function Probe() {
      const { lastAction } = useGamepadNavigation();
      return <output>{lastAction ? `${lastAction.sequence}` : "-"}</output>;
    }
    const pad = createMockPad();
    render(
      <Layer>
        <Grid />
        <Probe />
      </Layer>,
    );
    connect(pad);
    screen.getByText("a").focus();

    // x and y trade the lead by a hundredth every frame, like a stick resting in a diagonal gate.
    for (let frame = 0; frame < 20; frame += 1) {
      pad.stick(frame % 2 === 0 ? 0.71 : 0.7, frame % 2 === 0 ? 0.7 : 0.71);
      elapse();
    }

    expect(screen.getByRole("status").textContent).toBe("1");
    expect(focused()).toBe("b");
  });

  it("still turns when the stick is pushed clearly towards the other axis", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <Grid />
      </Layer>,
    );
    connect(pad);
    screen.getByText("a").focus();

    pad.stick(0.9, 0.1);
    elapse();
    expect(focused()).toBe("b");
    pad.stick(0.1, 0.9);
    elapse();
    expect(focused()).toBe("d");
  });
});

describe("GamepadNavigationProvider: a failing action", () => {
  it("keeps polling after an action throws, and says what happened", () => {
    const pad = createMockPad();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Layer>
        <Grid />
      </Layer>,
    );
    connect(pad);
    screen.getByText("a").focus();

    const boom = new Error("focus failed");
    vi.spyOn(HTMLElement.prototype, "focus").mockImplementationOnce(() => {
      throw boom;
    });
    tap(pad, RIGHT);
    expect(errors).toHaveBeenCalledWith(expect.any(String), boom);
    expect(focused()).toBe("a");

    // The loop is still running: the next press goes through.
    tap(pad, RIGHT);
    expect(focused()).toBe("b");
  });

  it("does not let a throwing onModalityChange swallow the press that caused it", () => {
    const pad = createMockPad();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Layer
        onModalityChange={() => {
          throw new Error("listener failed");
        }}
      >
        <Grid />
      </Layer>,
    );
    connect(pad);
    screen.getByText("a").focus();

    tap(pad, RIGHT);
    expect(focused()).toBe("b");
    expect(errors).toHaveBeenCalledTimes(1);
    tap(pad, DOWN);
    expect(focused()).toBe("d");
  });
});

describe("GamepadNavigationProvider: more than one pad", () => {
  function Probe() {
    const { padId } = useGamepadNavigation();
    return <output>{String(padId)}</output>;
  }

  it("does not act on the button that woke a second pad while the first is in use", () => {
    const first = createMockPad("First pad", 0);
    const second = createMockPad("Second pad", 1);
    const onClick = vi.fn();
    render(
      <Layer>
        <button onClick={onClick}>Go</button>
        <Probe />
      </Layer>,
    );
    connect(first);
    screen.getByText("Go").focus();
    elapse(64);

    second.press(A);
    connectAlso(second);
    elapse(100);
    expect(onClick).not.toHaveBeenCalled();

    second.release();
    elapse();
    tap(second, A);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("leaves the first pad's own held direction repeating when a second one connects", () => {
    const first = createMockPad("First pad", 0);
    const second = createMockPad("Second pad", 1);
    const moves: number[] = [];
    render(
      <Layer>
        {Array.from({ length: 8 }, (_, index) => (
          <button
            key={index}
            ref={(node) => {
              if (node) {
                place(node, 0, index * 56);
              }
            }}
            onFocus={() => moves.push(Date.now())}
          >
            {index}
          </button>
        ))}
      </Layer>,
    );
    connect(first);
    screen.getByText("0").focus();
    first.press(DOWN);
    elapse(16 * 3);
    connectAlso(second);
    moves.length = 0;
    elapse(16 * 40);

    // Still repeating after the second pad arrived: the first pad's DOWN was not primed away.
    expect(moves.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps reporting the first pad until it goes, then the next", () => {
    const first = createMockPad("First pad", 0);
    const second = createMockPad("Second pad", 1);
    render(
      <Layer>
        <Probe />
      </Layer>,
    );
    connect(first);
    expect(screen.getByRole("status").textContent).toBe("First pad");

    connectAlso(second);
    expect(screen.getByRole("status").textContent).toBe("First pad");

    first.connected = false;
    pads = [second];
    act(() => {
      window.dispatchEvent(Object.assign(new Event("gamepaddisconnected"), { gamepad: first }));
    });
    expect(screen.getByRole("status").textContent).toBe("Second pad");
  });
});

describe("GamepadNavigationProvider: pads that are not standard", () => {
  const unmapped = (id = "Flight stick (Vendor: 0000 Product: 0000)", index = 0) =>
    Object.assign(createMockPad(id, index), { mapping: "" });

  function Probe() {
    const { connected, padId } = useGamepadNavigation();
    return <output>{`${connected}|${padId}`}</output>;
  }

  it("ignores a pad whose buttons do not follow the standard layout", () => {
    const stick = unmapped();
    const onClick = vi.fn();
    render(
      <Layer>
        <button onClick={onClick}>Go</button>
        <Grid />
        <Probe />
      </Layer>,
    );
    connect(stick);
    screen.getByText("Go").focus();

    // Its trigger is button 0, which on a standard pad is A; its axes are not a left stick either.
    tap(stick, A);
    tap(stick, DOWN);
    stick.stick(0.9, 0);
    elapse(100);

    expect(onClick).not.toHaveBeenCalled();
    expect(focused()).toBe("Go");
    expect(screen.getByRole("status").textContent).toBe("false|null");
    expect(html.hasAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe(false);
  });

  it("ignores one that was already awake when the layer was switched on", () => {
    const stick = unmapped();
    pads = [stick];
    const onClick = vi.fn();
    render(
      <Layer>
        <button onClick={onClick}>Go</button>
      </Layer>,
    );
    screen.getByText("Go").focus();

    tap(stick, A);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("reads it with the standard layout when allowNonStandardPads says to", () => {
    const stick = unmapped();
    const onClick = vi.fn();
    render(
      <Layer allowNonStandardPads>
        <button onClick={onClick}>Go</button>
        <Probe />
      </Layer>,
    );
    connect(stick);
    screen.getByText("Go").focus();

    tap(stick, A);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toBe(
      "true|Flight stick (Vendor: 0000 Product: 0000)",
    );
  });

  it("works with the standard pad plugged in beside an ignored one", () => {
    const stick = unmapped("Flight stick", 0);
    const pad = createMockPad("Real pad", 1);
    const onClick = vi.fn();
    render(
      <Layer>
        <button onClick={onClick}>Go</button>
        <Probe />
      </Layer>,
    );
    connect(stick);
    connectAlso(pad);
    screen.getByText("Go").focus();

    tap(stick, A);
    expect(onClick).not.toHaveBeenCalled();
    tap(pad, A);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toBe("true|Real pad");
  });

  it("ignores an xr-standard controller too", () => {
    const controller = Object.assign(createMockPad("XR controller"), { mapping: "xr-standard" });
    const onClick = vi.fn();
    render(
      <Layer>
        <button onClick={onClick}>Go</button>
      </Layer>,
    );
    connect(controller);
    screen.getByText("Go").focus();

    tap(controller, A);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("GamepadNavigationProvider: the device used last", () => {
  it("follows a person from the pad to the keyboard to the mouse and back", () => {
    const changes: InputModality[] = [];
    const pad = createMockPad();
    render(
      <Layer onModalityChange={(modality) => changes.push(modality)}>
        <Grid />
      </Layer>,
    );
    connect(pad);
    screen.getByText("a").focus();
    tap(pad, RIGHT);
    expect(html.getAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe("gamepad");

    fireEvent.keyDown(document.body, { key: "a" });
    expect(html.getAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe("keyboard");

    // The mouse after the keyboard, without going back through the pad first.
    fireEvent.pointerDown(document.body);
    expect(html.getAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe("pointer");

    fireEvent.keyDown(document.body, { key: "a" });
    expect(html.getAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe("keyboard");
    fireEvent.mouseDown(document.body);
    expect(html.getAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe("pointer");

    expect(changes).toEqual(["gamepad", "keyboard", "pointer", "keyboard", "pointer"]);
    expect(document.querySelector(`[${GAMEPAD_FOCUS_ATTRIBUTE}]`)).toBeNull();
  });

  it("takes the ring back when the pad is used after the mouse", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <Grid />
      </Layer>,
    );
    connect(pad);
    screen.getByText("a").focus();
    tap(pad, RIGHT);
    fireEvent.keyDown(document.body, { key: "a" });
    fireEvent.pointerDown(document.body);
    expect(html.classList.contains("[&_[data-gamepad-focus]]:outline-2!")).toBe(false);

    tap(pad, DOWN);
    expect(html.getAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe("gamepad");
    expect(html.classList.contains("[&_[data-gamepad-focus]]:outline-2!")).toBe(true);
    expect(screen.getByText("d").hasAttribute(GAMEPAD_FOCUS_ATTRIBUTE)).toBe(true);
  });

  it("reports the keyboard and the mouse from the moment a pad is seen, before the pad is used", () => {
    const changes: InputModality[] = [];
    const pad = createMockPad();
    render(
      <Layer onModalityChange={(modality) => changes.push(modality)}>
        <Grid />
      </Layer>,
    );
    connect(pad);

    fireEvent.pointerDown(document.body);
    expect(html.getAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe("pointer");
    expect(changes).toEqual(["pointer"]);
  });

  it("watches nothing until a pad has been seen", () => {
    const docAdd = vi.spyOn(document, "addEventListener");
    render(
      <Layer>
        <Grid />
      </Layer>,
    );

    fireEvent.keyDown(document.body, { key: "a" });
    fireEvent.pointerDown(document.body);
    expect(html.hasAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe(false);
    expect(
      docAdd.mock.calls.filter(([type]) =>
        ["keydown", "pointerdown", "mousedown"].includes(String(type)),
      ),
    ).toEqual([]);
  });

  it("still tells the keyboard from the pad's own dispatched keys once it watches the keyboard", async () => {
    const pad = createMockPad();
    const changes: InputModality[] = [];
    render(
      <Layer onModalityChange={(modality) => changes.push(modality)}>
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
          </TabsList>
        </Tabs>
      </Layer>,
    );
    connect(pad);
    screen.getByRole("tab", { name: "One" }).focus();

    tap(pad, RIGHT);
    await settle();
    expect(changes).toEqual(["gamepad"]);
  });
});

describe("GamepadNavigationProvider: toggle groups", () => {
  function Switch({
    orientation,
    multiple = false,
    onValueChange,
    onValuesChange,
  }: {
    orientation?: "horizontal" | "vertical";
    multiple?: boolean;
    onValueChange?: (value: string) => void;
    onValuesChange?: (value: string[]) => void;
  }) {
    return (
      <>
        <button>before</button>
        {multiple ? (
          <ToggleGroup
            type="multiple"
            aria-label="View"
            orientation={orientation}
            onValueChange={onValuesChange}
          >
            <ToggleGroupItem value="month">Month</ToggleGroupItem>
            <ToggleGroupItem value="week">Week</ToggleGroupItem>
            <ToggleGroupItem value="day">Day</ToggleGroupItem>
          </ToggleGroup>
        ) : (
          <ToggleGroup
            type="single"
            defaultValue="month"
            aria-label="View"
            orientation={orientation}
            onValueChange={onValueChange}
          >
            <ToggleGroupItem value="month">Month</ToggleGroupItem>
            <ToggleGroupItem value="week">Week</ToggleGroupItem>
            <ToggleGroupItem value="day">Day</ToggleGroupItem>
          </ToggleGroup>
        )}
        <button>after</button>
      </>
    );
  }
  const item = (name: string) => screen.getByRole("radio", { name });

  it("starts with every item out of the tab order, which is why the group needs its own rule", () => {
    render(
      <Layer>
        <Switch />
      </Layer>,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("tabindex"))).toEqual(["-1", "-1", "-1"]);
    expect(radios.every((radio) => radio.hasAttribute("data-radix-collection-item"))).toBe(true);
  });

  it("steps along a row with left and right, and a press of A switches to the focused item", async () => {
    const pad = createMockPad();
    const onValueChange = vi.fn();
    render(
      <Layer>
        <Switch onValueChange={onValueChange} />
      </Layer>,
    );
    connect(pad);
    lineUp(screen.getAllByRole("radio"), "row");
    place(screen.getByText("before"), 0, -56);
    place(screen.getByText("after"), 0, 56);

    item("Month").focus();
    tap(pad, RIGHT);
    await settle();
    expect(document.activeElement).toBe(item("Week"));
    // Focus alone does not switch a toggle group the way it does a radio group.
    expect(item("Month").getAttribute("aria-checked")).toBe("true");

    tap(pad, A);
    await settle();
    expect(onValueChange).toHaveBeenLastCalledWith("week");
    expect(item("Week").getAttribute("aria-checked")).toBe("true");

    tap(pad, LEFT);
    await settle();
    expect(document.activeElement).toBe(item("Month"));
  });

  it("lets up and down leave a row, and left and right leave it past the first and last item", async () => {
    const pad = createMockPad();
    render(
      <Layer>
        <Switch />
      </Layer>,
    );
    connect(pad);
    lineUp(screen.getAllByRole("radio"), "row", 0, 0);
    place(screen.getByText("before"), 0, -56);
    place(screen.getByText("after"), 0, 56);

    item("Week").focus();
    tap(pad, DOWN);
    await settle();
    expect(focused()).toBe("after");

    item("Week").focus();
    tap(pad, UP);
    await settle();
    expect(focused()).toBe("before");

    // Past the last item it moves on rather than wrapping round to the first.
    place(screen.getByText("after"), 120, 0);
    item("Day").focus();
    tap(pad, RIGHT);
    await settle();
    expect(focused()).toBe("after");
  });

  it("steps down a column when the group says it is vertical, and lets left and right leave", async () => {
    const pad = createMockPad();
    render(
      <Layer>
        <Switch orientation="vertical" />
      </Layer>,
    );
    connect(pad);
    // Laid out as a row, but declared vertical: up and down step, left and right leave.
    lineUp(screen.getAllByRole("radio"), "row");
    place(screen.getByText("after"), 200, 0);

    item("Week").focus();
    tap(pad, DOWN);
    await settle();
    expect(document.activeElement).toBe(item("Day"));

    item("Week").focus();
    tap(pad, LEFT);
    await settle();
    expect(document.activeElement?.getAttribute("role")).not.toBe("radio");
  });

  it("offers a group whose layout is not known every direction until its first or last item", async () => {
    const pad = createMockPad();
    render(
      <Layer>
        <Switch />
      </Layer>,
    );
    connect(pad);

    item("Month").focus();
    tap(pad, DOWN);
    await settle();
    expect(document.activeElement).toBe(item("Week"));
    tap(pad, RIGHT);
    await settle();
    expect(document.activeElement).toBe(item("Day"));
    tap(pad, DOWN);
    await settle();
    expect(focused()).toBe("after");
  });

  it("works for a group of pressed buttons too, which carry aria-pressed and not a role", async () => {
    const pad = createMockPad();
    const onValueChange = vi.fn();
    render(
      <Layer>
        <Switch multiple onValuesChange={onValueChange} />
      </Layer>,
    );
    connect(pad);
    lineUp(screen.getAllByRole("button", { pressed: false }), "row");

    screen.getByRole("button", { name: "Month" }).focus();
    tap(pad, RIGHT);
    await settle();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Week" }));
    tap(pad, A);
    await settle();
    expect(onValueChange).toHaveBeenLastCalledWith(["week"]);
  });

  it("leaves a plain group of buttons to the spatial search, and a group inside a toolbar to the toolbar", () => {
    const pad = createMockPad();
    const keys: string[] = [];
    render(
      <Layer>
        <div role="group" aria-label="Plain">
          <button>one</button>
          <button>two</button>
        </div>
        <div role="toolbar" aria-label="Tools">
          <div role="group" aria-label="Inner">
            <button>tool one</button>
            <button>tool two</button>
          </div>
        </div>
      </Layer>,
    );
    document.addEventListener("keydown", (event) => keys.push(event.key));
    connect(pad);
    lineUp([screen.getByText("one"), screen.getByText("two")], "row", 0, 0);
    lineUp([screen.getByText("tool one"), screen.getByText("tool two")], "row", 0, 100);

    screen.getByText("one").focus();
    tap(pad, RIGHT);
    expect(focused()).toBe("two");
    expect(keys).toEqual([]);

    // The toolbar owns Left and Right, so the arrow reaches the button as a key.
    screen.getByText("tool one").focus();
    tap(pad, RIGHT);
    expect(keys).toEqual(["ArrowRight"]);
  });

  it("switches the view of a real TimeCalendar, which a pad could not reach before", async () => {
    const pad = createMockPad();
    render(
      <Layer>
        <TimeCalendar events={[]} now={new Date(2026, 9, 23, 14, 30)} defaultDate="2026-10-23" />
      </Layer>,
    );
    connect(pad);
    const month = screen.getByRole("radio", { name: "Month" });
    const week = screen.getByRole("radio", { name: "Week" });
    lineUp([month, week], "row", 600, 0);
    expect(month.getAttribute("aria-checked")).toBe("true");

    month.focus();
    tap(pad, RIGHT);
    await settle();
    expect(document.activeElement).toBe(week);

    tap(pad, A);
    await settle();
    expect(week.getAttribute("aria-checked")).toBe("true");
    expect(month.getAttribute("aria-checked")).toBe("false");
  });
});

describe("GamepadNavigationProvider: fields that step", () => {
  const keysOn = () => {
    const keys: string[] = [];
    document.addEventListener("keydown", (event) => keys.push(event.key));
    return keys;
  };

  it("sends up and down to a field that marks itself as stepping, and lets left and right leave", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <button>above</button>
        <input aria-label="Time" data-gamepad-step="" defaultValue="09:00" />
        <button>below</button>
      </Layer>,
    );
    const keys = keysOn();
    connect(pad);
    place(screen.getByText("above"), 0, -56);
    place(screen.getByLabelText("Time"), 0, 0);
    place(screen.getByText("below"), 0, 56);

    screen.getByLabelText("Time").focus();
    tap(pad, UP);
    tap(pad, DOWN);
    expect(keys).toEqual(["ArrowUp", "ArrowDown"]);
    expect(document.activeElement).toBe(screen.getByLabelText("Time"));

    keys.length = 0;
    place(screen.getByText("below"), 140, 0);
    tap(pad, RIGHT);
    expect(keys).toEqual([]);
    expect(focused()).toBe("below");
  });

  it("moves away from a plain text field on up and down, which is why the attribute exists", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <button>above</button>
        <input aria-label="Name" />
      </Layer>,
    );
    const keys = keysOn();
    connect(pad);
    place(screen.getByText("above"), 0, -56);
    place(screen.getByLabelText("Name"), 0, 0);

    screen.getByLabelText("Name").focus();
    tap(pad, UP);
    expect(keys).toEqual([]);
    expect(focused()).toBe("above");
  });

  it("sends up and down to an element with the spinbutton role", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <button>above</button>
        <div role="spinbutton" tabIndex={0} aria-valuenow={3} aria-label="Quantity" />
      </Layer>,
    );
    const keys = keysOn();
    connect(pad);
    screen.getByRole("spinbutton").focus();
    tap(pad, UP);
    expect(keys).toEqual(["ArrowUp"]);
  });

  describe("native number inputs", () => {
    function Seats({
      readOnly,
      step = 2,
      onChange,
    }: {
      readOnly?: boolean;
      step?: number | "any";
      onChange?: (value: string) => void;
    }) {
      return (
        <>
          <button>above</button>
          <input
            type="number"
            aria-label="Seats"
            defaultValue={4}
            min={0}
            max={6}
            step={step}
            readOnly={readOnly}
            onChange={(event) => onChange?.(event.target.value)}
          />
          <button>below</button>
        </>
      );
    }
    const seats = () => screen.getByLabelText("Seats") as HTMLInputElement;

    it("steps by the input's own step on up and down, firing the change React listens to", () => {
      const pad = createMockPad();
      const onChange = vi.fn();
      render(
        <Layer>
          <Seats onChange={onChange} />
        </Layer>,
      );
      connect(pad);
      seats().focus();

      tap(pad, UP);
      expect(seats().value).toBe("6");
      expect(onChange).toHaveBeenLastCalledWith("6");
      tap(pad, DOWN);
      tap(pad, DOWN);
      expect(seats().value).toBe("2");
      expect(onChange).toHaveBeenCalledTimes(3);
      expect(document.activeElement).toBe(seats());
    });

    it("stops at max without leaving, and has no change to report once it cannot step", () => {
      const pad = createMockPad();
      const onChange = vi.fn();
      render(
        <Layer>
          <Seats onChange={onChange} />
        </Layer>,
      );
      connect(pad);
      seats().focus();

      tap(pad, UP);
      tap(pad, UP);
      expect(seats().value).toBe("6");
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(seats());
    });

    it("lets left and right leave, as a caret has no use for them here", () => {
      const pad = createMockPad();
      render(
        <Layer>
          <Seats />
        </Layer>,
      );
      connect(pad);
      place(seats(), 0, 0);
      place(screen.getByText("below"), 140, 0);
      place(screen.getByText("above"), -140, 0);

      seats().focus();
      tap(pad, RIGHT);
      expect(focused()).toBe("below");
      seats().focus();
      tap(pad, LEFT);
      expect(focused()).toBe("above");
    });

    it("does not step a read-only input, and does not throw on step=any", () => {
      const pad = createMockPad();
      const { rerender } = render(
        <Layer>
          <Seats readOnly />
        </Layer>,
      );
      connect(pad);
      seats().focus();
      tap(pad, UP);
      expect(seats().value).toBe("4");

      rerender(
        <Layer>
          <Seats step="any" />
        </Layer>,
      );
      seats().focus();
      expect(() => tap(pad, UP)).not.toThrow();
      expect(document.activeElement).toBe(seats());
    });
  });
});

describe("GamepadNavigationProvider: menus", () => {
  const keysOn = () => {
    const keys: string[] = [];
    document.addEventListener("keydown", (event) => keys.push(event.key));
    return keys;
  };

  /** The DOM Radix gives a dropdown with a submenu, minus the portals: ids, roles and labelling. */
  function MenuTree() {
    return (
      <>
        <button id="menu-trigger" aria-haspopup="menu" aria-expanded="true">
          Open
        </button>
        <div role="menu" aria-labelledby="menu-trigger" aria-orientation="vertical">
          <div role="menuitem" tabIndex={-1}>
            Plain
          </div>
          <div id="menu-more" role="menuitem" aria-haspopup="menu" tabIndex={-1}>
            More
          </div>
        </div>
        <div role="menu" aria-labelledby="menu-more" aria-orientation="vertical">
          <div role="menuitem" tabIndex={-1}>
            Sub A
          </div>
        </div>
        <div role="menubar" aria-label="App">
          <div id="menu-file" role="menuitem" aria-haspopup="menu" tabIndex={-1}>
            File
          </div>
        </div>
        <div role="menu" aria-labelledby="menu-file" aria-orientation="vertical">
          <div role="menuitem" tabIndex={-1}>
            New
          </div>
        </div>
      </>
    );
  }
  const focusItem = (name: string) => screen.getByText(name).focus();

  it("sends up and down to an item, and nothing else when the item has no submenu", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <MenuTree />
      </Layer>,
    );
    const keys = keysOn();
    connect(pad);

    focusItem("Plain");
    tap(pad, DOWN);
    tap(pad, UP);
    tap(pad, RIGHT);
    tap(pad, LEFT);
    expect(keys).toEqual(["ArrowDown", "ArrowUp"]);
  });

  it("sends right to an item that opens a submenu, so Radix opens it, and not left", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <MenuTree />
      </Layer>,
    );
    const keys = keysOn();
    connect(pad);

    focusItem("More");
    tap(pad, RIGHT);
    expect(keys).toEqual(["ArrowRight"]);
    keys.length = 0;
    tap(pad, LEFT);
    expect(keys).toEqual([]);
  });

  it("sends left inside a submenu, so Radix closes it, and not right", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <MenuTree />
      </Layer>,
    );
    const keys = keysOn();
    connect(pad);

    focusItem("Sub A");
    tap(pad, LEFT);
    expect(keys).toEqual(["ArrowLeft"]);
    keys.length = 0;
    tap(pad, RIGHT);
    expect(keys).toEqual([]);
  });

  it("knows a menubar's menu by Radix's own marker when the trigger's id has been replaced", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <div role="menu" aria-labelledby="no-such-trigger" data-radix-menubar-content="">
          <div role="menuitem" tabIndex={-1}>
            Orphan
          </div>
        </div>
      </Layer>,
    );
    const keys = keysOn();
    connect(pad);

    focusItem("Orphan");
    tap(pad, LEFT);
    tap(pad, RIGHT);
    expect(keys).toEqual(["ArrowLeft", "ArrowRight"]);
  });

  it("sends left and right inside a menu that hangs off a menubar, which switches menus with them", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <MenuTree />
      </Layer>,
    );
    const keys = keysOn();
    connect(pad);

    focusItem("New");
    tap(pad, LEFT);
    tap(pad, RIGHT);
    expect(keys).toEqual(["ArrowLeft", "ArrowRight"]);
  });
});

describe("GamepadNavigationProvider: when the focused element goes away", () => {
  /** A list whose Delete buttons remove their own row, which drops focus onto the page. */
  function Rows({ count = 5, omitEnds = false }: { count?: number; omitEnds?: boolean }) {
    const [rows, setRows] = React.useState(() => Array.from({ length: count }, (_, i) => i + 1));
    return (
      <>
        {omitEnds ? null : <button>Top</button>}
        <ul>
          {rows.map((row) => (
            <li key={row}>
              <button onClick={() => setRows((current) => current.filter((n) => n !== row))}>
                Delete {row}
              </button>
            </li>
          ))}
        </ul>
        {omitEnds ? null : <button>Bottom</button>}
      </>
    );
  }

  it("carries on with the row that took its place when Down is pressed, not from the top of the page", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <Rows />
      </Layer>,
    );
    connect(pad);
    screen.getByText("Delete 3").focus();

    tap(pad, A);
    expect(screen.queryByText("Delete 3")).toBeNull();
    expect(document.activeElement).toBe(document.body);

    tap(pad, DOWN);
    expect(focused()).toBe("Delete 4");
  });

  it("goes back to the row before it on Up, like Shift+Tab", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <Rows />
      </Layer>,
    );
    connect(pad);
    screen.getByText("Delete 3").focus();

    tap(pad, A);
    tap(pad, UP);
    expect(focused()).toBe("Delete 2");
  });

  it("puts focus beside the removed element when A is pressed with nothing focused, without pressing it", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <Rows />
      </Layer>,
    );
    connect(pad);
    screen.getByText("Delete 2").focus();

    tap(pad, A);
    tap(pad, A);
    expect(focused()).toBe("Delete 3");
    expect(screen.queryByText("Delete 2")).toBeNull();
    expect(screen.getByText("Delete 3")).toBeTruthy();
  });

  it("continues past the end of the list when its last row is removed, and before its start for the first", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <Rows count={3} />
      </Layer>,
    );
    connect(pad);

    screen.getByText("Delete 3").focus();
    tap(pad, A);
    tap(pad, DOWN);
    // Nothing follows the list inside it, so the next control is the one after the list.
    expect(focused()).toBe("Bottom");

    screen.getByText("Delete 1").focus();
    tap(pad, A);
    tap(pad, UP);
    expect(focused()).toBe("Top");
  });

  it("falls back to the control on the other side when nothing lies the way it was going", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <Rows count={3} omitEnds />
      </Layer>,
    );
    connect(pad);

    screen.getByText("Delete 3").focus();
    tap(pad, A);
    // The removed row was the last control on the page, so Down goes to the one before it, not back
    // to the top of the page.
    tap(pad, DOWN);
    expect(focused()).toBe("Delete 2");
  });

  it("remembers a row focused before any pad was seen, so the very first press can remove it", () => {
    const pad = createMockPad();
    // The row takes itself out of the page inside the click, before anything else can look at it.
    render(
      <Layer>
        <ul>
          {[1, 2, 3].map((row) => (
            <li key={row}>
              <button onClick={(event) => event.currentTarget.parentElement?.remove()}>
                Delete {row}
              </button>
            </li>
          ))}
        </ul>
      </Layer>,
    );
    // Nothing is listening for focus yet: the layer has not met a pad.
    screen.getByText("Delete 2").focus();
    connect(pad);

    tap(pad, A);
    expect(screen.queryByText("Delete 2")).toBeNull();
    tap(pad, DOWN);
    expect(focused()).toBe("Delete 3");
  });

  it("starts from the first control of a layer that is before the element in the page, not from where the element was", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <div role="alertdialog">
          <button>Layer one</button>
          <button>Layer two</button>
        </div>
        <button>Behind</button>
      </Layer>,
    );
    connect(pad);
    screen.getByText("Behind").focus();
    (document.activeElement as HTMLElement).blur();

    // The page element is remembered, and is not in the layer: Down starts the layer from its first control.
    tap(pad, DOWN);
    expect(focused()).toBe("Layer one");
  });

  it("leaves a whole removed section from the place it stood", () => {
    const pad = createMockPad();
    function Sections() {
      const [open, setOpen] = React.useState(true);
      return (
        <>
          <button>Before</button>
          {open ? (
            <section>
              <button>Inner one</button>
              <button onClick={() => setOpen(false)}>Close section</button>
            </section>
          ) : null}
          <button>After</button>
        </>
      );
    }
    render(
      <Layer>
        <Sections />
      </Layer>,
    );
    connect(pad);
    screen.getByText("Close section").focus();

    tap(pad, A);
    tap(pad, DOWN);
    expect(focused()).toBe("After");
  });

  it("still starts from the first control when focus was dropped but nothing was removed", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <Rows />
      </Layer>,
    );
    connect(pad);
    screen.getByText("Delete 3").focus();
    tap(pad, A);
    // Focus is on the page now and the remembered row is gone. Put it back on a row that stays, blur it.
    screen.getByText("Delete 4").focus();
    (document.activeElement as HTMLElement).blur();

    tap(pad, DOWN);
    expect(focused()).toBe("Top");
  });
});

describe("GamepadNavigationProvider: implicit submission from a text field", () => {
  const submitted = () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    return onSubmit;
  };

  it("does not submit a form whose default button is disabled, as Enter does not", () => {
    const pad = createMockPad();
    const onSubmit = submitted();
    render(
      <Layer>
        <form onSubmit={onSubmit}>
          <input aria-label="Amount" defaultValue="" />
          <button type="submit" disabled>
            Save
          </button>
        </form>
      </Layer>,
    );
    connect(pad);
    screen.getByLabelText("Amount").focus();

    tap(pad, A);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("treats the first submit button as the default, even when a later one is enabled", () => {
    const pad = createMockPad();
    const onSubmit = submitted();
    render(
      <Layer>
        <form onSubmit={onSubmit}>
          <input aria-label="Amount" />
          <button type="submit" disabled>
            Save
          </button>
          <button type="submit">Save and close</button>
        </form>
      </Layer>,
    );
    connect(pad);
    screen.getByLabelText("Amount").focus();

    tap(pad, A);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("clicks the default button, as Enter does, and the click is what submits", () => {
    const pad = createMockPad();
    const order: string[] = [];
    render(
      <Layer>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            order.push("submit");
          }}
        >
          <input aria-label="Amount" />
          <input aria-label="Note" />
          <button type="submit" onClick={() => order.push("click")}>
            Save
          </button>
        </form>
      </Layer>,
    );
    connect(pad);
    screen.getByLabelText("Note").focus();

    tap(pad, A);
    expect(order).toEqual(["click", "submit"]);
  });

  it("does not submit a form of several text fields that has no submit button", () => {
    const pad = createMockPad();
    const onSubmit = submitted();
    render(
      <Layer>
        <form onSubmit={onSubmit}>
          <input aria-label="First" />
          <input aria-label="Second" />
        </form>
      </Layer>,
    );
    connect(pad);
    screen.getByLabelText("First").focus();

    tap(pad, A);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a form with a single text field and no submit button, whatever else it holds", () => {
    const pad = createMockPad();
    const onSubmit = submitted();
    render(
      <Layer>
        <form onSubmit={onSubmit}>
          <input aria-label="Search" />
          <input type="checkbox" aria-label="Exact" />
        </form>
      </Layer>,
    );
    connect(pad);
    screen.getByLabelText("Search").focus();

    tap(pad, A);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("reports that nothing responded when the form refuses to submit", () => {
    function Probe() {
      const { lastAction } = useGamepadNavigation();
      return <output>{lastAction ? `${lastAction.action}:${lastAction.handled}` : "none"}</output>;
    }
    const pad = createMockPad();
    render(
      <Layer>
        <form onSubmit={submitted()}>
          <input aria-label="Amount" />
          <button type="submit" disabled>
            Save
          </button>
        </form>
        <Probe />
      </Layer>,
    );
    connect(pad);
    screen.getByLabelText("Amount").focus();

    tap(pad, A);
    expect(screen.getByRole("status").textContent).toBe("activate:false");
  });
});

describe("GamepadNavigationProvider: roving widgets as one box", () => {
  it("goes down into a grid whose one tab stop sits off to the side, not past it to a wide control", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <button>Toolbar</button>
        <div role="grid" aria-label="Month">
          <div role="row">
            <div role="gridcell" tabIndex={0}>
              Friday
            </div>
            <div role="gridcell" tabIndex={-1}>
              Saturday
            </div>
          </div>
        </div>
        <button>After</button>
      </Layer>,
    );
    connect(pad);
    // The toolbar button is at the left; the grid spans the page but its tab stop is a cell at the right;
    // a full-width control sits below the grid.
    place(screen.getByText("Toolbar"), 40, 0, 160, 40);
    place(screen.getByRole("grid"), 40, 100, 1000, 300);
    place(screen.getByText("Friday"), 614, 150, 143, 116);
    place(screen.getByText("After"), 40, 450, 1000, 40);

    screen.getByText("Toolbar").focus();
    tap(pad, DOWN);
    expect(focused()).toBe("Friday");
  });
});

describe("GamepadNavigationProvider: one layer per page", () => {
  function Checkbox({ onChange }: { onChange: (checked: boolean) => void }) {
    return (
      <input type="checkbox" aria-label="Remember" onChange={(e) => onChange(e.target.checked)} />
    );
  }

  it("lets a second enabled provider stand idle, so one press acts once", () => {
    const pad = createMockPad();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const onChange = vi.fn();
    render(
      <GamepadNavigationProvider enabled>
        <GamepadNavigationProvider enabled>
          <Checkbox onChange={onChange} />
        </GamepadNavigationProvider>
      </GamepadNavigationProvider>,
    );
    connect(pad);
    screen.getByLabelText("Remember").focus();

    tap(pad, A);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText("Remember") as HTMLInputElement).checked).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain("another enabled provider");
  });

  it("reports an idle second provider as having seen nothing", () => {
    function Probe({ name }: { name: string }) {
      const { connected, lastAction } = useGamepadNavigation();
      return (
        <output aria-label={name}>
          {String(connected)}:{lastAction?.action ?? "none"}
        </output>
      );
    }
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const pad = createMockPad();
    render(
      <>
        <GamepadNavigationProvider enabled>
          <button>Go</button>
          <Probe name="first" />
        </GamepadNavigationProvider>
        <GamepadNavigationProvider enabled>
          <Probe name="second" />
        </GamepadNavigationProvider>
      </>,
    );
    connect(pad);
    screen.getByText("Go").focus();
    tap(pad, A);

    expect(screen.getByLabelText("first").textContent).toBe("true:activate");
    expect(screen.getByLabelText("second").textContent).toBe("false:none");
  });

  it("hands the page to the waiting provider when the first one is removed", () => {
    const pad = createMockPad();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const onChange = vi.fn();
    const tree = (first: boolean) => (
      <>
        {first ? <GamepadNavigationProvider enabled /> : null}
        <GamepadNavigationProvider enabled>
          <Checkbox onChange={onChange} />
        </GamepadNavigationProvider>
      </>
    );
    const { rerender } = render(tree(true));
    connect(pad);
    screen.getByLabelText("Remember").focus();
    tap(pad, A);
    // The first provider owns the page and acted once; the second saw nothing of it.
    expect(onChange).toHaveBeenCalledTimes(1);

    rerender(tree(false));
    tap(pad, A);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("does not count a disabled provider as the owner", () => {
    const pad = createMockPad();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const onChange = vi.fn();
    render(
      <>
        <GamepadNavigationProvider enabled={false} />
        <GamepadNavigationProvider enabled>
          <Checkbox onChange={onChange} />
        </GamepadNavigationProvider>
      </>,
    );
    connect(pad);
    screen.getByLabelText("Remember").focus();

    tap(pad, A);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("still works under StrictMode, which runs the effect twice", () => {
    const pad = createMockPad();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const onChange = vi.fn();
    render(
      <React.StrictMode>
        <GamepadNavigationProvider enabled>
          <Checkbox onChange={onChange} />
        </GamepadNavigationProvider>
      </React.StrictMode>,
    );
    connect(pad);
    screen.getByLabelText("Remember").focus();

    tap(pad, A);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("lets the owner change a setting without losing the page to the waiting provider", () => {
    const pad = createMockPad();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const onChange = vi.fn();
    const tree = (deadZone: number) => (
      <>
        <GamepadNavigationProvider enabled deadZone={deadZone} />
        <GamepadNavigationProvider enabled>
          <Checkbox onChange={onChange} />
        </GamepadNavigationProvider>
      </>
    );
    const { rerender } = render(tree(0.5));
    rerender(tree(0.6));
    connect(pad);
    screen.getByLabelText("Remember").focus();

    tap(pad, A);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("GamepadNavigationProvider: what the readout names", () => {
  function Readout() {
    const { lastAction } = useGamepadNavigation();
    return <output>{lastAction ? lastAction.target : "none"}</output>;
  }

  it("names the tab a tab list hands focus on to, not the list that was focused", async () => {
    const pad = createMockPad();
    render(
      <Layer>
        <button>Above</button>
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
          </TabsList>
          <TabsContent value="one">panel</TabsContent>
        </Tabs>
        <Readout />
      </Layer>,
    );
    connect(pad);
    place(screen.getByText("Above"), 0, 0);
    place(screen.getByRole("tablist"), 0, 56, 200, 40);
    screen.getByText("Above").focus();

    tap(pad, DOWN);
    await settle();
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "One" }));
    expect(screen.getByRole("status").textContent).toBe('tab "One"');
  });

  it("names the button that was pressed for A, not the field its handler moved focus to", () => {
    const pad = createMockPad();
    function Opens() {
      const field = React.useRef<HTMLInputElement>(null);
      return (
        <>
          <button onClick={() => field.current?.focus()}>Open editor</button>
          <input ref={field} aria-label="Editor" />
        </>
      );
    }
    render(
      <Layer>
        <Opens />
        <Readout />
      </Layer>,
    );
    connect(pad);
    screen.getByText("Open editor").focus();

    tap(pad, A);
    expect(document.activeElement).toBe(screen.getByLabelText("Editor"));
    expect(screen.getByRole("status").textContent).toBe('button "Open editor"');
  });

  it("names the element that was pressed for A, even when pressing it removed it", () => {
    const pad = createMockPad();
    function Once() {
      const [shown, setShown] = React.useState(true);
      return shown ? <button onClick={() => setShown(false)}>Dismiss</button> : null;
    }
    render(
      <Layer>
        <Once />
        <Readout />
      </Layer>,
    );
    connect(pad);
    screen.getByText("Dismiss").focus();

    tap(pad, A);
    expect(screen.getByRole("status").textContent).toBe('button "Dismiss"');
  });
});

describe("GamepadNavigationProvider: layers, tab filters and focus guards", () => {
  /** Three ways a layer shows itself that do not trap focus the way Radix's Dialog does. */
  const layers: Array<[string, (children: React.ReactNode) => React.ReactNode]> = [
    [
      "a non-modal dialog Radix has opened",
      (c) => (
        <div role="dialog" data-state="open">
          {c}
        </div>
      ),
    ],
    ["an alert dialog", (c) => <div role="alertdialog">{c}</div>],
    ["a native dialog that is open", (c) => <dialog open>{c}</dialog>],
  ];

  it.each(layers)(
    "keeps the pad inside %s, with the page behind it neither hidden nor inert",
    (_, wrap) => {
      const pad = createMockPad();
      render(
        <Layer>
          <button>Behind</button>
          {wrap(
            <>
              <button>Layer one</button>
              <button>Layer two</button>
            </>,
          )}
        </Layer>,
      );
      connect(pad);
      place(screen.getByText("Layer one"), 0, 0);
      place(screen.getByText("Layer two"), 0, 56);
      place(screen.getByText("Behind"), 0, 112);
      screen.getByText("Layer one").focus();

      for (const direction of [DOWN, DOWN, DOWN, UP, UP, UP, RIGHT, LEFT]) {
        tap(pad, direction);
        expect(["Layer one", "Layer two"]).toContain(focused());
      }
    },
  );

  it("starts inside the layer when focus is on the page behind it", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <button>Behind</button>
        <div role="alertdialog">
          <button>Layer one</button>
          <button>Layer two</button>
        </div>
      </Layer>,
    );
    connect(pad);
    place(screen.getByText("Behind"), 0, 0);
    place(screen.getByText("Layer one"), 0, 56);
    place(screen.getByText("Layer two"), 0, 112);
    screen.getByText("Behind").focus();

    // From Behind, Down would reach Layer one anyway; Up has nowhere to go but out of the layer.
    tap(pad, UP);
    expect(focused()).toBe("Layer one");
  });

  it("ignores a layer that is hidden from assistive technology, and a panel that only has the role", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <button>Page one</button>
        <div aria-hidden="true">
          <div role="alertdialog">
            <button>Stale layer</button>
          </div>
        </div>
        <div role="dialog">
          <button>Persistent panel</button>
        </div>
        <button>Page two</button>
      </Layer>,
    );
    connect(pad);
    place(screen.getByText("Page one"), 0, 0);
    place(screen.getByText("Persistent panel"), 0, 56);
    place(screen.getByText("Page two"), 0, 112);
    screen.getByText("Page one").focus();

    tap(pad, DOWN);
    expect(focused()).toBe("Persistent panel");
    tap(pad, DOWN);
    expect(focused()).toBe("Page two");
  });

  it.each([
    ["the disabled attribute", { disabled: true }],
    ["aria-disabled", { "aria-disabled": "true" }],
    ["data-disabled", { "data-disabled": "" }],
  ] as Array<[string, Record<string, unknown>]>)(
    "skips a tab disabled with %s when switching with the bumpers",
    async (_, attributes) => {
      const pad = createMockPad();
      render(
        <Layer>
          <div role="tablist">
            <button role="tab" aria-selected="true">
              One
            </button>
            <button role="tab" {...attributes}>
              Two
            </button>
            <button role="tab">Three</button>
          </div>
        </Layer>,
      );
      connect(pad);
      screen.getByRole("tab", { name: "One" }).focus();

      tap(pad, RB);
      await settle();
      expect(focused()).toBe("Three");
    },
  );

  it("never lands on a Radix focus guard, whether it follows the page or the pad is looking for a start", () => {
    const pad = createMockPad();
    render(
      <Layer>
        <span data-radix-focus-guard="" tabIndex={0} />
        <button>First</button>
        <span data-radix-focus-guard="" tabIndex={0} />
        <button>Second</button>
      </Layer>,
    );
    connect(pad);
    place(screen.getByText("First"), 0, 0);
    place(document.querySelectorAll<HTMLElement>("[data-radix-focus-guard]")[1]!, 0, 56, 1, 1);
    place(screen.getByText("Second"), 0, 112);

    // Nothing focused: the first control, not the guard in front of it.
    tap(pad, DOWN);
    expect(focused()).toBe("First");
    // And the guard sitting between the two buttons is stepped over.
    tap(pad, DOWN);
    expect(focused()).toBe("Second");
  });
});

describe("GamepadNavigationProvider: cleanup", () => {
  it("removes every listener, frame, attribute and class on unmount", () => {
    const addListener = vi.spyOn(window, "addEventListener");
    const removeListener = vi.spyOn(window, "removeEventListener");
    const docAdd = vi.spyOn(document, "addEventListener");
    const docRemove = vi.spyOn(document, "removeEventListener");
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const pad = createMockPad();

    const { unmount } = render(
      <Layer>
        <Grid />
      </Layer>,
    );
    connect(pad);
    screen.getByText("a").focus();
    tap(pad, RIGHT);
    expect(html.getAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe("gamepad");

    unmount();

    const gamepadTypes = ["gamepadconnected", "gamepaddisconnected"];
    for (const type of gamepadTypes) {
      const added = addListener.mock.calls.filter(([name]) => name === type).length;
      const removed = removeListener.mock.calls.filter(([name]) => name === type).length;
      expect(removed, type).toBe(added);
    }
    for (const [type] of docAdd.mock.calls) {
      if (["keydown", "pointerdown", "mousedown", "focusin", "focusout"].includes(String(type))) {
        expect(
          docRemove.mock.calls.some(([name]) => name === type),
          String(type),
        ).toBe(true);
      }
    }
    expect(cancel).toHaveBeenCalled();
    expect(html.hasAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe(false);
    expect(html.className).not.toContain("data-gamepad-focus");
    expect(document.querySelector(`[${GAMEPAD_FOCUS_ATTRIBUTE}]`)).toBeNull();

    getGamepads.mockClear();
    elapse(500);
    expect(getGamepads).not.toHaveBeenCalled();

    // Nothing is listening any more: a pad press after unmount reaches no one.
    const onClick = vi.fn();
    const button = document.createElement("button");
    button.addEventListener("click", onClick);
    document.body.append(button);
    button.focus();
    tap(pad, A);
    expect(onClick).not.toHaveBeenCalled();
    button.remove();
  });

  it("stops everything when enabled goes back to false, and restarts when it returns", () => {
    const pad = createMockPad();
    const onClick = vi.fn();
    const tree = (enabled: boolean) => (
      <GamepadNavigationProvider enabled={enabled}>
        <button onClick={onClick}>Go</button>
      </GamepadNavigationProvider>
    );
    const { rerender } = render(tree(true));
    connect(pad);
    screen.getByText("Go").focus();
    tap(pad, A);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(tree(false));
    getGamepads.mockClear();
    tap(pad, A);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(getGamepads).not.toHaveBeenCalled();
    expect(html.hasAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe(false);

    rerender(tree(true));
    // The pad is still plugged in; the layer finds it without another connect event.
    tap(pad, A);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("restores a modality attribute that was there before", () => {
    html.setAttribute(INPUT_MODALITY_ATTRIBUTE, "pointer");
    const pad = createMockPad();
    const { unmount } = render(
      <Layer>
        <Grid />
      </Layer>,
    );
    connect(pad);
    screen.getByText("a").focus();
    tap(pad, RIGHT);
    expect(html.getAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe("gamepad");

    unmount();
    expect(html.getAttribute(INPUT_MODALITY_ATTRIBUTE)).toBe("pointer");
  });
});
