import * as React from "react";

/** Selector for anything inside a row that owns its own keyboard handling. */
export const INTERACTIVE_WITHIN_ROW =
  'button, input, select, textarea, a[href], [role="button"], [role="checkbox"], [role="menuitem"], [contenteditable="true"]';

/** Fallback PageUp/PageDown step when the viewport height is not measurable (e.g. under jsdom). */
const FALLBACK_PAGE_STEP = 10;

export interface UseDataTableRowFocusOptions {
  /** Number of data rows currently rendered by the table (the page, under client pagination). */
  count: number;
  /** The table's scroll container. Rows are looked up inside it to be focused. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Brings a row into the window before it is focused. */
  scrollToIndex: (index: number) => void;
  /** Row height used to translate the viewport height into a PageUp/PageDown step. */
  estimatedRowHeight: number;
  /**
   * Called with the row's index when Enter or Space is pressed on the row itself. Leave it out for a
   * table whose rows do nothing, and those keys stay untouched.
   */
  onActivate?: (index: number) => void;
}

export interface UseDataTableRowFocusResult {
  /**
   * The one row in the tab order. Also the index the virtualizer pins into its rendered range once
   * `pinnedIndex` is set, so a focused row is never unmounted by scrolling.
   */
  activeIndex: number;
  /** `activeIndex` once a row has been focused, `undefined` before that. */
  pinnedIndex: number | undefined;
  /** `0` for the active row, `-1` for the rest, so the whole body is a single tab stop. */
  rowTabIndex: (index: number) => 0 | -1;
  handleRowFocus: (index: number) => void;
  handleKeyDown: React.KeyboardEventHandler<HTMLElement>;
  /**
   * Bubbled focus and blur of everything the table owns: its rows, the controls in them and any
   * menu or dialog they portal out (React bubbles those through the portal). Put them on the
   * `<table>`; they are how the hook knows whether the table had focus when a row went away.
   */
  handleFocusWithin: React.FocusEventHandler<HTMLElement>;
  handleBlurWithin: React.FocusEventHandler<HTMLElement>;
}

/**
 * Roving focus over data rows.
 *
 * Rows are not focusable in an un-virtualized table either, so this is additive behaviour rather
 * than a virtualization detail — but it is what makes focus *retention* across a window boundary
 * observable: the active index is pinned into the virtualizer's rendered range, so scrolling the
 * focused row out of view never unmounts it and never drops `document.activeElement` to `<body>`.
 *
 * A row that is not rendered yet cannot be focused, so `moveTo` records the target index and an
 * effect focuses it on the first commit where it exists. A row that is already rendered is focused
 * on the spot: a request that no render will ever settle (the key pressed at the first or last row,
 * which changes nothing) must not be left behind to be honoured by some unrelated later render.
 *
 * When the element holding focus is removed with its row (an action that deletes the row, a filter
 * that drops it), the browser sends focus to `<body>` and the next Tab starts over at the top of the
 * page. The hook notices that and puts focus on the row now at the same position.
 */
export function useDataTableRowFocus({
  count,
  containerRef,
  scrollToIndex,
  estimatedRowHeight,
  onActivate,
}: UseDataTableRowFocusOptions): UseDataTableRowFocusResult {
  const [activeIndex, setActiveIndex] = React.useState(0);
  // Sticky once set: the pin costs one extra rendered row, and clearing it on blur would race the
  // "focus the row once it mounts" effect below and let the row it is protecting unmount.
  const [engaged, setEngaged] = React.useState(false);
  const pendingFocus = React.useRef<number | null>(null);

  const clampedActive = count > 0 ? Math.min(activeIndex, count - 1) : 0;

  const findRow = React.useCallback(
    (index: number): HTMLTableRowElement | null =>
      containerRef.current?.querySelector<HTMLTableRowElement>(
        `tr[data-row-id][data-index="${index}"]`,
      ) ?? null,
    [containerRef],
  );

  // No dependency list: the target row may take more than one commit to appear, and this must retry
  // until it does.
  React.useEffect(() => {
    const index = pendingFocus.current;
    if (index === null) return;
    // The request is stale once the table has shrunk past it, or focus has gone to something that is
    // not part of the table (nothing, i.e. `<body>`, still counts as free to take).
    const active = document.activeElement;
    const focusLeft =
      active !== null && active !== document.body && !containerRef.current?.contains(active);
    if (index >= count || focusLeft) {
      pendingFocus.current = null;
      return;
    }
    const row = findRow(index);
    if (!row) return;
    pendingFocus.current = null;
    row.focus();
  });

  const handleRowFocus = React.useCallback((index: number) => {
    setEngaged(true);
    setActiveIndex(index);
  }, []);

  const moveTo = React.useCallback(
    (index: number) => {
      if (count === 0) return;
      const next = Math.min(count - 1, Math.max(0, index));
      setEngaged(true);
      setActiveIndex(next);
      scrollToIndex(next);
      const row = findRow(next);
      if (row) {
        pendingFocus.current = null;
        if (document.activeElement !== row) row.focus();
      } else {
        pendingFocus.current = next;
      }
    },
    [count, findRow, scrollToIndex],
  );

  const handleKeyDown = React.useCallback<React.KeyboardEventHandler<HTMLElement>>(
    (event) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      // A checkbox, row-action button or inline-edit cell owns its own keys.
      if (target?.closest(INTERACTIVE_WITHIN_ROW)) return;
      const row = target?.closest<HTMLTableRowElement>("tr[data-row-id]");
      if (!row) return;

      const viewport = containerRef.current?.clientHeight ?? 0;
      const pageStep =
        viewport > 0 && estimatedRowHeight > 0
          ? Math.max(1, Math.floor(viewport / estimatedRowHeight))
          : FALLBACK_PAGE_STEP;

      switch (event.key) {
        case "ArrowDown":
          moveTo(clampedActive + 1);
          break;
        case "ArrowUp":
          moveTo(clampedActive - 1);
          break;
        case "Home":
          moveTo(0);
          break;
        case "End":
          moveTo(count - 1);
          break;
        case "PageDown":
          moveTo(clampedActive + pageStep);
          break;
        case "PageUp":
          moveTo(clampedActive - pageStep);
          break;
        case "Enter":
        case " ": {
          // Only the row itself: something focusable inside a custom cell keeps its own Enter/Space.
          const index = Number(row.dataset.index);
          if (!onActivate || target !== row || !Number.isInteger(index)) return;
          onActivate(index);
          break;
        }
        default:
          return;
      }
      // Only reached for a handled key: stop the scroll container (and, for Space, the page)
      // scrolling under us as well.
      event.preventDefault();
    },
    [clampedActive, containerRef, count, estimatedRowHeight, moveTo, onActivate],
  );

  // Focus is "inside" from the first focus event bubbling out of the table's React tree until a blur
  // does. React switches its event system off while it commits, so the blur a browser sends when the
  // focused element is *removed* never reaches these handlers: still inside, with nothing focused,
  // therefore means the focused element went away rather than that the user moved on.
  const focusInside = React.useRef(false);
  const handleFocusWithin = React.useCallback<React.FocusEventHandler<HTMLElement>>(() => {
    focusInside.current = true;
  }, []);
  const handleBlurWithin = React.useCallback<React.FocusEventHandler<HTMLElement>>(() => {
    focusInside.current = false;
  }, []);

  const rescueTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = React.useRef({ count, clampedActive, moveTo });
  latest.current = { count, clampedActive, moveTo };

  React.useLayoutEffect(() => {
    if (!focusInside.current || rescueTimer.current !== null) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    // Not at once: a closing menu or dialog hands focus back to its trigger on a timer of its own,
    // and that trigger is exactly where a keyboard user should land when the row is still there. Two
    // timers deep, so it is queued behind theirs.
    rescueTimer.current = setTimeout(() => {
      rescueTimer.current = setTimeout(() => {
        rescueTimer.current = null;
        if (!focusInside.current) return;
        const now = document.activeElement;
        if (now && now !== document.body) return;
        focusInside.current = false;
        const { count: rows, clampedActive: position, moveTo: move } = latest.current;
        if (rows > 0) move(position);
      }, 0);
    }, 0);
  });

  React.useEffect(
    () => () => {
      if (rescueTimer.current !== null) clearTimeout(rescueTimer.current);
      rescueTimer.current = null;
    },
    [],
  );

  const rowTabIndex = React.useCallback(
    (index: number): 0 | -1 => (index === clampedActive ? 0 : -1),
    [clampedActive],
  );

  return {
    activeIndex: clampedActive,
    pinnedIndex: engaged ? clampedActive : undefined,
    rowTabIndex,
    handleRowFocus,
    handleKeyDown,
    handleFocusWithin,
    handleBlurWithin,
  };
}
