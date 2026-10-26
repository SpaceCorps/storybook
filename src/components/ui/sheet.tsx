"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { CardContentLayoutReset } from "@/components/ui/card-flush-context";
import { FieldReset } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useReturnFocus } from "@/hooks/use-return-focus";
import { overlayCloseVariant, overlayVariant } from "./overlay-variant";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay className={cn(overlayVariant(), className)} {...props} ref={ref} />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariant = cva("fixed z-50 gap-4 bg-card p-6 outline-hidden", {
  variants: {
    side: {
      top: "inset-x-0 top-0 border-b shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1),inset_0_-8px_8px_-8px_rgba(0,0,0,0.04)]",
      bottom:
        "inset-x-0 bottom-0 border-t shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1),0_-4px_6px_-4px_rgba(0,0,0,0.1),inset_0_8px_8px_-8px_rgba(0,0,0,0.04)]",
      left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm shadow-[10px_0_15px_-3px_rgba(0,0,0,0.1),4px_0_6px_-4px_rgba(0,0,0,0.1),inset_-8px_0_8px_-8px_rgba(0,0,0,0.04)]",
      right:
        "inset-y-0 right-0 h-full w-3/4 border-l shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.1),-4px_0_6px_-4px_rgba(0,0,0,0.1),inset_8px_0_8px_-8px_rgba(0,0,0,0.04)]",
    },
  },
  defaultVariants: {
    side: "right",
  },
});

interface SheetContentProps
  extends
    Omit<React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>, "children">,
    VariantProps<typeof sheetVariant> {
  children?: React.ReactNode;
  /**
   * Where focus goes on close when whatever opened the sheet has since left the page, such as a
   * row that the sheet deleted.
   */
  fallbackFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Focus goes to `data-autofocus`, else the first field, else the Close button on open, and back to
 * whatever was focused before on close, with or without a `SheetTrigger`.
 */
const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(
  (
    {
      side = "right",
      className,
      children,
      asChild,
      onOpenAutoFocus,
      onCloseAutoFocus,
      fallbackFocusRef,
      ...props
    },
    ref,
  ) => {
    const focus = useReturnFocus({
      onOpenAutoFocus,
      onCloseAutoFocus,
      fallbackFocusRef,
      focusFirstField: true,
      forwardedRef: ref,
    });
    return (
      // Above the portal, not around the children: with `asChild` Radix needs to see one element.
      <FieldReset>
        <CardContentLayoutReset>
          <SheetPortal>
            <SheetOverlay />
            <SheetPrimitive.Content
              ref={focus.ref}
              asChild={asChild}
              className={cn(sheetVariant({ side }), className)}
              {...props}
              onOpenAutoFocus={focus.onOpenAutoFocus}
              onCloseAutoFocus={focus.onCloseAutoFocus}
            >
              {focus.anchor}
              <SheetPrimitive.Close className={cn(overlayCloseVariant(), "absolute right-4 top-4")}>
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </SheetPrimitive.Close>
              {asChild ? <Slottable>{children}</Slottable> : children}
            </SheetPrimitive.Content>
          </SheetPortal>
        </CardContentLayoutReset>
      </FieldReset>
    );
  },
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-4 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end gap-2", className)}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
