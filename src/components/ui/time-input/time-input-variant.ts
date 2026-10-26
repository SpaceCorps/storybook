import { cva } from "class-variance-authority";

import { menuItemRing } from "@/components/ui/overlay-variant";

/**
 * The room the field itself keeps. The clock button takes its square out of the right padding, so
 * below these widths the time is cut off: `09:0` instead of `09:00`, with no way to read the rest.
 */
export const timeInputWrapperVariant = cva("", {
  variants: {
    density: {
      Small: "min-w-20",
      Medium: "min-w-24",
      Large: "min-w-28",
    },
  },
  defaultVariants: {
    density: "Medium",
  },
});

/**
 * The suggestion list. It is its own scroller and positioned, so an option's `offsetTop` is
 * measured from the list rather than from the popper wrapper around it.
 */
export const timeListVariant = cva(
  "relative max-h-60 w-[var(--radix-popover-trigger-width)] min-w-[7rem] overflow-y-auto overscroll-contain p-1",
  {
    variants: {
      density: {
        Small: "text-xs",
        Medium: "text-sm",
        Large: "text-base",
      },
    },
    defaultVariants: {
      density: "Medium",
    },
  },
);

/**
 * One suggestion. The `bg-accent` tint on the focused row is 1.1:1 against the popover, so the row
 * the keyboard is on also gets the inset ring every menu and list in the library uses. The check
 * that marks the selected row is sized with the row, or at Small density it would be taller than
 * the text and push the rows below it down.
 */
export const timeOptionVariant = cva(
  [
    "flex w-full cursor-pointer select-none items-center justify-between gap-2 rounded-selector tabular-nums outline-hidden hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground aria-selected:font-medium [&_svg]:shrink-0",
    menuItemRing,
  ],
  {
    variants: {
      density: {
        Small: "px-1.5 py-1 [&_svg]:size-3",
        Medium: "px-2 py-1.5 [&_svg]:size-4",
        Large: "px-2.5 py-2 [&_svg]:size-5",
      },
    },
    defaultVariants: {
      density: "Medium",
    },
  },
);
