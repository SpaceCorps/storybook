import * as React from "react";

import { nextFocusDate } from "./calendar-math";
import type { CalendarView, DateRange, WeekStart } from "./types";

/**
 * How long a key that led off screen waits for the period that holds its day. A parent that applies a
 * controlled `date` in a transition, a router or a store does so within a moment; one that never does
 * must not leave a request behind that grabs focus whenever the day finally appears.
 */
const PENDING_FOCUS_MS = 5000;

interface UseCalendarKeysOptions {
  view: CalendarView;
  weekStartsOn: WeekStart;
  /** The cells on screen; a target outside it changes the period instead of just moving focus. */
  range: DateRange;
  /** The roving tab stop follows focus. */
  onFocusDate: (date: string) => void;
  /** The key led off screen: show the period that holds `date`. Focus follows once it has rendered. */
  onNavigate: (date: string) => void;
  /** Enter or Space on a day cell itself (not on an entry inside it). */
  onActivate: (date: string) => void;
}

/** A day to focus once its cell exists, and what it takes to stop waiting for it. */
interface PendingFocus {
  date: string;
  stop: () => void;
}

/**
 * The keyboard of a date grid, after the ARIA authoring practices: one tab stop (the active cell),
 * arrows and Home/End/PageUp/PageDown to move between days, Enter or Space to act on the day.
 *
 * Entries inside a cell are buttons and tab stops only in the active cell; the arrow keys pressed on
 * one move from its cell, and Escape on one puts focus back on the cell. Attach the returned
 * `onKeyDown` to every day cell and `gridRef` to the element that holds them.
 *
 * A key that leaves the visible range asks for another period and focuses its day once that day has
 * rendered, however late: a controlled `date` is often applied after the key press (a transition, a
 * router, a store). The request lapses when the user does something else first (another key, a
 * pointer press), when the calendar unmounts, or after `PENDING_FOCUS_MS`.
 */
export function useCalendarKeys({
  view,
  weekStartsOn,
  range,
  onFocusDate,
  onNavigate,
  onActivate,
}: UseCalendarKeysOptions) {
  const gridRef = React.useRef<HTMLDivElement>(null);
  const pending = React.useRef<PendingFocus | null>(null);

  const focusCell = React.useCallback((date: string): boolean => {
    const cell = gridRef.current?.querySelector<HTMLElement>(
      `[role="gridcell"][data-date="${date}"]`,
    );
    cell?.focus();
    return cell !== null && cell !== undefined;
  }, []);

  const clearPending = React.useCallback(() => {
    pending.current?.stop();
    pending.current = null;
  }, []);

  const waitToFocus = React.useCallback(
    (date: string) => {
      clearPending();
      const timer = setTimeout(clearPending, PENDING_FOCUS_MS);
      // Capturing listeners run before anything inside the page sees the event, so the key that is
      // being handled right now (which has already passed this phase) does not cancel its own request.
      document.addEventListener("keydown", clearPending, true);
      document.addEventListener("pointerdown", clearPending, true);
      pending.current = {
        date,
        stop: () => {
          clearTimeout(timer);
          document.removeEventListener("keydown", clearPending, true);
          document.removeEventListener("pointerdown", clearPending, true);
        },
      };
    },
    [clearPending],
  );

  // A key that left the screen renders the next period first; the cell to focus exists only after,
  // and that render can be any number of renders away. Until it exists the request stays.
  React.useLayoutEffect(() => {
    const request = pending.current;
    if (request && focusCell(request.date)) clearPending();
  });
  React.useEffect(() => clearPending, [clearPending]);

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>, date: string) => {
      const cell = event.currentTarget;
      // Events from a popover rendered in a portal still bubble through React's tree to the cell.
      if (!(event.target instanceof Node) || !cell.contains(event.target)) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      const onCell = event.target === cell;
      if (event.key === "Escape") {
        if (!onCell) {
          event.preventDefault();
          focusCell(date);
        }
        return;
      }
      if (onCell && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        onActivate(date);
        return;
      }

      const target = nextFocusDate(event.key, event.shiftKey, date, view, weekStartsOn);
      if (target === null) return;
      event.preventDefault();
      onFocusDate(target);
      if (target >= range.from && target <= range.to) {
        clearPending();
        focusCell(target);
      } else {
        waitToFocus(target);
        onNavigate(target);
      }
    },
    [
      view,
      weekStartsOn,
      range.from,
      range.to,
      onFocusDate,
      onNavigate,
      onActivate,
      focusCell,
      clearPending,
      waitToFocus,
    ],
  );

  return { gridRef, onKeyDown, focusCell };
}
