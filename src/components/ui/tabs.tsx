import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";
import { useTabsListScroll } from "./tabs-scroll";

/*
 * Every tab set renders through the Radix primitives, which give the tablist a roving tabindex,
 * arrow/Home/End keys, ids and `aria-controls`/`aria-labelledby` between a tab and its panel, and a
 * focusable panel. An earlier hand-rolled default had none of those: Tab visited every trigger,
 * arrows did nothing, and the panel pointed at an id nothing carried.
 */

interface TabsContextType {
  value?: string;
  onValueChange?: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextType>({});

type TabsProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> & {
  /** @deprecated Radix is always used; the prop is accepted so existing callers keep compiling. */
  useRadix?: boolean;
};

const Tabs = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Root>, TabsProps>(
  (
    {
      value: controlledValue,
      defaultValue,
      onValueChange,
      className,
      children,
      useRadix: _useRadix,
      ...props
    },
    ref,
  ) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
    const value = controlledValue !== undefined ? controlledValue : uncontrolledValue;
    const handleValueChange = React.useCallback(
      (newValue: string) => {
        if (controlledValue === undefined) {
          setUncontrolledValue(newValue);
        }
        onValueChange?.(newValue);
      },
      [controlledValue, onValueChange],
    );
    const context = React.useMemo(
      () => ({ value, onValueChange: handleValueChange }),
      [value, handleValueChange],
    );

    return (
      <TabsContext.Provider value={context}>
        <TabsPrimitive.Root
          ref={ref}
          // Always controlled from here, so Radix never switches modes when the first tab is picked.
          value={value ?? ""}
          onValueChange={handleValueChange}
          // `min-w-0`, as on Card: a tab set is often a flex or grid item, and without it the automatic
          // minimum size would let a long list of tabs stretch the item (and the page) instead of
          // scrolling inside the list.
          className={cn("min-w-0", className)}
          {...props}
        >
          {children}
        </TabsPrimitive.Root>
      </TabsContext.Provider>
    );
  },
);
Tabs.displayName = "Tabs";

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  /** @deprecated Radix is always used; the prop is accepted so existing callers keep compiling. */
  useRadix?: boolean;
};

/*
 * The list is a segmented control: a hairline outline round a surface, the tabs inset in it.
 *
 * - Geometry. A 1px border and 4px of padding are 5px from the edge to a tab, and the tab's radius is
 *   the list's minus those 5px, so the two curves are concentric. The padding is not decoration: the
 *   list scrolls, a scroller clips at its padding box, and a focus ring reaches 4px out of a tab
 *   (2px offset, 2px ring), so anything less would shave the ring. Pixel values rather than the
 *   spacing scale, which is fractional here (0.27rem) and would put the tab's edges between pixels.
 *   The ring's offset is the list's own surface (`ring-offset-card`): the page colour would show as
 *   a dark halo in dark, where a card is a step above the page.
 * - Fill. Hover and selection are tints of the foreground, not a fill from muted/accent/secondary:
 *   each of those is the colour of some surface a list gets put on (a muted panel, a sidebar), and
 *   there the selected tab vanished into it. A tint reads the same on all of them.
 * - Overflow. Tabs that do not fit scroll inside the list; `max-w-full` is what stops them widening
 *   it, and so their parent. The scrollbar is hidden (it would double the height) and the list stays
 *   scrollable by touch, trackpad, shift+wheel and by focusing a tab. The plain vertical wheel is
 *   left to the page: turning it sideways would trap page scroll whenever the pointer crossed the
 *   list. The list snaps to a tab start, so the side you scrolled towards never rests on a half-cut
 *   tab (the far side always does: that is what says there is more). `scroll-px` is the margin a
 *   tab is brought to and the same as the fade, so a revealed tab is clear of it.
 * - Fade. `data-overflow-left/right` are set only while there is more content that way, so a list
 *   that fits has no mask at all, and neither has the end you are at. The mask is on the list, not a
 *   gradient laid over it: it needs no colour (the surface may be anything), and a mask never takes a
 *   click from the tab under it. Its first layer is the fade; the other two draw the border ring, so
 *   the outline stays whole while what is inside it fades. An engine without `mask-composite` (before
 *   Chrome 120) paints the ring and everything else opaque: no fade, and nothing else lost.
 * - `justify-center-safe`: plain `justify-center` leaves the start of an overflowing list unreachable.
 * - A vertical list is not a scroller (see `data-[orientation=vertical]:overflow-visible`).
 */
const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, useRadix: _useRadix, onFocus, ...props }, ref) => {
    const listRef = React.useRef<HTMLDivElement | null>(null);
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        listRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );
    const { edges, onFocus: revealFocused } = useTabsListScroll(
      listRef,
      React.useContext(TabsContext).value,
    );

    return (
      <TabsPrimitive.List
        ref={setRefs}
        data-overflow-left={edges.left ? "" : undefined}
        data-overflow-right={edges.right ? "" : undefined}
        className={cn(
          "inline-flex h-9 max-w-full items-center justify-center-safe rounded-box border border-border bg-card p-[4px] text-muted-foreground",
          "overflow-x-auto overflow-y-hidden overscroll-x-contain snap-x snap-mandatory [--tabs-fade:1.5rem] scroll-px-(--tabs-fade) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden data-[orientation=vertical]:overflow-visible",
          "[--tabs-mask:linear-gradient(to_right,transparent,#000_var(--tabs-fade-left,0px),#000_calc(100%_-_var(--tabs-fade-right,0px)),transparent)]",
          "data-[overflow-left]:[--tabs-fade-left:var(--tabs-fade)] data-[overflow-right]:[--tabs-fade-right:var(--tabs-fade)]",
          "[&:is([data-overflow-left],[data-overflow-right])]:[mask-clip:padding-box,padding-box,border-box] [&:is([data-overflow-left],[data-overflow-right])]:[mask-composite:add,exclude,add] [&:is([data-overflow-left],[data-overflow-right])]:[mask-image:var(--tabs-mask),linear-gradient(#000,#000),linear-gradient(#000,#000)] [&:is([data-overflow-left],[data-overflow-right])]:[mask-origin:padding-box,padding-box,border-box]",
          className,
        )}
        onFocus={(event) => {
          onFocus?.(event);
          revealFocused(event);
        }}
        {...props}
      />
    );
  },
);
TabsList.displayName = "TabsList";

type TabsTriggerProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
  /** @deprecated Radix is always used; the prop is accepted so existing callers keep compiling. */
  useRadix?: boolean;
};

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(
  (
    {
      className,
      value,
      useRadix: _useRadix,
      onClick,
      onMouseDown,
      onMouseUp,
      onKeyDown,
      onFocus,
      onBlur,
      disabled,
      ...props
    },
    ref,
  ) => {
    const context = React.useContext(TabsContext);
    // Radix asks for a tab on mousedown, on focus and on Enter/Space. A parent that has not applied
    // the change by the time the click lands (a router, a "discard changes?" prompt) would then be
    // asked again for the same gesture, so remember which of those already asked.
    const pressed = React.useRef(false);
    const keyed = React.useRef(false);

    return (
      <TabsPrimitive.Trigger
        ref={ref}
        value={value}
        disabled={disabled}
        className={cn(
          "inline-flex snap-start items-center justify-center self-stretch whitespace-nowrap rounded-[calc(var(--radius-boxes)-5px)] px-4 data-[orientation=vertical]:py-2 text-sm font-medium ring-offset-card transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground forced-colors:data-[state=active]:underline forced-colors:data-[state=active]:decoration-2 forced-colors:data-[state=active]:underline-offset-4",
          className,
        )}
        onMouseDown={(event) => {
          onMouseDown?.(event);
          // The same test Radix applies before it selects.
          if (!event.defaultPrevented && !disabled && event.button === 0 && !event.ctrlKey) {
            pressed.current = true;
          }
        }}
        onMouseUp={(event) => {
          onMouseUp?.(event);
          pressed.current = false;
        }}
        onFocus={(event) => {
          onFocus?.(event);
          // The focus a press brings is part of the press, which Radix already acted on. Cancelling
          // it here keeps Radix from asking a second time.
          if (pressed.current) event.preventDefault();
        }}
        onBlur={(event) => {
          onBlur?.(event);
          pressed.current = false;
          keyed.current = false;
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (
            !event.defaultPrevented &&
            !disabled &&
            (event.key === "Enter" || event.key === " ")
          ) {
            keyed.current = true;
          }
        }}
        onClick={(event) => {
          onClick?.(event);
          const keyAlreadyAsked = keyed.current;
          keyed.current = false;
          // Radix selects on mousedown, focus and Enter/Space. A bare click, which is all that
          // assistive technology and `element.click()` send, would otherwise select nothing. It is
          // told apart from the click that ends a press (`detail` counts the presses) and from the
          // one Enter or Space turns into.
          if (event.defaultPrevented || disabled || keyAlreadyAsked || event.detail > 0) return;
          if (context.value !== value) context.onValueChange?.(value);
        }}
        {...props}
      />
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

type TabsContentProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content> & {
  /** @deprecated Radix is always used; the prop is accepted so existing callers keep compiling. */
  useRadix?: boolean;
};

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  TabsContentProps
>(({ className, useRadix: _useRadix, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
