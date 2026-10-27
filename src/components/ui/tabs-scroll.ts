import * as React from "react";

/*
 * Keeps a tab list that is wider than its container usable: it scrolls inside itself, the tab in use
 * is brought into view, and the two edges say whether there is more past them.
 *
 * The tab in use is brought into view when it is first shown, when it becomes the value, when it is
 * mounted after the value was set, when the keyboard moves focus to it, and when the list changes
 * width. Scrolling by hand is not fought: a scroll or a wheel does nothing to the tab in use, a
 * render that changes nothing about it does not reveal it again, and a resize that leaves the width
 * alone (the height changed) does not either. A change of width does bring the tab back even when the
 * person had scrolled away from it: that is the price of never leaving it cut off by a window that
 * was narrowed.
 *
 * Everything here works in *logical* coordinates, measured from the edge the content starts at (the
 * left in a left-to-right list, the right in a right-to-left one), so the arithmetic is written once.
 * Only the two ends of the pipeline know about direction: `readState` turns the browser's physical
 * numbers into logical ones, and `scrollListTo` turns the answer back.
 */

/** How far past a scroll edge still counts as "at the edge": scroll positions are fractional. */
const EDGE_TOLERANCE_PX = 1;

export interface Edges {
  /** There is more content past the physical left edge. */
  left: boolean;
  /** There is more content past the physical right edge. */
  right: boolean;
}

const NO_EDGES: Edges = { left: false, right: false };

export interface ScrollState {
  /** How far the content has been scrolled from its start. */
  scroll: number;
  /** The width of the visible window. */
  client: number;
  /** The width of everything inside it. */
  size: number;
}

/** Which sides of a scroller have content past them. */
export function overflowSides({ scroll, client, size }: ScrollState): {
  start: boolean;
  end: boolean;
} {
  const max = Math.max(0, size - client);
  return { start: scroll > EDGE_TOLERANCE_PX, end: max - scroll > EDGE_TOLERANCE_PX };
}

export interface RevealInput extends ScrollState {
  /** Scroll padding: the margin a tab is brought to, which the edge fade must not reach into. */
  inset: { start: number; end: number };
  /** The tab to show, in content coordinates. */
  tab: { start: number; end: number };
  /** Where every tab starts, in content coordinates: the points the list snaps to. */
  starts: readonly number[];
}

/**
 * The scroll offset that shows `tab` whole, or null when it already is (or nothing can move).
 *
 * Scrolling back brings the tab's start to the inset, which is where the list snaps to anyway. Scrolling
 * forward does not use the least offset that shows the tab: the list would then snap to the nearest
 * tab start, which can be the one before, and take the end of the tab out of view again. It takes
 * the first tab start that is at least that far along instead. A tab wider than the window is shown
 * from its start.
 */
export function revealScroll({
  scroll,
  client,
  size,
  inset,
  tab,
  starts,
}: RevealInput): number | null {
  const max = Math.max(0, size - client);
  let next = scroll;

  if (tab.start - inset.start < scroll) {
    next = tab.start - inset.start;
  } else if (tab.end + inset.end > scroll + client) {
    const needed = tab.end + inset.end - client;
    const own = tab.start - inset.start;
    const snapped = starts
      .map((start) => start - inset.start)
      .filter((position) => position >= needed - EDGE_TOLERANCE_PX && position <= own);
    next = snapped.length > 0 ? Math.min(...snapped) : Math.min(needed, own);
  }

  next = Math.min(max, Math.max(0, next));
  return Math.abs(next - scroll) < EDGE_TOLERANCE_PX / 2 ? null : next;
}

const px = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * How much a transform (a scaling ancestor: a dialog opens at 95% and grows) has shrunk or stretched
 * what `getBoundingClientRect` reports compared with the layout the scroll offsets are in.
 *
 * The list's layout width is its used `width`, which is a fraction of a pixel and the border box only
 * when box-sizing says so. `offsetWidth` is not a substitute: it is rounded, and for a box at a
 * fractional position snapped to the device pixel, so it can be a whole pixel off. That would call an
 * untransformed list 358.4px wide "0.3% scaled", an error that grows with a tab's distance from the
 * edge, and it is the one thing this must not do.
 */
function layoutScale(style: CSSStyleDeclaration, box: DOMRect): number {
  const used = px(style.width);
  if (!(used > 0)) return 1;
  const width =
    style.boxSizing === "border-box"
      ? used
      : used +
        px(style.paddingLeft) +
        px(style.paddingRight) +
        px(style.borderLeftWidth) +
        px(style.borderRightWidth);
  return box.width / width;
}

function readState(list: HTMLElement): { rtl: boolean } & ScrollState {
  const rtl = getComputedStyle(list).direction === "rtl";
  // A right-to-left scroller reports its offset as 0 at the start and negative from there.
  return {
    rtl,
    scroll: rtl ? -list.scrollLeft : list.scrollLeft,
    client: list.clientWidth,
    size: list.scrollWidth,
  };
}

/** The edges the list can still be scrolled towards, as the physical sides they are on. */
function readEdges(list: HTMLElement): Edges {
  const { rtl, ...state } = readState(list);
  const { start, end } = overflowSides(state);
  return rtl ? { left: end, right: start } : { left: start, right: end };
}

function scrollListTo(list: HTMLElement, logical: number, rtl: boolean, behavior: ScrollBehavior) {
  const left = rtl ? -logical : logical;
  // jsdom has no element scrollTo.
  if (typeof list.scrollTo === "function") list.scrollTo({ left, behavior });
  else list.scrollLeft = left;
}

/** Scrolls `tab` into view inside `list`, and nothing else: the page keeps its own scroll position. */
function revealTab(list: HTMLElement, tab: HTMLElement, behavior: ScrollBehavior): void {
  const { rtl, ...state } = readState(list);
  const box = list.getBoundingClientRect();
  const style = getComputedStyle(list);
  // Rectangles are in screen pixels and the scroll offsets in layout pixels; they agree unless a
  // transform sits between the two, and then every distance has to be taken back to layout.
  const scale = layoutScale(style, box);
  // Offsets are measured inside the border, where the scrollable area starts.
  const edge = (element: Element) => {
    const rect = element.getBoundingClientRect();
    const gap = rtl ? box.right - rect.right : rect.left - box.left;
    const start = gap / scale - list.clientLeft + state.scroll;
    return { start, end: start + rect.width / scale };
  };
  const inset = rtl
    ? { start: px(style.scrollPaddingRight), end: px(style.scrollPaddingLeft) }
    : { start: px(style.scrollPaddingLeft), end: px(style.scrollPaddingRight) };
  const starts = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]')).map(
    (element) => edge(element).start,
  );

  const next = revealScroll({ ...state, inset, tab: edge(tab), starts });
  if (next !== null) scrollListTo(list, next, rtl, behavior);
}

const ACTIVE_TAB = '[role="tab"][data-state="active"]';

/**
 * Whether the person asked for less motion. Anything but a clear yes is "no": a `matchMedia` that is
 * missing, throws, or hands back nothing (a stub, a sandboxed frame, a partial polyfill) must not
 * take the tree down on a tab change, which is where this is read.
 */
const prefersReducedMotion = (): boolean => {
  try {
    return (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
    );
  } catch {
    return false;
  }
};

/** Focus that came from the keyboard (or a script after one); a press is left to the selection. */
function isKeyboardFocus(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    // An engine without :focus-visible: reveal anyway, the worst case is an instant scroll.
    return true;
  }
}

/**
 * Wires a tab list's scrolling: the fade edges, the tab in use kept in view, and a focus handler that
 * reveals the tab the keyboard moved to.
 *
 * What reveals the tab in use, and how: its first showing is instant, so is a tab that arrives after
 * the value was set, and so is a resize (a smooth scroll would lag a window being dragged); only a
 * change of value scrolls smoothly, and not under reduced motion. Measuring never loops: the state
 * only changes when a side flips, and a scroll event or a resize is all that measures besides a
 * render.
 */
export function useTabsListScroll(
  listRef: React.RefObject<HTMLElement | null>,
  value: string | undefined,
): { edges: Edges; onFocus: (event: React.FocusEvent<HTMLElement>) => void } {
  const [edges, setEdges] = React.useState<Edges>(NO_EDGES);
  // What the last render showed: which tab was in use, and for which value. A tab is revealed when
  // this changes, not when a render merely happens.
  const seen = React.useRef<{ value: string | undefined; tab: HTMLElement | null } | null>(null);
  // The list had no width when its tab came into use, so there was nothing to place it in yet.
  const waiting = React.useRef(false);
  const width = React.useRef(0);

  const measure = React.useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    // A vertical list is not a scroller, so there is never more past an edge.
    const next = list.getAttribute("data-orientation") === "vertical" ? NO_EDGES : readEdges(list);
    setEdges((current) =>
      current.left === next.left && current.right === next.right ? current : next,
    );
  }, [listRef]);

  const revealActive = React.useCallback(
    (behavior: ScrollBehavior) => {
      const list = listRef.current;
      const active = list?.querySelector<HTMLElement>(ACTIVE_TAB);
      if (list && active && list.getAttribute("data-orientation") !== "vertical") {
        revealTab(list, active, behavior);
      }
    },
    [listRef],
  );

  // Before paint, so a tab that starts off-screen never shows at the wrong place first. It runs for
  // every render, not for a change of value: the tab in use can also appear (a controlled value whose
  // trigger is rendered later) or be replaced (the triggers remounted) with the value unchanged.
  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>(ACTIVE_TAB);
    const before = seen.current;
    seen.current = { value, tab: active };
    if (!active || active === before?.tab) return;
    if (list.clientWidth === 0) {
      // Not laid out yet (a hidden ancestor): the resize observer places it once there is a width.
      waiting.current = true;
      return;
    }
    waiting.current = false;
    const changed = before !== null && before.value !== value;
    revealActive(changed && !prefersReducedMotion() ? "smooth" : "auto");
  });

  // Tabs come and go with the parent's render, and that is when the overflow can change without the
  // list's own box moving. After the reveal above, so the first paint has the fade it will keep.
  React.useLayoutEffect(() => {
    measure();
  });

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    width.current = list.clientWidth;
    list.addEventListener("scroll", measure, { passive: true });
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        const now = list.clientWidth;
        const resized = now !== width.current;
        width.current = now;
        // A narrower box can push the tab in use out of the window (a phone turned on its side), and
        // the browser only re-snaps to a point that is still valid, not to this one. Only a change of
        // width does it, so a person scrolling the list is not pulled back by a resize that never
        // touched it; nothing moves when the tab is still whole.
        if (now > 0 && (waiting.current || resized)) {
          waiting.current = false;
          revealActive("auto");
        }
        measure();
      });
      observer.observe(list);
    }
    return () => {
      list.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [listRef, measure, revealActive]);

  const onFocus = React.useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      const list = listRef.current;
      const tab = (event.target as Element).closest<HTMLElement>('[role="tab"]');
      // Instant: the browser scrolls a focused element into view itself, and a smooth scroll still
      // under way when it does would be cut short by it.
      if (list && tab && list.contains(tab) && isKeyboardFocus(tab)) revealTab(list, tab, "auto");
    },
    [listRef],
  );

  return { edges, onFocus };
}
