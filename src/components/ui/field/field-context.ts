import * as React from "react";

export interface FieldContextValue {
  /** The id of the control the label points at: the `id` prop, or one generated with `useId`. */
  id: string;
  /** For composite controls (radio group, range) that name themselves with `aria-labelledby`. */
  labelId: string;
  /** Whether a label renders, so `labelId` is only referenced when it exists. */
  hasLabel: boolean;
  /** The label as text, when it is a string; a control that cannot be labelled by id needs the words. */
  labelText?: string;
  hintId: string;
  errorId: string;
  /** Space-separated ids of the hint and error, listing only the ones that render. */
  describedBy?: string;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
  name?: string;
  /**
   * For a control that owns the id of its focusable element (cmdk does), so the label can point at
   * it instead of at the generated `id`. Pass `undefined` to go back.
   */
  setControlId?: (id: string | undefined) => void;
}

export const FieldContext = React.createContext<FieldContextValue | null>(null);

/** The field the caller is inside, or `null`. */
export function useFieldContext(): FieldContextValue | null {
  return React.useContext(FieldContext);
}

type Booleanish = boolean | "true" | "false";

export interface FieldControlProps {
  id?: string;
  name?: string;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
  "aria-required"?: Booleanish;
}

export interface ResolvedFieldControlProps {
  id: string | undefined;
  name: string | undefined;
  disabled: boolean | undefined;
  "aria-describedby": string | undefined;
  "aria-invalid": FieldControlProps["aria-invalid"];
  "aria-required": Booleanish | undefined;
}

function mergeIds(...lists: Array<string | undefined>): string | undefined {
  const ids = lists.flatMap((list) => (list ?? "").split(/\s+/).filter(Boolean));
  return ids.length > 0 ? Array.from(new Set(ids)).join(" ") : undefined;
}

/**
 * What a form control takes from the field around it. A prop the caller passed always wins, except
 * `aria-describedby`, which is joined with the field's. `aria-invalid` and `aria-required` are only
 * ever emitted as `true`, never as `"false"`. Outside a field the props come back untouched.
 */
export function useFieldControl<P extends FieldControlProps>(
  props: P,
): P & ResolvedFieldControlProps {
  const field = React.useContext(FieldContext);
  return {
    ...props,
    id: props.id ?? field?.id,
    name: props.name ?? field?.name,
    disabled: props.disabled ?? (field?.disabled ? true : undefined),
    "aria-describedby": mergeIds(props["aria-describedby"], field?.describedBy),
    "aria-invalid": props["aria-invalid"] ?? (field?.invalid ? true : undefined),
    "aria-required": props["aria-required"] ?? (field?.required ? true : undefined),
  };
}
