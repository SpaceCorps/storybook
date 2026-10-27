import * as React from "react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import type { Range, VirtualItem } from "@tanstack/react-virtual";

import { Densities } from "@/types/density";

import type { DataTableVirtualized } from "./types";

/** Row count above which `virtualized="auto"` starts windowing. */
export const DATA_TABLE_VIRTUALIZATION_THRESHOLD = 50;

/** Default bounded height of the scroll viewport, in px, while windowing is active. */
export const DATA_TABLE_MAX_BODY_HEIGHT = 480;

/** Default number of rows rendered beyond the visible range. */
export const DATA_TABLE_OVERSCAN = 8;

/**
 * First-paint row-height estimates per density. Real heights come from `measureElement`, so these
 * only decide how honest the scrollbar is before a row has been measured. Tighter than the list
 * primitive's map because table rows have no vertical gap.
 */
export const DATA_TABLE_ROW_HEIGHT_ESTIMATES: Record<Densities, number> = {
  [Densities.Small]: 36,
  [Densities.Medium]: 44,
  [Densities.Large]: 52,
};

/**
 * The details row that follows a data row when its details are open, or `null`. Paired by the row's
 * id, not just by adjacency, so a spacer or some other row in between can never be taken for it.
 */
export function detailRowOf(row: Element): HTMLElement | null {
  const next = row.nextElementSibling;
  if (!(next instanceof HTMLElement) || !(row instanceof HTMLElement)) return null;
  return next.dataset.detailFor !== undefined && next.dataset.detailFor === row.dataset.rowId
    ? next
    : null;
}

/**
 * What one windowed item weighs: its data row and, while they are open, the details under it. The
 * details are a row of their own in the DOM, but the virtualizer sizes by `data-index`, one element
 * to an index, so the item has to be measured as the pair or every row below an open one would sit
 * where it is not.
 */
export function measureRowWithDetail(row: Element, entry: ResizeObserverEntry | undefined): number {
  const own = entry?.borderBoxSize?.[0]?.blockSize;
  const rowSize = own !== undefined ? Math.round(own) : (row as HTMLElement).offsetHeight;
  return rowSize + (detailRowOf(row)?.offsetHeight ?? 0);
}

export interface UseDataTableVirtualizationOptions {
  /**
   * Ref to `Table`'s `overflow-auto` wrapper — the element that scrolls. Owned by the caller
   * because the row-focus hook needs it too, and the two hooks are mutually dependent.
   */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** `getRowId` for the rows currently rendered, in render order. Drives keys and measurements. */
  rowIds: string[];
  virtualized: DataTableVirtualized;
  virtualizationThreshold: number;
  maxBodyHeight: number | string;
  /** Overrides the density estimate. */
  estimateRowHeight?: number;
  overscan: number;
  density: Densities;
  /**
   * Index always kept in the rendered range, so the focused row is never unmounted by a scroll and
   * `document.activeElement` never drops to `<body>`.
   */
  pinnedIndex?: number;
  /** `false` while the body is a skeleton or the empty-state row. */
  enabled: boolean;
}

export interface UseDataTableVirtualizationResult {
  /** Whether the body should be windowed. When `false` every field below is inert. */
  active: boolean;
  /** `{ maxHeight }` while active, `undefined` otherwise. Windowing needs a bounded viewport. */
  containerStyle: React.CSSProperties | undefined;
  /** The rows to render, ascending by index. `null` while inactive — render every row. */
  virtualItems: VirtualItem[] | null;
  /** Height of the leading spacer row. */
  padStart: number;
  /** Height of the trailing spacer row. */
  padEnd: number;
  /**
   * Height of the gap between `virtualItems[position]` and its successor, or 0 when they are
   * adjacent. Non-zero only when `pinnedIndex` pulls a row in from outside the contiguous window,
   * which is what keeps `padStart + rendered + gaps + padEnd === totalSize` true in that case too.
   */
  gapAfter: (position: number) => number;
  /**
   * Index of the first row inside the viewport itself (not the overscan), or `undefined` while
   * inactive. The row to put in the tab order when the active one has been scrolled out of the DOM.
   */
  firstVisibleIndex: number | undefined;
  /** Pass as each data row's `ref`. Requires `data-index` on the same element. */
  measureRowElement: (node: HTMLTableRowElement | null) => void;
  /**
   * Pass as the `ref` of the details row under a data row. Its height is part of that row's item, and
   * the row's own observer cannot see it change (when the container resizes and the text wraps, when
   * the details open or close), so the details row is watched and the pair measured again.
   */
  measureDetailElement: (node: HTMLTableRowElement | null) => void;
  scrollToIndex: (index: number) => void;
  /** Sum of every row height, measured where known and estimated elsewhere. */
  totalSize: number;
}

/**
 * Row windowing for `DataTable`, kept out of the component the same way sorting, pagination and
 * column visibility are.
 *
 * Runs *after* sort and pagination: sort → page → window. A change to the page's row identities
 * (a re-sort, a filter, a page change) drops the measurement cache and returns the viewport to the
 * top, so a re-sort never leaves you mid-list at a stale offset.
 */
export function useDataTableVirtualization({
  containerRef,
  rowIds,
  virtualized,
  virtualizationThreshold,
  maxBodyHeight,
  estimateRowHeight,
  overscan,
  density,
  pinnedIndex,
  enabled,
}: UseDataTableVirtualizationOptions): UseDataTableVirtualizationResult {
  const count = rowIds.length;

  const active =
    enabled &&
    count > 0 &&
    (virtualized === true || (virtualized === "auto" && count > virtualizationThreshold));

  const estimate = estimateRowHeight ?? DATA_TABLE_ROW_HEIGHT_ESTIMATES[density];
  const estimateSize = React.useCallback(() => estimate, [estimate]);

  const rowIdsRef = React.useRef(rowIds);
  rowIdsRef.current = rowIds;
  const getItemKey = React.useCallback((index: number) => rowIdsRef.current[index] ?? index, []);

  const rangeExtractor = React.useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range);
      if (pinnedIndex === undefined || pinnedIndex < 0 || pinnedIndex >= range.count) {
        return indexes;
      }
      if (indexes.includes(pinnedIndex)) return indexes;
      return [...indexes, pinnedIndex].sort((a, b) => a - b);
    },
    [pinnedIndex],
  );

  const virtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count,
    getScrollElement: () => (active ? containerRef.current : null),
    estimateSize,
    overscan,
    getItemKey,
    rangeExtractor,
    measureElement: measureRowWithDetail,
  });
  const virtualizerRef = React.useRef(virtualizer);
  virtualizerRef.current = virtualizer;

  // details row -> its data row, remembered because a removed details row has no siblings left to ask
  const detailPairs = React.useRef(new Map<Element, HTMLElement>());
  const detailObserver = React.useRef<ResizeObserver | null>(null);

  const remeasureRow = React.useCallback((row: HTMLElement) => {
    const index = Number(row.dataset.index);
    if (Number.isInteger(index))
      virtualizerRef.current.resizeItem(index, measureRowWithDetail(row, undefined));
  }, []);

  const measureDetailElement = React.useCallback(
    (node: HTMLTableRowElement | null) => {
      if (!node || typeof ResizeObserver === "undefined") return;
      const row = node.previousElementSibling;
      if (!(row instanceof HTMLElement) || detailPairs.current.has(node)) return;
      detailPairs.current.set(node, row);
      detailObserver.current ??= new ResizeObserver((entries) => {
        for (const entry of entries) {
          const detail = entry.target;
          const owner = detailPairs.current.get(detail);
          if (!owner) continue;
          // Removed (the details closed, or the row went out of the window): the pair is over, and
          // the row, if it is still there, is back to its own height.
          if (!detail.isConnected) {
            detailPairs.current.delete(detail);
            detailObserver.current?.unobserve(detail);
          }
          if (owner.isConnected) remeasureRow(owner);
        }
      });
      detailObserver.current.observe(node);
    },
    [remeasureRow],
  );
  React.useEffect(
    () => () => {
      detailObserver.current?.disconnect();
      detailObserver.current = null;
      detailPairs.current.clear();
    },
    [],
  );

  // Row identity, not array identity: a call site passing an inline `getRowId` produces a fresh
  // `rowIds` array on every render, and resetting the viewport on each of those would make the
  // table unscrollable.
  const identity = React.useMemo(() => rowIds.join("\u0000"), [rowIds]);
  const lastIdentity = React.useRef(identity);
  React.useEffect(() => {
    if (lastIdentity.current === identity) return;
    lastIdentity.current = identity;
    if (!active) return;
    virtualizer.measure();
    // `scrollToOffset`, not `element.scrollTop = 0`: assigning scrollTop leaves the virtualizer's
    // own offset stale until a scroll event happens to arrive, so the window would keep rendering
    // the slice it was showing before the re-sort.
    virtualizer.scrollToOffset(0);
  }, [active, identity, virtualizer]);

  const virtualItems = active ? virtualizer.getVirtualItems() : null;
  const totalSize = virtualizer.getTotalSize();

  const padStart = virtualItems?.length ? virtualItems[0].start : 0;
  const padEnd = virtualItems?.length ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  const gapAfter = React.useCallback(
    (position: number) => {
      if (!virtualItems) return 0;
      const current = virtualItems[position];
      const next = virtualItems[position + 1];
      if (!current || !next) return 0;
      return Math.max(0, next.start - current.end);
    },
    [virtualItems],
  );

  const { measureElement, scrollToIndex } = virtualizer;
  const scrollToIndexStable = React.useCallback(
    (index: number) => {
      scrollToIndex(index);
    },
    [scrollToIndex],
  );

  return {
    active,
    containerStyle: active ? { maxHeight: maxBodyHeight } : undefined,
    virtualItems,
    padStart,
    padEnd,
    gapAfter,
    firstVisibleIndex: virtualItems?.length
      ? (virtualizer.range?.startIndex ?? virtualItems[0].index)
      : undefined,
    measureRowElement: measureElement,
    measureDetailElement,
    scrollToIndex: scrollToIndexStable,
    totalSize,
  };
}
