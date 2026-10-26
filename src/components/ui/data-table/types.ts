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
  /** Header text. Falls back to `name`. */
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
