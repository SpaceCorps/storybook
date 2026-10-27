import { cva } from "class-variance-authority";

/*
 * Hover, press and current-page fills for anything that sits on the sidebar. The sidebar and the
 * island's shell are `bg-secondary`, and `--accent` is that same colour in both themes, so
 * `hover:bg-accent` painted nothing: the current page had no mark in the icon rail, where the label
 * that used to carry it is gone. A tint of the foreground is visible on any surface and follows the
 * theme (about 1.2:1 for hover and 1.3 to 1.4:1 for the current page against the sidebar), where a
 * token is only as good as the surface it happens to differ from.
 *
 * The current page keeps its fill while hovered: it is already the deepest step. Forced-colors mode
 * drops every background, so the current page is also marked in system colours.
 */
export const SIDEBAR_HOVER_FILL = "hover:bg-foreground/8";
export const SIDEBAR_PRESS_FILL = "active:bg-foreground/12";
export const SIDEBAR_CURRENT_FILL =
  "data-[active=true]:bg-foreground/12 data-[active=true]:hover:bg-foreground/12 forced-colors:data-[active=true]:bg-[Highlight] forced-colors:data-[active=true]:text-[HighlightText]";

export const sidebarMenuButtonVariant = cva(
  [
    // The collapsed rail's button is `!size-9`: 38.88px, over the 36px touch target. `!p-2.5` leaves
    // exactly the icon's width inside, which squeezes the label to nothing (it stays in the
    // accessibility tree as the button's name) and centres the icon without a justify rule, which
    // would swing the icon across while the button is still animating its width.
    "peer/menu-button flex w-full items-center gap-2 overflow-hidden group-data-[collapsible=icon]:overflow-visible rounded-md p-2 text-left text-sm focus-visible:outline-hidden ring-ring transition-[width,height,padding] motion-reduce:transition-none hover:text-accent-foreground focus-visible:ring-2 active:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:text-accent-foreground data-[active=true]:font-medium data-[state=open]:hover:bg-foreground/12 data-[state=open]:hover:text-accent-foreground group-data-[collapsible=icon]:!size-9 group-data-[collapsible=icon]:!p-2.5 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 cursor-pointer",
    SIDEBAR_HOVER_FILL,
    SIDEBAR_PRESS_FILL,
    SIDEBAR_CURRENT_FILL,
  ],
  {
    variants: {
      variant: {
        default: "",
        outline:
          "bg-background shadow-[0_0_0_1px_var(--border)] hover:shadow-[0_0_0_1px_var(--accent)]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        // Holds a size-8 avatar or logo tile. 2.16px of padding centres it in the 38.88px rail button
        // and, like the other sizes, leaves no room for the label.
        lg: "h-12 text-sm group-data-[collapsible=icon]:!p-0.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
