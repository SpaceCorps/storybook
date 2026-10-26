import { useFieldControl } from "@/components/ui/field/field-context";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import * as React from "react";
import { Densities } from "@/types/density";
import { useDensity } from "@/contexts/density-context";
export type NullableBoolean = boolean | null | undefined;

const getSizeClasses = (density?: Densities): string => {
  switch (density) {
    case Densities.Small:
      return "size-3";
    case Densities.Large:
      return "size-5";
    default:
      return "size-4";
  }
};

type AppCheckboxProps = Omit<
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
  "checked" | "defaultChecked" | "onCheckedChange" | "className" | "asChild" | "children"
> & {
  checked?: NullableBoolean;
  defaultChecked?: NullableBoolean;
  onCheckedChange?: (checked: boolean | null) => void;
  nullable?: boolean;
  autoFocus?: boolean;
  className?: string;
  density?: Densities;
};

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  AppCheckboxProps
>((props: AppCheckboxProps, ref) => {
  const {
    id,
    checked,
    defaultChecked,
    onCheckedChange,
    disabled,
    nullable = false,
    className = "",
    density,
    ...rest
  } = useFieldControl(props);
  const contextDensity = useDensity();
  const effectiveDensity = density ?? contextDensity;
  const isControlled = checked !== undefined;
  const [internalChecked, setInternalChecked] = React.useState<NullableBoolean>(
    defaultChecked ?? false,
  );
  const effectiveChecked = isControlled ? checked : internalChecked;

  // Map checked value helper for safe boolean/null states
  const normalizedChecked = React.useMemo(() => {
    if (effectiveChecked === undefined || effectiveChecked === null) return nullable ? null : false;
    if (effectiveChecked === true || (effectiveChecked as any) === 1) return true;
    if (effectiveChecked === false || (effectiveChecked as any) === 0) return false;
    return !!effectiveChecked;
  }, [effectiveChecked, nullable]);

  const uiChecked = nullable && normalizedChecked === null ? "indeterminate" : !!normalizedChecked;

  // Cycle: null -> true -> false -> null (if nullable)
  const handleCheckedChange = (next: boolean) => {
    logger.debug("Checkbox clicked, next:", next, "current checked:", normalizedChecked);
    let nextVal: boolean | null;
    if (nullable) {
      if (normalizedChecked === null) nextVal = true;
      else if (normalizedChecked === true) nextVal = false;
      else nextVal = null;
    } else {
      nextVal = next;
    }
    if (!isControlled) {
      setInternalChecked(nextVal);
    }
    onCheckedChange?.(nextVal);
  };

  const isInvalid = className?.includes("border-destructive") || className?.includes("bg-red-50");
  const baseClass = `peer ${getSizeClasses(effectiveDensity)} shrink-0 rounded-checkbox border border-border shadow transition-colors hover:bg-accent/50 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary data-[state=checked]:hover:bg-primary/90 dark:border-white/10 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive dark:aria-invalid:border-red dark:aria-invalid:focus-visible:ring-red aria-invalid:data-[state=checked]:bg-destructive aria-invalid:data-[state=checked]:border-destructive aria-invalid:data-[state=checked]:text-destructive-foreground`;
  const finalClass = isInvalid
    ? baseClass
        .replace("data-[state=checked]:bg-primary", "data-[state=checked]:bg-destructive")
        .replace("data-[state=checked]:border-primary", "data-[state=checked]:border-destructive")
        .replace(
          "data-[state=checked]:text-primary-foreground",
          "data-[state=checked]:text-destructive-foreground",
        )
        .replace(
          "data-[state=checked]:hover:bg-primary/90",
          "data-[state=checked]:hover:bg-destructive/90",
        )
        .replace(
          "focus-visible:ring-ring",
          "focus-visible:ring-destructive dark:focus-visible:ring-red",
        )
        .replace("border-border", "border-destructive")
        .replace("dark:border-white/10", "dark:border-red")
    : baseClass;

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      id={id}
      checked={uiChecked}
      onCheckedChange={handleCheckedChange}
      disabled={disabled}
      className={cn(finalClass, className)}
      {...rest}
    >
      <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
        {uiChecked === "indeterminate" ? (
          <Minus className={getSizeClasses(effectiveDensity)} />
        ) : (
          <Check className={getSizeClasses(effectiveDensity)} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = "AppCheckbox";

export { Checkbox };
