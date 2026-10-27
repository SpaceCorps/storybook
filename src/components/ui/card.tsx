import * as React from "react";

import { cn } from "@/lib/utils";
import { CardContentLayoutContext } from "./card-flush-context";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    disabled?: boolean;
  }
>(({ className, disabled, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card"
    data-disabled={disabled ? "" : undefined}
    aria-disabled={disabled}
    className={cn(
      // `min-w-0` because a card is often a flex or grid item: without it the automatic minimum size
      // lets one wide child (a table) stretch the card past its track and squeeze its siblings. A
      // card that should instead grow to its content opts back in with `min-w-fit`.
      "min-w-0 rounded-box border bg-card text-card-foreground shadow",
      disabled && "opacity-50 cursor-not-allowed",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-header"
      className={cn("flex flex-col gap-y-1.5 p-6", className)}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-title"
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  ),
);
CardDescription.displayName = "CardDescription";

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Drops the content padding so a child can run edge to edge, the card's own border acting as its
   * frame. Meant for tables: a `DataTable` inside a flush content area draws no box of its own, keeps
   * a divider on top and insets its first and last column by the card padding. The bottom corners
   * are clipped to the card radius when this is the card's last section, and the top corners when it
   * is the first (a card with no header), so the table's opaque header cannot square them off.
   */
  flush?: boolean;
}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, flush = false, ...props }, ref) => (
    <CardContentLayoutContext.Provider value={flush ? "flush" : "padded"}>
      <div
        ref={ref}
        data-slot="card-content"
        data-flush={flush ? "" : undefined}
        className={cn(
          // Hands the card fill to descendants that need an opaque surface of their own (a table's
          // pinned columns and sticky header) so they match the card rather than the page.
          "[--ivy-data-table-surface:var(--card)]",
          flush
            ? "overflow-hidden p-0 first:rounded-t-[calc(var(--radius-boxes)-1px)] last:rounded-b-[calc(var(--radius-boxes)-1px)]"
            : "p-6 pt-0",
          className,
        )}
        {...props}
      />
    </CardContentLayoutContext.Provider>
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-footer"
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
