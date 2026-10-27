import * as React from "react";

import { DATA_TABLE_SPACING_REM } from "./responsive-columns";

/** What the page says about the pinned columns that the table cannot work out from its props. */
export interface PinnedMetrics {
  /** The root font size in px. */
  remPx: number;
  /** px of one spacing step (`--spacing`), the unit the pinned cells are built from. */
  unitPx: number;
  /** A rendered selection checkbox's width, when there is one on the page. */
  checkboxPx: number | null;
  /** What the unfolded actions cell needed the last time it was on the page, else `null`. */
  unfoldedActionsPx: number | null;
  /** What the cell needed the last time its actions were folded into one menu button, else `null`. */
  foldedActionsPx: number | null;
  /** The width a consumer set for the actions column with `--ivy-data-table-actions-width`, else `null`. */
  configuredActionsPx: number | null;
}

const REM_PX = 16;

export const DEFAULT_PINNED_METRICS: PinnedMetrics = {
  remPx: REM_PX,
  unitPx: DATA_TABLE_SPACING_REM * REM_PX,
  checkboxPx: null,
  unfoldedActionsPx: null,
  foldedActionsPx: null,
  configuredActionsPx: null,
};

/** How many rows are measured: the first ones on screen. The model covers the rest. */
const MEASURED_ROWS = 25;

export const ACTIONS_WIDTH_VAR = "--ivy-data-table-actions-width";

/** `4.32px` or `0.27rem` as px; anything else (a `calc()`, nothing) is not a length this can use. */
export function parseCssLength(value: string, remPx: number): number | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(px|rem)\s*$/i.exec(value);
  if (!match) return null;
  const length = Number(match[1]);
  return match[2].toLowerCase() === "rem" ? length * remPx : length;
}

/**
 * What the widest actions cell on the page needs: the buttons side by side plus the cell's padding.
 * Read from where the buttons sit and not from the cell, whose width is whatever the table handed it:
 * under `table-layout: auto` the spare room is shared out among every column, pinned ones included, so
 * a cell reads wider the more room there is. The buttons do not move with it. Positions are the
 * layout ones (`offsetLeft`, `offsetWidth`) and so ignore a transform, as the container's width does.
 *
 * `null` when there is nothing to measure: no rows on the page, no layout (jsdom, a hidden tab), or a
 * number that cannot be right (not finite, or wider than the table itself).
 */
export function measureActionsWidth(container: HTMLElement): number | null {
  const room = container.clientWidth;
  // No width at all is no layout (jsdom, a hidden tab), and a test that stubs `offsetWidth` on every
  // element would otherwise be believed: 1000 for a button.
  if (!(room > 0)) return null;
  const cells = container.querySelectorAll<HTMLElement>("tbody td[data-pin='end']");
  let widest: number | null = null;

  for (let index = 0, seen = 0; index < cells.length && seen < MEASURED_ROWS; index += 1) {
    const cell = cells[index];
    const group = cell.querySelector<HTMLElement>("[data-slot='data-table-row-actions']");
    if (!group || group.children.length === 0) continue;
    seen += 1;

    let left = Infinity;
    let right = -Infinity;
    for (const child of Array.from(group.children)) {
      if (!(child instanceof HTMLElement) || !(child.offsetWidth > 0)) continue;
      left = Math.min(left, child.offsetLeft);
      right = Math.max(right, child.offsetLeft + child.offsetWidth);
    }
    if (!(right > left)) continue;

    const style = getComputedStyle(cell);
    const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const needed = Math.ceil(right - left + padding);
    if (!Number.isFinite(needed) || needed <= 0) continue;
    if (needed > room) continue;
    widest = Math.max(widest ?? 0, needed);
  }
  return widest;
}

function readCheckboxWidth(container: HTMLElement): number | null {
  const room = container.clientWidth;
  const box = container.querySelector<HTMLElement>("tbody [role='checkbox']");
  // Same guard as the actions: no layout, or a number the table could not hold, is not a measurement.
  return box && room > 0 && box.offsetWidth > 0 && box.offsetWidth < room ? box.offsetWidth : null;
}

function readRemPx(): number {
  const size = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(size) && size > 0 ? size : REM_PX;
}

const sameMetrics = (a: PinnedMetrics, b: PinnedMetrics) =>
  a.remPx === b.remPx &&
  a.unitPx === b.unitPx &&
  a.checkboxPx === b.checkboxPx &&
  a.unfoldedActionsPx === b.unfoldedActionsPx &&
  a.foldedActionsPx === b.foldedActionsPx &&
  a.configuredActionsPx === b.configuredActionsPx;

/**
 * Reads, from the page, the sizes the pinned columns are laid out at, so that what the fit reserves
 * for them is what they take. The table's own model (`estimateStartColumnWidth`,
 * `estimateActionsColumnWidth`) is exact for the library's cells with icon buttons; this is for what
 * it cannot know: a root font size or `--spacing` that is not the default, a checkbox sized by a
 * different density, and above all an action with a text label, which is as wide as its text.
 *
 * It measures after every commit, in a layout effect (before paint), and sets state only when a number
 * changed, so a table that settles renders once more at most. Only layout-derived numbers are read,
 * none of which depends on the room the table was given, so reserving them cannot move them. Fonts
 * that load after the first paint change a label's width without a commit; they are waited for.
 *
 * The widest actions cell is remembered per fold state, because only the state that is on the page can
 * be measured. The state that is not on the page keeps its last measurement: it is the best guess at
 * what it will need, and the first measurement after the table enters that state replaces it.
 */
export function usePinnedMetrics({
  containerRef,
  enabled,
  collapsedRef,
}: {
  /** The table's scroll container: what the cells are measured in and the custom properties resolve on. */
  containerRef: React.RefObject<HTMLElement | null>;
  enabled: boolean;
  /**
   * Whether the actions on the page are folded into one menu button. A ref the table sets while it
   * renders, after the fit that decides it: this hook runs before that fit (its numbers are the
   * fit's input) but measures after the commit, when the ref holds the answer for what is on the page.
   */
  collapsedRef: React.RefObject<boolean>;
}): PinnedMetrics {
  const [metrics, setMetrics] = React.useState<PinnedMetrics>(DEFAULT_PINNED_METRICS);
  const metricsRef = React.useRef(metrics);

  const measure = React.useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const remPx = readRemPx();
    const style = getComputedStyle(container);
    const unit = parseCssLength(style.getPropertyValue("--spacing"), remPx);
    const configured = parseCssLength(style.getPropertyValue(ACTIONS_WIDTH_VAR), remPx);
    const actions = measureActionsWidth(container);

    const previous = metricsRef.current;
    // Only the state that is on the page is measured; the other keeps what it last measured, and a
    // page with no row to measure (one being fetched) leaves both as they were.
    const next: PinnedMetrics = {
      remPx,
      unitPx: unit ?? DATA_TABLE_SPACING_REM * remPx,
      checkboxPx: readCheckboxWidth(container),
      unfoldedActionsPx: collapsedRef.current
        ? previous.unfoldedActionsPx
        : (actions ?? previous.unfoldedActionsPx),
      foldedActionsPx: collapsedRef.current
        ? (actions ?? previous.foldedActionsPx)
        : previous.foldedActionsPx,
      configuredActionsPx: configured,
    };
    if (sameMetrics(previous, next)) return;
    metricsRef.current = next;
    setMetrics(next);
  }, [collapsedRef, containerRef]);

  // No dependency list: the number of rows, the actions they carry and the cells' contents all change
  // with a commit, and a comparison of equal numbers is all that a quiet commit costs.
  React.useLayoutEffect(() => {
    if (enabled) measure();
  });

  React.useEffect(() => {
    if (!enabled) return;
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (!fonts) return;
    let cancelled = false;
    void fonts.ready.then(() => {
      if (!cancelled) measure();
    });
    const onLoaded = () => measure();
    fonts.addEventListener?.("loadingdone", onLoaded);
    return () => {
      cancelled = true;
      fonts.removeEventListener?.("loadingdone", onLoaded);
    };
  }, [enabled, measure]);

  return enabled ? metrics : DEFAULT_PINNED_METRICS;
}
