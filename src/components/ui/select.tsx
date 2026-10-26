import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { VariantProps } from "class-variance-authority";

import { useFieldContext, useFieldControl } from "@/components/ui/field/field-context";
import { cn } from "@/lib/utils";
import {
  selectSingleTriggerVariant,
  selectContentVariant,
  selectItemVariant,
  selectTriggerEndActionsVariant,
} from "./select/variant";
import { useDensity } from "@/contexts/density-context";

/**
 * `SelectPrimitive.Root` plus what a surrounding Field knows: the form `name` and whether the whole
 * select is disabled. (`id` and `aria-*` belong on the trigger, which {@link SelectTrigger} handles.)
 */
function Select(props: React.ComponentProps<typeof SelectPrimitive.Root>) {
  const field = useFieldContext();
  return (
    <SelectPrimitive.Root
      {...props}
      name={props.name ?? field?.name}
      disabled={props.disabled ?? (field?.disabled ? true : undefined)}
    />
  );
}
Select.displayName = "Select";

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> &
    VariantProps<typeof selectSingleTriggerVariant>
>((props, ref) => {
  // The field's `name` is submitted by the select behind the trigger (see `Select`). On the button as
  // well, `form.elements[name]` would be a list of the two and its `.value` would be "".
  const { className, density, children, name: _fieldName, ...rest } = useFieldControl(props);
  const contextDensity = useDensity();
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(selectSingleTriggerVariant({ density: density ?? contextDensity, className }))}
      name={props.name}
      {...rest}
    >
      {children}
    </SelectPrimitive.Trigger>
  );
});
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectTriggerEndActions = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => (
  <div className={cn(selectTriggerEndActionsVariant(), className)}>
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="size-4 opacity-50 flex-shrink-0" />
    </SelectPrimitive.Icon>
  </div>
);
SelectTriggerEndActions.displayName = "SelectTriggerEndActions";

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-pointer items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronUp className="size-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-pointer items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronDown className="size-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> &
    VariantProps<typeof selectContentVariant> & { header?: React.ReactNode }
>(({ className, density, children, header, position = "popper", ...props }, ref) => {
  const contextDensity = useDensity();
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          selectContentVariant({ density: density ?? contextDensity }),
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        {...props}
      >
        {header}
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> &
    VariantProps<typeof selectItemVariant>
>(({ className, density, children, ...props }, ref) => {
  const contextDensity = useDensity();
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(selectItemVariant({ density: density ?? contextDensity, className }))}
      {...props}
    >
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectTriggerEndActions,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
