import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

/** An overflow value a person can scroll with: `hidden`, `clip` and `visible` cannot be. */
const isScrollable = (overflow: string) =>
  overflow === "auto" || overflow === "scroll" || overflow === "overlay";

/**
 * Whether the viewport has anything a person can scroll. A keyboard user can only scroll a region
 * they can focus, but a viewport that is always a tab stop adds a dead stop to every Blade and code
 * block that fits, so focusability follows overflow.
 *
 * Overflow only counts on an axis the viewport can scroll. The vertical scrollbar is always
 * mounted here, so vertical overflow always scrolls. The horizontal axis is clipped (`overflow-x:
 * hidden`) until a horizontal `ScrollBar` is mounted inside the area, so wide content with none
 * would make a tab stop that the arrow keys cannot move.
 */
function useViewportOverflows(ref: React.RefObject<HTMLElement | null>): boolean {
  const [overflows, setOverflows] = React.useState(false);

  React.useLayoutEffect(() => {
    const viewport = ref.current;
    if (!viewport) return;

    const measure = () => {
      setOverflows(
        viewport.scrollHeight > viewport.clientHeight ||
          (isScrollable(getComputedStyle(viewport).overflowX) &&
            viewport.scrollWidth > viewport.clientWidth),
      );
    };
    measure();

    // A horizontal scrollbar switches the viewport's overflow-x without changing its box.
    let styleObserver: MutationObserver | undefined;
    if (typeof MutationObserver !== "undefined") {
      styleObserver = new MutationObserver(measure);
      styleObserver.observe(viewport, { attributes: true, attributeFilter: ["style", "class"] });
    }

    if (typeof ResizeObserver === "undefined") return () => styleObserver?.disconnect();
    // The viewport's own box changes with the layout, its content child with the children.
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    return () => {
      observer.disconnect();
      styleObserver?.disconnect();
    };
  }, [ref]);

  return overflows;
}

/** What a scrollable region that nobody named is called, instead of its whole content. */
const DEFAULT_SCROLL_REGION_LABEL = "Scrollable content";

/**
 * A scroll area. While its content overflows, the scrolling viewport is a tab stop (so the keyboard
 * can scroll it) and a named `region`, which is what a screen reader announces on arriving at it.
 * Name it with `aria-label` or `aria-labelledby`: both go to the viewport, since the root is a bare
 * box that cannot take a name. Unnamed, it is called "Scrollable content", which is better than a
 * focusable box named by everything inside it, but says nothing about what is in there.
 */
const ScrollArea = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    viewportClassName?: string;
    viewportStyle?: React.CSSProperties;
    hideScrollbar?: boolean;
  }
>(
  (
    {
      className,
      children,
      scrollHideDelay = 0,
      viewportClassName,
      viewportStyle,
      hideScrollbar,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      ...props
    },
    ref,
  ) => {
    const viewportRef = React.useRef<HTMLDivElement>(null);
    const overflows = useViewportOverflows(viewportRef);
    // A name needs a role that takes one, and a region only matters while there is something to
    // scroll to, so both arrive together with the tab stop.
    const regionProps = overflows
      ? {
          role: "region" as const,
          "aria-label": ariaLabel ?? (ariaLabelledBy ? undefined : DEFAULT_SCROLL_REGION_LABEL),
          "aria-labelledby": ariaLabelledBy,
        }
      : {};

    return (
      <ScrollAreaPrimitive.Root
        ref={ref}
        className={cn("relative overflow-hidden", className)}
        scrollHideDelay={scrollHideDelay}
        {...props}
      >
        <ScrollAreaPrimitive.Viewport
          ref={viewportRef}
          tabIndex={overflows ? 0 : undefined}
          {...regionProps}
          className={cn(
            "h-full w-full rounded-[inherit] focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
            viewportClassName,
          )}
          style={viewportStyle}
        >
          {children}
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar className={hideScrollbar ? "invisible-scrollbar" : undefined} />
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
    );
  },
);
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none z-20",
      orientation === "vertical" && "h-full w-1.5 p-px",
      orientation === "horizontal" && "h-1.5 flex-col p-px",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
