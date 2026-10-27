import { cva } from "class-variance-authority";

/**
 * The scrim behind a modal surface (Dialog, AlertDialog, Sheet).
 *
 * A bare `bg-black/30` was close to invisible: in dark mode the page is already near-black, so a
 * 30% black wash changes almost nothing, and the dialog panel (same `--background`) merged into
 * the page. The heavier wash dims lit content, and the blur pushes the page back so the panel
 * reads as a separate surface in both themes.
 *
 * The scrim and blur are still what separate the panel, but they were doing it alone: measured on the
 * rendered dark page, a `--background` panel was 1.02:1 (Dialog) and 1.04:1 (AlertDialog) against the
 * dimmed page behind it. Dialog and AlertDialog sit on `--popover` now, like Sheet (`--card`), which
 * dark mode lifts a step above the page: 1.08:1 and 1.09:1, and the panel reads as a surface instead
 * of a hole. A Card inside a dialog is on the same colour as its panel then, and keeps its edge from
 * `--border` alone. Dialog, AlertDialog, Popover and Sheet name their fill as
 * `--ivy-data-table-surface`, so an `embedded` DataTable placed directly in one joins it; a bordered
 * table, the default, paints the page colour inside its own edge and is a slightly recessed inset.
 */
export const overlayVariant = cva(
  "fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] dark:bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
);

/**
 * The X in the corner of a Dialog or Sheet. It is the first tabbable, so it is where focus lands on
 * open whenever the overlay has no field; a bare `focus:outline-hidden` left it with no indicator at
 * all, in a dialog whose only other cue is the page behind it being dimmed.
 */
export const overlayCloseVariant = cva(
  "shrink-0 rounded-selector p-1 text-muted-foreground transition-colors cursor-pointer hover:bg-accent hover:text-accent-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

/**
 * Keyboard highlight for a menu row (DropdownMenu, ContextMenu, Menubar). The `bg-accent` tint it
 * sits on is 1.1:1 against the popover in light mode and 1.3:1 in dark, which is not a focus
 * indicator, so the keyboard-focused row also gets an inset ring.
 *
 * Radix focuses the row under the pointer as well, and Chromium counts that script focus as
 * `:focus-visible`, so the ring is switched off while the row is hovered: the pointer keeps the
 * plain tint it always had instead of an outline chasing it down the menu.
 */
export const menuItemRing =
  "focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring hover:focus-visible:ring-0";
