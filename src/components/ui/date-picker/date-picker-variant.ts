import { cva } from "class-variance-authority";

/** The calendar button that sits inside the right edge of the field. */
export const datePickerButtonVariant = cva(
  "absolute inset-y-0 right-0 flex aspect-square items-center justify-center rounded-r-field text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      density: {
        Small: "[&_svg]:size-3",
        Medium: "[&_svg]:size-4",
        Large: "[&_svg]:size-5",
      },
    },
    defaultVariants: {
      density: "Medium",
    },
  },
);

/** Right padding that keeps typed text clear of the calendar button. */
export const datePickerInputVariant = cva("", {
  variants: {
    density: {
      Small: "pr-7",
      Medium: "pr-9",
      Large: "pr-11",
    },
  },
  defaultVariants: {
    density: "Medium",
  },
});

/**
 * The shared frame of a range field: the two inputs and the dash between them. The frame is the
 * bordered box, and `aria-invalid` is only valid on the inputs inside it, so the invalid border and
 * ring are driven from them. Dark theme uses the `red` step, as the other controls do, because the
 * `destructive` fill is 2:1 on the page.
 */
export const dateRangeFrameVariant = cva(
  "relative items-center gap-1 focus-within:ring-1 focus-within:ring-ring has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:focus-within:ring-destructive dark:has-[input[aria-invalid=true]]:border-red dark:has-[input[aria-invalid=true]]:focus-within:ring-red",
  {
    variants: {
      density: {
        Small: "pr-7",
        Medium: "pr-9",
        Large: "pr-11",
      },
    },
    defaultVariants: {
      density: "Medium",
    },
  },
);
