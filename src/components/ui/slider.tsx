import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import { Densities } from "@/types/density";
import { useDensity } from "@/contexts/density-context";
import { formatBytes } from "@/lib/formatters";

interface SliderWithCurrencyProps extends React.ComponentPropsWithoutRef<
  typeof SliderPrimitive.Root
> {
  currency?: string;
  isBytesFormat?: boolean;
  density?: Densities;
  /**
   * Replaces the value shown above a thumb. A single value is for a one-thumb slider; give an array
   * with one entry per thumb for a range.
   */
  tooltipValue?: string | number | ReadonlyArray<string | number>;
  /**
   * Accessible name per thumb, in thumb order. A range slider needs distinct names for its handles
   * ("Minimum price", "Maximum price"); without this they derive from `aria-label` with "minimum"
   * and "maximum" appended.
   */
  thumbLabels?: ReadonlyArray<string>;
  /**
   * Spoken value per thumb (`aria-valuetext`), for values whose bare number is not meaningful.
   * Defaults to the currency or byte formatting when one of those props is set.
   */
  getValueText?: (value: number, index: number) => string | undefined;
}
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderWithCurrencyProps
>(
  (
    {
      className,
      currency,
      isBytesFormat = false,
      density,
      tooltipValue,
      thumbLabels,
      getValueText,
      value: valueProp,
      defaultValue,
      onValueChange,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      ...props
    },
    ref,
  ) => {
    const contextDensity = useDensity();
    const effectiveDensity = density ?? contextDensity;
    const idPrefix = React.useId();

    // The thumbs and their tooltips follow the live values, which Radix keeps to itself when the
    // slider is uncontrolled, so the component tracks them alongside it.
    const [uncontrolledValue, setUncontrolledValue] = React.useState<number[]>(
      defaultValue ?? [props.min ?? 0],
    );
    const values = valueProp ?? uncontrolledValue;
    const handleValueChange = React.useCallback(
      (next: number[]) => {
        if (valueProp === undefined) setUncontrolledValue(next);
        onValueChange?.(next);
      },
      [valueProp, onValueChange],
    );

    const formatter = React.useMemo(() => {
      if (!currency) return null;
      try {
        return Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
      } catch {
        return null;
      }
    }, [currency]);

    const formatValue = (value: number): string | undefined => {
      if (isBytesFormat) return formatBytes(value, 2);
      if (formatter) return formatter.format(value);
      return undefined;
    };

    // Each thumb is the slider, so each needs its own name; the root is a plain span and stays
    // unnamed unless it groups a range.
    const rangeSuffix = (index: number): string =>
      values.length === 2
        ? index === 0
          ? "minimum"
          : "maximum"
        : `${index + 1} of ${values.length}`;
    const thumbNameProps = (index: number): React.HTMLAttributes<HTMLSpanElement> => {
      const given = thumbLabels?.[index];
      if (given) return { "aria-label": given };
      if (ariaLabelledBy && !ariaLabel) {
        if (values.length === 1) return { "aria-labelledby": ariaLabelledBy };
        const id = `${idPrefix}-thumb-${index}`;
        return {
          id,
          "aria-labelledby": `${ariaLabelledBy} ${id}`,
          "aria-label": rangeSuffix(index),
        };
      }
      const base = ariaLabel ?? "Slider";
      return { "aria-label": values.length === 1 ? base : `${base} ${rangeSuffix(index)}` };
    };

    const tooltipFor = (value: number, index: number): React.ReactNode => {
      if (Array.isArray(tooltipValue)) return tooltipValue[index] ?? formatValue(value) ?? value;
      if (tooltipValue != null && values.length === 1) return tooltipValue as string | number;
      return formatValue(value) ?? value;
    };

    // Size variants for track and thumb
    const sizeVariant: Record<string, { track: string; thumb: string; tooltip: string }> = {
      Small: {
        track: "h-1",
        thumb: "size-3",
        tooltip: "text-xs -top-6",
      },
      Medium: {
        track: "h-1.5",
        thumb: "size-4",
        tooltip: "text-sm -top-7",
      },
      Large: {
        track: "h-2",
        thumb: "size-5",
        tooltip: "text-ml -top-8",
      },
    };

    const variant = sizeVariant[effectiveDensity];
    const isRange = values.length > 1;

    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn("relative flex w-full touch-none select-none items-center", className)}
        {...(isRange
          ? { role: "group", "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy }
          : {})}
        {...props}
        value={values}
        onValueChange={handleValueChange}
      >
        <SliderPrimitive.Track
          className={cn(
            "relative w-full grow overflow-hidden rounded-full bg-muted",
            variant.track,
          )}
        >
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        {values.map((value, index) => (
          <SliderPrimitive.Thumb
            // The thumb count only changes with the value array, never reorders.
            key={index}
            {...thumbNameProps(index)}
            aria-valuetext={getValueText?.(value, index) ?? formatValue(value)}
            className={cn(
              "relative block rounded-full border bg-background shadow transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
              variant.thumb,
            )}
          >
            <div
              aria-hidden="true"
              className={cn(
                "absolute left-1/2 transform -translate-x-1/2 bg-popover text-foreground p-1 rounded shadow whitespace-nowrap",
                variant.tooltip,
              )}
            >
              {tooltipFor(value, index)}
            </div>
          </SliderPrimitive.Thumb>
        ))}
      </SliderPrimitive.Root>
    );
  },
);

Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
