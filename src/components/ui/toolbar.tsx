import * as React from "react";
import { Ellipsis } from "lucide-react";

import { cn } from "@/lib/utils";
import { useMergedRefs } from "@/lib/merge-refs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { densityToButtonSize, densityToIconButtonSize } from "@/components/ui/density-scale";
import { useDensity } from "@/contexts/density-context";
import { Densities } from "@/types/density";
import { toolbarGroupVariant, toolbarSeparatorVariant, toolbarVariant } from "./toolbar-variant";

export type ToolbarOrientation = "horizontal" | "vertical";
export type ToolbarOverflow = "menu" | "wrap" | "scroll";

/** Marks a focusable toolbar item for the root's roving tabindex. */
const ITEM_ATTR = "data-toolbar-item";
/** Marks the `leading` / `trailing` wrappers, whose contents are excluded from navigation. */
const SLOT_ATTR = "data-toolbar-slot";

interface ToolbarContextValue {
  density: Densities;
  orientation: ToolbarOrientation;
  disabled: boolean;
}

const ToolbarContext = React.createContext<ToolbarContextValue>({
  density: Densities.Medium,
  orientation: "horizontal",
  disabled: false,
});

export function useToolbarContext(): ToolbarContextValue {
  return React.useContext(ToolbarContext);
}

export interface ToolbarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "aria-label"> {
  /** Required: a `role="toolbar"` without an accessible name is an axe violation. */
  "aria-label": string;
  orientation?: ToolbarOrientation;
  density?: Densities;
  disabled?: boolean;
  /** Rendered outside the item flow and excluded from arrow-key navigation. */
  leading?: React.ReactNode;
  /** Rendered outside the item flow and excluded from arrow-key navigation. */
  trailing?: React.ReactNode;
  overflow?: ToolbarOverflow;
  /**
   * Caps the visible item count directly, overriding the `ResizeObserver` measurement. jsdom
   * reports every width as `0`, so this is the deterministic seam for testing `overflow="menu"`.
   */
  maxVisibleItems?: number;
}

interface ToolbarItemLikeProps {
  icon?: React.ReactNode;
  label?: React.ReactNode;
  tooltip?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  "aria-label"?: string;
  children?: React.ReactNode;
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
}

/** What the overflow menu needs to stand in for one item that no longer fits. */
interface OverflowItem {
  props: ToolbarItemLikeProps;
  /** Toggles keep their pressed state in the menu, as a checked item. */
  toggle: boolean;
}

function isSeparatorElement(child: React.ReactElement): boolean {
  return child.type === ToolbarSeparator;
}

function isItemElement(child: React.ReactElement): boolean {
  return child.type === ToolbarButton || child.type === ToolbarToggleButton;
}

/** Flattens a child (including nested groups) into the button-like props the overflow menu needs. */
function collectOverflowItems(child: React.ReactNode): OverflowItem[] {
  if (!React.isValidElement(child)) return [];
  const props = child.props as ToolbarItemLikeProps;
  if (isSeparatorElement(child)) return [];
  if (isItemElement(child)) return [{ props, toggle: child.type === ToolbarToggleButton }];
  if (props.children === undefined) return [];
  return React.Children.toArray(props.children).flatMap(collectOverflowItems);
}

interface SplitChildren {
  visible: React.ReactElement[];
  overflowed: React.ReactElement[];
}

function splitChildren(children: React.ReactElement[], cap: number | undefined): SplitChildren {
  if (cap === undefined || cap < 0) return { visible: children, overflowed: [] };

  const visible: React.ReactElement[] = [];
  const overflowed: React.ReactElement[] = [];
  let itemCount = 0;

  for (const child of children) {
    if (isSeparatorElement(child)) {
      // A separator adjacent to a moved item collapses rather than leaving a stray divider.
      if (overflowed.length === 0) visible.push(child);
      continue;
    }
    if (itemCount < cap) {
      visible.push(child);
      itemCount += 1;
    } else {
      overflowed.push(child);
    }
  }

  while (visible.length > 0 && isSeparatorElement(visible[visible.length - 1])) {
    visible.pop();
  }

  return { visible, overflowed };
}

/** Whether the element takes typed text, and so owns the caret keys (Home, End, the arrows). */
function isEditable(el: HTMLElement): boolean {
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "submit", "reset", "image", "file", "range"].includes(
      el.type,
    );
  }
  return false;
}

function navigableItems(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[${ITEM_ATTR}]`)).filter(
    (el) => el.closest(`[${SLOT_ATTR}]`) === null,
  );
}

/**
 * Items that can take focus. Judged by the element itself rather than a marker attribute, because
 * Button owns its `data-disabled` and rewrites it; and an `aria-disabled` item stays in, since a
 * soft-disabled button is deliberately focusable.
 */
function enabledItems(root: HTMLElement): HTMLElement[] {
  return navigableItems(root).filter((el) => !el.matches(":disabled"));
}

const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  (
    {
      className,
      children,
      orientation = "horizontal",
      density,
      disabled = false,
      leading,
      trailing,
      overflow = "menu",
      maxVisibleItems,
      onKeyDown,
      onFocus,
      onPointerDown,
      "aria-label": ariaLabel,
      ...props
    },
    ref,
  ) => {
    const contextDensity = useDensity();
    const effectiveDensity = density ?? contextDensity;

    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const setRootRef = useMergedRefs(rootRef, ref);

    const [activeIndex, setActiveIndex] = React.useState(0);
    const [measuredCap, setMeasuredCap] = React.useState<number | undefined>(undefined);
    const cap = overflow === "menu" ? (maxVisibleItems ?? measuredCap) : undefined;

    const childElements = React.useMemo(
      () => React.Children.toArray(children).filter(React.isValidElement),
      [children],
    );
    const { visible, overflowed } = React.useMemo(
      () => splitChildren(childElements, cap),
      [childElements, cap],
    );
    const overflowItems = React.useMemo(
      () => overflowed.flatMap(collectOverflowItems),
      [overflowed],
    );

    // Roving tabindex: exactly one item is tabbable, so the toolbar is a single tab stop.
    React.useEffect(() => {
      const node = rootRef.current;
      if (!node) return;
      const items = navigableItems(node);
      const enabled = enabledItems(node);
      for (const el of items) el.setAttribute("tabindex", "-1");
      const active = enabled[activeIndex < enabled.length ? activeIndex : 0];
      active?.setAttribute("tabindex", "0");
    });

    // Runtime overflow measurement. jsdom reports 0 widths, which resolves to "everything fits".
    React.useEffect(() => {
      if (overflow !== "menu" || maxVisibleItems !== undefined) return;
      const node = rootRef.current;
      if (!node || typeof ResizeObserver === "undefined") return;

      const measure = () => {
        const available = orientation === "vertical" ? node.clientHeight : node.clientWidth;
        const items = navigableItems(node).filter(
          (el) => el.getAttribute("data-toolbar-overflow-trigger") !== "true",
        );
        if (available === 0 || items.length === 0) {
          setMeasuredCap(undefined);
          return;
        }
        let used = 0;
        let fits = 0;
        for (const el of items) {
          used += orientation === "vertical" ? el.offsetHeight : el.offsetWidth;
          if (used > available) break;
          fits += 1;
        }
        setMeasuredCap(fits >= items.length ? undefined : fits);
      };

      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      return () => observer.disconnect();
    }, [overflow, maxVisibleItems, orientation, children]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      const node = rootRef.current;
      if (!node) return;

      // Alt+Left and Alt+Right are the browser's Back and Forward, and a chord with Ctrl or Meta
      // (Ctrl+Home, Ctrl+Left...) is the page's or the platform's. Only the bare keys navigate.
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      // Only a key pressed on one of the toolbar's own items navigates. Everything else that
      // bubbles up to this root has keys of its own: the caret keys of a search field in the
      // `leading` or `trailing` slot, and the keys of the overflow menu, whose content React
      // delivers here although it is portaled out of the toolbar.
      const origin =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(`[${ITEM_ATTR}]`)
          : null;
      if (!origin || !node.contains(origin) || origin.closest(`[${SLOT_ATTR}]`) !== null) return;
      if (isEditable(origin)) return;

      const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
      const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
      const items = enabledItems(node);
      if (items.length === 0) return;

      const focused = items.indexOf(origin);
      const from = focused === -1 ? Math.min(activeIndex, items.length - 1) : focused;

      let next: number | undefined;
      if (event.key === nextKey) next = (from + 1) % items.length;
      else if (event.key === prevKey) next = (from - 1 + items.length) % items.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = items.length - 1;
      if (next === undefined) return;

      event.preventDefault();
      setActiveIndex(next);
      items[next].focus();
    };

    // The tab stop follows wherever focus actually goes, not only the arrow keys: after a mouse
    // click on item 3 and a Tab away, Shift+Tab has to come back to item 3. A pointer press counts
    // too, because Safari does not focus a button it was clicked on.
    const rememberItem = (target: EventTarget) => {
      const node = rootRef.current;
      const item = target instanceof Element ? target.closest<HTMLElement>(`[${ITEM_ATTR}]`) : null;
      if (!node || !item) return;
      const index = enabledItems(node).indexOf(item);
      if (index !== -1) setActiveIndex(index);
    };

    const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
      onFocus?.(event);
      rememberItem(event.target);
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      onPointerDown?.(event);
      rememberItem(event.target);
    };

    const contextValue = React.useMemo<ToolbarContextValue>(
      () => ({ density: effectiveDensity, orientation, disabled }),
      [effectiveDensity, orientation, disabled],
    );

    return (
      <ToolbarContext.Provider value={contextValue}>
        <TooltipProvider>
          <div
            ref={setRootRef}
            role="toolbar"
            aria-label={ariaLabel}
            aria-orientation={orientation}
            aria-disabled={disabled}
            data-density={effectiveDensity.toLowerCase()}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onPointerDown={handlePointerDown}
            className={cn(
              toolbarVariant({ density: effectiveDensity, orientation }),
              overflow === "wrap" && "flex-wrap",
              overflow === "scroll" &&
                (orientation === "vertical" ? "overflow-y-auto" : "overflow-x-auto"),
              disabled && "pointer-events-none opacity-50",
              className,
            )}
            {...props}
          >
            {leading !== undefined && (
              <div data-toolbar-slot="leading" className="mr-auto flex items-center">
                {leading}
              </div>
            )}
            {visible}
            {overflowItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size={densityToIconButtonSize(effectiveDensity)}
                    aria-label="More actions"
                    data-toolbar-item=""
                    data-toolbar-overflow-trigger="true"
                  >
                    <Ellipsis />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {overflowItems.map(({ props: item, toggle }, index) => {
                    const content = (
                      <>
                        {item.icon}
                        <span>{item.label ?? item.tooltip ?? item["aria-label"]}</span>
                      </>
                    );
                    // The menu item's own click, which Radix also fires for Enter and Space, so the
                    // handler gets a real event it can call preventDefault or stopPropagation on.
                    // Its currentTarget is the menu item rather than a button.
                    const onClick = item.onClick as unknown as React.MouseEventHandler<HTMLElement>;
                    return toggle ? (
                      <DropdownMenuCheckboxItem
                        key={index}
                        checked={Boolean(item.pressed)}
                        disabled={item.disabled}
                        onCheckedChange={(next) => item.onPressedChange?.(next)}
                        onClick={onClick}
                      >
                        {content}
                      </DropdownMenuCheckboxItem>
                    ) : (
                      <DropdownMenuItem
                        key={index}
                        // Lines the labels up with the checked items' indicator column.
                        inset={overflowItems.some((other) => other.toggle)}
                        disabled={item.disabled}
                        onClick={onClick}
                      >
                        {content}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {trailing !== undefined && (
              <div data-toolbar-slot="trailing" className="ml-auto flex items-center">
                {trailing}
              </div>
            )}
          </div>
        </TooltipProvider>
      </ToolbarContext.Provider>
    );
  },
);
Toolbar.displayName = "Toolbar";

export interface ToolbarGroupProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "aria-label"
> {
  "aria-label": string;
  density?: Densities;
  orientation?: ToolbarOrientation;
}

const ToolbarGroup = React.forwardRef<HTMLDivElement, ToolbarGroupProps>(
  ({ className, density, orientation, ...props }, ref) => {
    const context = useToolbarContext();
    return (
      <div
        ref={ref}
        role="group"
        className={cn(
          toolbarGroupVariant({
            density: density ?? context.density,
            orientation: orientation ?? context.orientation,
          }),
          className,
        )}
        {...props}
      />
    );
  },
);
ToolbarGroup.displayName = "ToolbarGroup";

export interface ToolbarSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  density?: Densities;
  /** The *toolbar's* orientation; the separator renders perpendicular to it. */
  orientation?: ToolbarOrientation;
}

const ToolbarSeparator = React.forwardRef<HTMLDivElement, ToolbarSeparatorProps>(
  ({ className, density, orientation, ...props }, ref) => {
    const context = useToolbarContext();
    const toolbarOrientation = orientation ?? context.orientation;
    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={toolbarOrientation === "vertical" ? "horizontal" : "vertical"}
        className={cn(
          toolbarSeparatorVariant({
            density: density ?? context.density,
            orientation: toolbarOrientation,
          }),
          className,
        )}
        {...props}
      />
    );
  },
);
ToolbarSeparator.displayName = "ToolbarSeparator";

export interface ToolbarButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  icon?: React.ReactNode;
  label?: React.ReactNode;
  tooltip?: string;
  density?: Densities;
}

/**
 * A button in a toolbar. It is a roving-tabindex item: one button of the toolbar is a tab stop and
 * the arrow keys move between them.
 *
 * A disabled button is disabled natively (the `disabled` attribute, which also removes it from
 * navigation). It no longer carries the `data-disabled="true"` marker an earlier version added, so
 * outside CSS or tests that select on it should use `:disabled` or `[data-disabled]`, which the
 * underlying Button sets for its own styling.
 */
const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ className, icon, label, tooltip, density, disabled, ...props }, ref) => {
    const context = useToolbarContext();
    const effectiveDensity = density ?? context.density;
    const isDisabled = Boolean(disabled) || context.disabled;
    const iconOnly = icon !== undefined && label === undefined;
    // An icon-only button falls back to its tooltip so it is never nameless.
    const accessibleName = props["aria-label"] ?? (iconOnly ? tooltip : undefined);

    const button = (
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        size={
          iconOnly
            ? densityToIconButtonSize(effectiveDensity)
            : densityToButtonSize(effectiveDensity)
        }
        disabled={isDisabled}
        data-toolbar-item=""
        className={className}
        {...props}
        aria-label={accessibleName}
      >
        {icon}
        {label !== undefined && <span>{label}</span>}
      </Button>
    );

    if (tooltip === undefined) return button;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  },
);
ToolbarButton.displayName = "ToolbarButton";

export interface ToolbarToggleButtonProps extends ToolbarButtonProps {
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
}

/**
 * A toolbar button with a pressed state (`aria-pressed`). Pressed, it has a tint and a bar under the
 * icon, which is what shows it to anyone for whom the tint alone is too faint.
 */
const ToolbarToggleButton = React.forwardRef<HTMLButtonElement, ToolbarToggleButtonProps>(
  ({ className, pressed = false, onPressedChange, onClick, ...props }, ref) => (
    <ToolbarButton
      ref={ref}
      aria-pressed={pressed}
      className={cn(
        // A tint alone is a 1.1:1 step from the toolbar. The bar under the icon is the cue that
        // survives a low-vision user's contrast and forced-colors mode, which strips the tint.
        pressed &&
          "relative bg-accent after:pointer-events-none after:absolute after:inset-x-1.5 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-foreground forced-colors:after:bg-[Highlight]",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        onPressedChange?.(!pressed);
      }}
      {...props}
    />
  ),
);
ToolbarToggleButton.displayName = "ToolbarToggleButton";

export { Toolbar, ToolbarGroup, ToolbarSeparator, ToolbarButton, ToolbarToggleButton };
