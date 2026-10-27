"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Slottable } from "@radix-ui/react-slot";
import { X } from "lucide-react";

import { CardContentLayoutReset } from "@/components/ui/card-flush-context";
import { FieldReset } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useReturnFocus } from "@/hooks/use-return-focus";
import { overlayCloseVariant, overlayVariant } from "./overlay-variant";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn(overlayVariant(), className)} {...props} />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /**
   * Where focus goes on close when whatever opened the dialog has since left the page, such as a
   * row that the dialog deleted.
   */
  fallbackFocusRef?: React.RefObject<HTMLElement | null>;
};

/**
 * Focus goes to `data-autofocus`, else the first field, else the Close button on open, and back
 * to whatever was focused before on close, with or without a `DialogTrigger`.
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    { className, children, asChild, onOpenAutoFocus, onCloseAutoFocus, fallbackFocusRef, ...props },
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
          <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
              ref={focus.ref}
              asChild={asChild}
              className={cn(
                "[--ivy-data-table-surface:var(--popover)] fixed left-[50%] top-[10%] z-50 flex flex-col w-[calc(100%-2rem)] max-sm:!w-[calc(100%-2rem)] max-sm:!max-w-[calc(100%-2rem)] sm:w-full max-w-xl max-h-[85vh] translate-x-[-50%] translate-y-0 rounded-box border bg-popover shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[5%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[5%] overflow-hidden focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                className,
              )}
              {...props}
              onOpenAutoFocus={focus.onOpenAutoFocus}
              onCloseAutoFocus={focus.onCloseAutoFocus}
            >
              {focus.anchor}
              {asChild ? <Slottable>{children}</Slottable> : children}
            </DialogPrimitive.Content>
          </DialogPortal>
        </CardContentLayoutReset>
      </FieldReset>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

type DialogHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  /** When true, the Radix close control is not rendered (e.g. Ivy DialogHeader.HideCloseButton). */
  hideCloseButton?: boolean;
};

const DialogHeader = ({ className, children, hideCloseButton, ...props }: DialogHeaderProps) => (
  <div
    className={cn(
      "sticky top-0 z-10 bg-popover p-4 flex-shrink-0 flex items-start justify-between gap-2",
      className,
    )}
    {...props}
  >
    <div className="min-w-0 flex-1">{children}</div>
    {!hideCloseButton && (
      // Pinned to the title row, not centred on the whole header: with a description under the
      // title, `items-center` floated the X halfway down. The -mt-1 centres the 24px button on
      // the 16px `leading-none` title line, and -mr-1 puts the icon on the content's right edge.
      <DialogPrimitive.Close className={cn(overlayCloseVariant(), "-mr-1 -mt-1")}>
        <X className="size-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    )}
  </div>
);
DialogHeader.displayName = "DialogHeader";

/** The dialog's body: padded to line up with the header and footer, and scrolls when it is tall. */
const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 pb-2 pt-1", className)} {...props} />
);
DialogBody.displayName = "DialogBody";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end gap-2 flex-shrink-0 p-6 pt-4",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
