"use client";

import * as React from "react";

import {
  GAMEPAD_FOCUS_ATTRIBUTE,
  GAMEPAD_STEP_ATTRIBUTE,
  INPUT_MODALITY_ATTRIBUTE,
  describeElement,
  isSyntheticInput,
  landedElement,
  markActiveElement,
  markGamepadFocus,
  performAction,
  releasePressedKeys,
  rememberActiveElement,
  type InputModality,
} from "./gamepad-dom";
import {
  DEFAULT_DEAD_ZONE,
  DEFAULT_INITIAL_REPEAT_DELAY,
  DEFAULT_REPEAT_INTERVAL,
  createRepeater,
  heldActions,
  type GamepadAction,
  type StickMemory,
} from "./gamepad-logic";

/**
 * Rings the element that has gamepad focus. Put on `<html>` (the provider does it while a pad is in
 * use): `:focus-visible` only follows the keyboard, and a pad is neither, so components' own rings
 * stay dark. An outline survives forced-colors mode, and `!` beats the `outline-hidden` that
 * rings-by-box-shadow components set on themselves. Literal class names so Tailwind finds them in
 * this file whether it is compiled from source or from the package's dist.
 */
export const gamepadFocusRingClass =
  "[&_[data-gamepad-focus]]:outline-solid! [&_[data-gamepad-focus]]:outline-2! [&_[data-gamepad-focus]]:outline-offset-2! [&_[data-gamepad-focus]]:outline-ring!";

export interface GamepadActionEvent {
  action: GamepadAction;
  /**
   * A short description of the element the action landed on, for display. For a move or a tab switch
   * that is the element that has focus afterwards (a tab list hands focus on to its active tab); for
   * A and B it is the element that was pressed or sent Escape, which may no longer exist or have focus.
   */
  target: string;
  /** False when nothing responded, such as pressing B with nothing open. */
  handled: boolean;
  /** Counts up on every action, so two identical presses in a row are still distinguishable. */
  sequence: number;
}

export interface GamepadNavigationState {
  enabled: boolean;
  /** A pad is connected and being polled. */
  connected: boolean;
  /** `Gamepad.id` of the first connected pad. */
  padId: string | null;
  /** The device used last, once a pad has been seen; null before that or while disabled. */
  modality: InputModality | null;
  lastAction: GamepadActionEvent | null;
}

const IDLE: Omit<GamepadNavigationState, "enabled"> = {
  connected: false,
  padId: null,
  modality: null,
  lastAction: null,
};

const GamepadNavigationContext = React.createContext<GamepadNavigationState>({
  enabled: false,
  ...IDLE,
});

/** What the gamepad layer is doing. Outside a provider this reports a disabled layer. */
export function useGamepadNavigation(): GamepadNavigationState {
  return React.useContext(GamepadNavigationContext);
}

export interface GamepadNavigationProviderProps {
  /**
   * Off by default: nothing is listened to or polled until this is true. Mount one enabled provider
   * per page: a second one stays inert (with a warning in development) until the first goes away,
   * because two layers would each perform every press.
   */
  enabled?: boolean;
  /** How far (0 to 1) a stick has to move before it counts as a press. */
  deadZone?: number;
  /** Milliseconds a direction is held before it starts repeating. */
  initialRepeatDelay?: number;
  /** Milliseconds between repeats once repeating has started. */
  repeatInterval?: number;
  /**
   * Pads whose `mapping` is not `"standard"` are ignored. Wheels, flight sticks, HOTAS rigs and some
   * generic USB pads report `""`, and their button and axis numbers do not mean A, B and the D-pad:
   * a trigger on button 0 would click whatever has focus. Set this to read such a pad with the
   * standard layout anyway, for a pad you know lines up with it.
   */
  allowNonStandardPads?: boolean;
  /**
   * Classes added to `<html>` while the gamepad is the active input. The default rings the focused
   * element; pass `""` to draw your own from `[data-gamepad-focus]`.
   */
  ringClassName?: string;
  /**
   * Called with the device that was used last each time it changes. Once a pad has been seen the
   * layer keeps watching the keyboard and mouse as well, so this follows a person who puts the pad
   * down and picks up the mouse.
   */
  onModalityChange?: (modality: InputModality) => void;
  children?: React.ReactNode;
}

type Snapshot = Omit<GamepadNavigationState, "enabled">;

// One layer per page. Every enabled provider polls the pads and performs each action, so two of them
// would act twice on one press: A on a checkbox would toggle it back. The first enabled provider
// owns the page; a later one stays inert, and takes over when the owner goes away. Module-level on
// purpose: two providers may come from different parts of an app that know nothing of each other.
let layerOwner: symbol | null = null;
const layerQueue = new Set<() => void>();

/** Tries to become the page's layer; false when another provider already is, which then waits its turn. */
function claimLayer(token: symbol, retry: () => void): boolean {
  if (layerOwner !== null) {
    layerQueue.add(retry);
    return false;
  }
  layerOwner = token;
  return true;
}

function releaseLayer(token: symbol, retry: () => void): void {
  layerQueue.delete(retry);
  if (layerOwner !== token) {
    return;
  }
  layerOwner = null;
  // Hand the page to the provider that has waited longest.
  const [next] = layerQueue;
  if (next) {
    layerQueue.delete(next);
    next();
  }
}

/**
 * Lets a game controller drive the page: D-pad or left stick moves focus, A activates, B sends
 * Escape, and the shoulder buttons switch tabs. It is a layer over the keyboard behaviour that is
 * already there, not a second set of handlers: arrows reach the focused widget as real key events.
 */
export function GamepadNavigationProvider({
  enabled = false,
  deadZone = DEFAULT_DEAD_ZONE,
  initialRepeatDelay = DEFAULT_INITIAL_REPEAT_DELAY,
  repeatInterval = DEFAULT_REPEAT_INTERVAL,
  allowNonStandardPads = false,
  ringClassName = gamepadFocusRingClass,
  onModalityChange,
  children,
}: GamepadNavigationProviderProps) {
  const [snapshot, setSnapshot] = React.useState<Snapshot>(IDLE);
  // Bumped when the provider that had the page lets go, so a waiting one tries again.
  const [turn, setTurn] = React.useState(0);
  const warnedAboutSecondLayer = React.useRef(false);

  // The latest callback without restarting the polling loop each time its identity changes.
  const onModalityChangeRef = React.useRef(onModalityChange);
  React.useEffect(() => {
    onModalityChangeRef.current = onModalityChange;
  });

  React.useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const token = Symbol("gamepad-navigation");
    const retry = () => setTurn((previous) => previous + 1);
    if (!claimLayer(token, retry)) {
      if (import.meta.env.DEV && !warnedAboutSecondLayer.current) {
        warnedAboutSecondLayer.current = true;
        console.warn(
          "GamepadNavigationProvider: another enabled provider already drives this page, so this one " +
            "does nothing until that one is unmounted or disabled. Mount a single provider near the root.",
        );
      }
      return () => releaseLayer(token, retry);
    }

    const win = window;
    const doc = document;
    const html = doc.documentElement;
    const ringTokens = ringClassName.split(/\s+/).filter(Boolean);
    const modalityBefore = html.getAttribute(INPUT_MODALITY_ATTRIBUTE);
    const repeater = createRepeater({ initialDelay: initialRepeatDelay, interval: repeatInterval });
    // What each stick resolved to last frame, so a stick resting on a diagonal does not flip per frame.
    const sticks: StickMemory = new Map();

    let frame = 0;
    let polling = false;
    let watchingDevices = false;
    let modality: InputModality | null = null;
    let padId: string | null = null;
    let sequence = 0;

    const publish = (patch: Partial<Snapshot>) =>
      setSnapshot((previous) => ({ ...previous, ...patch }));

    const reportError = (error: unknown) => {
      // A failing action or callback must not take the polling loop down with it; say so and go on.
      console.error("GamepadNavigationProvider:", error);
    };

    const acceptsPad = (pad: Gamepad) =>
      pad.connected !== false && (allowNonStandardPads || pad.mapping === "standard");

    const readPads = (): Gamepad[] => {
      if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
        return [];
      }
      try {
        // Pads the browser has dropped come back as null or with connected === false.
        return Array.from(navigator.getGamepads()).filter(
          (pad): pad is Gamepad => pad !== null && acceptsPad(pad),
        );
      } catch {
        // A permissions policy or an insecure context makes the call throw rather than return nothing.
        return [];
      }
    };

    // Real input takes the ring away again. Our own dispatched events must not count as input.
    const onKeyDown = () => {
      if (!isSyntheticInput()) {
        setModality("keyboard");
      }
    };
    const onPointerDown = () => setModality("pointer");
    const onFocusIn = () => markActiveElement(doc);
    // Where focus is, whichever device moved it, so an element removed under it can be left from.
    const onFocusSeen = () => rememberActiveElement(doc);
    const onFocusOut = () => markGamepadFocus(doc, null);

    // Watched from the first pad on until the layer is switched off, so the last device used stays
    // right whichever way a person goes: pad, then keyboard, then mouse.
    const deviceEvents: ReadonlyArray<readonly [string, EventListener]> = [
      ["keydown", onKeyDown],
      ["pointerdown", onPointerDown],
      ["mousedown", onPointerDown],
      ["focusin", onFocusSeen],
    ];
    // Only the pad needs focus marked, because `:focus-visible` is the keyboard's and not the pad's.
    const focusEvents: ReadonlyArray<readonly [string, EventListener]> = [
      ["focusin", onFocusIn],
      ["focusout", onFocusOut],
    ];

    const listen = (events: ReadonlyArray<readonly [string, EventListener]>) => {
      for (const [type, listener] of events) {
        doc.addEventListener(type, listener, true);
      }
    };
    const unlisten = (events: ReadonlyArray<readonly [string, EventListener]>) => {
      for (const [type, listener] of events) {
        doc.removeEventListener(type, listener, true);
      }
    };

    function setModality(next: InputModality) {
      if (next === modality) {
        return;
      }
      const wasGamepad = modality === "gamepad";
      modality = next;
      html.setAttribute(INPUT_MODALITY_ATTRIBUTE, next);

      if (next === "gamepad") {
        html.classList.add(...ringTokens);
        listen(focusEvents);
      } else if (wasGamepad) {
        html.classList.remove(...ringTokens);
        unlisten(focusEvents);
        markGamepadFocus(doc, null);
      }

      publish({ modality: next });
      try {
        onModalityChangeRef.current?.(next);
      } catch (error) {
        reportError(error);
      }
    }

    const run = (action: GamepadAction) => {
      setModality("gamepad");
      const outcome = performAction(doc, action);
      markActiveElement(doc);
      sequence += 1;
      publish({
        lastAction: {
          action,
          target: describeElement(landedElement(doc, action, outcome)),
          handled: outcome.handled,
          sequence,
        },
      });
    };

    const tick = (now: number) => {
      frame = 0;
      const pads = readPads();
      if (pads.length === 0) {
        stopPolling();
        padId = null;
        publish({ connected: false, padId: null });
        return;
      }
      // Ask for the next frame before doing anything that can throw: once the loop is not scheduled,
      // `polling` is still true and nothing would ever start it again. Anything below may also
      // disable the layer; the cleanup cancels this frame if so.
      frame = win.requestAnimationFrame(tick);
      for (const action of repeater.step(heldActions(pads, deadZone, sticks), now)) {
        try {
          run(action);
        } catch (error) {
          reportError(error);
        }
      }
    };

    function startPolling() {
      if (!watchingDevices) {
        watchingDevices = true;
        listen(deviceEvents);
      }
      if (polling) {
        return;
      }
      polling = true;
      // Whatever woke the pad is still held; it must not also click something.
      repeater.reset();
      sticks.clear();
      repeater.prime(heldActions(readPads(), deadZone, sticks));
      frame = win.requestAnimationFrame(tick);
    }

    function stopPolling() {
      polling = false;
      if (frame) {
        win.cancelAnimationFrame(frame);
        frame = 0;
      }
      repeater.reset();
      sticks.clear();
    }

    /** `padId` stays the first connected pad for as long as it is there, and moves on only when it goes. */
    const settlePadId = (pads: readonly Gamepad[], fallback: string | null) => {
      if (padId === null || !pads.some((pad) => pad.id === padId)) {
        padId = pads[0]?.id ?? fallback;
      }
      publish({ connected: true, padId });
    };

    const onConnected = (event: Event) => {
      const eventPad = (event as GamepadEvent).gamepad ?? null;
      const pads = readPads();
      if (pads.length === 0 && !(eventPad && acceptsPad(eventPad))) {
        // A pad the layer ignores (see `allowNonStandardPads`): nothing to poll, nothing to publish.
        return;
      }
      settlePadId(pads, eventPad?.id ?? null);
      if (polling) {
        // Polling already runs for another pad, so `startPolling` will not prime. The button that
        // woke this one is still down; it must not fire on the next frame.
        const fresh = pads.find((pad) => pad.index === eventPad?.index) ?? eventPad;
        if (fresh && acceptsPad(fresh)) {
          repeater.prime(heldActions([fresh], deadZone));
        }
      }
      startPolling();
    };

    const onDisconnected = () => {
      const pads = readPads();
      if (pads.length > 0) {
        settlePadId(pads, null);
        return;
      }
      stopPolling();
      padId = null;
      publish({ connected: false, padId: null });
      if (modality === "gamepad") {
        setModality("keyboard");
      }
    };

    win.addEventListener("gamepadconnected", onConnected);
    win.addEventListener("gamepaddisconnected", onDisconnected);

    // Browsers only announce a pad after a button press, so one that was already awake when the
    // layer was switched on never fires gamepadconnected.
    const present = readPads();
    if (present.length > 0) {
      settlePadId(present, null);
      startPolling();
    }

    return () => {
      win.removeEventListener("gamepadconnected", onConnected);
      win.removeEventListener("gamepaddisconnected", onDisconnected);
      stopPolling();
      releasePressedKeys();
      unlisten(deviceEvents);
      unlisten(focusEvents);
      markGamepadFocus(doc, null);
      html.classList.remove(...ringTokens);
      if (modalityBefore === null) {
        html.removeAttribute(INPUT_MODALITY_ATTRIBUTE);
      } else {
        html.setAttribute(INPUT_MODALITY_ATTRIBUTE, modalityBefore);
      }
      setSnapshot(IDLE);
      releaseLayer(token, retry);
    };
  }, [
    enabled,
    deadZone,
    initialRepeatDelay,
    repeatInterval,
    allowNonStandardPads,
    ringClassName,
    turn,
  ]);

  const value = React.useMemo<GamepadNavigationState>(
    () => ({ enabled, ...(enabled ? snapshot : IDLE) }),
    [enabled, snapshot],
  );

  return (
    <GamepadNavigationContext.Provider value={value}>{children}</GamepadNavigationContext.Provider>
  );
}

export { GAMEPAD_FOCUS_ATTRIBUTE, GAMEPAD_STEP_ATTRIBUTE, INPUT_MODALITY_ATTRIBUTE };
export type { InputModality };
