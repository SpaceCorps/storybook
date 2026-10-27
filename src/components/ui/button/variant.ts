import { cva } from "class-variance-authority";

import { controlHeight, controlSize, densityText } from "../density-scale";

/**
 * Disabled look for the solid (filled) variants. Dimming them with `opacity-50` pulls the fill and
 * the label toward the page colour together, which left the label at 3.3:1 on a white page for the
 * default button (and 2.0:1 for destructive) — grey text on a grey pill. A flat muted surface keeps
 * the label above 5:1 in both themes and still reads as unavailable next to its live twin. The
 * transparent variants (outline, ghost, link...) keep dimming, at 60% instead of 50% so their label
 * clears 4.5:1 on both pages.
 */
const solidDisabled =
  "disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none";

/**
 * The same look for a button that is disabled the soft way (`focusableWhenDisabled`): it is still
 * focusable and still takes pointer events, so unlike `disabled:` it also has to cancel the hover
 * effect. Each hover cancel below restores that variant's resting state.
 */
const solidSoftDisabled =
  "aria-disabled:bg-muted aria-disabled:text-muted-foreground aria-disabled:opacity-100 aria-disabled:shadow-none aria-disabled:hover:brightness-100";
const surfaceSoftDisabled = "aria-disabled:hover:text-inherit";

export const buttonVariant = cva(
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-field font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: `bg-primary text-primary-foreground shadow-sm hover:brightness-90 ${solidDisabled} ${solidSoftDisabled}`,
        destructive: `bg-destructive text-destructive-foreground shadow-sm hover:brightness-90 ${solidDisabled} ${solidSoftDisabled}`,
        outline: `border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground aria-disabled:hover:bg-background ${surfaceSoftDisabled}`,
        secondary: `bg-secondary text-secondary-foreground shadow-sm hover:brightness-90 ${solidDisabled} ${solidSoftDisabled}`,
        success: `bg-success text-success-foreground shadow-sm hover:brightness-90 ${solidDisabled} ${solidSoftDisabled}`,
        warning: `bg-warning text-warning-foreground shadow-sm hover:brightness-90 ${solidDisabled} ${solidSoftDisabled}`,
        info: `bg-info text-info-foreground shadow-sm hover:brightness-90 ${solidDisabled} ${solidSoftDisabled}`,
        ghost: `hover:bg-accent hover:text-accent-foreground aria-disabled:hover:bg-transparent ${surfaceSoftDisabled}`,
        link: "text-primary underline-offset-4 hover:underline brightness-90 hover:brightness-100 aria-disabled:hover:no-underline aria-disabled:hover:brightness-90",
        inline:
          "text-primary underline hover:no-underline !p-0 !h-auto aria-disabled:hover:underline",
        ai: `bg-background  hover:bg-accent hover:text-accent-foreground aria-disabled:hover:bg-background ${surfaceSoftDisabled}`,
      },
      size: {
        default: `${controlHeight.Medium} px-4 ${densityText.Medium}`,
        sm: `${controlHeight.Small} rounded-field px-3 ${densityText.Small}`,
        lg: `${controlHeight.Large} rounded-field px-8 ${densityText.Large}`,
        icon: `${controlSize.Medium} shrink-0`,
        "icon-sm": `${controlSize.Small} shrink-0`,
        "icon-lg": `${controlSize.Large} shrink-0`,
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
