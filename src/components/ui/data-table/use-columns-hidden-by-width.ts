import * as React from "react";

import {
  estimateColumnWidth,
  getResponsiveFit,
  sameColumnNames,
  type ResponsiveFit,
} from "./responsive-columns";
import type { DataTableColumn } from "./types";

export interface UseColumnsHiddenByWidthOptions<TRow> {
  /** The element whose width decides: the table's own wrapper, not the window. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** The columns the user has not hidden, in render order. */
  columns: DataTableColumn<TRow>[];
  /** px held by the pinned columns, see `reservedColumnsWidth`. */
  reservedWidth: number;
  /** `false` for a table with no `hideBelow` or `priority`: nothing is observed at all. */
  enabled: boolean;
}

export interface UseResponsiveFitOptions<TRow> extends UseColumnsHiddenByWidthOptions<TRow> {
  /** The pinned columns' px while the row actions are folded into one menu button. Defaults to `reservedWidth`. */
  reservedFoldedWidth?: number;
  /** Fold row actions below this container width. Not a finite number: never fold. */
  collapseBelow?: number;
  /** Whether folding does anything here (some row has more than one action). Defaults to true. */
  collapseApplies?: boolean;
  /** The root font size in px, which `rem` widths and the default estimate follow. Defaults to 16. */
  remPx?: number;
}

export interface UseResponsiveFitResult {
  /** The names of the columns the container is too narrow for. */
  hidden: ReadonlySet<string>;
  /** Whether the row actions are folded into one menu button. */
  rowActionsCollapsed: boolean;
}

const NONE: ReadonlySet<string> = new Set();

interface FitState {
  hidden: ReadonlySet<string>;
  trigger: boolean;
}

/**
 * The columns the container is too narrow for, and whether its row actions fold into one menu button.
 *
 * The container is measured with a `ResizeObserver`, once synchronously before the first paint and on
 * every change after, as the width of its border box. The answer is held as state and only replaced
 * when it is a different answer, so dragging a divider across a table re-renders it at each
 * breakpoint it crosses and not on every frame in between. The width itself is kept in a ref for the
 * same reason.
 *
 * Until a width is known the answer is the narrow one (see `getResponsiveFit`), which is what a
 * server render and the first client pass show. A width of 0 is not a measurement: it is a hidden
 * tab, a closed sheet or a test without layout, and keeps the last real one.
 *
 * The observed element is the table's outer wrapper, whose width is the room the host gives it and
 * does not depend on which columns are showing, so hiding a column cannot change the measurement that
 * hid it. The one input that can is a scrollbar that a change of height brings or takes away (15 px
 * for a classic one). The previous answer is fed back to `getResponsiveFit`, whose reveal margin is
 * larger than that, so a width that jitters by less than the margin can move the answer one way and
 * never back. That holds for a table that mixes `hideBelow` and `priority` columns as well, and for
 * the fold: the fold is decided from the width and its own history alone, never from the columns.
 *
 * `reservedWidth`, `reservedFoldedWidth`, `collapseBelow`, `collapseApplies` and `remPx` are read when
 * the container changes and re-run the fit when they change; they are not themselves a function of
 * the width, so a change of one is a discrete event that the history absorbs.
 */
export function useResponsiveFit<TRow>({
  containerRef,
  columns,
  reservedWidth,
  reservedFoldedWidth,
  collapseBelow,
  collapseApplies = true,
  remPx,
  enabled,
}: UseResponsiveFitOptions<TRow>): UseResponsiveFitResult {
  const [state, setState] = React.useState<FitState>(() => {
    if (!enabled) return { hidden: NONE, trigger: false };
    const first = getResponsiveFit(columns, {
      width: null,
      reservedWidth,
      reservedFoldedWidth,
      remPx,
      collapseBelow,
      collapseApplies,
    });
    return { hidden: first.hidden, trigger: first.trigger };
  });
  const stateRef = React.useRef(state);
  const widthRef = React.useRef<number | null>(null);
  const measuredRef = React.useRef(false);
  const latest = React.useRef({
    columns,
    reservedWidth,
    reservedFoldedWidth,
    collapseBelow,
    collapseApplies,
    remPx,
  });
  latest.current = {
    columns,
    reservedWidth,
    reservedFoldedWidth,
    collapseBelow,
    collapseApplies,
    remPx,
  };

  const recompute = React.useCallback(() => {
    const width = widthRef.current;
    const next: ResponsiveFit = getResponsiveFit(latest.current.columns, {
      width,
      reservedWidth: latest.current.reservedWidth,
      reservedFoldedWidth: latest.current.reservedFoldedWidth,
      remPx: latest.current.remPx,
      collapseBelow: latest.current.collapseBelow,
      collapseApplies: latest.current.collapseApplies,
      // The first measurement replaces the narrow-first guess outright: nothing to be steady about.
      previous: measuredRef.current ? stateRef.current : undefined,
    });
    if (width !== null) measuredRef.current = true;
    if (
      sameColumnNames(next.hidden, stateRef.current.hidden) &&
      next.trigger === stateRef.current.trigger
    ) {
      return;
    }
    stateRef.current = { hidden: next.hidden, trigger: next.trigger };
    setState(stateRef.current);
  }, []);

  React.useLayoutEffect(() => {
    if (!enabled) return;
    const element = containerRef.current;
    if (!element) return;

    // The layout width in both cases, never `getBoundingClientRect`: a dialog that is still zooming in
    // is scaled by a transform, which would read as a narrower table that no observer ever corrects
    // (an observer does not see transforms).
    const read = (entry?: ResizeObserverEntry) => {
      const width =
        entry?.borderBoxSize?.[0]?.inlineSize ?? entry?.contentRect?.width ?? element.offsetWidth;
      if (!(width > 0)) return;
      widthRef.current = width;
      recompute();
    };

    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => read(entries[entries.length - 1]));
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef, enabled, recompute]);

  // The inputs can change under a width that has not: a user hiding a column, a caller swapping the
  // set, a `width` edit that moves the estimate, a new measurement of the pinned cells, a page whose
  // rows have more actions. Their values, not their identity: an inline `columns` array is a new
  // object on every render.
  const signature = columns
    .map(
      (column) =>
        `${column.name}:${column.hideBelow ?? ""}:${column.priority ?? ""}:${estimateColumnWidth(column, remPx)}`,
    )
    .join("|");
  React.useLayoutEffect(() => {
    if (enabled) recompute();
  }, [
    enabled,
    recompute,
    reservedWidth,
    reservedFoldedWidth,
    collapseBelow,
    collapseApplies,
    remPx,
    signature,
  ]);

  return React.useMemo(
    () =>
      enabled
        ? { hidden: state.hidden, rowActionsCollapsed: state.trigger && collapseApplies }
        : { hidden: NONE, rowActionsCollapsed: false },
    [collapseApplies, enabled, state],
  );
}

/**
 * The names of the columns the container is too narrow for: {@link useResponsiveFit} without the
 * folding of row actions, for a custom layout that only needs the set.
 */
export function useColumnsHiddenByWidth<TRow>(
  options: UseColumnsHiddenByWidthOptions<TRow>,
): ReadonlySet<string> {
  return useResponsiveFit(options).hidden;
}
