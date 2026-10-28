import { cva } from "class-variance-authority";

import type { DataTableColumn } from "./types";

/** Text alignment shared by a column's header and its cells. */
export const dataTableCellAlignVariant = cva("", {
  variants: {
    align: {
      Left: "text-left",
      Center: "text-center",
      // Tabular figures so digits and decimals line up down a money or hours column.
      Right: "text-right tabular-nums",
    },
  },
  defaultVariants: {
    align: "Left",
  },
});

/**
 * What a row paints behind its cells, as a custom property rather than a background colour so the
 * pinned columns can repaint exactly the same fill. A sticky cell must be opaque or the cells
 * scrolling under it show through, and `bg-muted/50` (the `TableRow` default) is translucent: the
 * pinned cells would sit white on a tinted hovered or selected row.
 *
 * `--ivy-data-table-surface` is the fill the table sits on (the card, inside a card) and falls back to
 * the page background. The class strings are spelled out in full because Tailwind finds classes by
 * scanning source text, so a string assembled from parts would never reach the stylesheet.
 */
const ROW_BACKGROUND = [
  "[--row-bg:var(--ivy-data-table-surface,var(--background))] bg-[color:var(--row-bg)]",
  "hover:[--row-bg:color-mix(in_oklab,var(--ivy-data-table-surface,var(--background)),var(--muted)_50%)] hover:bg-[color:var(--row-bg)]",
  // A selected row stays selected under the pointer instead of lightening to the hover tint.
  "data-[state=selected]:[--row-bg:var(--muted)] data-[state=selected]:bg-[color:var(--row-bg)] data-[state=selected]:hover:[--row-bg:var(--muted)]",
].join(" ");

/**
 * The focus ring of a row is an outline on the `<tr>`, which paints over ordinary cells but not over
 * pinned ones: a sticky cell is positioned, so it paints above the row's outline and hides it. The
 * pinned cells therefore redraw the same two-pixel edge themselves, as an inset shadow, with the end
 * bar on their outer side. It lives in `--tw-inset-shadow`, apart from the divider's `--tw-shadow`,
 * so the two compose instead of one replacing the other. In forced colors, where shadows are not
 * painted, they take an outline of their own instead.
 */
const ROW_FOCUS_PINNED = [
  "focus-visible:[&>[data-pin=start]]:inset-shadow-[0_2px_0_0_var(--ring),0_-2px_0_0_var(--ring),2px_0_0_0_var(--ring)]",
  "focus-visible:[&>[data-pin=end]]:inset-shadow-[0_2px_0_0_var(--ring),0_-2px_0_0_var(--ring),-2px_0_0_0_var(--ring)]",
  // Forced colors (Windows high contrast) drops box shadows, so the edges above vanish and the row's
  // outline would stop dead at each pinned column. The pinned cells outline themselves instead, in
  // the system colour the mode picks for outlines.
  "forced-colors:focus-visible:[&>[data-pin]]:outline-2 forced-colors:focus-visible:[&>[data-pin]]:-outline-offset-2",
].join(" ");

/**
 * A truncated cell can be read in full with a mouse (its `title`) and by a screen reader (the text is
 * in the DOM), but a keyboard user sees an ellipsis and nothing more. The row they are on, or one of
 * its controls, therefore shows its truncating cells (marked `data-truncate`) wrapped instead of cut.
 * Only keyboard focus does it (`focus-visible`): a click on a row must not make it jump.
 */
const ROW_REVEAL = [
  "focus-visible:[&>[data-truncate]]:whitespace-normal focus-visible:[&>[data-truncate]]:[overflow-wrap:anywhere]",
  "has-focus-visible:[&>[data-truncate]]:whitespace-normal has-focus-visible:[&>[data-truncate]]:[overflow-wrap:anywhere]",
].join(" ");

/** Row affordances: clickable rows get a pointer, selected rows get the muted surface. */
export const dataTableRowVariant = cva(`${ROW_BACKGROUND} ${ROW_FOCUS_PINNED} ${ROW_REVEAL}`, {
  variants: {
    interactive: {
      true: "cursor-pointer",
      false: "",
    },
    selected: {
      true: "[--row-bg:var(--muted)]",
      false: "",
    },
  },
  defaultVariants: {
    interactive: false,
    selected: false,
  },
});

/**
 * The totals row: an opaque tint (same reason as above) that ignores the pointer, since nothing in
 * it is a target. The `font-medium` comes from the `TableFooter` section.
 */
export const DATA_TABLE_FOOTER_ROW =
  "[--row-bg:color-mix(in_oklab,var(--ivy-data-table-surface,var(--background)),var(--muted)_50%)] bg-[color:var(--row-bg)] hover:bg-[color:var(--row-bg)]";

/**
 * Pinned edge columns. The selection column sticks to the left and the row-action column to the
 * right, so the checkbox and the edit icon stay reachable however far a wide table is scrolled.
 *
 * The divider is a shadow rather than a border because collapsed borders belong to the table grid
 * and do not travel with a sticky cell. It only shows while content is hidden behind the pinned
 * column: the scroll container carries `data-overflow-start` / `data-overflow-end` (see
 * `useScrollEdges`), so a table that fits shows no stray rule.
 */
const PIN_START = "left-0 in-data-[overflow-start]:shadow-[inset_-1px_0_0_var(--border)]";
const PIN_END = "right-0 in-data-[overflow-end]:shadow-[inset_1px_0_0_var(--border)]";

/**
 * Header cells already stick to the top through the table's own utilities and take their fill from
 * there, so they only need the edge. Body and footer cells stick on both axes by hand and repaint
 * the row fill, fading with the row so a hover does not flash the pinned cell alone.
 */
export function dataTablePinClass(side: "start" | "end", part: "head" | "cell"): string {
  const edge = side === "start" ? PIN_START : PIN_END;
  return part === "head" ? edge : `sticky z-[1] bg-[color:var(--row-bg)] transition-colors ${edge}`;
}

/** Toolbar gaps, mirroring the legacy widget's density-keyed `spacing` map. */
export const dataTableToolbarVariant = cva("flex flex-wrap items-center", {
  variants: {
    density: {
      Small: "gap-1",
      Medium: "gap-2",
      Large: "gap-3",
    },
  },
  defaultVariants: {
    density: "Medium",
  },
});

/**
 * How a column's cells handle overflow. These are Tailwind utilities rather than rules in a
 * stylesheet of their own: an app that takes the design system through `styles/index.css` plus a
 * Tailwind `@source` on `dist` only receives utility classes found in the compiled components, so a
 * rule living in a component `.css` file never reached it and every cell wrapped.
 */
const CELL_WRAP = "whitespace-normal [overflow-wrap:anywhere]";
const CELL_NOWRAP = "whitespace-nowrap";
// Under `table-layout: auto` a nowrap cell's minimum width is its full text, so `text-ellipsis` alone
// never truncates anything and one long message stretches the whole table. The cap is what makes the
// ellipsis real; it is a custom property so a table that wants longer lines can raise it.
const CELL_TRUNCATE =
  "max-w-[var(--ivy-data-table-truncate-width,20rem)] overflow-hidden text-ellipsis whitespace-nowrap";
// The header of a truncating column takes the same cap. Without it the label and its sort icon, which
// do not wrap, set the column's minimum width however short the cap makes the cells, and the column
// ends up wider than the fit assumed. The label inside is what gives way, see `DataTableColumnHeader`.
const HEADER_TRUNCATE = "max-w-[var(--ivy-data-table-truncate-width,20rem)]";

type CellWrapColumn<TRow> = Pick<DataTableColumn<TRow>, "nowrap" | "wrapText" | "align">;

const isNowrap = <TRow>(column: CellWrapColumn<TRow>): boolean =>
  column.nowrap ?? (column.align === "Right" && !column.wrapText);

/** Whether a column's cells are cut off with an ellipsis (as opposed to wrapped or kept whole). */
export function dataTableCellTruncates<TRow>(column: CellWrapColumn<TRow>): boolean {
  return !isNowrap(column) && !column.wrapText;
}

/**
 * The cap on a column's header: the cells' own, while they truncate, and none otherwise. A column whose
 * cells are kept whole (dates, amounts) or wrap is as wide as its header needs, and
 * {@link estimateColumnWidth} counts it.
 */
export function dataTableHeaderWrapClass<TRow>(column: CellWrapColumn<TRow>): string {
  return dataTableCellTruncates(column) ? HEADER_TRUNCATE : "";
}

/** Resolves a column's `nowrap` / `wrapText` / `align` into the cell's overflow classes. */
export function dataTableCellWrapClass<TRow>(column: CellWrapColumn<TRow>): string {
  if (isNowrap(column)) return CELL_NOWRAP;
  return column.wrapText ? CELL_WRAP : CELL_TRUNCATE;
}
