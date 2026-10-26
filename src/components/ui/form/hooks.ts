import * as React from "react";
import { type FieldPath, type FieldValues, useFormContext } from "react-hook-form";

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

export const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue,
);

type FormItemContextValue = {
  id: string;
  /** Whether the item was marked `required`, which labels and controls both reflect. */
  required?: boolean;
  /** FormLabel, FormDescription and FormMessage tell the item they render, so a control only references ids that exist. */
  setLabelMounted?: (mounted: boolean) => void;
  setDescriptionMounted?: (mounted: boolean) => void;
  setMessageMounted?: (mounted: boolean) => void;
  /** The id of a control that owns its focusable element's id (cmdk does); the label points at it. */
  controlId?: string;
};

export const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue,
);

export const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  const fieldState = getFieldState(fieldContext.name, formState);

  const { id, required, controlId } = itemContext;

  return {
    id,
    name: fieldContext.name,
    required: required ?? false,
    formItemId: controlId ?? `${id}-form-item`,
    formLabelId: `${id}-form-item-label`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};
