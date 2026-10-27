import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * The border-box width of the element behind `ref`, in whole pixels, kept current with a
 * ResizeObserver. It is 0 until the element has been measured (and stays 0 where nothing lays out,
 * such as jsdom), so callers should read 0 as "unknown" and not as "narrow". The element behind `ref`
 * is looked up once on mount, so it has to stay mounted as long as the component does.
 */
export function useElementWidth(ref: RefObject<Element | null>): number {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Measured before paint so a wide container never flashes the narrow layout first.
    const measure = () => (element instanceof HTMLElement ? element.offsetWidth : 0);
    setWidth(measure());

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries.at(-1);
      setWidth(Math.round(entry?.borderBoxSize?.[0]?.inlineSize ?? measure()));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
