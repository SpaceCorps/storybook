import React from "react";
import { useSoftDisabled } from "./button/soft-disabled";
import { Tooltip, type TooltipSide } from "./TuiTooltip";
import "./ui.css";

export type IconButtonSize = "sm" | "md" | "lg";
export type IconButtonVariant = "ghost" | "danger" | "solid";

export interface IconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "title" | "children"
> {
  /** Accessible name, and the tooltip text unless `tooltip` overrides it. */
  label: string;
  /** The icon. */
  children: React.ReactNode;
  /** Replaces the tooltip text; false suppresses the tooltip entirely. */
  tooltip?: React.ReactNode | false;
  shortcut?: string | string[];
  tooltipSide?: TooltipSide;
  tooltipOpen?: boolean;
  onTooltipOpenChange?: (open: boolean) => void;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  /** Held-open look for a button whose panel is showing. */
  active?: boolean;
  /**
   * With `disabled`, keep the button focusable (`aria-disabled`, not the `disabled` attribute) so a
   * keyboard user can find it and its tooltip opens on focus as well as hover. Click, Enter and
   * Space are ignored. Plain `disabled` stays native.
   */
  focusableWhenDisabled?: boolean;
  /**
   * Why it is unavailable: announced as the description, and shown in the tooltip. The button is
   * described by this reason alone. The open tooltip, which repeats the label and the reason, is not
   * linked to it a second time, so a screen reader does not say the reason twice.
   */
  disabledReason?: string;
  className?: string;
}

/**
 * The bundle's one icon button: a square hit target with the shared hover surface and a shared
 * tooltip instead of a native `title`, so every icon control in the app behaves the same.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    children,
    tooltip,
    shortcut,
    tooltipSide = "top",
    tooltipOpen,
    onTooltipOpenChange,
    size = "lg",
    variant = "ghost",
    active,
    focusableWhenDisabled,
    disabledReason,
    className = "",
    type = "button",
    ...rest
  },
  ref,
) {
  const hasDisabledProp = "disabled" in rest;
  const {
    disabled,
    onClick,
    onKeyDown,
    onPointerDown,
    onMouseDown,
    "aria-describedby": describedBy,
    "aria-haspopup": hasPopup,
    ...buttonProps
  } = rest;
  const softDisabled = useSoftDisabled<HTMLButtonElement>({
    disabled,
    focusableWhenDisabled,
    disabledReason,
    onClick,
    onKeyDown,
    onPointerDown,
    onMouseDown,
    "aria-describedby": describedBy,
    "aria-haspopup": hasPopup,
  });

  const button = (
    <button
      {...buttonProps}
      {...softDisabled.props}
      ref={ref}
      type={type}
      className={`tui-icon-btn ${className}`.trim()}
      data-size={size}
      data-variant={variant}
      data-active={active ? "true" : undefined}
      aria-label={label}
    >
      {children}
      {softDisabled.reason ? (
        <span id={softDisabled.reason.id} hidden>
          {softDisabled.reason.text}
        </span>
      ) : null}
    </button>
  );

  if (tooltip === false) return button;

  return (
    <Tooltip
      content={tooltip ?? (softDisabled.reason ? `${label}: ${softDisabled.reason.text}` : label)}
      shortcut={shortcut}
      side={tooltipSide}
      open={tooltipOpen}
      onOpenChange={onTooltipOpenChange}
      // A natively disabled button emits no pointer events, so its tooltip hangs off a wrapper.
      // A soft-disabled one is a live element and needs none.
      wrapTrigger={hasDisabledProp && !focusableWhenDisabled}
    >
      {button}
    </Tooltip>
  );
});
