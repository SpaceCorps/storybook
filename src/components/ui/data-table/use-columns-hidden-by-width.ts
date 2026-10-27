import * as React from "react";

import {
  estimateColumnWidth,
  getColumnsHiddenByWidth,
  sameColumnNames,
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

const NONE: ReadonlySet<string> = new Set();

/**
 * The names of the columns the container is too narrow for.
 *
 * The container is measured with a `ResizeObserver`, once synchronously before the first paint and on
 * every change after, as the width of its border box. The answer is held as state and only replaced when it is a different set of
 * names, so dragging a divider across a table re-renders it at each breakpoint it crosses and not on
 * every frame in between. The width itself is kept in a ref for the same reason.
 *
 * Until a width is known the answer is the narrow one (see `getColumnsHiddenByWidth`), which is what
 * a server render and the first client pass show. A width of 0 is not a measurement: it is a hidden
 * tab, a closed sheet or a test without layout, and keeps the last real one.
 *
 * The observed element is the table's outer wrapper, whose width is the room the host gives it and
 * does not depend on which columns are showing, so hiding a column cannot change the measurement that
 * hid it. The one input that can is the page scrollbar, which the reveal margin absorbs.
 */
export function useColumnsHiddenByWidth<TRow>({
  containerRef,
  columns,
  reservedWidth,
  enabled,
}: UseColumnsHiddenByWidthOptions<TRow>): ReadonlySet<string> {
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(() =>
    enabled ? getColumnsHiddenByWidth(columns, { width: null, reservedWidth }) : NONE,
  );
  const hiddenRef = React.useRef(hidden);
  const widthRef = React.useRef<number | null>(null);
  const measuredRef = React.useRef(false);
  const latest = React.useRef({ columns, reservedWidth });
  latest.current = { columns, reservedWidth };

  const recompute = React.useCallback(() => {
    const { columns: current, reservedWidth: reserved } = latest.current;
    const width = widthRef.current;
    const next = getColumnsHiddenByWidth(current, {
      width,
      reservedWidth: reserved,
      // The first measurement replaces the narrow-first guess outright: nothing to be steady about.
      previouslyHidden: measuredRef.current ? hiddenRef.current : undefined,
    });
    if (width !== null) measuredRef.current = true;
    if (sameColumnNames(next, hiddenRef.current)) return;
    hiddenRef.current = next;
    setHidden(next);
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

  // The columns themselves can change under a width that has not: a user hiding one, a caller
  // swapping the set, a `width` edit that moves the estimate. Their inputs, not their identity: an
  // inline `columns` array is a new object on every render.
  const signature = columns
    .map(
      (column) =>
        `${column.name}:${column.hideBelow ?? ""}:${column.priority ?? ""}:${estimateColumnWidth(column)}`,
    )
    .join("|");
  React.useLayoutEffect(() => {
    if (enabled) recompute();
  }, [enabled, recompute, reservedWidth, signature]);

  return enabled ? hidden : NONE;
}
