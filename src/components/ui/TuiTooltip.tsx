import React, { useContext } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { TuiKbd, formatShortcut } from "./TuiKbd";
import "./ui.css";

export { formatShortcut };

/* Radix arbitrates hover hand-off (and the "one tooltip at a time" rule) inside a Provider, so
   a Provider per tooltip means every button in a row waits out the full delay again. A widget
   root wraps its subtree in TooltipScope once; tooltips inside it then share that Provider, and
   a tooltip mounted outside any scope still brings its own. */
const InScope = React.createContext(false);

export interface TooltipScopeProps {
  children: React.ReactNode;
  delayDuration?: number;
  skipDelayDuration?: number;
}

export const TooltipScope: React.FC<TooltipScopeProps> = ({
  children,
  delayDuration = 500,
  skipDelayDuration = 300,
}) => {
  /* A widget hosted inside another widget's scope reuses it rather than nesting a second one. */
  if (useContext(InScope)) return <>{children}</>;

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration}>
      <InScope.Provider value={true}>{children}</InScope.Provider>
    </TooltipPrimitive.Provider>
  );
};

export type TooltipSide = "top" | "right" | "bottom" | "left";

/**
 * Passed to a trigger that has nothing to show. Radix composes its own handler after the caller's and
 * skips it when the event is already prevented, so the trigger neither opens nor tells the provider
 * that it did (which would close a tooltip that is open on some other control).
 */
const cancelOpen = (event: React.SyntheticEvent) => event.preventDefault();

export interface TooltipProps {
  /**
   * The tooltip body. Nothing renders when it is empty, and an element child then does nothing it
   * would not do bare: it stays mounted only so that a control whose tooltip text comes and goes
   * (a gate that opens, a reason that clears) is not remounted, which would drop its focus.
   */
  content?: React.ReactNode;
  children: React.ReactNode;
  side?: TooltipSide;
  sideOffset?: number;
  /** Shortcut hint shown as a key cap next to the label, e.g. "⌘+K" or ["Ctrl", "K"]. */
  shortcut?: string | string[];
  /** False renders the trigger alone — for a label that is only a tooltip while collapsed. */
  enabled?: boolean;
  /**
   * Anchors the tooltip on a wrapper `span` instead of the trigger itself, for a trigger that cannot
   * take pointer events. It is a property of the control, not of its current state: flipping it
   * would remount the trigger.
   *
   * Do not use it to explain a disabled control. A natively disabled button is out of the tab order
   * whatever wraps it, so the explanation never reaches a keyboard. Make the control soft-disabled
   * instead (`focusableWhenDisabled` and `disabledReason` on `Button` and `IconButton`): it stays
   * focusable, announces the reason, and opens this tooltip on hover and on focus with no wrapper.
   * The wrapper itself is never focusable, since an unnamed, outline-less tab stop is worse than none.
   */
  wrapTrigger?: boolean;
  /**
   * @deprecated No effect. It used to make the `wrapTrigger` wrapper a tab stop while the control
   * was disabled; that stop was unnamed and invisible, so the wrapper is never focusable now. Use
   * `focusableWhenDisabled` and `disabledReason` on the control instead.
   */
  triggerDisabled?: boolean;
  delayDuration?: number;
  skipDelayDuration?: number;
  className?: string;
  asChild?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * The bundle's one tooltip: a portaled Radix tooltip with the shared card styling and an
 * optional key cap. Every widget uses it instead of a native `title`, so hover timing, styling
 * and placement match wherever a control lives.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = "top",
  sideOffset = 8,
  shortcut,
  enabled = true,
  wrapTrigger = false,
  delayDuration = 500,
  skipDelayDuration = 300,
  className = "",
  asChild = true,
  open,
  defaultOpen,
  onOpenChange,
}) => {
  const scoped = useContext(InScope);
  const hasContent = Boolean(content);

  /* Radix is always driven from here, so it never switches between controlled and uncontrolled as
     `content` comes and goes. */
  const [innerOpen, setInnerOpen] = React.useState(defaultOpen ?? false);
  const controlled = open !== undefined;
  const handleOpenChange = (next: boolean) => {
    // No content, nothing to open: do not remember a hover that had no tooltip to show.
    if (next && !hasContent) return;
    if (!controlled) setInnerOpen(next);
    onOpenChange?.(next);
  };

  if (enabled === false) {
    return <>{children}</>;
  }

  /* An element child that is its own trigger keeps one place in the tree whether or not there is
     content. Otherwise a control whose tooltip text comes and goes (a gate that opens, a reason
     that clears) would be remounted each time, and a focused button would lose focus to <body>.
     Anything else (text, a fragment, a child that Radix would have to wrap) is returned bare. */
  const keepsPlace =
    asChild && !wrapTrigger && React.isValidElement(children) && children.type !== React.Fragment;
  if (!hasContent && !keepsPlace) {
    return <>{children}</>;
  }

  const root = (
    <TooltipPrimitive.Root
      open={hasContent && (controlled ? open : innerOpen)}
      onOpenChange={handleOpenChange}
    >
      <TooltipPrimitive.Trigger
        asChild={asChild || wrapTrigger}
        // With nothing to show the trigger is inert: no state attribute, and no opening on hover or
        // focus.
        {...(hasContent
          ? {}
          : { "data-state": undefined, onPointerMove: cancelOpen, onFocus: cancelOpen })}
      >
        {wrapTrigger ? <span className="tui-tooltip-trigger-wrap">{children}</span> : children}
      </TooltipPrimitive.Trigger>
      {hasContent ? (
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={sideOffset}
            className={`tui-tooltip-content ${className}`.trim()}
          >
            <div className="tui-tooltip-inner">
              {typeof content === "string" ? (
                <span className="tui-tooltip-label">{content}</span>
              ) : (
                content
              )}
              {shortcut && <TuiKbd keys={shortcut} variant="boxed" />}
            </div>
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      ) : null}
    </TooltipPrimitive.Root>
  );

  if (scoped) return root;

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration}>
      {root}
    </TooltipPrimitive.Provider>
  );
};
