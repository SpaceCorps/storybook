import { describe, expect, it } from "vite-plus/test";
import {
  GAMEPAD_BUTTON,
  compositeDirections,
  createRepeater,
  heldActions,
  isForward,
  isTrappingRole,
  layoutOrientation,
  menuDirections,
  pickSpatialTarget,
  runsOffEnd,
  stepIndex,
  stickDirection,
  type GamepadAction,
  type PadSnapshot,
  type Rect,
  type StickMemory,
} from "../src/components/ui/gamepad-navigation/gamepad-logic";

/** A standard-mapping pad with the given buttons down and the left stick at (x, y). */
function pad(pressed: number[] = [], axes: [number, number] = [0, 0]): PadSnapshot {
  return {
    buttons: Array.from({ length: 17 }, (_, index) => ({ pressed: pressed.includes(index) })),
    axes: [...axes, 0, 0],
  };
}

const rect = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

describe("stickDirection", () => {
  it("ignores everything inside the dead zone, edge included", () => {
    expect(stickDirection(0, 0, 0.5)).toBeNull();
    expect(stickDirection(0.5, -0.5, 0.5)).toBeNull();
    expect(stickDirection(0.2, 0.49, 0.5)).toBeNull();
  });

  it("reports the direction once the stick leaves the dead zone", () => {
    expect(stickDirection(0.51, 0, 0.5)).toBe("right");
    expect(stickDirection(-0.9, 0.1, 0.5)).toBe("left");
    expect(stickDirection(0, 0.8, 0.5)).toBe("down");
    expect(stickDirection(0, -0.8, 0.5)).toBe("up");
  });

  it("resolves a diagonal to the stronger axis", () => {
    expect(stickDirection(0.9, 0.6, 0.5)).toBe("right");
    expect(stickDirection(0.6, -0.9, 0.5)).toBe("up");
  });

  it("honours a custom dead zone", () => {
    expect(stickDirection(0.7, 0, 0.8)).toBeNull();
    expect(stickDirection(0.7, 0, 0.3)).toBe("right");
  });

  it("treats missing or non-finite axes as centred", () => {
    expect(stickDirection(Number.NaN, Number.NaN, 0.5)).toBeNull();
    expect(stickDirection(undefined as unknown as number, 0, 0.5)).toBeNull();
  });

  describe("with the direction it had last frame", () => {
    it("keeps the axis it chose until the other one is clearly further", () => {
      // 0.71 against 0.70 is noise on a stick resting in a diagonal gate, not a change of mind.
      expect(stickDirection(0.7, 0.71, 0.5, null)).toBe("down");
      expect(stickDirection(0.7, 0.71, 0.5, "right")).toBe("right");
      expect(stickDirection(0.71, 0.7, 0.5, "down")).toBe("down");
      // Pushed 0.15 further on the other axis, it has genuinely turned.
      expect(stickDirection(0.7, 0.86, 0.5, "right")).toBe("down");
      expect(stickDirection(0.2, 0.9, 0.5, "right")).toBe("down");
    });

    it("follows the stick across to the other side of the same axis", () => {
      expect(stickDirection(-0.7, 0.1, 0.5, "right")).toBe("left");
      expect(stickDirection(0.1, -0.9, 0.5, "down")).toBe("up");
    });

    it("lets go a little below the dead zone, not at its edge", () => {
      expect(stickDirection(0.45, 0, 0.5, null)).toBeNull();
      expect(stickDirection(0.45, 0, 0.5, "right")).toBe("right");
      expect(stickDirection(0.39, 0, 0.5, "right")).toBeNull();
    });

    it("lets go sooner when the dead zone itself is small", () => {
      expect(stickDirection(0.06, 0, 0.1, "right")).toBe("right");
      expect(stickDirection(0.04, 0, 0.1, "right")).toBeNull();
    });
  });
});

describe("heldActions", () => {
  it("maps the standard buttons", () => {
    const held = heldActions([
      pad([
        GAMEPAD_BUTTON.dpadUp,
        GAMEPAD_BUTTON.a,
        GAMEPAD_BUTTON.b,
        GAMEPAD_BUTTON.leftBumper,
        GAMEPAD_BUTTON.rightBumper,
      ]),
    ]);
    expect([...held].sort()).toEqual(["activate", "cancel", "next-tab", "previous-tab", "up"]);
  });

  it("maps each D-pad direction", () => {
    expect([...heldActions([pad([GAMEPAD_BUTTON.dpadDown])])]).toEqual(["down"]);
    expect([...heldActions([pad([GAMEPAD_BUTTON.dpadLeft])])]).toEqual(["left"]);
    expect([...heldActions([pad([GAMEPAD_BUTTON.dpadRight])])]).toEqual(["right"]);
  });

  it("reads the left stick through the dead zone", () => {
    expect([...heldActions([pad([], [0.4, 0])])]).toEqual([]);
    expect([...heldActions([pad([], [0.8, 0])])]).toEqual(["right"]);
    expect([...heldActions([pad([], [0.8, 0])], 0.9)]).toEqual([]);
  });

  it("ignores buttons it has no use for and the right stick", () => {
    const held = heldActions([{ ...pad([2, 3, 9]), axes: [0, 0, 1, 1] }]);
    expect(held.size).toBe(0);
  });

  it("merges several pads", () => {
    const held = heldActions([pad([GAMEPAD_BUTTON.a]), pad([GAMEPAD_BUTTON.dpadLeft])]);
    expect([...held].sort()).toEqual(["activate", "left"]);
  });

  it("copes with a pad that reports fewer buttons than the standard mapping", () => {
    expect(heldActions([{ buttons: [{ pressed: true }], axes: [] }]).has("activate")).toBe(true);
  });

  describe("stick jitter", () => {
    // A stick resting in an octagonal gate's diagonal: x and y trade the lead by a hundredth.
    const jitter = (frame: number): [number, number] =>
      frame % 2 === 0 ? [0.71, 0.7] : [0.7, 0.71];

    function firedOver(frames: number, sticks?: StickMemory) {
      const repeater = createRepeater();
      let fired = 0;
      for (let frame = 0; frame < frames; frame += 1) {
        fired += repeater.step(
          heldActions([pad([], jitter(frame))], 0.5, sticks),
          frame * 16,
        ).length;
      }
      return fired;
    }

    it("presses once and then waits out the repeat delay, however the stick wobbles", () => {
      // 20 frames is 320 ms, short of the 400 ms delay.
      expect(firedOver(20, new Map())).toBe(1);
      // 60 frames is 944 ms: the press, then repeats at 400, 528, 656, 784 and 912 ms.
      expect(firedOver(60, new Map())).toBe(6);
    });

    it("flips with every frame when nothing remembers the last one", () => {
      expect(firedOver(20)).toBe(20);
    });

    it("forgets a pad that has gone", () => {
      const sticks: StickMemory = new Map();
      heldActions([pad([], [0.9, 0]), pad([], [0, 0.9])], 0.5, sticks);
      expect([...sticks.entries()]).toEqual([
        [0, "right"],
        [1, "down"],
      ]);
      heldActions([pad([], [0.9, 0])], 0.5, sticks);
      expect([...sticks.keys()]).toEqual([0]);
    });
  });
});

describe("createRepeater", () => {
  const down = new Set<GamepadAction>(["down"]);
  const none = new Set<GamepadAction>();

  it("fires a press at once and then waits out the initial delay", () => {
    const repeater = createRepeater({ initialDelay: 400, interval: 120 });
    expect(repeater.step(down, 0)).toEqual(["down"]);
    expect(repeater.step(down, 16)).toEqual([]);
    expect(repeater.step(down, 399)).toEqual([]);
    expect(repeater.step(down, 400)).toEqual(["down"]);
  });

  it("repeats on the interval once repeating has started", () => {
    const repeater = createRepeater({ initialDelay: 400, interval: 120 });
    repeater.step(down, 0);
    expect(repeater.step(down, 400)).toEqual(["down"]);
    expect(repeater.step(down, 519)).toEqual([]);
    expect(repeater.step(down, 520)).toEqual(["down"]);
    expect(repeater.step(down, 640)).toEqual(["down"]);
  });

  it("fires at most once per frame even after a long stall", () => {
    const repeater = createRepeater({ initialDelay: 400, interval: 120 });
    repeater.step(down, 0);
    expect(repeater.step(down, 5000)).toEqual(["down"]);
    expect(repeater.step(down, 5016)).toEqual([]);
  });

  it("starts over after a release", () => {
    const repeater = createRepeater({ initialDelay: 400, interval: 120 });
    repeater.step(down, 0);
    repeater.step(none, 100);
    expect(repeater.step(down, 200)).toEqual(["down"]);
    expect(repeater.step(down, 300)).toEqual([]);
  });

  it("never repeats activate or cancel while held", () => {
    const repeater = createRepeater({ initialDelay: 400, interval: 120 });
    const held = new Set<GamepadAction>(["activate", "cancel"]);
    expect(repeater.step(held, 0).sort()).toEqual(["activate", "cancel"]);
    expect(repeater.step(held, 400)).toEqual([]);
    expect(repeater.step(held, 5000)).toEqual([]);
  });

  it("repeats the tab buttons like a direction", () => {
    const repeater = createRepeater({ initialDelay: 400, interval: 120 });
    const next = new Set<GamepadAction>(["next-tab"]);
    expect(repeater.step(next, 0)).toEqual(["next-tab"]);
    expect(repeater.step(next, 400)).toEqual(["next-tab"]);
  });

  it("times each action independently", () => {
    const repeater = createRepeater({ initialDelay: 400, interval: 120 });
    repeater.step(new Set<GamepadAction>(["left"]), 0);
    // `right` is pressed 300 ms later: it fires now and has its own 400 ms to wait.
    expect(repeater.step(new Set<GamepadAction>(["left", "right"]), 300)).toEqual(["right"]);
    expect(repeater.step(new Set<GamepadAction>(["left", "right"]), 400)).toEqual(["left"]);
    expect(repeater.step(new Set<GamepadAction>(["left", "right"]), 700)).toEqual([
      "left",
      "right",
    ]);
  });

  it("treats a primed action as handled until it is released", () => {
    const repeater = createRepeater();
    const held = new Set<GamepadAction>(["activate", "down"]);
    repeater.prime(held);
    expect(repeater.step(held, 0)).toEqual([]);
    expect(repeater.step(held, 10_000)).toEqual([]);
    repeater.step(none, 10_016);
    expect(repeater.step(held, 10_032).sort()).toEqual(["activate", "down"]);
  });

  it("forgets everything on reset", () => {
    const repeater = createRepeater();
    repeater.step(down, 0);
    repeater.reset();
    expect(repeater.step(down, 16)).toEqual(["down"]);
  });

  it("uses 400 ms and 120 ms by default", () => {
    const repeater = createRepeater();
    repeater.step(down, 0);
    expect(repeater.step(down, 399)).toEqual([]);
    expect(repeater.step(down, 400)).toEqual(["down"]);
    expect(repeater.step(down, 519)).toEqual([]);
    expect(repeater.step(down, 520)).toEqual(["down"]);
  });
});

describe("pickSpatialTarget", () => {
  it("picks the next field down a column, not the one after", () => {
    const origin = rect(0, 0, 300, 40);
    const column = [rect(0, 112, 300, 40), rect(0, 56, 300, 40)];
    expect(pickSpatialTarget(origin, column, "down")).toBe(1);
  });

  it("goes up as well as down", () => {
    const origin = rect(0, 112, 300, 40);
    const column = [rect(0, 0, 300, 40), rect(0, 56, 300, 40)];
    expect(pickSpatialTarget(origin, column, "up")).toBe(1);
  });

  it("prefers the neighbour straight along a row over a diagonal one", () => {
    const origin = rect(0, 0, 100, 40);
    const candidates = [
      rect(116, 56, 100, 40), // diagonal, lower right
      rect(116, 0, 100, 40), // straight right
      rect(0, 56, 100, 40), // straight below
    ];
    expect(pickSpatialTarget(origin, candidates, "right")).toBe(1);
    expect(pickSpatialTarget(origin, candidates, "down")).toBe(2);
  });

  it("walks a 2 x 2 grid in both axes", () => {
    const [a, b, c, d] = [
      rect(0, 0, 100, 40),
      rect(116, 0, 100, 40),
      rect(0, 56, 100, 40),
      rect(116, 56, 100, 40),
    ] as const;
    expect(pickSpatialTarget(a, [b, c, d], "right")).toBe(0);
    expect(pickSpatialTarget(b, [a, c, d], "left")).toBe(0);
    expect(pickSpatialTarget(b, [a, c, d], "down")).toBe(2);
    expect(pickSpatialTarget(d, [a, b, c], "up")).toBe(1);
    expect(pickSpatialTarget(c, [a, b, d], "right")).toBe(2);
  });

  it("prefers a wide field that overlaps the origin over a small one off to the side", () => {
    const origin = rect(140, 0, 60, 40);
    const wideField = rect(0, 56, 400, 40);
    const sideButton = rect(300, 56, 60, 40);
    expect(pickSpatialTarget(origin, [sideButton, wideField], "down")).toBe(1);
  });

  it("steps from a full-width field to the small checkbox under it before the buttons below that", () => {
    const field = rect(0, 0, 300, 40);
    const checkbox = rect(0, 52, 16, 16);
    const saveButton = rect(0, 80, 60, 40);
    const cancelButton = rect(76, 80, 70, 40);
    expect(pickSpatialTarget(field, [saveButton, cancelButton, checkbox], "down")).toBe(2);
    // And back up again from the buttons.
    expect(pickSpatialTarget(saveButton, [field, checkbox, cancelButton], "up")).toBe(1);
  });

  it("returns -1 when nothing lies that way", () => {
    const origin = rect(0, 56, 100, 40);
    expect(pickSpatialTarget(origin, [rect(0, 0, 100, 40)], "down")).toBe(-1);
    expect(pickSpatialTarget(origin, [], "left")).toBe(-1);
  });

  it("does not count a candidate on the same line as being below", () => {
    const origin = rect(0, 0, 100, 40);
    expect(pickSpatialTarget(origin, [rect(116, 0, 100, 40)], "down")).toBe(-1);
  });
});

describe("stepIndex", () => {
  it("wraps in both directions", () => {
    expect(stepIndex(0, 3, 1)).toBe(1);
    expect(stepIndex(2, 3, 1)).toBe(0);
    expect(stepIndex(0, 3, -1)).toBe(2);
  });

  it("has nothing to step through when the list is empty", () => {
    expect(stepIndex(0, 0, 1)).toBe(-1);
  });
});

describe("compositeDirections", () => {
  it("gives a horizontal tablist the horizontal arrows and a vertical one the vertical", () => {
    expect(compositeDirections("tablist", "horizontal")).toEqual(["left", "right"]);
    expect(compositeDirections("tablist", null)).toEqual(["left", "right"]);
    expect(compositeDirections("tablist", "vertical")).toEqual(["up", "down"]);
  });

  it("gives menus and listboxes the vertical arrows by default", () => {
    expect(compositeDirections("menu")).toEqual(["up", "down"]);
    expect(compositeDirections("listbox")).toEqual(["up", "down"]);
    expect(compositeDirections("listbox", "horizontal")).toEqual(["left", "right"]);
    expect(compositeDirections("menubar")).toEqual(["left", "right"]);
  });

  it("gives grids and trees all four, since they have no axis to spare", () => {
    for (const role of ["grid", "treegrid", "tree"]) {
      expect(compositeDirections(role), role).toEqual(["up", "down", "left", "right"]);
      expect(compositeDirections(role, "vertical"), role).toEqual(["up", "down", "left", "right"]);
      expect(isTrappingRole(role), role).toBe(true);
    }
  });

  it("gives a radio group only the axis it runs along, and all four when that is not known", () => {
    expect(compositeDirections("radiogroup", "horizontal")).toEqual(["left", "right"]);
    expect(compositeDirections("radiogroup", "vertical")).toEqual(["up", "down"]);
    expect(compositeDirections("radiogroup", null)).toEqual(["up", "down", "left", "right"]);
  });

  it("gives a slider only the axis it runs along, so the other one can leave it", () => {
    expect(compositeDirections("slider")).toEqual(["left", "right"]);
    expect(compositeDirections("slider", "horizontal")).toEqual(["left", "right"]);
    expect(compositeDirections("slider", "vertical")).toEqual(["up", "down"]);
  });

  it("leaves a role that is not a trap out of the trapping set", () => {
    for (const role of ["radiogroup", "slider", "tablist", "menu", "separator", null]) {
      expect(isTrappingRole(role), String(role)).toBe(false);
    }
  });

  it("only gives a combobox the vertical arrows while it is open", () => {
    expect(compositeDirections("combobox", null, false)).toBeNull();
    expect(compositeDirections("combobox", null, true)).toEqual(["up", "down"]);
  });

  it("moves a window splitter along its own axis", () => {
    expect(compositeDirections("separator", "vertical")).toEqual(["left", "right"]);
    expect(compositeDirections("separator", "horizontal")).toEqual(["up", "down"]);
  });

  it("returns null for roles that are not composite widgets", () => {
    expect(compositeDirections("button")).toBeNull();
    expect(compositeDirections(null)).toBeNull();
  });
});

describe("menuDirections", () => {
  it("keeps up and down for the items and nothing else for a plain item of a top-level menu", () => {
    expect(menuDirections()).toEqual(["up", "down"]);
    expect(menuDirections({})).toEqual(["up", "down"]);
  });

  it("adds right for an item that opens a submenu, and left inside a submenu", () => {
    expect(menuDirections({ hasSubmenu: true })).toEqual(["up", "down", "right"]);
    expect(menuDirections({ isSubmenu: true })).toEqual(["up", "down", "left"]);
    expect(menuDirections({ hasSubmenu: true, isSubmenu: true })).toEqual([
      "up",
      "down",
      "right",
      "left",
    ]);
  });

  it("adds both horizontal directions in a menubar, which switches menus with them", () => {
    expect(menuDirections({ inMenubar: true })).toEqual(["up", "down", "right", "left"]);
  });

  it("matches the plain menu role when the context says nothing", () => {
    expect(menuDirections()).toEqual(compositeDirections("menu"));
  });
});

describe("runsOffEnd", () => {
  it("is true when the next item in that direction would be past the list", () => {
    expect(runsOffEnd("down", 2, 3)).toBe(true);
    expect(runsOffEnd("right", 2, 3)).toBe(true);
    expect(runsOffEnd("up", 0, 3)).toBe(true);
    expect(runsOffEnd("left", 0, 3)).toBe(true);
  });

  it("is false anywhere else in the list", () => {
    expect(runsOffEnd("down", 1, 3)).toBe(false);
    expect(runsOffEnd("right", 0, 3)).toBe(false);
    expect(runsOffEnd("up", 2, 3)).toBe(false);
    expect(runsOffEnd("left", 1, 3)).toBe(false);
  });

  it("lets a lone item go in every direction", () => {
    for (const direction of ["up", "down", "left", "right"] as const) {
      expect(runsOffEnd(direction, 0, 1), direction).toBe(true);
    }
  });

  it("counts down and right as forward", () => {
    expect(isForward("up")).toBe(false);
    expect(isForward("left")).toBe(false);
    expect(isForward("down")).toBe(true);
    expect(isForward("right")).toBe(true);
  });
});

describe("layoutOrientation", () => {
  it("reads a row, a column and a grid", () => {
    const row = [rect(0, 0, 16, 16), rect(30, 0, 16, 16), rect(60, 0, 16, 16)];
    const column = [rect(0, 0, 16, 16), rect(0, 30, 16, 16), rect(0, 60, 16, 16)];
    const grid = [
      rect(0, 0, 16, 16),
      rect(30, 0, 16, 16),
      rect(0, 30, 16, 16),
      rect(30, 30, 16, 16),
    ];
    expect(layoutOrientation(row)).toBe("horizontal");
    expect(layoutOrientation(column)).toBe("vertical");
    expect(layoutOrientation(grid)).toBeNull();
  });

  it("allows a row to be a little off level", () => {
    expect(layoutOrientation([rect(0, 0, 16, 16), rect(30, 4, 16, 16), rect(60, 2, 16, 16)])).toBe(
      "horizontal",
    );
  });

  it("has nothing to read from one item, or from boxes that have no layout", () => {
    expect(layoutOrientation([rect(0, 0, 16, 16)])).toBeNull();
    expect(layoutOrientation([])).toBeNull();
    expect(layoutOrientation([rect(0, 0, 0, 0), rect(0, 0, 0, 0)])).toBeNull();
  });
});
