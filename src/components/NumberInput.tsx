import { FieldReset } from "@/components/ui/field/field";
import { useFieldControl } from "@/components/ui/field/field-context";
import { Input, type InputProps } from "@/components/ui/input";
import { useMergedRefs } from "@/lib/merge-refs";
import { Densities } from "@/types/density";
import { useDensity } from "@/contexts/density-context";
import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ChangeEvent,
  type FocusEvent,
  type WheelEvent,
} from "react";
import { formatBytes } from "@/lib/formatters";

const numberFormatCache = new Map<string, Intl.NumberFormat>();

export interface NumberInputProps extends Omit<
  InputProps,
  | "value"
  | "defaultValue"
  | "onChange"
  | "type"
  | "min"
  | "max"
  | "step"
  | "density"
  // The password and verbatim extras mean nothing on a number.
  | "passwordToggle"
  | "passwordToggleLabel"
  | "revealed"
  | "defaultRevealed"
  | "onRevealedChange"
  | "containerClassName"
  | "verbatim"
> {
  min?: number;
  max?: number;
  step?: number;
  value?: number | null;
  onChange?: (value: number | null) => void;
  format?: Intl.NumberFormatOptions;
  isBytesFormat?: boolean;
  allowNegative?: boolean;
  density?: Densities;
  "data-testid"?: string;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      min,
      max,
      step = 1,
      placeholder = "",
      value = null,
      onChange,
      onBlur,
      onFocus,
      onKeyDown,
      onWheel,
      format = {
        style: "decimal",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        useGrouping: true,
        notation: "standard",
      },
      isBytesFormat = false,
      allowNegative = true,
      className = "",
      density,
      "data-testid": dataTestId,
      ...fieldProps
    },
    ref,
  ) => {
    // `name` belongs on a hidden input that holds the number, not on the text being edited, which is
    // formatted ("1,234.5", "1.2 KB") and is not what a form should submit.
    const { name, disabled, ...inputProps } = useFieldControl(fieldProps);
    const readOnly = inputProps.readOnly === true;
    const contextDensity = useDensity();
    const effectiveDensity = density ?? contextDensity;

    const [displayValue, setDisplayValue] = useState<string>("");
    const [isFocused, setIsFocused] = useState(false);
    const [isValid, setIsValid] = useState(true);
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const mergedRef = useMergedRefs(ref, inputRef);

    const formatter = useMemo(() => {
      const key = JSON.stringify(format);
      let fmt = numberFormatCache.get(key);
      if (!fmt) {
        fmt = Intl.NumberFormat(undefined, format);
        numberFormatCache.set(key, fmt);
      }
      return fmt;
    }, [format]);

    const formatValue = useCallback(
      (num: number | null): string => {
        if (num === null) return "";
        try {
          if (isFocused) return num.toString();
          if (isBytesFormat) return formatBytes(num, format.maximumFractionDigits ?? 2);
          return formatter.format(num);
        } catch {
          return num.toString();
        }
      },
      [formatter, isFocused, isBytesFormat, format.maximumFractionDigits],
    );

    const parseValue = useCallback(
      (input: string, shouldRound = true): number | null => {
        if (!input) return null;

        const cleaned = input.replace(/[^\d.-]/g, "");
        const parts = cleaned.split(".");
        const sanitized = parts[0] + (parts.length > 1 ? "." + parts[1] : "");
        const parsed = parseFloat(sanitized);

        if (isNaN(parsed)) return null;
        if (!allowNegative && parsed < 0) return null;
        if (min !== undefined && parsed < min) return min;
        if (max !== undefined && parsed > max) return max;

        if (step && shouldRound) {
          const rounded = Math.round(parsed / step) * step;
          return Number(rounded.toFixed(10));
        }

        return parsed;
      },
      [min, max, step, allowNegative],
    );

    const handleStep = useCallback(
      (multiplier: number) => {
        if (disabled || readOnly) return;

        const current = value ?? 0;
        const newValue = parseValue((current + step * multiplier).toString(), true);

        if (newValue !== null) {
          if (max !== undefined && newValue > max) return;
          if (min !== undefined && newValue < min) return;

          onChange?.(newValue);
          setDisplayValue(formatValue(newValue));
        }
      },
      [value, step, parseValue, onChange, formatValue, disabled, readOnly, min, max],
    );

    // The caller's handler runs first and can take the key or the wheel for itself with
    // `preventDefault`; it never switches stepping off by being there.
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        onKeyDown?.(e);
        if (e.defaultPrevented || disabled || readOnly) return;

        switch (e.key) {
          case "ArrowUp":
            e.preventDefault();
            handleStep(1);
            break;
          case "ArrowDown":
            e.preventDefault();
            handleStep(-1);
            break;
        }
      },
      [onKeyDown, disabled, readOnly, handleStep],
    );

    const handleWheel = useCallback(
      (e: WheelEvent<HTMLInputElement>) => {
        onWheel?.(e);
        if (e.defaultPrevented || !isFocused || disabled || readOnly) return;

        e.preventDefault();
        const delta = -Math.sign(e.deltaY);
        handleStep(delta);
      },
      [onWheel, isFocused, disabled, readOnly, handleStep],
    );

    const handleChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        if (inputValue === "") {
          setDisplayValue("");
          setIsValid(true);
          onChange?.(null);
          return;
        }

        const newValue = parseValue(inputValue, false);
        setDisplayValue(inputValue);
        setIsValid(newValue !== null);

        if (newValue !== null) {
          onChange?.(newValue);
        }
      },
      [parseValue, onChange],
    );

    const handleFocus = useCallback(
      (e: FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        setDisplayValue(value?.toString() ?? "");
        onFocus?.(e);
      },
      [value, onFocus],
    );

    const handleBlur = useCallback(
      (e: FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        if (value === null) {
          setDisplayValue("");
        } else {
          setDisplayValue(formatValue(value));
        }
        onBlur?.(e);
      },
      [formatValue, value, onBlur],
    );

    useEffect(() => {
      if (!isFocused) {
        setDisplayValue(formatValue(value));
      }
    }, [value, isFocused, formatValue]);

    const displayValueToUse = isFocused ? displayValue : formatValue(value);

    return (
      // The field's id, description and state were resolved above and are passed on by hand, so the
      // surrounding field is cut off from the Input, which would otherwise hand it the `name` again.
      <FieldReset>
        <div className="relative">
          <Input
            ref={mergedRef}
            type="text"
            inputMode="decimal"
            value={displayValueToUse}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            min={min}
            max={max}
            step={step}
            placeholder={placeholder}
            density={effectiveDensity}
            className={`${className} ${!isValid ? "border-[var(--color-destructive)] dark:border-red" : ""}`}
            data-testid={dataTestId}
            data-gamepad-step=""
            {...inputProps}
            disabled={disabled}
            onKeyDown={handleKeyDown}
            onWheel={handleWheel}
          />
          {name ? (
            <input type="hidden" name={name} value={value ?? ""} disabled={disabled} />
          ) : null}
        </div>
      </FieldReset>
    );
  },
);

NumberInput.displayName = "NumberInput";

export default NumberInput;
