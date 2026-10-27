import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  FieldContext,
  useFieldControl,
  type FieldContextValue,
} from "@/components/ui/field/field-context";
import { fieldErrorTextClass } from "@/components/ui/field/field-variant";
import { FormFieldContext, FormItemContext, useFormField } from "./hooks";

const Form = FormProvider;

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

export interface FormItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Marks the control `aria-required` and the label with an asterisk. */
  required?: boolean;
}

/**
 * Provides the same {@link FieldContext} as `Field`, fed from react-hook-form: the control finds its
 * id, description, error state and required flag the way it does inside a `Field`. A control that
 * owns its own id (`MultipleSelector`) hands it back, and `FormLabel` points at that instead.
 * `FormLabel` tells the item it renders, so a group named by `aria-labelledby` only references it
 * when it exists.
 */
const FormItem = React.forwardRef<HTMLDivElement, FormItemProps>(
  ({ className, required = false, ...props }, ref) => {
    const id = React.useId();
    const { name } = React.useContext(FormFieldContext);
    const form = useFormContext();
    const invalid = form ? Boolean(form.getFieldState(name, form.formState).error) : false;
    const [labelMounted, setLabelMounted] = React.useState(false);
    const [descriptionMounted, setDescriptionMounted] = React.useState(false);
    const [messageMounted, setMessageMounted] = React.useState(false);
    const [controlId, setControlId] = React.useState<string>();

    const item = React.useMemo(
      () => ({
        id,
        required,
        controlId,
        setLabelMounted,
        setDescriptionMounted,
        setMessageMounted,
      }),
      [id, required, controlId],
    );

    const field = React.useMemo<FieldContextValue>(() => {
      const hintId = `${id}-form-item-description`;
      const errorId = `${id}-form-item-message`;
      return {
        id: `${id}-form-item`,
        labelId: `${id}-form-item-label`,
        hasLabel: labelMounted,
        hintId,
        errorId,
        describedBy:
          [descriptionMounted && hintId, messageMounted && errorId].filter(Boolean).join(" ") ||
          undefined,
        invalid,
        required,
        disabled: false,
        name,
        setControlId,
      };
    }, [id, labelMounted, descriptionMounted, messageMounted, invalid, required, name]);

    return (
      <FormItemContext.Provider value={item}>
        <FieldContext.Provider value={field}>
          <div ref={ref} className={cn("gap-y-4", className)} {...props} />
        </FieldContext.Provider>
      </FormItemContext.Provider>
    );
  },
);
FormItem.displayName = "FormItem";

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, children, ...props }, ref) => {
  const { error, formItemId, formLabelId, required } = useFormField();
  const { setLabelMounted } = React.useContext(FormItemContext);

  React.useLayoutEffect(() => {
    setLabelMounted?.(true);
    return () => setLabelMounted?.(false);
  }, [setLabelMounted]);

  return (
    <Label
      ref={ref}
      id={formLabelId}
      className={cn(error && fieldErrorTextClass, className)}
      htmlFor={formItemId}
      {...props}
    >
      {children}
      {required ? (
        <span aria-hidden="true" className={fieldErrorTextClass}>
          {" "}
          *
        </span>
      ) : null}
    </Label>
  );
});
FormLabel.displayName = "FormLabel";

/** Hands the control its id and `aria-*` state, listing the description and message only while they render. */
const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const control = useFieldControl({});

  return (
    <Slot
      ref={ref}
      id={control.id}
      aria-describedby={control["aria-describedby"]}
      aria-invalid={control["aria-invalid"]}
      aria-required={control["aria-required"]}
      {...props}
    />
  );
});
FormControl.displayName = "FormControl";

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField();
  const { setDescriptionMounted } = React.useContext(FormItemContext);

  React.useLayoutEffect(() => {
    setDescriptionMounted?.(true);
    return () => setDescriptionMounted?.(false);
  }, [setDescriptionMounted]);

  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  );
});
FormDescription.displayName = "FormDescription";

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField();
  const { setMessageMounted } = React.useContext(FormItemContext);
  const body = error ? String(error?.message) : children;
  const hasBody = Boolean(body);

  React.useLayoutEffect(() => {
    if (!hasBody) return;
    setMessageMounted?.(true);
    return () => setMessageMounted?.(false);
  }, [hasBody, setMessageMounted]);

  if (!body) {
    return null;
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      role="alert"
      className={cn(fieldErrorTextClass, className)}
      {...props}
    >
      {body}
    </p>
  );
});
FormMessage.displayName = "FormMessage";

export { Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage, FormField };
