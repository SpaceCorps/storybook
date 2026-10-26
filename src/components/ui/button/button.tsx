import React from "react";
import { Slot } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { buttonVariant } from "./variant";
import { useSoftDisabled } from "./soft-disabled";
import { useDensity } from "@/contexts/density-context";
import { densityToButtonSize } from "@/components/ui/density-scale";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariant> {
  asChild?: boolean;
  /**
   * With `disabled`, keep the button in the tab order instead of removing it. It renders
   * `aria-disabled="true"` rather than the `disabled` attribute, ignores click, Enter, Space and
   * the form submit they would start, and dims like a disabled button. Use it where a person
   * needs to find the control and learn why it is unavailable; plain `disabled` is unchanged.
   */
  focusableWhenDisabled?: boolean;
  /**
   * Why the button is unavailable, announced as its description while `disabled`. It is rendered
   * inside the button, so it needs a button of its own: with `asChild` it is not rendered.
   */
  disabledReason?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      disabled,
      focusableWhenDisabled,
      disabledReason,
      onClick,
      onKeyDown,
      onPointerDown,
      onMouseDown,
      children,
      "aria-describedby": describedBy,
      "aria-haspopup": hasPopup,
      ...props
    },
    ref,
  ) => {
    const contextDensity = useDensity();
    const effectiveSize = size ?? densityToButtonSize(contextDensity);
    const Comp = asChild ? Slot : "button";
    const softDisabled = useSoftDisabled<HTMLButtonElement>({
      disabled,
      focusableWhenDisabled,
      disabledReason: asChild ? undefined : disabledReason,
      onClick,
      onKeyDown,
      onPointerDown,
      onMouseDown,
      "aria-describedby": describedBy,
      "aria-haspopup": hasPopup,
    });
    return (
      <Comp
        className={cn(buttonVariant({ variant, size: effectiveSize, className }))}
        ref={ref}
        {...props}
        {...softDisabled.props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {children}
            {softDisabled.reason ? (
              // Hidden, so it stays out of the button's name, yet still read as its description.
              <span id={softDisabled.reason.id} hidden>
                {softDisabled.reason.text}
              </span>
            ) : null}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button };
