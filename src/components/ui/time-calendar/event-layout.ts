/**
 * Turning entries into days, totals and positioned blocks.
 *
 * The model matches the server's time log: an entry belongs to the day it STARTS, and an `end` at or
 * before the `start` means it ends the next day. Day totals are therefore keyed by the start date, as
 * the server's per-day report is, while the week view splits a night shift into a tail on its own day
 * and a continuation on the next.
 */

import { diffDays, isValidIsoDate } from "./calendar-math";
import type { CalendarClock, TimeCalendarEvent } from "./types";

const MINUTES_PER_DAY = 1440;

/** `H:MM` or `HH:MM` as minutes since midnight. `24:00`, `9:5` and anything else are rejected. */
export function toMinutes(t: string | undefined): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(t ?? "");
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : undefined;
}

/** Minutes since midnight as `HH:MM`. Values outside 0 to 1439 wrap around midnight, so 1500 is `01:00`. */
export function fromMinutes(m: number): string {
  const wrapped = ((Math.round(m) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const minutes = String(wrapped % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Whether an entry has no usable start time and so belongs in the hours-only strip, not on the clock. */
export function isHoursOnly(ev: Pick<TimeCalendarEvent, "start">): boolean {
  return toMinutes(ev.start) === undefined;
}

export interface EventSpan {
  /** Minutes since midnight of the entry's own date. */
  startMin: number;
  /**
   * Minutes since midnight of the entry's own date, so it is above 1440 once the entry runs into the
   * next day. `undefined` when the end is not known.
   */
  endMin: number | undefined;
  /** The entry ends after midnight of its own date. */
  crossesMidnight: boolean;
}

/**
 * Where an entry sits on its own date's clock, or `null` for an hours-only entry (no usable start).
 * A running entry without an end follows `nowMin`, the minutes between midnight of the entry's date
 * and now; that is above 1440 for an entry that began on an earlier day. An explicit end wins.
 */
export function eventSpan(
  ev: Pick<TimeCalendarEvent, "start" | "end" | "running">,
  nowMin?: number,
): EventSpan | null {
  const startMin = toMinutes(ev.start);
  if (startMin === undefined) return null;
  const end = toMinutes(ev.end);
  if (end !== undefined) {
    const endMin = end <= startMin ? end + MINUTES_PER_DAY : end;
    return { startMin, endMin, crossesMidnight: endMin > MINUTES_PER_DAY };
  }
  if (ev.running && nowMin !== undefined) {
    const endMin = Math.max(nowMin, startMin);
    return { startMin, endMin, crossesMidnight: endMin > MINUTES_PER_DAY };
  }
  return { startMin, endMin: undefined, crossesMidnight: false };
}

/** Minutes from midnight of the entry's date to `now`, which only a running entry needs. */
function minutesUntilNow(
  ev: TimeCalendarEvent,
  now: CalendarClock | undefined,
): number | undefined {
  if (!now || !ev.running || !isValidIsoDate(ev.date) || !isValidIsoDate(now.date))
    return undefined;
  return diffDays(now.date, ev.date) * MINUTES_PER_DAY + now.minutes;
}

/**
 * The entry's duration in hours. A timer that is still running (`running`, with no `end`) follows
 * `now`, because its block does: a server reports `hours` for it too, but only as of the moment it
 * answered, and taking that literally would freeze the figure beside a block that keeps growing.
 * Otherwise `hours` wins when it is given, else what start and end work out to, else 0. A running
 * entry with no clock to follow also falls back to `hours`. Never negative.
 */
export function eventHours(ev: TimeCalendarEvent, now?: CalendarClock): number {
  const span = eventSpan(ev, minutesUntilNow(ev, now));
  const derived =
    span && span.endMin !== undefined ? Math.max(0, (span.endMin - span.startMin) / 60) : undefined;
  if (ev.running === true && toMinutes(ev.end) === undefined && derived !== undefined) {
    return derived;
  }
  if (typeof ev.hours === "number" && Number.isFinite(ev.hours)) return Math.max(0, ev.hours);
  return derived ?? 0;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Timed entries by start, then hours-only entries; ties by title, then id so the order is stable. */
function compareEvents(a: TimeCalendarEvent, b: TimeCalendarEvent): number {
  const startA = toMinutes(a.start);
  const startB = toMinutes(b.start);
  if (startA !== startB) {
    if (startA === undefined) return 1;
    if (startB === undefined) return -1;
    return startA - startB;
  }
  return compareText(a.title, b.title) || compareText(a.id, b.id);
}

/** Entries by the day they start, each day sorted. Entries with an invalid date are left out. */
export function groupByDate<TMeta>(
  events: readonly TimeCalendarEvent<TMeta>[],
): Map<string, TimeCalendarEvent<TMeta>[]> {
  const days = new Map<string, TimeCalendarEvent<TMeta>[]>();
  for (const ev of events) {
    if (!isValidIsoDate(ev.date)) continue;
    const day = days.get(ev.date);
    if (day) day.push(ev);
    else days.set(ev.date, [ev]);
  }
  for (const day of days.values()) day.sort(compareEvents);
  return days;
}

/**
 * Hours per day, keyed by the day an entry starts on. This is how the server attributes a night
 * shift, so the figure agrees with the server's own per-day report.
 */
export function dayTotals(
  events: readonly TimeCalendarEvent[],
  now?: CalendarClock,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const ev of events) {
    if (!isValidIsoDate(ev.date)) continue;
    totals.set(ev.date, (totals.get(ev.date) ?? 0) + eventHours(ev, now));
  }
  return totals;
}

/** The part of an entry that falls on one day, in minutes since that day's midnight (0 to 1440). */
export interface DaySegment {
  id: string;
  startMin: number;
  endMin: number;
  /** The entry began on an earlier day. */
  continued: boolean;
  /** The entry carries on into the next day. */
  continues: boolean;
}

export interface PositionedSegment extends DaySegment {
  /** Zero-based column within its cluster of overlapping segments. */
  col: number;
  /** Columns in the cluster. */
  cols: number;
  /** Columns the block covers, at least 1: it widens into neighbours that are free during its interval. */
  span: number;
  /**
   * Where the block is drawn down to, in minutes since midnight, never before `endMin`. A block is
   * drawn at least `minMinutes` tall, but only into free space: this is `endMin` lifted to
   * `startMin + minMinutes` and then cut at the start of the next block that shares its width. So it is
   * the true end for an entry that is long enough or has a neighbour right below it, and the lifted end
   * for a short entry with room beneath it. `layoutDayEvents` always sets it. Optional so that a
   * position an app builds by hand still draws: `blockStyle` then draws `endMin` and leaves the least
   * height to the CSS `min-height`.
   */
  drawnEndMin?: number;
}

/**
 * The blocks to draw in `date`'s column: entries that start that day (clipped to midnight) and the
 * continuations of entries that started on an earlier day. Hours-only entries are not segments.
 *
 * An entry whose end is not known gets a zero-length block at its start, unless it is running, in
 * which case it follows `now`: a timer left running overnight continues on the next day's column up
 * to the present. Without `now` a running entry has no known end either.
 */
export function segmentsForDay(
  events: readonly TimeCalendarEvent[],
  date: string,
  now?: CalendarClock,
): DaySegment[] {
  if (!isValidIsoDate(date)) return [];
  const segments: DaySegment[] = [];
  for (const ev of events) {
    if (!isValidIsoDate(ev.date)) continue;
    const daysIn = diffDays(date, ev.date);
    if (daysIn < 0) continue;
    const span = eventSpan(ev, minutesUntilNow(ev, now));
    if (!span) continue;
    const endAbs = span.endMin ?? span.startMin + hoursToMinutes(ev.hours);
    const dayStart = daysIn * MINUTES_PER_DAY;
    // The first day always shows the entry, even at zero length; later days only while it still runs.
    if (daysIn > 0 && endAbs <= dayStart) continue;
    segments.push({
      id: ev.id,
      startMin: Math.max(span.startMin - dayStart, 0),
      endMin: Math.min(endAbs - dayStart, MINUTES_PER_DAY),
      continued: daysIn > 0,
      continues: endAbs > dayStart + MINUTES_PER_DAY,
    });
  }
  return segments;
}

function hoursToMinutes(hours: number | undefined): number {
  return typeof hours === "number" && Number.isFinite(hours) && hours > 0
    ? Math.round(hours * 60)
    : 0;
}

interface ClusterItem extends DaySegment {
  /**
   * Where the entry's extent ends, which is what decides whether two entries overlap: its true `endMin`,
   * or for a zero-extent entry (no known end, `endMin <= startMin`) the lifted minimum, `startMin` plus
   * `minMinutes`. See {@link layoutDayEvents}.
   */
  end: number;
  col: number;
}

interface PlacedItem extends ClusterItem {
  cols: number;
  span: number;
}

/**
 * Whether two placed blocks share any of the day column's width. Each covers the fraction
 * `col / cols` to `(col + span) / cols` of it, and `cols` differs between clusters, so the comparison
 * is made on those fractions, cross-multiplied to stay in integers. Touching edges do not share.
 */
function sharesWidth(a: PlacedItem, b: PlacedItem): boolean {
  return a.col * b.cols < (b.col + b.span) * a.cols && b.col * a.cols < (a.col + a.span) * b.cols;
}

/**
 * Packs one day's segments side by side and works out how far down each block is drawn.
 *
 * Columns mean overlap, and only true overlap. Segments whose intervals overlap share a cluster;
 * inside it each takes the first column whose previous occupant has ended (touching is not
 * overlapping), then widens right over columns that are free during its own interval. Entries that
 * touch, or have any gap between them, are always in the same column at full width, whatever
 * `minMinutes` is: the least height of a block is not something an entry occupies.
 *
 * A block is drawn at least `minMinutes` tall (the least height a block has, expressed in minutes of
 * the hour height; one minute when omitted), so that a short entry stays readable and clickable, but
 * only into free space. `drawnEndMin` is the true end lifted to `startMin + minMinutes`, then cut at
 * the smallest `o.startMin` over the other blocks `o` that start at or after this entry's end and
 * share any of its width. Sharing is judged across clusters too (`sharesWidth`), since the entry right
 * below a short one is usually in the next cluster.
 *
 * - The cut never goes below the true end. A block `o` that shares width with this one cannot overlap
 *   it: overlapping blocks are in different columns of one cluster, and a block never widens over a
 *   column that an overlapping block sits in, so their widths are disjoint. So `o` either ends at or
 *   before this entry starts, or starts at or after it ends. Only the second kind cuts, and it cuts at
 *   its own start, which is at or after the end.
 * - Nothing is drawn over anything. Of two blocks that share width, one is above the other, and the
 *   upper one is cut at or above the start of the lower one.
 *
 * An entry with no known end (`endMin <= startMin`, which is what `segmentsForDay` makes of an entry
 * that has only a start) has no true interval to be mistaken for an overlap, and a cut would shrink it
 * to a sliver of about a pixel. It keeps the old rule, and only it does: its extent for overlap
 * purposes is the lifted minimum, `startMin + minMinutes`, so an entry that starts inside that is put
 * beside it, and it is always drawn the whole minimum. Every other entry is judged on its true
 * interval.
 *
 * The positions report the true `startMin` and `endMin`. The output is ordered by start, does not
 * depend on the order of the input, and the input is left alone.
 */
export function layoutDayEvents(input: readonly DaySegment[], minMinutes = 1): PositionedSegment[] {
  const least = Number.isFinite(minMinutes) ? Math.max(minMinutes, 1) : 1;
  // Entries that start in the same minute truly overlap, and which of them takes the left column is
  // decided by how far each is drawn (its end lifted to the least height), longer first, then by id.
  // That is what the layout always did, so a genuine overlap splits as it did; it is the lifted end
  // and not `end`, which is the true one, that keeps two short entries starting together in id order.
  const lifted = (s: ClusterItem) => Math.max(s.end, s.startMin + least);
  const items: ClusterItem[] = input
    .map((s) => ({ ...s, end: s.endMin > s.startMin ? s.endMin : s.startMin + least, col: 0 }))
    .sort((a, b) => a.startMin - b.startMin || lifted(b) - lifted(a) || compareText(a.id, b.id));

  const placed: PlacedItem[] = [];
  let cluster: ClusterItem[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const columnEnds: number[] = [];
    for (const item of cluster) {
      let col = columnEnds.findIndex((end) => end <= item.startMin);
      if (col < 0) {
        col = columnEnds.length;
        columnEnds.push(0);
      }
      columnEnds[col] = item.end;
      item.col = col;
    }
    const cols = columnEnds.length;
    for (const item of cluster) {
      let span = 1;
      while (
        item.col + span < cols &&
        !cluster.some(
          (other) =>
            other !== item &&
            other.col === item.col + span &&
            other.startMin < item.end &&
            other.end > item.startMin,
        )
      ) {
        span++;
      }
      placed.push({ ...item, cols, span });
    }
    cluster = [];
  };

  for (const item of items) {
    if (item.startMin >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();

  // `placed` is ordered by start, so the first block below this one that shares its width is the one
  // that starts soonest, and nothing that starts at or after the lifted end can cut it.
  return placed.map((item, index) => {
    let drawnEnd = Math.max(item.endMin, item.startMin + least);
    for (let next = index + 1; next < placed.length && placed[next].startMin < drawnEnd; next++) {
      const other = placed[next];
      if (other.startMin >= item.end && sharesWidth(item, other)) drawnEnd = other.startMin;
    }
    return {
      id: item.id,
      startMin: item.startMin,
      endMin: item.endMin,
      continued: item.continued,
      continues: item.continues,
      col: item.col,
      cols: item.cols,
      span: item.span,
      drawnEndMin: drawnEnd,
    };
  });
}

/**
 * The hours the week grid spans: `cfg` (clamped to 0 to 24) widened to whole hours that hold every
 * segment of the week. A night shift pulls its day's column down to 24:00 and the next one up to
 * 00:00 for that week only.
 */
export function hourRangeFor(
  segmentsOfWeek: readonly DaySegment[],
  cfg: readonly [number, number],
): [number, number] {
  let start = Math.min(Math.max(Math.floor(cfg[0]), 0), 23);
  let end = Math.min(Math.max(Math.ceil(cfg[1]), start + 1), 24);
  for (const s of segmentsOfWeek) {
    start = Math.min(start, Math.floor(s.startMin / 60));
    // A zero-length block is still drawn one minute tall, which must fit inside the grid.
    end = Math.max(end, Math.ceil(Math.max(s.endMin, s.startMin + 1) / 60));
  }
  return [start, Math.max(end, start + 1)];
}

/**
 * The slot that holds `minutes` since midnight, snapped down to `snap` minutes and kept on the grid
 * the way `slotMinutes` keeps a click on it: before the first hour is the first slot, after the last
 * the last one. For a time of day that is not a pointer position, such as the present.
 */
export function slotAt(minutes: number, range: readonly [number, number], snap: number): number {
  const step = Number.isFinite(snap) && snap >= 1 ? Math.floor(snap) : 1;
  const from = range[0] * 60;
  const total = Math.max(0, (range[1] - range[0]) * 60);
  const offset = Number.isFinite(minutes)
    ? Math.min(Math.max(minutes - from, 0), Math.max(total - 1, 0))
    : 0;
  return from + Math.floor(offset / step) * step;
}

/**
 * The time a click lands on: `ratio` is how far down the grid the pointer is (0 at the top edge, 1 at
 * the bottom), `range` the hours the grid shows, and the answer minutes since midnight, snapped down
 * to `snap` minutes. It never leaves the grid, so a click on the very bottom edge gives the last slot
 * and not the hour after it.
 */
export function slotMinutes(ratio: number, range: readonly [number, number], snap: number): number {
  const step = Number.isFinite(snap) && snap >= 1 ? Math.floor(snap) : 1;
  const total = Math.max(0, (range[1] - range[0]) * 60);
  const clamped = Number.isFinite(ratio) ? Math.min(Math.max(ratio, 0), 1) : 0;
  const slot = Math.min(
    Math.floor((clamped * total) / step),
    Math.max(0, Math.floor((total - 1) / step)),
  );
  return range[0] * 60 + slot * step;
}
