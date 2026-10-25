"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { overlayVariant } from "./overlay-variant";

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

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[10%] z-50 flex flex-col w-[calc(100%-2rem)] max-sm:!w-[calc(100%-2rem)] max-sm:!max-w-[calc(100%-2rem)] sm:w-full max-w-xl max-h-[85vh] translate-x-[-50%] translate-y-0 rounded-box border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[5%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[5%] sm:rounded-box overflow-hidden focus:outline-hidden focus:ring-0",
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

type DialogHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  /** When true, the Radix close control is not rendered (e.g. Ivy DialogHeader.HideCloseButton). */
  hideCloseButton?: boolean;
};

const DialogHeader = ({ className, children, hideCloseButton, ...props }: DialogHeaderProps) => (
  <div
    className={cn(
      "sticky top-0 z-10 bg-background p-4 flex-shrink-0 flex items-start justify-between gap-2",
      className,
    )}
    {...props}
  >
    <div className="min-w-0 flex-1">{children}</div>
    {!hideCloseButton && (
      // Pinned to the title row, not centred on the whole header: with a description under the
      // title, `items-center` floated the X halfway down. The -mt-1 centres the 24px button on
      // the 16px `leading-none` title line, and -mr-1 puts the icon on the content's right edge.
      <DialogPrimitive.Close className="-mr-1 -mt-1 shrink-0 p-1 rounded-selector text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-hidden cursor-pointer">
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
