import * as React from "react";

/**
 * A native `disabled` control leaves the tab order and the accessibility tree's reach: a keyboard
 * user never finds it, a screen reader cannot be told why it is unavailable, and a tooltip on it
 * never opens because it emits no pointer events. A submit button disabled while a form is invalid
 * is the usual victim.
 *
 * The soft form keeps the control focusable and announced, with `aria-disabled="true"`, and
 * swallows the activation itself: click, Enter, Space and the form submit they would trigger. A
 * control that declares a popup (`aria-haspopup`, which Radix sets on a menu trigger) also stops
 * the presses and arrow keys that would open it, since a Radix menu opens on pointer-down and on
 * ArrowDown, not on click.
 */
export interface SoftDisabledOptions<Element extends HTMLElement> {
  disabled?: boolean;
  /** Keep the control focusable while `disabled`; without it `disabled` is the native attribute. */
  focusableWhenDisabled?: boolean;
  /** Why it is unavailable, announced as the control's description. */
  disabledReason?: string;
  onClick?: React.MouseEventHandler<Element>;
  onKeyDown?: React.KeyboardEventHandler<Element>;
  onPointerDown?: React.PointerEventHandler<Element>;
  onMouseDown?: React.MouseEventHandler<Element>;
  "aria-describedby"?: string;
  "aria-haspopup"?: React.AriaAttributes["aria-haspopup"];
}

export interface SoftDisabledResult<Element extends HTMLElement> {
  /** True when the control is disabled the soft way. */
  soft: boolean;
  /**
   * Spread onto the control AFTER its other props, having taken the options above out of them.
   *
   * `aria-disabled`, `data-disabled`, `aria-describedby` and `aria-haspopup` are present only when
   * they have a value. An own key set to `undefined` is not the same as an absent one: Radix's Slot
   * lets a child's explicit `undefined` override what a wrapping Tooltip or Trigger passes down, so
   * an always-present `aria-describedby: undefined` cut the open tooltip off from its button.
   */
  props: {
    disabled: boolean | undefined;
    onClick: React.MouseEventHandler<Element> | undefined;
    onKeyDown: React.KeyboardEventHandler<Element> | undefined;
    onPointerDown: React.PointerEventHandler<Element> | undefined;
    onMouseDown: React.MouseEventHandler<Element> | undefined;
    "aria-describedby"?: string;
    "aria-haspopup"?: React.AriaAttributes["aria-haspopup"];
    "aria-disabled"?: true;
    "data-disabled"?: "";
  };
  /** Render `<span id={reason.id} hidden>{reason.text}</span>` inside the control. */
  reason: { id: string; text: string } | null;
}

function declaresPopup(value: React.AriaAttributes["aria-haspopup"]): boolean {
  return value !== undefined && value !== false && value !== "false";
}

export function useSoftDisabled<Element extends HTMLElement>(
  options: SoftDisabledOptions<Element>,
): SoftDisabledResult<Element> {
  const {
    disabled,
    focusableWhenDisabled,
    disabledReason,
    onClick,
    onKeyDown,
    onPointerDown,
    onMouseDown,
    "aria-describedby": describedBy,
    "aria-haspopup": hasPopup,
  } = options;
  const reasonId = React.useId();
  const soft = Boolean(disabled && focusableWhenDisabled);
  const popup = declaresPopup(hasPopup);
  const reason = disabled && disabledReason ? { id: reasonId, text: disabledReason } : null;

  const blockClick = React.useCallback((event: React.MouseEvent<Element>) => {
    // Cancelling the click also cancels the submit a `type="submit"` button would start, whether
    // from a pointer, Enter/Space on the button, or implicit submission from a field in the form.
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const blockKey = React.useCallback(
    (event: React.KeyboardEvent<Element>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        return;
      }
      // Radix opens a menu on ArrowDown/ArrowUp. Any other control keeps its arrow keys: swallowing
      // them would trap a soft-disabled item inside a vertical toolbar or menu.
      if (popup && (event.key === "ArrowDown" || event.key === "ArrowUp")) return;
      onKeyDown?.(event);
    },
    [onKeyDown, popup],
  );

  const describedByValue = [describedBy, reason?.id].filter(Boolean).join(" ");

  return {
    soft,
    props: {
      disabled: soft ? undefined : disabled,
      ...(soft ? { "aria-disabled": true as const, "data-disabled": "" as const } : {}),
      ...(describedByValue ? { "aria-describedby": describedByValue } : {}),
      ...(hasPopup !== undefined ? { "aria-haspopup": hasPopup } : {}),
      onClick: soft ? blockClick : onClick,
      onKeyDown: soft ? blockKey : onKeyDown,
      // Radix's DropdownMenuTrigger and Select open on pointer-down, before any click.
      onPointerDown: soft ? undefined : onPointerDown,
      onMouseDown: soft ? undefined : onMouseDown,
    },
    reason,
  };
}
