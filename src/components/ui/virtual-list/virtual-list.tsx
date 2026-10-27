import * as React from "react";

import { cn } from "@/lib/utils";
import { useDensity } from "@/contexts/density-context";
import { Densities } from "@/types/density";

import { useVirtualList } from "./use-virtual-list";

/**
 * First-paint item-height estimates per density, carried over from the framework's `ListWidget`.
 * Looser than the data table's map because list rows are not table cells.
 */
export const VIRTUAL_LIST_ITEM_HEIGHT_ESTIMATES: Record<Densities, number> = {
  [Densities.Small]: 44,
  [Densities.Medium]: 60,
  [Densities.Large]: 76,
};

/** What a list nobody named is called: a focusable region with no name says nothing on arrival. */
const DEFAULT_LIST_LABEL = "Scrollable list";

/** An overflow value a person can scroll with: `hidden`, `clip` and `visible` cannot be. */
const isScrollable = (overflow: string) =>
  overflow === "auto" || overflow === "scroll" || overflow === "overlay";

/**
 * Whether the container has anything a person can scroll. A keyboard user can only scroll a region
 * they can focus, but one that is always a tab stop adds a dead stop to every list that is empty or
 * fits its box, so focusability follows overflow, as it does in `ScrollArea`.
 *
 * It is measured after every commit rather than on a dependency list: the spacer's height, the rows
 * and the `className` that sets the overflow all arrive through a render, and a state that already
 * holds the answer bails out. The observer catches the one change that is not a render, the box
 * itself resizing. A pixel of slack, as in `SidebarInsetContent`, because scroll sizes are rounded
 * and a list that fits to the fraction would otherwise read as scrolling by one.
 */
function useScrollerOverflows(ref: React.RefObject<HTMLElement | null>): boolean {
  const [overflows, setOverflows] = React.useState(false);

  const measure = React.useCallback(() => {
    const element = ref.current;
    if (!element) return;
    setOverflows(
      element.scrollHeight > element.clientHeight + 1 ||
        (isScrollable(getComputedStyle(element).overflowX) &&
          element.scrollWidth > element.clientWidth + 1),
    );
  }, [ref]);

  React.useLayoutEffect(measure);

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, measure]);

  return overflows;
}

export interface VirtualListProps<TItem> {
  items: TItem[];
  renderItem: (item: TItem, index: number) => React.ReactNode;
  /** Stable key per item. Measurements are cached against it, so reordering keeps real heights. */
  getItemKey: (item: TItem, index: number) => string;
  /** Overrides the density estimate, in px. Real heights are measured after first paint. */
  estimateSize?: number;
  /** Items rendered beyond the visible range. Defaults to 6. */
  overscan?: number;
  /**
   * Index always kept mounted, even when scrolled out of view — for a focused row, or a streaming
   * tail whose in-progress content must not be torn down.
   */
  pinnedIndex?: number;
  /** Applied to the scroll container. It must have a bounded height for windowing to mean anything. */
  className?: string;
  /** Applied to each item wrapper. */
  itemClassName?: string;
  density?: Densities;
  /**
   * Names the scroll region, which is what a screen reader announces on arriving at it. Unnamed it
   * is called "Scrollable list", which says nothing about what is in there, and two unnamed lists on
   * one page are two regions with the same name, which axe reports as `landmark-unique`. Name every
   * list once there is more than one.
   */
  "aria-label"?: string;
  /** Names the region from visible text instead, such as the heading above the list. */
  "aria-labelledby"?: string;
  "data-testid"?: string;
}

/**
 * A windowed list that owns its scroll container.
 *
 * Only the visible slice plus `overscan` is mounted; the container's inner spacer carries the full
 * height so the scrollbar is honest, and items are absolutely positioned within it. Structure is
 * adapted from the framework's `ListWidget`, minus the widget-tree plumbing — this takes plain React
 * children through `renderItem`, not a `WidgetNode` map.
 *
 * Absolute positioning is fine here and deliberately *not* what the data table does: a `<tr>` cannot
 * be absolutely positioned without breaking column alignment and the sticky header, so the table
 * pads with spacer rows instead.
 *
 * While its content overflows, the scroll container is a tab stop and a named `region`, so the
 * arrow and Page Up/Down keys scroll it once it has focus. Name it with `aria-label` or
 * `aria-labelledby`. A list that is empty or fits its box has nothing to scroll, so it has no role,
 * label or tab stop, as with `ScrollArea`.
 *
 * Unlike `SidebarInsetContent`, which is a tab stop only while it overflows and holds nothing
 * tabbable, an overflowing list is a tab stop even when its rows hold buttons or links. Only the
 * mounted slice of rows exists, so which rows have controls changes as the window moves, and Tab
 * cannot land on one in a row that is not mounted. Following them would take an observer over rows
 * that change on every scroll tick, and a tab order that depends on the scroll position, to save
 * one stop.
 */
export function VirtualList<TItem>({
  items,
  renderItem,
  getItemKey,
  estimateSize,
  overscan,
  pinnedIndex,
  className,
  itemClassName,
  density: propDensity,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "data-testid": dataTestId,
}: VirtualListProps<TItem>) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const overflows = useScrollerOverflows(scrollRef);
  const globalDensity = useDensity();
  const density = propDensity ?? globalDensity;
  const estimate = estimateSize ?? VIRTUAL_LIST_ITEM_HEIGHT_ESTIMATES[density];

  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  const estimateSizeFn = React.useCallback(() => estimate, [estimate]);
  const getKey = React.useCallback(
    (index: number) => {
      const item = itemsRef.current[index];
      return item === undefined ? index : getItemKey(item, index);
    },
    [getItemKey],
  );

  const {
    items: virtualItems,
    totalSize,
    measureElement,
  } = useVirtualList({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: estimateSizeFn,
    overscan,
    getItemKey: getKey,
    pinnedIndex,
  });

  // A name needs a role that takes one, and a region only matters while there is something to
  // scroll to, so both arrive together with the tab stop.
  const regionProps = overflows
    ? {
        tabIndex: 0,
        role: "region" as const,
        "aria-label": ariaLabel ?? (ariaLabelledBy ? undefined : DEFAULT_LIST_LABEL),
        "aria-labelledby": ariaLabelledBy,
      }
    : {};

  return (
    <div
      ref={scrollRef}
      {...regionProps}
      className={cn(
        "relative isolate h-full w-full overflow-y-auto rounded-[inherit]",
        // An outline, drawn inside the box: the bounded wrapper this lives in often clips whatever
        // is outside it, and a ring (an inset box-shadow) is painted under the rows, so any row with
        // a background hides it. The rows sit at a negative z-index inside the isolated container
        // for the same reason: positioned and transformed, they would otherwise paint over it.
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      data-testid={dataTestId}
    >
      <div className="relative -z-10 w-full" style={{ height: totalSize }}>
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          if (item === undefined) return null;
          return (
            <div
              key={virtualItem.key}
              // virtual-core reads `data-index` back off the measured element and warns without it.
              data-index={virtualItem.index}
              ref={measureElement}
              className={cn("absolute top-0 left-0 w-full min-w-0", itemClassName)}
              style={{ transform: `translateY(${virtualItem.start}px)` }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

VirtualList.displayName = "VirtualList";
