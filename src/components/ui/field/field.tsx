import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FieldContext, type FieldContextValue } from "./field-context";
import { fieldErrorTextClass, fieldVariant } from "./field-variant";

export interface FieldProps extends Omit<React.ComponentPropsWithoutRef<"div">, "id"> {
  /** The visible label. Wired to the control by id, so clicking it focuses the control. */
  label?: React.ReactNode;
  /** Help text under the control; announced with it. */
  hint?: React.ReactNode;
  /** Error text under the control; announced with it and marks the control invalid. */
  error?: React.ReactNode;
  /** Sets `aria-required` on the control and adds an asterisk to the label. Not the native attribute. */
  required?: boolean;
  disabled?: boolean;
  /** Marks the control invalid without an error message (a message shown elsewhere). */
  invalid?: boolean;
  /** The control's id. Generated when omitted; two fields never share one. */
  id?: string;
  /** The form field name the control submits under. */
  name?: string;
  orientation?: "vertical" | "horizontal";
  /** Keeps the label for assistive technology and takes it off the screen. */
  hideLabel?: boolean;
}

/**
 * Wires a label, hint and error to the control inside it. The control picks the wiring up from
 * context (`Input`, `Textarea`, `Checkbox`, `Switch`, `Select`, `RadioGroup`, `NumberInput`,
 * `DatePicker`, `DateRangePicker`, `MultipleSelector`), so no id or `aria-*` has to be threaded by hand.
 */
const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  (
    {
      label,
      hint,
      error,
      required = false,
      disabled = false,
      invalid: invalidProp,
      id: idProp,
      name,
      orientation = "vertical",
      hideLabel = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const id = idProp ?? generatedId;
    const [controlId, setControlId] = React.useState<string>();
    const invalid = invalidProp ?? Boolean(error);
    const hasHint = Boolean(hint);
    const hasError = Boolean(error);
    const hasLabel = Boolean(label);
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    const labelId = `${id}-label`;
    const labelText = typeof label === "string" ? label : undefined;
    const describedBy = [hasHint && hintId, hasError && errorId].filter(Boolean).join(" ");

    const value = React.useMemo<FieldContextValue>(
      () => ({
        id,
        labelId,
        hasLabel,
        labelText,
        hintId,
        errorId,
        describedBy: describedBy || undefined,
        invalid,
        required,
        disabled,
        name,
        setControlId,
      }),
      [
        id,
        labelId,
        hasLabel,
        labelText,
        hintId,
        errorId,
        describedBy,
        invalid,
        required,
        disabled,
        name,
      ],
    );

    const horizontal = orientation === "horizontal";

    return (
      <FieldContext.Provider value={value}>
        <div
          ref={ref}
          data-slot="field"
          data-invalid={invalid || undefined}
          data-disabled={disabled || undefined}
          className={cn(fieldVariant({ orientation }), className)}
          {...props}
        >
          {horizontal ? children : null}
          {hasLabel ? (
            <Label
              id={labelId}
              htmlFor={controlId ?? id}
              className={cn(invalid && fieldErrorTextClass, hideLabel && "sr-only")}
            >
              {label}
              {required ? (
                <span aria-hidden="true" className={fieldErrorTextClass}>
                  {" "}
                  *
                </span>
              ) : null}
            </Label>
          ) : null}
          {horizontal ? null : children}
          {hasHint ? (
            <p
              id={hintId}
              className={cn("text-sm text-muted-foreground", horizontal && "col-start-2")}
            >
              {hint}
            </p>
          ) : null}
          {hasError ? (
            <p
              id={errorId}
              role="alert"
              className={cn("text-sm", fieldErrorTextClass, horizontal && "col-start-2")}
            >
              {error}
            </p>
          ) : null}
        </div>
      </FieldContext.Provider>
    );
  },
);
Field.displayName = "Field";

/**
 * Cuts the link to the surrounding field. React context crosses portals and component boundaries, so a
 * form opened from inside a field (a dialog, a popover) would otherwise hand its first input the outer
 * field's id and description.
 */
function FieldReset({ children }: { children?: React.ReactNode }) {
  return <FieldContext.Provider value={null}>{children}</FieldContext.Provider>;
}

export { Field, FieldReset };
