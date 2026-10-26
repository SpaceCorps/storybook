import * as React from "react";

import { useMergedRefs } from "@/lib/merge-refs";

/**
 * Radix returns focus to a modal's own Trigger and nowhere else. Every dialog the accounting app
 * opens is driven by state (`open={...}`) from a plain button, so there is no Trigger: Escape,
 * Cancel and Save all dropped focus on <body> and the next Tab started again at the top of the
 * page. This remembers whoever had focus when the overlay opened and hands it back on close.
 */

/** What a user is most likely to want to type into when a form dialog opens. */
const FIELD_SELECTOR = [
  'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]):not([type="file"]):not([disabled]):not([readonly])',
  "textarea:not([disabled]):not([readonly])",
  "select:not([disabled])",
  '[role="combobox"]:not([disabled]):not([aria-disabled="true"])',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(",");

const AUTOFOCUS_SELECTOR = "[data-autofocus],[autofocus]";

const HIDDEN_SELECTOR = '[hidden],[inert],[aria-hidden="true"]';

type FocusHandler = (event: Event) => void;

export interface UseReturnFocusOptions<ContentElement extends HTMLElement = HTMLElement> {
  /** Runs first; calling `preventDefault()` opts out of the default initial focus. */
  onOpenAutoFocus?: FocusHandler;
  /** Runs first; calling `preventDefault()` opts out of returning focus to the opener. */
  onCloseAutoFocus?: FocusHandler;
  /**
   * Where focus goes on close when the opener is gone, for example the row whose action menu
   * opened a dialog that deleted it.
   */
  fallbackFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * Move focus into the first field on open (`data-autofocus`, else the first text-like field)
   * instead of the Close button. Leave it off where Radix already has a better target, as the
   * AlertDialog's Cancel button.
   */
  focusFirstField?: boolean;
  /**
   * The ref the content forwards to its caller. Hand it over and put `ref` from the result on the
   * content instead, so the caller's ref keeps working while the hook sees the content element.
   */
  forwardedRef?: React.ForwardedRef<ContentElement>;
}

export interface UseReturnFocusResult<ContentElement extends HTMLElement = HTMLElement> {
  onOpenAutoFocus: FocusHandler;
  onCloseAutoFocus: FocusHandler;
  /**
   * Render as the FIRST child of the overlay content. It records the opener in a layout effect,
   * which runs before a child's React `autoFocus` and before Radix's own mount focus. Radix skips
   * its mount event when the content already holds focus, so `onOpenAutoFocus` alone misses it.
   */
  anchor: React.ReactElement;
  /**
   * Put on the overlay content (together with `forwardedRef`) so a second overlay opened from
   * inside this one, while this one animates out, can tell and inherit this one's opener.
   */
  ref: React.RefCallback<ContentElement>;
}

/** An element is only worth returning to while it can still take focus. */
function isConnectedElement(element: HTMLElement | null | undefined): element is HTMLElement {
  return Boolean(element?.isConnected);
}

const POPPER_WRAPPER = "[data-radix-popper-content-wrapper]";

/**
 * Who held focus just before it moved into each popper layer (a menu, popover or select). A
 * ContextMenu has no trigger button that carries `aria-controls`, so the control that had focus when
 * it opened is the only record of what opened it.
 */
const popperOpeners = new WeakMap<Element, HTMLElement>();

let trackingPoppers = false;

/**
 * Starts watching for focus moving into a popper. This runs when the module loads rather than when
 * an overlay mounts: the focus that matters moved into the menu before the overlay it opens exists.
 */
function trackPoppers() {
  if (trackingPoppers || typeof document === "undefined") return;
  trackingPoppers = true;

  document.addEventListener(
    "focusin",
    (event) => {
      const { target, relatedTarget } = event;
      if (!(target instanceof Element) || !(relatedTarget instanceof HTMLElement)) return;
      const wrapper = target.closest(POPPER_WRAPPER);
      if (!wrapper || wrapper.contains(relatedTarget) || relatedTarget.closest(POPPER_WRAPPER)) {
        return;
      }
      popperOpeners.set(wrapper, relatedTarget);
    },
    true,
  );
}
trackPoppers();

/**
 * An opener inside a menu or popover that closes with the dialog's opening is gone by the time the
 * dialog closes, so remember the control that opened that menu instead. Radix links the two with
 * `aria-controls` on the trigger (and `aria-labelledby` on a dropdown's content). A ContextMenu has
 * neither, so the element that held focus before the menu took it stands in.
 */
function resolveOpener(active: HTMLElement): HTMLElement {
  const wrapper = active.closest(POPPER_WRAPPER);
  const layer = wrapper?.firstElementChild;
  if (layer?.id) {
    // A scan rather than an attribute selector: ids from useId() contain colons, and jsdom has no
    // CSS.escape to quote them with.
    const owner = Array.from(document.querySelectorAll<HTMLElement>("[aria-controls]")).find(
      (element) => element.getAttribute("aria-controls") === layer.id,
    );
    if (owner) return owner;
    const labelledBy = layer.getAttribute("aria-labelledby");
    const labelOwner = labelledBy ? document.getElementById(labelledBy) : null;
    if (labelOwner) return labelOwner;
  }
  const remembered = wrapper ? popperOpeners.get(wrapper) : undefined;
  return remembered?.isConnected ? remembered : active;
}

function focusCandidates(root: HTMLElement): HTMLElement[] {
  const marked = Array.from(root.querySelectorAll<HTMLElement>(AUTOFOCUS_SELECTOR));
  const fields = Array.from(root.querySelectorAll<HTMLElement>(FIELD_SELECTOR));
  // A marked wrapper stands for the first field inside it.
  const expanded = marked.flatMap((element) =>
    element.matches(FIELD_SELECTOR)
      ? [element]
      : [...Array.from(element.querySelectorAll<HTMLElement>(FIELD_SELECTOR)), element],
  );
  return [...expanded, ...fields].filter((element) => !element.closest(HIDDEN_SELECTOR));
}

/** True on a phone, where focusing a field raises the keyboard over the dialog it just opened. */
function prefersTouch(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Focus the field a person opening a form dialog wants to type into. Returns true when focus moved.
 * Radix would otherwise pick the first tabbable, which is the Close button.
 */
function focusFirstField(event: Event): boolean {
  const root = (event.currentTarget ?? event.target) as HTMLElement | null;
  if (!root || prefersTouch()) return false;
  for (const candidate of focusCandidates(root)) {
    candidate.focus();
    if (document.activeElement === candidate) {
      event.preventDefault();
      return true;
    }
  }
  return false;
}

interface Session {
  captured: boolean;
  opener: HTMLElement | null;
  /** The overlay content element, once the caller has put `ref` on it. */
  container: HTMLElement | null;
}

/** Every overlay that is open or still animating out. */
const liveSessions = new Set<Session>();

/**
 * The opener of an overlay that unmounted in this very task. When one overlay closes and another
 * opens from a control inside it (a wizard's Next, an AlertDialog's Yes that opens a form), both
 * happen in one commit, the control is gone, and focus is on <body>: the second overlay would
 * otherwise find nothing to return to.
 */
let handoff: { opener: HTMLElement | null } | null = null;

/**
 * An overlay opened from inside another overlay that is on its way out has not really been opened
 * by that overlay's button, which is about to leave the page. It was opened by whatever opened the
 * first one, and that is what closing it should return to.
 */
function inheritedOpener(
  self: Session,
  candidates: Array<HTMLElement | null>,
): { opener: HTMLElement | null } | null {
  for (const element of candidates) {
    if (!element) continue;
    for (const other of liveSessions) {
      if (other === self || !other.container?.contains(element)) continue;
      // Still open: a nested overlay, which returns to the control inside its parent as usual.
      if (other.container.getAttribute("data-state") === "closed") return { opener: other.opener };
    }
  }
  // Focus on <body> and an overlay that unmounted a moment ago: its button was focused.
  if (candidates.every((element) => element === null) && handoff) return handoff;
  return null;
}

function ReturnFocusAnchor({ onMount }: { onMount: () => () => void }): null {
  React.useLayoutEffect(() => onMount(), [onMount]);
  return null;
}

export function useReturnFocus<ContentElement extends HTMLElement = HTMLElement>(
  options: UseReturnFocusOptions<ContentElement> = {},
): UseReturnFocusResult<ContentElement> {
  const {
    onOpenAutoFocus,
    onCloseAutoFocus,
    fallbackFocusRef,
    focusFirstField: wantsField,
    forwardedRef,
  } = options;

  // `captured` stays true for the whole open session, so a later capture cannot overwrite the
  // opener with a control inside the overlay itself. StrictMode's extra layout-effect pass runs
  // before Radix moves focus and would find the opener again anyway; what the guard is for is an
  // anchor that remounts while the overlay is open, which captures with focus already inside it.
  // One object for the hook's lifetime, so the registry above can hold on to it.
  const session = React.useRef<Session>({ captured: false, opener: null, container: null });

  const capture = React.useCallback(() => {
    const self = session.current;
    if (self.captured) return;
    self.captured = true;
    const active = document.activeElement;
    const focused = active instanceof HTMLElement && active !== document.body ? active : null;
    const opener = focused ? resolveOpener(focused) : null;
    self.opener = (inheritedOpener(self, [focused, opener]) ?? { opener }).opener;
  }, []);

  const mount = React.useCallback(() => {
    const self = session.current;
    liveSessions.add(self);
    capture();
    return () => {
      liveSessions.delete(self);
      const released = { opener: self.opener };
      handoff = released;
      queueMicrotask(() => {
        if (handoff === released) handoff = null;
      });
    };
  }, [capture]);

  const setContainer = React.useCallback((node: ContentElement | null) => {
    session.current.container = node;
  }, []);
  // Merged rather than called by hand: a React 19 callback ref may return a cleanup, and a hand-rolled
  // merge swallows it and calls the caller's ref with `null` instead.
  const ref = useMergedRefs<ContentElement>(forwardedRef, setContainer);

  const handleOpen = React.useCallback(
    (event: Event) => {
      onOpenAutoFocus?.(event);
      if (event.defaultPrevented || !wantsField) return;
      focusFirstField(event);
    },
    [onOpenAutoFocus, wantsField],
  );

  const handleClose = React.useCallback(
    (event: Event) => {
      onCloseAutoFocus?.(event);

      // StrictMode runs the focus scope's cleanup once while the overlay is still open. That is
      // not a close: the content is still in the document, and the opener must survive for the
      // real one.
      const container = event.target;
      if (container instanceof Node && container.isConnected) return;

      const self = session.current;
      const opener = self.opener;
      self.captured = false;
      self.opener = null;
      if (event.defaultPrevented) return;

      // A modal leaves focus on <body> when its content goes. Focus anywhere else was put there on
      // purpose, by a click outside a non-modal overlay or by the caller, and is not ours to take.
      const active = document.activeElement;
      if (active && active !== document.body && active !== document.documentElement) return;

      for (const target of [opener, fallbackFocusRef?.current]) {
        if (!isConnectedElement(target)) continue;
        target.focus();
        if (document.activeElement === target) {
          // Stops Radix refocusing its Trigger, which would win over a different opener.
          event.preventDefault();
          return;
        }
      }
    },
    [onCloseAutoFocus, fallbackFocusRef],
  );

  const anchor = React.createElement(ReturnFocusAnchor, { onMount: mount });

  return { onOpenAutoFocus: handleOpen, onCloseAutoFocus: handleClose, anchor, ref };
}
