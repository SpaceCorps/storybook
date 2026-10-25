import * as React from "react";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Input, type InputProps } from "@/components/ui/input";
import { inputVariant } from "@/components/ui/input/variant";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDensity } from "@/contexts/density-context";
import type { Densities } from "@/types/density";
import {
  datePickerButtonVariant,
  datePickerInputVariant,
  dateRangeFrameVariant,
} from "./date-picker-variant";
import {
  compareIsoDates,
  formatIsoDate,
  formatTypedDate,
  isIsoDate,
  parseIsoDate,
} from "./iso-date";

const ISO_PLACEHOLDER = "yyyy-mm-dd";

/** Strips the field chrome the frame already draws, so the two inputs read as one control. */
const RANGE_FIELD =
  "h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-center shadow-none focus-visible:ring-0";

type CalendarProps = React.ComponentProps<typeof Calendar>;

/** Props shared by both pickers that configure the popover calendar. */
interface DatePickerCalendarProps {
  /** Earliest selectable date, `yyyy-mm-dd`. */
  min?: string;
  /** Latest selectable date, `yyyy-mm-dd`. */
  max?: string;
  /** First day of the week, 0 = Sunday. Defaults to 1 (Monday), as in ISO 8601 and Sweden. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** A `date-fns` locale for month and weekday names. Dates are still shown as `yyyy-mm-dd`. */
  locale?: CalendarProps["locale"];
  density?: Densities;
}

function isWithin(iso: string, min?: string, max?: string): boolean {
  if (min && compareIsoDates(iso, min) < 0) return false;
  if (max && compareIsoDates(iso, max) > 0) return false;
  return true;
}

function disabledMatchers(min?: string, max?: string): CalendarProps["disabled"] {
  const before = parseIsoDate(min);
  const after = parseIsoDate(max);
  const matchers = [...(before ? [{ before }] : []), ...(after ? [{ after }] : [])];
  return matchers.length > 0 ? matchers : undefined;
}

function useDensityOr(density: Densities | undefined): Densities {
  const contextDensity = useDensity();
  return density ?? contextDensity;
}

/** Controlled when `value` is defined, otherwise tracks its own state seeded from `defaultValue`. */
function useControllableValue<T>(
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

interface DateTextFieldProps extends Omit<
  InputProps,
  "value" | "defaultValue" | "onChange" | "type" | "density"
> {
  /** The committed value: a valid `yyyy-mm-dd` or an empty string. */
  value: string;
  /** Called with a valid in-range `yyyy-mm-dd`, or `""` once the field is emptied. */
  onCommit: (iso: string) => void;
  /** Rejects dates the picker cannot take (outside `min`/`max`, wrong side of the other end). */
  isAllowed?: (iso: string) => boolean;
  /** ArrowDown asks the owner to open the calendar. */
  onRequestOpen?: () => void;
  /** Enter was pressed; the owner may close the calendar. */
  onSubmitted?: () => void;
  density?: Densities;
}

/**
 * A text field for one ISO date. The text is a draft while it is being edited: a complete, allowed
 * date commits at once, so a form bound to it never lags a keystroke behind, and anything else is
 * thrown away on blur in favour of the last committed value.
 */
const DateTextField = React.forwardRef<HTMLInputElement, DateTextFieldProps>(
  (
    { value, onCommit, isAllowed, onRequestOpen, onSubmitted, onBlur, onKeyDown, ...props },
    ref,
  ) => {
    const [draft, setDraft] = React.useState<string | null>(null);

    // A new committed value (from the calendar, or the parent) replaces whatever was being typed.
    React.useEffect(() => setDraft(null), [value]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = formatTypedDate(event.target.value);
      setDraft(next);
      if (next === "") {
        if (value !== "") onCommit("");
      } else if (isIsoDate(next) && (isAllowed?.(next) ?? true) && next !== value) {
        onCommit(next);
      }
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        placeholder={ISO_PLACEHOLDER}
        maxLength={10}
        {...props}
        value={draft ?? value}
        onChange={handleChange}
        onBlur={(event) => {
          setDraft(null);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onRequestOpen?.();
          } else if (event.key === "Enter") {
            onSubmitted?.();
          }
        }}
      />
    );
  },
);
DateTextField.displayName = "DateTextField";

export interface DatePickerProps
  extends
    Omit<InputProps, "value" | "defaultValue" | "onChange" | "type" | "min" | "max" | "density">,
    DatePickerCalendarProps {
  /** Controlled value as `yyyy-mm-dd`; `""` or `null` for no date. */
  value?: string | null;
  /** Initial value when uncontrolled. */
  defaultValue?: string;
  /** Called with `yyyy-mm-dd`, or `""` when the field is cleared. */
  onChange?: (value: string) => void;
}

/**
 * A date field whose value is an ISO `yyyy-mm-dd` string, shown and typed as `yyyy-mm-dd` whatever
 * the browser's locale (a native `<input type="date">` shows mm/dd/yyyy to an English browser).
 *
 * Type a date — digits are enough, the dashes are added — or pick one from the calendar, which opens
 * from the button or with ArrowDown and starts its weeks on Monday.
 */
const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      value,
      defaultValue = "",
      onChange,
      min,
      max,
      weekStartsOn = 1,
      locale,
      density: propDensity,
      className,
      disabled,
      name,
      ...props
    },
    ref,
  ) => {
    const density = useDensityOr(propDensity);
    const [current, setCurrent] = useControllableValue<string>(
      value === null ? "" : value,
      defaultValue,
      onChange,
    );
    const [open, setOpen] = React.useState(false);

    const selected = parseIsoDate(current);
    const allowed = React.useCallback((iso: string) => isWithin(iso, min, max), [min, max]);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className={cn("relative w-full", className)}>
            <DateTextField
              ref={ref}
              {...props}
              className={datePickerInputVariant({ density })}
              density={density}
              disabled={disabled}
              value={current}
              onCommit={setCurrent}
              isAllowed={allowed}
              onRequestOpen={() => !disabled && setOpen(true)}
              onSubmitted={() => setOpen(false)}
            />
            {name ? <input type="hidden" name={name} value={current} /> : null}
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Choose date"
                disabled={disabled}
                className={datePickerButtonVariant({ density })}
              >
                <CalendarIcon aria-hidden="true" />
              </button>
            </PopoverTrigger>
          </div>
        </PopoverAnchor>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            required
            selected={selected}
            defaultMonth={selected ?? parseIsoDate(min) ?? new Date()}
            onSelect={(date) => {
              if (!date) return;
              setCurrent(formatIsoDate(date));
              setOpen(false);
            }}
            disabled={disabledMatchers(min, max)}
            weekStartsOn={weekStartsOn}
            locale={locale}
            density={density}
          />
        </PopoverContent>
      </Popover>
    );
  },
);
DatePicker.displayName = "DatePicker";

/** The start and end of a range as `yyyy-mm-dd`; either is `""` while unset. */
export interface DateRangeValue {
  from: string;
  to: string;
}

export interface DateRangePickerProps
  extends
    Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "children">,
    DatePickerCalendarProps {
  /** Controlled range. */
  value?: DateRangeValue;
  /** Initial range when uncontrolled. */
  defaultValue?: DateRangeValue;
  /** Called with the new range; `from` and `to` are `yyyy-mm-dd` or `""`. */
  onChange?: (value: DateRangeValue) => void;
  disabled?: boolean;
  /** Accessible names for the two fields. */
  fromLabel?: string;
  toLabel?: string;
}

const EMPTY_RANGE: DateRangeValue = { from: "", to: "" };

/**
 * Two ISO date fields and one two-month calendar. The end can never precede the start: typing an
 * end before the start is ignored, and in the calendar the first click starts a range, the second
 * ends it (in either order), and a click after that starts over.
 */
const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>(
  (
    {
      value,
      defaultValue = EMPTY_RANGE,
      onChange,
      min,
      max,
      weekStartsOn = 1,
      locale,
      density: propDensity,
      className,
      disabled,
      fromLabel = "From date",
      toLabel = "To date",
      ...props
    },
    ref,
  ) => {
    const density = useDensityOr(propDensity);
    const [range, setRange] = useControllableValue<DateRangeValue>(value, defaultValue, onChange);
    const [open, setOpen] = React.useState(false);

    const selected: DateRange | undefined = React.useMemo(() => {
      const from = parseIsoDate(range.from);
      const to = parseIsoDate(range.to);
      return from || to ? { from, to } : undefined;
    }, [range.from, range.to]);

    const fromAllowed = React.useCallback(
      (iso: string) => isWithin(iso, min, range.to || max),
      [min, max, range.to],
    );
    const toAllowed = React.useCallback(
      (iso: string) => isWithin(iso, range.from || min, max),
      [min, max, range.from],
    );

    const pickDay = (day: Date) => {
      const iso = formatIsoDate(day);
      if (range.from === "" || range.to !== "") {
        setRange({ from: iso, to: "" });
        return;
      }
      setRange(
        compareIsoDates(iso, range.from) < 0
          ? { from: iso, to: range.from }
          : { from: range.from, to: iso },
      );
      setOpen(false);
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div
            ref={ref}
            role="group"
            {...props}
            className={cn(
              inputVariant({ density }),
              dateRangeFrameVariant({ density }),
              disabled && "cursor-not-allowed opacity-50",
              className,
            )}
          >
            <DateTextField
              aria-label={fromLabel}
              className={RANGE_FIELD}
              density={density}
              disabled={disabled}
              value={range.from}
              onCommit={(from) => setRange({ ...range, from })}
              isAllowed={fromAllowed}
              onRequestOpen={() => !disabled && setOpen(true)}
              onSubmitted={() => setOpen(false)}
            />
            <span aria-hidden="true" className="text-muted-foreground">
              –
            </span>
            <DateTextField
              aria-label={toLabel}
              className={RANGE_FIELD}
              density={density}
              disabled={disabled}
              value={range.to}
              onCommit={(to) => setRange({ ...range, to })}
              isAllowed={toAllowed}
              onRequestOpen={() => !disabled && setOpen(true)}
              onSubmitted={() => setOpen(false)}
            />
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Choose date range"
                disabled={disabled}
                className={datePickerButtonVariant({ density })}
              >
                <CalendarIcon aria-hidden="true" />
              </button>
            </PopoverTrigger>
          </div>
        </PopoverAnchor>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={selected}
            defaultMonth={selected?.from ?? parseIsoDate(min) ?? new Date()}
            onDayClick={pickDay}
            disabled={disabledMatchers(min, max)}
            weekStartsOn={weekStartsOn}
            locale={locale}
            density={density}
          />
        </PopoverContent>
      </Popover>
    );
  },
);
DateRangePicker.displayName = "DateRangePicker";

export { DatePicker, DateRangePicker };
