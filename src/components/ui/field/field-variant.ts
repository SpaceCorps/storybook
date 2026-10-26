import { cva } from "class-variance-authority";

export const fieldVariant = cva("grid gap-1.5", {
  variants: {
    orientation: {
      vertical: "",
      // The control sits in the first column and the label beside it; hint and error line up under the label.
      horizontal: "grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1",
    },
  },
  defaultVariants: {
    orientation: "vertical",
  },
});

/**
 * Error text and an invalid label. `text-destructive` is a fill colour: #ef4444 is 3.8:1 on white and
 * the dark theme's #7f1d1d is 2.0:1 on the page, both under the 4.5:1 text needs. These are the
 * steps the destructive badge uses, picked per theme the same way.
 */
export const fieldErrorTextClass =
  "text-[var(--destructive-800)] dark:text-[var(--destructive-200)]";
