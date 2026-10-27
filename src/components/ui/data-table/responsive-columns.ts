import type { DataTableColumn } from "./types";

/**
 * What a column is assumed to need, in px, when it names no `width` the estimate can read. 8rem holds
 * a date, an amount or a short name; a long text column should say so with `width`.
 */
export const DATA_TABLE_COLUMN_WIDTH_ESTIMATE = 128;

/**
 * How far past a column's threshold the container has to grow before a hidden column comes back. A
 * page scrollbar appearing or disappearing moves the container by about 15 px, and a table whose
 * height changes with its width (wrapping text, a longer details list) can be what makes it appear:
 * without the margin that is a column that hides and shows on every frame.
 */
export const DATA_TABLE_REVEAL_MARGIN = 24;

/** px held by the pinned columns around the data columns, which hiding a data column never frees. */
export const DATA_TABLE_RESERVED_WIDTH = {
  /** Selection checkbox. */
  select: 40,
  /** The details disclosure button, reserved whenever a column could be hidden. */
  detail: 36,
  /** Row actions. Matches the `--ivy-data-table-actions-width` default. */
  actions: 80,
} as const;

const CSS_LENGTH = /^\s*(\d+(?:\.\d+)?)\s*(px|rem)\s*$/i;
const REM_PX = 16;

const isRank = (value: number | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Whether the column takes part in responsive hiding at all. */
export function isResponsiveColumn<TRow>(
  column: Pick<DataTableColumn<TRow>, "hideBelow" | "priority">,
): boolean {
  return isRank(column.hideBelow) || isRank(column.priority);
}

/**
 * The px a column is taken to need when judging whether a table fits: its `width` when that is a
 * plain `px` or `rem` length, {@link DATA_TABLE_COLUMN_WIDTH_ESTIMATE} otherwise (`auto`, `%`, `calc()`
 * and the like say nothing about a size in px).
 */
export function estimateColumnWidth<TRow>(column: Pick<DataTableColumn<TRow>, "width">): number {
  const match = column.width ? CSS_LENGTH.exec(column.width) : null;
  if (!match) return DATA_TABLE_COLUMN_WIDTH_ESTIMATE;
  const value = Number(match[1]);
  return match[2].toLowerCase() === "rem" ? value * REM_PX : value;
}

/** The px the pinned columns around the data columns take, for {@link getColumnsHiddenByWidth}. */
export function reservedColumnsWidth({
  selectable,
  actions,
}: {
  selectable: boolean;
  actions: boolean;
}): number {
  return (
    (selectable ? DATA_TABLE_RESERVED_WIDTH.select : 0) +
    DATA_TABLE_RESERVED_WIDTH.detail +
    (actions ? DATA_TABLE_RESERVED_WIDTH.actions : 0)
  );
}

/** Columns the guard below keeps when width would otherwise take every one: the most important. */
function mostImportant<TRow>(columns: readonly DataTableColumn<TRow>[]): DataTableColumn<TRow> {
  const rankOf = (column: DataTableColumn<TRow>) => [
    isRank(column.priority) ? column.priority : Infinity,
    isRank(column.hideBelow) ? column.hideBelow : Infinity,
  ];
  return columns.reduce((best, column) => {
    const [bestPriority, bestBelow] = rankOf(best);
    const [priority, below] = rankOf(column);
    if (priority !== bestPriority) return priority < bestPriority ? column : best;
    return below < bestBelow ? column : best;
  });
}

/** The set a container of `width` px hides, with no memory of the last call. */
function hiddenAt<TRow>(
  columns: readonly DataTableColumn<TRow>[],
  width: number | null,
  reservedWidth: number,
): Set<string> {
  const hidden = new Set<string>();

  for (const column of columns) {
    if (isRank(column.hideBelow) && (width === null || width < column.hideBelow)) {
      hidden.add(column.name);
    }
  }

  // `hideBelow` has already decided for its own columns; the budget is shared by the rest.
  const ranked = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => isRank(column.priority) && !isRank(column.hideBelow));

  if (width === null) {
    for (const { column } of ranked) hidden.add(column.name);
    return hidden;
  }

  let needed =
    reservedWidth +
    columns.reduce(
      (sum, column) => (hidden.has(column.name) ? sum : sum + estimateColumnWidth(column)),
      0,
    );
  // Least important first; among equals the column on the right goes before the one on its left.
  ranked.sort((a, b) => b.column.priority! - a.column.priority! || b.index - a.index);
  for (const { column } of ranked) {
    if (needed <= width) break;
    hidden.add(column.name);
    needed -= estimateColumnWidth(column);
  }
  return hidden;
}

export interface ColumnsHiddenByWidthOptions {
  /** The container's width in px, or `null` while it has not been measured. */
  width: number | null;
  /** px held by the pinned columns, see {@link reservedColumnsWidth}. */
  reservedWidth?: number;
  /**
   * What the previous call returned, for hysteresis: a column that was hidden stays hidden until the
   * container is {@link DATA_TABLE_REVEAL_MARGIN} px wider than it takes to hide it. Hiding is never
   * delayed. Leave it out for a first measurement, which has nothing to be steady about.
   */
  previouslyHidden?: ReadonlySet<string>;
}

/**
 * Which of `columns` (the visible ones, in render order) a container of the given width hides.
 *
 * - `hideBelow` hides a column while the container is narrower than that.
 * - `priority` hides the least important columns one at a time until the estimated width of what is
 *   left fits ({@link estimateColumnWidth}), without touching a column that has `hideBelow`.
 * - Before a measurement (`width: null`) every column with either option is hidden: narrow first, so
 *   a phone's first paint is never a wide table that collapses afterwards.
 * - The most important column is kept even when nothing fits, so a table never loses every column.
 *
 * Pure and cheap (one pass and a sort of the prioritised columns), and a function of its arguments
 * only: the same width and history always give the same answer.
 */
export function getColumnsHiddenByWidth<TRow>(
  columns: readonly DataTableColumn<TRow>[],
  { width, reservedWidth = 0, previouslyHidden }: ColumnsHiddenByWidthOptions,
): Set<string> {
  if (columns.length === 0 || !columns.some(isResponsiveColumn)) return new Set();

  const hidden = hiddenAt(columns, width, reservedWidth);

  if (width !== null && previouslyHidden && previouslyHidden.size > 0) {
    const cautious = hiddenAt(columns, width - DATA_TABLE_REVEAL_MARGIN, reservedWidth);
    for (const name of previouslyHidden) {
      if (cautious.has(name)) hidden.add(name);
    }
  }

  if (columns.every((column) => hidden.has(column.name))) {
    hidden.delete(mostImportant(columns).name);
  }
  return hidden;
}

/** Whether two sets name the same columns. */
export function sameColumnNames(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const name of a) {
    if (!b.has(name)) return false;
  }
  return true;
}
