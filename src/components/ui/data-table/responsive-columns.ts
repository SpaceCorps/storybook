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
 * without the margin that is a column that hides and shows on every frame. Any jitter smaller than
 * the margin is absorbed, see {@link getColumnsHiddenByWidth}.
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

export interface ColumnsHiddenByWidthOptions {
  /** The container's width in px, or `null` while it has not been measured. */
  width: number | null;
  /** px held by the pinned columns, see {@link reservedColumnsWidth}. */
  reservedWidth?: number;
  /**
   * What the previous call returned, for hysteresis: a column that was hidden stays hidden until the
   * container is {@link DATA_TABLE_REVEAL_MARGIN} px wider than it takes to hide it. The history only
   * ever keeps a column hidden: it never delays hiding and never keeps showing a column the room
   * cannot pay for. It can show a `priority` column that a call without history would hide, because a
   * `hideBelow` column it holds back frees its room. Leave it out for a first measurement, which has
   * nothing to be steady about.
   *
   * The margin is applied to the `hideBelow` columns first, and the `priority` budget is then run
   * with that outcome: a `hideBelow` column that is being held back takes no room in it, so no
   * `priority` column is hidden to pay for a column that is not showing.
   */
  previouslyHidden?: ReadonlySet<string>;
}

/**
 * Which of `columns` (the visible ones, in render order) a container of the given width hides.
 *
 * - `hideBelow` hides a column while the container is narrower than that.
 * - `priority` hides the least important columns one at a time until the estimated width of what is
 *   left fits ({@link estimateColumnWidth}), without touching a column that has `hideBelow`. A column
 *   that names both is a `hideBelow` column; its `priority` only decides which column is kept when
 *   nothing else would be.
 * - Before a measurement (`width: null`) every column with either option is hidden: narrow first, so
 *   a phone's first paint is never a wide table that collapses afterwards.
 * - The most important column is kept even when nothing fits, so a table never loses every column.
 *
 * With `previouslyHidden` the answer has hysteresis (see {@link DATA_TABLE_REVEAL_MARGIN}). Each
 * `hideBelow` column gets its margin first and the `priority` budget runs on what is left, once at the
 * width and once a margin narrower (the second only to hold back a column that was hidden). That
 * holds for any mix of `hideBelow`, `priority` and plain columns:
 *
 * - **No flicker from a scrollbar.** The margin is larger than the 15 px a classic scrollbar takes.
 *   For every width W, every set `s` this function can return and every jitter `j` below the margin,
 *   if `f(W - j, s)` is a set other than `s`, then `f(W, that set)` is not `s`. A table whose height
 *   depends on its width (wrapping text, a longer details list) therefore cannot make its container
 *   alternate between two widths and its columns between two sets. Widths within 15 px of each other
 *   can only move the table one way, never round a loop. A jump of more than the margin is a real
 *   resize and can still flip a column; that is what the margin is for.
 * - **What shows fits.** If the columns left showing are estimated wider than the container, every
 *   `priority` column is already hidden, bar the one kept when nothing else would be. The history
 *   never keeps a column showing that the room cannot pay for, and a `hideBelow` column never shows
 *   below its threshold (again bar the kept one).
 * - **Growing never hides a column for nothing.** As the container grows, a column that is showing
 *   stays showing, except to pay for a `hideBelow` column that has just come back (and the kept one
 *   may hand over to a column that now fits). Shrinking is the mirror of that.
 * - **A table with only `hideBelow` columns, or only `priority` ones, answers as it did before.** The
 *   mix was the one shape that was wrong: it counted a `hideBelow` column that the margin held back
 *   as showing, so a `priority` column was hidden to pay for it.
 *
 * The widths are estimates ({@link estimateColumnWidth}), so "fits" is as true as they are; none of
 * this measures a real column. Pure and cheap (one pass and one sort of the prioritised columns), and
 * a function of its arguments only: the same width and history always give the same answer.
 */
export function getColumnsHiddenByWidth<TRow>(
  columns: readonly DataTableColumn<TRow>[],
  { width, reservedWidth = 0, previouslyHidden }: ColumnsHiddenByWidthOptions,
): Set<string> {
  if (columns.length === 0 || !columns.some(isResponsiveColumn)) return new Set();

  const hidden = new Set<string>();

  // `hideBelow` first, with its own margin: it answers to its threshold alone and not to the others.
  for (const column of columns) {
    const threshold = column.hideBelow;
    if (!isRank(threshold)) continue;
    if (
      width === null ||
      width < threshold ||
      (width < threshold + DATA_TABLE_REVEAL_MARGIN && previouslyHidden?.has(column.name))
    ) {
      hidden.add(column.name);
    }
  }

  // The budget is shared by the rest. Least important first; among equals the column on the right
  // goes before the one on its left.
  const ranked = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => isRank(column.priority) && !isRank(column.hideBelow))
    .sort((a, b) => b.column.priority! - a.column.priority! || b.index - a.index)
    .map(({ column }) => column);

  if (width === null) {
    for (const column of ranked) hidden.add(column.name);
  } else {
    // Counted once, with every column that `hideBelow` hides (margin included) already left out, and
    // used for both widths below, so a column is never counted as showing while a rule holds it back.
    const total =
      reservedWidth +
      columns.reduce(
        (sum, column) => (hidden.has(column.name) ? sum : sum + estimateColumnWidth(column)),
        0,
      );
    /** How many of `ranked`, from the least important, a container of `room` px has to drop. */
    const droppedAt = (room: number): number => {
      let needed = total;
      let dropped = 0;
      while (dropped < ranked.length && needed > room) {
        needed -= estimateColumnWidth(ranked[dropped]);
        dropped += 1;
      }
      return dropped;
    };

    const dropped = droppedAt(width);
    for (let i = 0; i < dropped; i += 1) hidden.add(ranked[i].name);

    // A column that was hidden stays hidden while it would still be dropped a margin narrower.
    if (previouslyHidden && previouslyHidden.size > 0) {
      const cautious = droppedAt(width - DATA_TABLE_REVEAL_MARGIN);
      for (let i = dropped; i < cautious; i += 1) {
        if (previouslyHidden.has(ranked[i].name)) hidden.add(ranked[i].name);
      }
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
