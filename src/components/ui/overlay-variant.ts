import { cva } from "class-variance-authority";

/**
 * The scrim behind a modal surface (Dialog, AlertDialog, Sheet).
 *
 * A bare `bg-black/30` was close to invisible: in dark mode the page is already near-black, so a
 * 30% black wash changes almost nothing, and the dialog panel (same `--background`) merged into
 * the page. The heavier wash dims lit content, and the blur pushes the page back so the panel
 * reads as a separate surface in both themes.
 */
export const overlayVariant = cva(
  "fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] dark:bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
);
