import * as React from "react";

/**
 * Controlled when `value` is defined, otherwise tracks its own state seeded from `defaultValue`.
 * `onChange` fires for both modes, so a caller can mirror an uncontrolled field.
 */
export function useControllableValue<T>(
  value: T | undefined,
  defaultValue: T,
  onChange: ((next: T) => void) | undefined,
): [T, (next: T) => void] {
  const [inner, setInner] = React.useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : inner;
  const set = React.useCallback(
    (next: T) => {
      if (!isControlled) setInner(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );
  return [current, set];
}
