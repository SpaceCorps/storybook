/**
 * The pure half of the gamepad navigation layer: no DOM, no timers, no globals. Everything here takes
 * plain numbers and returns plain values, so it is tested by feeding it button and axis arrays.
 */

export type Direction = "up" | "down" | "left" | "right";

export type GamepadAction = Direction | "activate" | "cancel" | "previous-tab" | "next-tab";

/** Button indices of the "standard" Gamepad mapping (https://w3c.github.io/gamepad/#remapping). */
export const GAMEPAD_BUTTON = {
  a: 0,
  b: 1,
  leftBumper: 4,
  rightBumper: 5,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
} as const;

/** Axis indices of the standard mapping; the right stick (2, 3) is left alone. */
export const GAMEPAD_AXIS = { leftStickX: 0, leftStickY: 1 } as const;

/** A stick has to move further than this (of a -1..1 range) before it counts as a press. */
export const DEFAULT_DEAD_ZONE = 0.5;
/** How long a direction is held before it starts repeating, in milliseconds. */
export const DEFAULT_INITIAL_REPEAT_DELAY = 400;
/** Gap between repeats once repeating has started, in milliseconds. */
export const DEFAULT_REPEAT_INTERVAL = 120;

/**
 * The part of a `Gamepad` this layer reads. A real `Gamepad` satisfies it, and so does a plain
 * object, which is what the tests use.
 */
export interface PadSnapshot {
  readonly buttons: ArrayLike<{ readonly pressed: boolean }>;
  readonly axes: ArrayLike<number>;
}

const BUTTON_ACTIONS: ReadonlyArray<readonly [number, GamepadAction]> = [
  [GAMEPAD_BUTTON.dpadUp, "up"],
  [GAMEPAD_BUTTON.dpadDown, "down"],
  [GAMEPAD_BUTTON.dpadLeft, "left"],
  [GAMEPAD_BUTTON.dpadRight, "right"],
  [GAMEPAD_BUTTON.a, "activate"],
  [GAMEPAD_BUTTON.b, "cancel"],
  [GAMEPAD_BUTTON.leftBumper, "previous-tab"],
  [GAMEPAD_BUTTON.rightBumper, "next-tab"],
];

/** Actions that keep firing while the button is held. Activate and cancel fire once per press. */
const REPEATABLE: ReadonlySet<GamepadAction> = new Set([
  "up",
  "down",
  "left",
  "right",
  "previous-tab",
  "next-tab",
]);

export const isRepeatable = (action: GamepadAction): boolean => REPEATABLE.has(action);

const finite = (value: number | undefined): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

/** How far a pushed stick may fall back below the dead zone before it counts as released, so a stick resting on the edge does not flicker. */
const STICK_RELEASE_MARGIN = 0.1;
/** How much further the other axis has to be pushed before a stick held along one axis switches to it. */
const STICK_AXIS_MARGIN = 0.15;

const SIGN: Record<Direction, 1 | -1> = { up: -1, down: 1, left: -1, right: 1 };

const isHorizontal = (direction: Direction): boolean =>
  direction === "left" || direction === "right";

/**
 * The direction a stick is pushed in, or null inside the dead zone. A diagonal push resolves to the
 * stronger axis, so one stick never presses two directions at once.
 *
 * `previous` is what this stick resolved to on the last frame. A stick resting near a diagonal
 * differs from itself by a hair every frame, and without memory the stronger axis would flip back and
 * forth, each flip a fresh press that skips the repeat delay. With it, the direction already chosen
 * holds until the other axis is pushed clearly further (`STICK_AXIS_MARGIN`), and is let go only once
 * the stick has fallen a little below the dead zone (`STICK_RELEASE_MARGIN`), not at the edge itself.
 */
export function stickDirection(
  x: number,
  y: number,
  deadZone: number,
  previous: Direction | null = null,
): Direction | null {
  const px = finite(x);
  const py = finite(y);
  const ax = Math.abs(px);
  const ay = Math.abs(py);

  if (previous) {
    const horizontal = isHorizontal(previous);
    const own = horizontal ? ax : ay;
    const other = horizontal ? ay : ax;
    const along = horizontal ? px : py;
    const releaseAt = deadZone - Math.min(STICK_RELEASE_MARGIN, deadZone / 2);
    if (Math.sign(along) === SIGN[previous] && own > releaseAt && other < own + STICK_AXIS_MARGIN) {
      return previous;
    }
  }

  if (ax <= deadZone && ay <= deadZone) {
    return null;
  }
  if (ax > ay) {
    return px > 0 ? "right" : "left";
  }
  return py > 0 ? "down" : "up";
}

/**
 * What each stick resolved to on the last frame, keyed by the pad's place in the list. Hand the same
 * map to every `heldActions` call of one polling loop; leave it out for a one-off, memoryless read.
 */
export type StickMemory = Map<number, Direction | null>;

/**
 * Every action currently held across all pads: the D-pad and face/shoulder buttons plus the left stick.
 * Reads the standard mapping only, so the caller must not pass pads that use another one.
 */
export function heldActions(
  pads: readonly PadSnapshot[],
  deadZone: number = DEFAULT_DEAD_ZONE,
  sticks?: StickMemory,
): Set<GamepadAction> {
  const held = new Set<GamepadAction>();
  pads.forEach((pad, position) => {
    for (const [index, action] of BUTTON_ACTIONS) {
      if (pad.buttons[index]?.pressed) {
        held.add(action);
      }
    }
    const stick = stickDirection(
      pad.axes[GAMEPAD_AXIS.leftStickX],
      pad.axes[GAMEPAD_AXIS.leftStickY],
      deadZone,
      sticks?.get(position) ?? null,
    );
    sticks?.set(position, stick);
    if (stick) {
      held.add(stick);
    }
  });
  // A pad that has gone must not leave its stick direction behind for the next one to inherit.
  if (sticks) {
    for (const position of sticks.keys()) {
      if (position >= pads.length) {
        sticks.delete(position);
      }
    }
  }
  return held;
}

export interface RepeaterOptions {
  initialDelay?: number;
  interval?: number;
}

export interface Repeater {
  /** The actions to run for this frame: new presses at once, held repeatable ones when they come due. */
  step(held: ReadonlySet<GamepadAction>, now: number): GamepadAction[];
  /**
   * Treats what is held right now as already handled, so the button that woke a pad up does not also
   * click something. It fires again only after being released and pressed anew.
   */
  prime(held: ReadonlySet<GamepadAction>): void;
  reset(): void;
}

/**
 * Turns "which actions are held this frame" into "which actions fire this frame". A press fires at
 * once; a repeatable action then fires again after `initialDelay` and every `interval` after that.
 * At most one firing per action per frame, so a stalled frame loop cannot burst.
 */
export function createRepeater({
  initialDelay = DEFAULT_INITIAL_REPEAT_DELAY,
  interval = DEFAULT_REPEAT_INTERVAL,
}: RepeaterOptions = {}): Repeater {
  // Infinity means "fired, never again until released".
  const nextDue = new Map<GamepadAction, number>();

  return {
    step(held, now) {
      for (const action of nextDue.keys()) {
        if (!held.has(action)) {
          nextDue.delete(action);
        }
      }
      const fired: GamepadAction[] = [];
      for (const action of held) {
        const due = nextDue.get(action);
        if (due === undefined) {
          fired.push(action);
          nextDue.set(action, isRepeatable(action) ? now + initialDelay : Infinity);
        } else if (now >= due) {
          fired.push(action);
          nextDue.set(action, now + interval);
        }
      }
      return fired;
    },
    prime(held) {
      for (const action of held) {
        nextDue.set(action, Infinity);
      }
    },
    reset() {
      nextDue.clear();
    },
  };
}

/** The part of a `DOMRect` the spatial search needs. */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const centreX = (rect: Rect) => (rect.left + rect.right) / 2;
const centreY = (rect: Rect) => (rect.top + rect.bottom) / 2;

/** Candidates must sit at least this far (px) past the origin's centre to count as "in that direction". */
const MIN_TRAVEL = 1;

/**
 * Which candidate is nearest in `direction` from `origin`, or -1 when none lies that way.
 *
 * The score is the empty space between the facing edges plus a quarter of the centre-to-centre
 * travel, with a heavy penalty for sitting off to the side of the origin's extent. A candidate that
 * overlaps the origin's extent is in line with it, however wide either box is, so only a light
 * penalty for how far off-centre it sits breaks ties. That makes the neighbour straight ahead win
 * over a closer one that is diagonal, and a small checkbox under a full-width field win over the
 * buttons beyond it.
 */
export function pickSpatialTarget(
  origin: Rect,
  candidates: readonly Rect[],
  direction: Direction,
): number {
  const horizontal = direction === "left" || direction === "right";
  const sign = direction === "right" || direction === "down" ? 1 : -1;
  const originAlong = horizontal ? centreX(origin) : centreY(origin);
  const originAcross = horizontal ? centreY(origin) : centreX(origin);

  let best = -1;
  let bestScore = Infinity;
  candidates.forEach((rect, index) => {
    const along = ((horizontal ? centreX(rect) : centreY(rect)) - originAlong) * sign;
    if (along <= MIN_TRAVEL) {
      return;
    }
    const across = Math.abs((horizontal ? centreY(rect) : centreX(rect)) - originAcross);

    // Space between the near edge of the candidate and the far edge of the origin; 0 when they overlap.
    const gap = horizontal
      ? sign > 0
        ? rect.left - origin.right
        : origin.left - rect.right
      : sign > 0
        ? rect.top - origin.bottom
        : origin.top - rect.bottom;
    // Distance between the two boxes' extents on the other axis; 0 when they overlap there.
    const sideGap = horizontal
      ? Math.max(0, rect.top - origin.bottom, origin.top - rect.bottom)
      : Math.max(0, rect.left - origin.right, origin.left - rect.right);

    const score =
      Math.max(0, gap) + along * 0.25 + sideGap * 4 + across * (sideGap > 0 ? 0.5 : 0.1);
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

/** `index` moved by one step, wrapping at both ends. */
export function stepIndex(index: number, count: number, step: 1 | -1): number {
  if (count <= 0) {
    return -1;
  }
  return (((index + step) % count) + count) % count;
}

export const ARROW_KEY: Record<Direction, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

export type Orientation = "horizontal" | "vertical";

/** Down and right go to the next item of a list, up and left to the previous one. */
export const isForward = (direction: Direction): boolean =>
  direction === "down" || direction === "right";

/** True when stepping `direction` from item `index` of `count` would run off the first or last item. */
export function runsOffEnd(direction: Direction, index: number, count: number): boolean {
  return isForward(direction) ? index >= count - 1 : index <= 0;
}

/**
 * Which way a run of items is laid out, read from their boxes: "horizontal" for a row, "vertical" for
 * a column, null for a grid, a single item, or no layout to read (jsdom reports every box as empty).
 * Two items count as sharing a row when their centres differ by less than half the smallest height.
 */
export function layoutOrientation(rects: readonly Rect[]): Orientation | null {
  if (rects.length < 2) {
    return null;
  }
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
  const spreadX = spread(rects.map(centreX));
  const spreadY = spread(rects.map(centreY));
  const rowTolerance = Math.min(...rects.map((rect) => rect.bottom - rect.top)) / 2;
  const columnTolerance = Math.min(...rects.map((rect) => rect.right - rect.left)) / 2;
  if (spreadY <= rowTolerance && spreadX > spreadY) {
    return "horizontal";
  }
  if (spreadX <= columnTolerance && spreadY > spreadX) {
    return "vertical";
  }
  return null;
}

const BOTH_AXES: readonly Direction[] = ["up", "down", "left", "right"];
const HORIZONTAL: readonly Direction[] = ["left", "right"];
const VERTICAL: readonly Direction[] = ["up", "down"];

/** Roles with no free axis: the widget wants all four directions, so one it ignores has to leave. */
const TRAPPING_ROLES: ReadonlySet<string> = new Set(["tree", "grid", "treegrid"]);

export const isTrappingRole = (role: string | null): boolean =>
  role !== null && TRAPPING_ROLES.has(role);

/** What the focused item and its menu say about where Left and Right lead; see `menuDirections`. */
export interface MenuContext {
  /** The focused item opens a submenu (`aria-haspopup`). */
  hasSubmenu?: boolean;
  /** The menu is itself a submenu, opened from an item of another menu. */
  isSubmenu?: boolean;
  /** The menu hangs off a menubar, where Left and Right switch to the neighbouring menu. */
  inMenubar?: boolean;
}

/**
 * The directions a menu keeps for itself. Up and Down walk the items. Right is the menu's when the
 * focused item opens a submenu (or the menu belongs to a menubar, which moves to the next menu), and
 * Left when the menu is a submenu (it closes) or belongs to a menubar. Radix handles all of them
 * once it receives the real arrow key, so the pad only has to leave them alone otherwise: a Left that
 * the menu does not need moves focus on like any other, instead of being swallowed.
 */
export function menuDirections({
  hasSubmenu = false,
  isSubmenu = false,
  inMenubar = false,
}: MenuContext = {}): readonly Direction[] {
  return [
    ...VERTICAL,
    ...(hasSubmenu || inMenubar ? (["right"] as const) : []),
    ...(isSubmenu || inMenubar ? (["left"] as const) : []),
  ];
}

/**
 * The directions a composite widget keeps for itself, or null for a role that is not one. Every other
 * direction is not the widget's, so it moves focus out of it. A D-pad has no Tab key, so a widget that
 * swallowed a direction without ever giving it back would be a place you cannot leave.
 *
 * | widget                                 | takes                                      | lets go                                                          |
 * | -------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
 * | tablist, toolbar, menubar              | Left/Right (Up/Down when vertical)         | the other axis at once; these wrap, so the ends do not           |
 * | listbox                                | Up/Down (Left/Right when horizontal)       | the other axis at once; B closes the popup                       |
 * | menu                                   | Up/Down, plus Right on an item that opens  | Left and Right otherwise (see `menuDirections`); B closes it     |
 * |                                        | a submenu and Left inside one, or both in  |                                                                  |
 * |                                        | a menubar                                  |                                                                  |
 * | toggle group (Radix, role=group)       | like a radio group: its orientation, else  | the other axis, and its own axis past the first or last item     |
 * |                                        | its layout, else all four                  |                                                                  |
 * | radiogroup, native radios              | its orientation: `aria-orientation`, else  | the other axis at once, and its own axis past the first or last  |
 * |                                        | the layout (a row: Left/Right, a column:   | radio (the pad does not wrap, it moves on)                       |
 * |                                        | Up/Down), else all four                    |                                                                  |
 * | slider, native range                   | Left/Right (Up/Down when vertical)         | the other axis at once; it stops at min and max                  |
 * | native select                          | Left/Right: previous and next option       | Up/Down at once, so passing a select never changes it; it stops  |
 * |                                        |                                            | at the first and last option                                     |
 * | spinbutton, number input               | Up/Down: step the value                    | Left/Right                                                       |
 * | separator (window splitter)            | along the split (Left/Right for a divider  | the other axis                                                   |
 * |                                        | that stands upright)                       |                                                                  |
 * | combobox                               | Up/Down while its list is open             | everything while it is closed                                    |
 * | tree, grid, treegrid                   | all four                                   | a direction the widget did not act on (it neither prevented the  |
 * |                                        |                                            | key nor moved focus); B steps out when nothing handled Escape    |
 * | table row (roving rows)                | Up/Down                                    | Left/Right                                                       |
 *
 * A spinbutton is an element with `role="spinbutton"`, a native `input[type=number]`, or any field
 * that marks itself with `data-gamepad-step` because it steps its value on ArrowUp and ArrowDown
 * without having a role (a masked text input, say).
 *
 * `orientation` is the widget's own, already resolved by the caller (for a radio group, from its
 * `aria-orientation` or else from `layoutOrientation`). The edge rule of the radio rows and the
 * "did the widget act" rule of the last two live in gamepad-dom.ts, where the DOM is.
 */
export function compositeDirections(
  role: string | null,
  orientation: string | null = null,
  expanded = false,
): readonly Direction[] | null {
  const vertical = orientation === "vertical";
  switch (role) {
    case "tablist":
    case "toolbar":
    case "menubar":
      return vertical ? VERTICAL : HORIZONTAL;
    case "listbox":
    case "menu":
      return orientation === "horizontal" ? HORIZONTAL : VERTICAL;
    case "radiogroup":
      if (orientation === "horizontal") {
        return HORIZONTAL;
      }
      return vertical ? VERTICAL : BOTH_AXES;
    case "tree":
    case "grid":
    case "treegrid":
      return BOTH_AXES;
    case "slider":
      return vertical ? VERTICAL : HORIZONTAL;
    case "spinbutton":
      return VERTICAL;
    // A window splitter: a horizontal one moves with up/down, a vertical one with left/right.
    case "separator":
      return vertical ? HORIZONTAL : VERTICAL;
    // A combobox only owns the vertical arrows while its list is open.
    case "combobox":
      return expanded ? VERTICAL : null;
    default:
      return null;
  }
}
