import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";

import { useFieldContext, useFieldControl } from "@/components/ui/field/field-context";
import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>((props, ref) => {
  const { className, ...rest } = useFieldControl(props);
  const field = useFieldContext();
  // A group is not a labelable element, so a field's label names it by reference instead of `for`.
  const labelledBy =
    rest["aria-labelledby"] ?? (field?.hasLabel && !rest["aria-label"] ? field.labelId : undefined);
  return (
    <RadioGroupPrimitive.Root
      className={cn("group/radiogroup grid gap-2", className)}
      {...rest}
      aria-labelledby={labelledBy}
      ref={ref}
    />
  );
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "relative aspect-square size-4 rounded-full border border-primary text-primary shadow focus:outline-hidden focus-visible:ring-1 focus-visible:ring-ring aria-invalid:border-destructive group-aria-invalid/radiogroup:border-destructive group-aria-invalid/radiogroup:focus-visible:ring-destructive dark:aria-invalid:border-red dark:group-aria-invalid/radiogroup:border-red dark:group-aria-invalid/radiogroup:focus-visible:ring-red disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer dark:border-white/10 dark:data-[state=checked]:border-primary",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="absolute inset-0 flex items-center justify-center">
        <Circle className="w-4/5 h-4/5 fill-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
