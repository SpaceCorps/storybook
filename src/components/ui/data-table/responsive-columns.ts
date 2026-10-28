import { Densities } from "@/types/density";
import type { DataTableColumn } from "./types";
import { dataTableCellTruncates } from "./variant";

/**
 * What a column is assumed to need, in px, when it names no `width` the estimate can read. 8rem holds
 * a date, an amount or a short name; a long text column should say so with `width`. At a root font
 * size other than 16px the estimate follows it, see {@link estimateColumnWidth}.
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

/**
 * px held by the pinned columns around the data columns, which hiding a data column never frees, at
 * Medium density and a 16px root font: what {@link reservedColumnsWidth} returns when it is told
 * nothing else. A table that knows more (its density, how many actions a row has, what the browser
 * laid out) is reserved for by {@link estimateStartColumnWidth} and {@link estimateActionsColumnWidth}.
 */
export const DATA_TABLE_RESERVED_WIDTH = {
  /** What a selection checkbox and the gap after it add to the cell that holds the details button. */
  select: 22,
  /** The cell with the details button, reserved whenever a column could be hidden. */
  detail: 48,
  /** The actions cell with two icon buttons, the usual pair. */
  actions: 100,
} as const;

const CSS_LENGTH = /^\s*(\d+(?:\.\d+)?)\s*(px|rem)\s*$/i;
const REM_PX = 16;
/** 8rem: the column an estimate cannot read a width for. */
const DEFAULT_COLUMN_REM = DATA_TABLE_COLUMN_WIDTH_ESTIMATE / REM_PX;

const isRank = (value: number | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Whether the column takes part in responsive hiding at all. */
export function isResponsiveColumn<TRow>(
  column: Pick<DataTableColumn<TRow>, "hideBelow" | "priority">,
): boolean {
  return isRank(column.hideBelow) || isRank(column.priority);
}

/** What a column's `header` and its alignment say about how it is laid out, for {@link estimateColumnWidth}. */
type ColumnWidthInput<TRow> = Pick<DataTableColumn<TRow>, "width"> &
  Partial<Pick<DataTableColumn<TRow>, "name" | "header" | "align" | "nowrap" | "wrapText">>;

/**
 * The px a column is taken to need when judging whether a table fits: its `width` when that is a
 * plain `px` or `rem` length, {@link DATA_TABLE_COLUMN_WIDTH_ESTIMATE} otherwise (`auto`, `%`, `calc()`
 * and the like say nothing about a size in px). A `rem` length, and the default, follow `remPx`, the
 * root font size (16 unless told otherwise).
 *
 * With `header` the header is counted as well, and the column is as wide as the wider of the two: a
 * header is not wrapped, so a column whose cells cannot truncate (a date, an amount, wrapping text) is
 * never narrower than its label and sort icon, see {@link estimateHeaderWidth}. The header of a column
 * that truncates gives way at the same cap as its cells, so it is not counted: such a column is its
 * `width`, with the same rule as for its cells (declare what the text needs, or set the cap). Without
 * `header` no header is counted, as it always was.
 */
export function estimateColumnWidth<TRow>(
  column: ColumnWidthInput<TRow>,
  remPx: number = REM_PX,
  header?: HeaderWidthMetrics,
): number {
  const match = column.width ? CSS_LENGTH.exec(column.width) : null;
  const declared = match
    ? match[2].toLowerCase() === "rem"
      ? Number(match[1]) * remPx
      : Number(match[1])
    : DEFAULT_COLUMN_REM * remPx;
  if (!header) return declared;

  const label = column.header ?? column.name;
  if (!label || dataTableCellTruncates(column)) return declared;
  return Math.max(
    declared,
    estimateHeaderWidth(label, {
      ...header,
      remPx,
      sortable: header.sortable?.has(column.name ?? "") ?? false,
    }),
  );
}

/**
 * One step of the spacing scale, in rem (`--spacing`). The pinned cells are whole numbers of steps:
 * the padding of a cell is `p-1`, `p-2` or `p-3` by density, a checkbox `size-3`, `size-4` or
 * `size-5`, the details button `size-7`, an icon action button `size-9`, the gap between them `gap-1`.
 * That is why their widths can be known without rendering them.
 */
export const DATA_TABLE_SPACING_REM = 0.27;

/** px of one spacing step at a 16px root font. */
const DEFAULT_UNIT_PX = DATA_TABLE_SPACING_REM * REM_PX;

const CELL_PADDING_STEPS: Record<Densities, number> = {
  [Densities.Small]: 1,
  [Densities.Medium]: 2,
  [Densities.Large]: 3,
};
const CHECKBOX_STEPS: Record<Densities, number> = {
  [Densities.Small]: 3,
  [Densities.Medium]: 4,
  [Densities.Large]: 5,
};
/** `pr-2` on a cell that holds a checkbox. */
const CHECKBOX_CELL_END_PADDING_STEPS = 2;
/** `ps-6` / `pe-6` on the first and last cell of a table that carries a flush card's inset. */
const INSET_STEPS = 6;
const GAP_STEPS = 1;
const DETAILS_BUTTON_STEPS = 7;
const ACTION_BUTTON_STEPS = 9;

/** What the estimates need to know about the table that the columns do not say. */
export interface PinnedColumnMetrics {
  /** Defaults to Medium. */
  density?: Densities;
  /** The table carries the inset of a flush card on its first and last cell. */
  inset?: boolean;
  /** px of one spacing step: `--spacing` as resolved in the page. Defaults to 0.27rem at 16px. */
  unitPx?: number;
}

const unitOf = ({ unitPx }: PinnedColumnMetrics) =>
  typeof unitPx === "number" && unitPx > 0 ? unitPx : DEFAULT_UNIT_PX;

/**
 * px the pinned cell at the start needs: the selection checkbox, the details button, or both side by
 * side, with the cell's padding. The details button is counted by default, because it appears the
 * moment a column is hidden and the width it needs must already be set aside then; `withDetails:
 * false` is the cell as it is laid out while nothing is hidden. `checkboxPx` replaces the model's
 * checkbox when the browser has said what it is.
 */
export function estimateStartColumnWidth({
  selectable,
  withDetails = true,
  checkboxPx,
  ...metrics
}: PinnedColumnMetrics & {
  selectable: boolean;
  withDetails?: boolean;
  checkboxPx?: number | null;
}): number {
  if (!selectable && !withDetails) return 0;
  const unit = unitOf(metrics);
  const density = metrics.density ?? Densities.Medium;
  const padding = CELL_PADDING_STEPS[density];

  const parts: number[] = [];
  if (selectable) {
    parts.push(
      typeof checkboxPx === "number" && checkboxPx > 0
        ? checkboxPx
        : CHECKBOX_STEPS[density] * unit,
    );
  }
  if (withDetails) parts.push(DETAILS_BUTTON_STEPS * unit);

  const start = (metrics.inset ? INSET_STEPS : padding) * unit;
  const end = (selectable ? CHECKBOX_CELL_END_PADDING_STEPS : padding) * unit;
  const gaps = (parts.length - 1) * GAP_STEPS * unit;
  return Math.ceil(start + parts.reduce((sum, part) => sum + part, 0) + gaps + end);
}

/**
 * px the pinned actions cell needs for `actionCount` icon buttons side by side, with the cell's
 * padding: 100 for the usual pair at Medium and 16px, 57 for one (or for the single "..." button the
 * actions fold into). A button with a text label is wider than the icon this assumes; the table
 * measures those, see `usePinnedMetrics`.
 */
export function estimateActionsColumnWidth({
  actionCount,
  ...metrics
}: PinnedColumnMetrics & { actionCount: number }): number {
  if (!(actionCount > 0)) return 0;
  const unit = unitOf(metrics);
  const padding = CELL_PADDING_STEPS[metrics.density ?? Densities.Medium];
  const end = metrics.inset ? INSET_STEPS : padding;
  const buttons = actionCount * ACTION_BUTTON_STEPS + (actionCount - 1) * GAP_STEPS;
  return Math.ceil((padding + buttons + end) * unit);
}

/** What the estimate of a header needs to know about the table that the columns do not say. */
export interface HeaderWidthMetrics extends PinnedColumnMetrics {
  /** Names of the columns whose header carries the sort icon (sorting is on and the column allows it). */
  sortable?: ReadonlySet<string>;
}

/** The header's text size at each density (`text-xs`, `text-sm`, `text-base`), in rem. */
const HEADER_FONT_REM: Record<Densities, number> = {
  [Densities.Small]: 0.75,
  [Densities.Medium]: 0.875,
  [Densities.Large]: 1,
};
/** `size-3.5`, and the `gap-1` before it, in steps: what the sort icon adds to a label. */
const SORT_ICON_STEPS = 3.5 + GAP_STEPS;

// What a glyph takes, in em, at the header's `font-medium`. They are read off the common sans-serif
// faces (Segoe UI, Arial, Georgia, Verdana), and sit at the wide end of them: the cost of an estimate
// that is too wide is a column hidden a little early, and the cost of one that is too narrow is the
// overlap this exists to prevent.
const FULL_WIDTH_GLYPH = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
/** Letters and marks that take about a third of an em or less in a sans-serif face. */
const NARROW_GLYPHS = "iljtfI .,:;'|!()[]/-";
const WIDE_GLYPH = /[mwMW%@]/;
const CAPITAL_OR_DIGIT = /[\p{Lu}\p{N}]/u;

function glyphEm(glyph: string): number {
  if (FULL_WIDTH_GLYPH.test(glyph)) return 1;
  if (NARROW_GLYPHS.includes(glyph)) return 0.3;
  if (WIDE_GLYPH.test(glyph)) return 0.88;
  return CAPITAL_OR_DIGIT.test(glyph) ? 0.7 : 0.58;
}

/**
 * px a column header takes when its label is not cut off: the text, the sort icon when it has one, and
 * the cell's padding (`px-1`, `px-2` or `px-3` by density). A header does not wrap, so this is also the
 * least a column whose cells cannot truncate (a date, an amount, wrapping text) is as wide as.
 *
 * The text is estimated from its characters and not measured. A measurement would be of the headers in
 * the page, and a column the fit has hidden has none; it would also change once the page's fonts have
 * loaded, and every change would be a new width for the fit to answer, a column hiding or coming back
 * for a number that was not known a moment ago. The estimate is a function of the label, the density
 * and the root font size, none of which depend on the room the table is given, so the fit stays a
 * function of its arguments and nothing it hides can move the number that hid it. It is wider than
 * the text in a typical face (by about 10 to 25 percent) on purpose, see `glyphEm`.
 */
export function estimateHeaderWidth(
  label: string,
  {
    density = Densities.Medium,
    remPx = REM_PX,
    sortable = false,
    ...metrics
  }: PinnedColumnMetrics & { remPx?: number; sortable?: boolean },
): number {
  const unit = unitOf(metrics);
  let em = 0;
  for (const glyph of label) em += glyphEm(glyph);
  const text = em * HEADER_FONT_REM[density] * remPx;
  const icon = sortable ? SORT_ICON_STEPS * unit : 0;
  const padding = 2 * CELL_PADDING_STEPS[density] * unit;
  return Math.ceil(text + icon + padding);
}

/**
 * The px the pinned columns around the data columns take, for {@link getColumnsHiddenByWidth}: the
 * start cell with its details button, and the actions cell for `actionCount` icon buttons (two unless
 * told). Medium density and a 16px root font unless `density` and `unitPx` say otherwise.
 */
export function reservedColumnsWidth({
  selectable,
  actions,
  actionCount = 2,
  ...metrics
}: PinnedColumnMetrics & {
  selectable: boolean;
  actions: boolean;
  actionCount?: number;
}): number {
  return (
    estimateStartColumnWidth({ selectable, ...metrics }) +
    (actions ? estimateActionsColumnWidth({ actionCount, ...metrics }) : 0)
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
  /** The root font size in px, which a `rem` width and the default estimate follow. Defaults to 16. */
  remPx?: number;
  /**
   * What is known about the headers, which a column that cannot truncate its header is at least as wide
   * as: see {@link estimateColumnWidth}. Left out, only the columns' `width` is counted.
   */
  header?: HeaderWidthMetrics;
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
 *   may hand over to a column that now fits). Shrinking is the mirror of that. This is for one
 *   `reservedWidth`; {@link getResponsiveFit} is where the room the pinned columns leave can change.
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
  {
    width,
    reservedWidth = 0,
    remPx = REM_PX,
    header,
    previouslyHidden,
  }: ColumnsHiddenByWidthOptions,
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
        (sum, column) =>
          hidden.has(column.name) ? sum : sum + estimateColumnWidth(column, remPx, header),
        0,
      );
    /** How many of `ranked`, from the least important, a container of `room` px has to drop. */
    const droppedAt = (room: number): number => {
      let needed = total;
      let dropped = 0;
      while (dropped < ranked.length && needed > room) {
        needed -= estimateColumnWidth(ranked[dropped], remPx, header);
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

/**
 * Whether row actions are folded into one menu button at this container width.
 *
 * - Not at all when `below` is not a finite number.
 * - Folded before a measurement (`width: null`), as a column with `hideBelow` is hidden: a phone's
 *   first paint is never a row of buttons that folds afterwards.
 * - Folded while the container is narrower than `below`; unfolded again only once it is
 *   {@link DATA_TABLE_REVEAL_MARGIN} px wider than that, so a scrollbar that comes and goes cannot
 *   make it flip on every frame. Between the two it keeps `wasCollapsed`, which a first measurement
 *   leaves out (at or above `below` is then unfolded).
 *
 * A function of the width and its own previous answer and of nothing else: not of the columns, not of
 * which of them are hidden, so folding cannot feed back into the width that decided it.
 */
export function getRowActionsCollapsed({
  width,
  below,
  wasCollapsed,
}: {
  width: number | null;
  below: number | undefined;
  wasCollapsed?: boolean;
}): boolean {
  if (!isRank(below)) return false;
  if (width === null || width < below) return true;
  if (width >= below + DATA_TABLE_REVEAL_MARGIN) return false;
  return wasCollapsed ?? false;
}

export interface ResponsiveFitOptions extends Omit<
  ColumnsHiddenByWidthOptions,
  "previouslyHidden"
> {
  /** The pinned columns' px while row actions are folded into one menu button. Defaults to `reservedWidth`. */
  reservedFoldedWidth?: number;
  /** Fold row actions below this container width, see {@link getRowActionsCollapsed}. */
  collapseBelow?: number;
  /**
   * Whether folding does anything in this table: false when no row has more than one action, where
   * the single button is already as small as the menu button would be. Defaults to true.
   */
  collapseApplies?: boolean;
  /** What the previous call returned, for hysteresis. Leave it out for a first measurement. */
  previous?: { hidden: ReadonlySet<string>; trigger: boolean };
}

export interface ResponsiveFit {
  /** Names of the columns the container is too narrow for. */
  hidden: Set<string>;
  /** Whether the container is narrow enough to fold, whether or not folding applies. The history. */
  trigger: boolean;
  /** Whether row actions are folded: `trigger`, and the table has something to fold. */
  collapsed: boolean;
}

/**
 * {@link getColumnsHiddenByWidth} and {@link getRowActionsCollapsed} together, because the first needs
 * to know which of two widths the pinned columns take: the actions folded into one button are
 * narrower. The fold is decided first and from the width alone; the columns are then fitted into what
 * the folded or the unfolded actions leave.
 *
 * The state is the pair (hidden columns, fold). Its guarantees are those of the two parts, for a
 * reserved width that does not change between calls: a jitter smaller than
 * {@link DATA_TABLE_REVEAL_MARGIN} can move the pair one way and never straight back. They are not the
 * "growing never hides a column" of the columns alone: crossing the fold threshold changes the room
 * by the difference of the two widths, so unfolding on the way up can hide a column that the folded
 * actions left room for, and folding on the way down can bring one back. Both are the point of
 * folding, and neither can recur inside a window narrower than the margin.
 */
export function getResponsiveFit<TRow>(
  columns: readonly DataTableColumn<TRow>[],
  {
    width,
    reservedWidth = 0,
    reservedFoldedWidth,
    remPx,
    header,
    collapseBelow,
    collapseApplies = true,
    previous,
  }: ResponsiveFitOptions,
): ResponsiveFit {
  const trigger = getRowActionsCollapsed({
    width,
    below: collapseBelow,
    wasCollapsed: previous?.trigger,
  });
  const collapsed = trigger && collapseApplies;
  const hidden = getColumnsHiddenByWidth(columns, {
    width,
    reservedWidth: collapsed ? (reservedFoldedWidth ?? reservedWidth) : reservedWidth,
    remPx,
    header,
    previouslyHidden: previous?.hidden,
  });
  return { hidden, trigger, collapsed };
}

/** Whether two sets name the same columns. */
export function sameColumnNames(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const name of a) {
    if (!b.has(name)) return false;
  }
  return true;
}
