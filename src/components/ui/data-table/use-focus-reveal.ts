import * as React from "react";

/** A sub-pixel overlap is not worth a scroll. */
const TOLERANCE = 1;

/**
 * Custom properties the hook writes onto the scroller, read by the `scroll-p*` utilities on it. They
 * hold the size of what sits on top of the scrolled content: the pinned columns on either side and
 * the sticky header above.
 */
export const PIN_START_VAR = "--ivy-data-table-pin-start";
export const PIN_END_VAR = "--ivy-data-table-pin-end";
export const HEAD_HEIGHT_VAR = "--ivy-data-table-head-height";
/** The width the scroller shows, which a row's details stay inside while the table scrolls under them. */
export const VIEWPORT_WIDTH_VAR = "--ivy-data-table-viewport";

function pinnedHeader(container: HTMLElement, side: "start" | "end"): HTMLElement | null {
  return container.querySelector<HTMLElement>(`thead th[data-pin="${side}"]`);
}

/**
 * Keeps a keyboard-focused control out from under the table's own furniture.
 *
 * Pinned columns and the sticky header are painted over the scrolled content, but the browser scrolls
 * a focused element only as far as the scroller's *edge*: tabbing to a control that lies behind the
 * pinned action column leaves it exactly where it was, hidden, and a control that merely pokes out
 * from behind it is counted as visible and not scrolled at all. Focus must not be obscured (WCAG
 * 2.4.11), so:
 *
 * - the scroller publishes the size of that furniture as `scroll-padding` (through custom
 *   properties and utilities on the scroller), which makes the browser's own scrolling stop short of
 *   it, and
 * - after a focus lands, whatever still overlaps is scrolled clear. That correction waits for the
 *   next frame because the browser scrolls *after* the `focusin` event has been dispatched, and it
 *   runs before that frame is painted, so nothing flickers.
 *
 * The cells inside a pinned column are never moved (they are the furniture), and a focused `<tr>`
 * spans the full width by definition, so it is only brought into view vertically: below the header
 * and above the bottom edge, which the browser leaves alone while a sliver of the row still shows.
 */
export function useRevealFocus(containerRef: React.RefObject<HTMLElement | null>): void {
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const start = pinnedHeader(container, "start");
      const end = pinnedHeader(container, "end");
      const head = container.querySelector<HTMLElement>("thead th");
      container.style.setProperty(PIN_START_VAR, `${start ? start.offsetWidth : 0}px`);
      container.style.setProperty(PIN_END_VAR, `${end ? end.offsetWidth : 0}px`);
      container.style.setProperty(HEAD_HEIGHT_VAR, `${head ? head.offsetHeight : 0}px`);
      container.style.setProperty(VIEWPORT_WIDTH_VAR, `${container.clientWidth}px`);
    };

    const reveal = (target: HTMLElement) => {
      if (!target.isConnected || !container.contains(target)) return;
      const box = container.getBoundingClientRect();
      // No layout (jsdom, a hidden tab): there is nothing to measure.
      if (box.width === 0 || box.height === 0) return;
      const rect = target.getBoundingClientRect();

      let dx = 0;
      let dy = 0;

      // The panels of a row's details and of the totals line pin themselves to the visible width, so
      // scrolling cannot bring them any closer.
      if (
        !target.closest("[data-pin]") &&
        !target.closest("[data-slot='data-table-detail-panel']") &&
        target.tagName !== "TR"
      ) {
        const start = pinnedHeader(container, "start")?.getBoundingClientRect();
        const end = pinnedHeader(container, "end")?.getBoundingClientRect();
        const visibleLeft = Math.max(box.left, start ? start.right : box.left);
        const visibleRight = Math.min(box.right, end ? end.left : box.right);
        if (rect.left < visibleLeft - TOLERANCE) {
          dx = rect.left - visibleLeft;
        } else if (rect.right > visibleRight + TOLERANCE) {
          // Never so far that the control's own start edge leaves the visible region.
          dx = Math.min(rect.right - visibleRight, rect.left - visibleLeft);
        }
      }

      if (!target.closest("thead")) {
        const head = container.querySelector<HTMLElement>("thead th")?.getBoundingClientRect();
        const visibleTop = Math.max(box.top, head ? head.bottom : box.top);
        // Not under the scrollbar along the bottom either.
        const visibleBottom =
          container.clientHeight > 0
            ? Math.min(box.bottom, box.top + container.clientHeight)
            : box.bottom;
        if (rect.top < visibleTop - TOLERANCE) {
          dy = rect.top - visibleTop;
        } else if (rect.bottom > visibleBottom + TOLERANCE) {
          // The browser counts a row as visible while a sliver of it shows, and jumping a long list a
          // page at a time lands on a row it has not measured yet, so nothing else would scroll the
          // rest of it in. Never so far that the top edge leaves the visible region.
          dy = Math.min(rect.bottom - visibleBottom, rect.top - visibleTop);
        }
      }

      if (dx !== 0) container.scrollLeft += dx;
      if (dy !== 0) container.scrollTop += dy;
    };

    let frame = 0;
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (typeof requestAnimationFrame !== "function") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => reveal(target));
    };

    measure();
    container.addEventListener("focusin", onFocusIn);

    // The furniture changes size with the columns, the density and the host's width.
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(container);
      if (container.firstElementChild) observer.observe(container.firstElementChild);
    }

    return () => {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      container.removeEventListener("focusin", onFocusIn);
      observer?.disconnect();
    };
  }, [containerRef]);
}
