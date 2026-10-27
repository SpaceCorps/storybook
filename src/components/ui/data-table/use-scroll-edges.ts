import * as React from "react";

/** Subpixel scroll positions would otherwise leave an edge "overflowing" by a hair. */
const EDGE_TOLERANCE = 1;

/**
 * Mirrors a scroller's horizontal overflow onto it as `data-overflow-start` / `data-overflow-end`,
 * for the pinned columns' divider to key off in CSS.
 *
 * Attributes are written straight to the element rather than held in state: they are read only by
 * selectors, so a scroll event should cost a style recalculation and not a render of the table.
 */
export function useScrollEdges(containerRef: React.RefObject<HTMLElement | null>): void {
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const scrolled = Math.abs(container.scrollLeft);
      const hidden = container.scrollWidth - container.clientWidth;
      container.toggleAttribute("data-overflow-start", scrolled > EDGE_TOLERANCE);
      container.toggleAttribute("data-overflow-end", hidden - scrolled > EDGE_TOLERANCE);
    };

    update();
    container.addEventListener("scroll", update, { passive: true });

    // The container resizes with its host and the table inside it with its columns, rows and
    // fonts, so both are watched.
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(update);
      observer.observe(container);
      if (container.firstElementChild) observer.observe(container.firstElementChild);
    }

    return () => {
      container.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [containerRef]);
}
