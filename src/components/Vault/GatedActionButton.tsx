import React from "react";
import { Button, type ButtonProps } from "../ui/button/button";
import { Tooltip } from "../ui/TuiTooltip";
import type { VaultGate } from "./gate";

export interface GatedActionButtonProps extends Omit<
  ButtonProps,
  "disabled" | "children" | "focusableWhenDisabled" | "disabledReason"
> {
  children: React.ReactNode;
  /** The gate from `computeVaultGate`; a disabled gate carries the reason to show. */
  gate: VaultGate;
  /** Shown when the gate allows the action — a plain hint rather than an explanation. */
  tooltip?: React.ReactNode;
}

/**
 * A vault action button that never fails silently: when its gate is closed the button stays in the
 * tab order, marked `aria-disabled`, and the reason is reachable as its accessible description, as
 * a tooltip on hover and on keyboard focus, and as the native `title`. Neither a keyboard user, a
 * screen reader user, a hovering user nor an assertion has to guess why nothing happens.
 *
 * It is soft-disabled (`focusableWhenDisabled`) rather than natively disabled, because a native
 * `disabled` button leaves the tab order and emits no pointer events, which is exactly when the
 * reason matters most. The tooltip sits on the button itself, so no wrapper is needed.
 *
 * **Breaking change from the natively disabled button this used to be.** A closed gate now renders
 * `aria-disabled="true"` and no `disabled` attribute, so in a consumer's own tests and styles:
 *
 * - `expect(button).toBeDisabled()`, `button.disabled` and `:disabled` no longer match. Assert
 *   `toHaveAttribute("aria-disabled", "true")` or select `[aria-disabled="true"]` instead.
 * - Click, Enter and Space are still ignored, and a submit button still does not submit. Only code
 *   that reads the `disabled` attribute (CSS, form libraries) can no longer tell.
 * - The button is a tab stop while the gate is closed, and carries a hidden description, so its
 *   `textContent` is the label followed by the reason. Query it by role and accessible name.
 * - While it has a tooltip the element carries the trigger's `data-state` attribute.
 *
 * There is no switch back to a native `disabled`: that is the behaviour that left the reason out of
 * a keyboard user's reach.
 */
export const GatedActionButton: React.FC<GatedActionButtonProps> = ({
  children,
  gate,
  tooltip,
  onClick,
  ...rest
}) => {
  const reason = gate.disabled ? gate.reason : undefined;
  const content = reason ?? tooltip;

  return (
    <Tooltip content={content}>
      <Button
        {...rest}
        disabled={gate.disabled}
        focusableWhenDisabled
        disabledReason={reason}
        title={typeof content === "string" ? content : undefined}
        onClick={onClick}
      >
        {children}
      </Button>
    </Tooltip>
  );
};
