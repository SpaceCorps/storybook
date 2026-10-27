import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

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
          className={className}
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

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, useRadix: _useRadix, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-box bg-muted p-1 text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
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
          "inline-flex items-center justify-center whitespace-nowrap -ml-px -mt-px px-4 py-2 text-sm font-medium ring-offset-background transition-all hover:bg-muted/50 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow",
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
