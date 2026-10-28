import type * as React from "react";

export type DataTableAlign = "Left" | "Center" | "Right";

/**
 * How the table presents itself.
 *
 * - `"bordered"` draws its own rounded border, for a table that stands alone on the page.
 * - `"embedded"` draws no box, for a host that already supplies one (a card, a panel). Header and row
 *   dividers stay; there is no outer frame, so it cannot double up with the host's border.
 */
export type DataTableVariant = "bordered" | "embedded";
export type DataTableSortDirection = "Ascending" | "Descending";

export interface DataTableSort {
  column: string;
  direction: DataTableSortDirection;
}

export interface DataTableColumn<TRow> {
  /** Stable key. Also the sort key and the `columnVisibility` map key. */
  name: string;
  /**
   * Header text. Falls back to `name`. In a column whose cells truncate the header truncates too, at
   * the same cap, with its sort icon kept in view and the whole text as a tooltip while it is cut off;
   * in a column whose cells are kept whole or wrap the header is never cut, and the column is as wide
   * as it needs.
   */
  header?: string;
  /** Cell value used for sorting, default rendering and the inline editor's initial value. */
  accessor?: (row: TRow) => unknown;
  /** Custom cell renderer. Receives the accessor value and the row. */
  cell?: (value: unknown, row: TRow, rowIndex: number) => React.ReactNode;
  /** Defaults to true. */
  sortable?: boolean;
  /** Defaults to "Left". Applies to both header and cells. */
  align?: DataTableAlign;
  /**
   * CSS width for the <th>, e.g. "110px" or "auto". It is a preferred width: a column whose text
   * cannot truncate is never narrower than its content. Truncating cells are capped at
   * `--ivy-data-table-truncate-width` (20rem by default), settable on the table's `className`.
   */
  width?: string;
  /** Defaults to false. Hidden columns are absent from the DOM. */
  hidden?: boolean;
  /**
   * Hide this column while the table's own container is narrower than this many px. It is the
   * container that is measured (the table's outer wrapper, with a `ResizeObserver`), not the
   * viewport, so a table in a narrow card, sheet or side panel reacts to the room it has.
   *
   * A column hidden this way is not lost: its value moves into the row's details (a disclosure
   * button in the row, present only while at least one column is hidden). `hidden` and the column
   * options menu are a separate thing and win: a column the user hid stays hidden at every width and
   * is not offered in the details. Takes precedence over `priority` on the same column.
   *
   * Before the container has been measured (server render, first paint) every column with `hideBelow`
   * is treated as hidden, so a phone never sees a wide table that then collapses. Where there is no
   * layout to measure (jsdom, a tab or sheet that is not shown) it stays that way until there is.
   *
   * The wrapper is measured, so give it a width the columns do not decide: a block, a flex or grid
   * item, a card. In a shrink-to-fit parent (an inline-block, an auto-sized table cell) hiding a column
   * narrows the table, which hides more, and the table collapses to the columns that always show.
   */
  hideBelow?: number;
  /**
   * Rank for dropping columns without naming a width: **lower is more important**, 1 is the first to
   * keep and the last to go. While the content does not fit its container the table hides the column
   * with the highest number, one at a time (the later column first among equals), until it does.
   * "Fits" is judged from an estimate, not from layout: each column is taken to need its `width` when
   * that is in `px` or `rem`, and 8rem otherwise, or its header when that is wider and the column
   * cannot truncate it, plus room for the selection, details and action columns. Name `width`
   * honestly, or use `hideBelow`, where the estimate is too far off.
   *
   * A column with neither `priority` nor `hideBelow` is never hidden by width, and the most important
   * column of a table is kept even when nothing fits. Hidden columns go to the row details, see
   * `hideBelow`.
   */
  priority?: number;
  /** Ascending sort position among visible columns; ties keep declaration order. */
  order?: number;
  /** Tooltip on the header. */
  help?: string;
  /**
   * Aggregate footer value for this column (legacy `footer`). Rendered as given, so it is whatever
   * the caller computed: under pagination a sum over the visible page and a sum over the whole
   * range look identical on every page, so say which one it is in the label next to it.
   */
  footer?: React.ReactNode;
  /**
   * Defaults to false — cells stay on one line and truncate with an ellipsis. Set to let a long text
   * column wrap instead. Overridden by `nowrap`.
   *
   * How a truncated cell is read in full: a mouse sees it as a tooltip (`title`), a keyboard user
   * sees the focused row show its truncating cells in full, and a screen reader always has the whole
   * text. A touch screen has none of those, so set `wrapText` on a column whose text matters on a
   * phone.
   */
  wrapText?: boolean;
  /**
   * Keep the cell on one line and never clip it: no wrapping and no ellipsis, so the column grows to
   * fit its content. Use it for dates, identifiers and amounts, which are unreadable when split or
   * cut. Defaults to true for `align: "Right"` columns (numbers) unless `wrapText` is set, and false
   * otherwise; an explicit value always wins, including over `wrapText`.
   */
  nowrap?: boolean;
  /** Cell becomes editable when the table is `editable`. Defaults to false. */
  editable?: boolean;
  /** Comparator override; defaults to the shared value comparator in utils.ts. */
  compare?: (a: unknown, b: unknown) => number;
}

export interface DataTableRowAction<TRow> {
  /** Stable id, passed to onRowAction. */
  tag: string;
  label: string;
  icon?: React.ReactNode;
  tooltip?: string;
  variant?: "default" | "destructive" | "separator";
  disabled?: boolean;
  children?: DataTableRowAction<TRow>[];
}

/** Payload handed to `onRowAction` when a row action is invoked. */
export interface DataTableRowActionEvent<TRow> {
  /** `getRowId(row, index)` for the row the action belongs to. */
  id: string;
  /** The invoked action's `tag`. */
  tag: string;
  row: TRow;
}

/** Payload handed to `onCellCommit` when an inline edit is committed. */
export interface DataTableCellCommitEvent<TRow> {
  /** `getRowId(row, index)` for the edited row. */
  id: string;
  row: TRow;
  /** The edited column's `name`. */
  column: string;
  /** The editor's text value. */
  value: string;
  /** The accessor value the editor started from. */
  previousValue: unknown;
}

/** Left/right content slots rendered above the table. */
export interface DataTableToolbarSlots {
  left?: React.ReactNode;
  right?: React.ReactNode;
}

/** `Record<string, boolean>` keyed by column `name`; an absent key means "use `column.hidden`". */
export type DataTableColumnVisibility = Record<string, boolean>;

/**
 * Row-windowing mode.
 *
 * - `"auto"` (the default) windows only once the rendered row count exceeds
 *   `virtualizationThreshold`. Because `paginated` defaults to true with a 10-row page, a default
 *   call site never windows and renders exactly as it did before virtualization existed.
 * - `true` forces windowing.
 * - `false` disables it.
 */
export type DataTableVirtualized = boolean | "auto";
