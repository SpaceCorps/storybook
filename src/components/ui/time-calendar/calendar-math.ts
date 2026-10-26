/**
 * Calendar arithmetic on `yyyy-mm-dd` strings.
 *
 * Every function reads and writes UTC components, so the answers do not depend on the process time
 * zone and a daylight-saving change cannot add or drop an hour from a day. Nothing here touches local
 * time except `zonedNow`, which exists to ask what the wall clock says somewhere.
 *
 * A string that is not a real calendar date throws a `RangeError`; check with `isValidIsoDate` first
 * when the value comes from a prop.
 */

import type { CalendarClock, CalendarView, DateRange, WeekStart } from "./types";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MS_PER_DAY = 86_400_000;

/** Midnight UTC of `iso`, or `null` when it is not a real date (`2026-02-30` rolls over, so it fails the round trip). */
function parseIso(iso: string): Date | null {
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // `Date.UTC(25, ...)` would mean 1925; setUTCFullYear takes the year literally.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? date : null;
}

function requireIso(iso: string): Date {
  const date = parseIso(iso);
  if (!date) throw new RangeError(`Invalid ISO date: ${JSON.stringify(iso)}`);
  return date;
}

function formatIso(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Whether `iso` is a real `yyyy-mm-dd` calendar date. */
export function isValidIsoDate(iso: string): boolean {
  return parseIso(iso) !== null;
}

export function addDays(iso: string, n: number): string {
  const date = requireIso(iso);
  date.setUTCDate(date.getUTCDate() + n);
  return formatIso(date);
}

/** Moves by whole months and clamps the day: 2026-01-31 plus one month is 2026-02-28. */
export function addMonths(iso: string, n: number): string {
  const date = requireIso(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + n);
  const daysInMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, daysInMonth));
  return formatIso(date);
}

export function startOfMonth(iso: string): string {
  requireIso(iso);
  return `${iso.slice(0, 8)}01`;
}

export function endOfMonth(iso: string): string {
  return addDays(addMonths(startOfMonth(iso), 1), -1);
}

/** 0 is Sunday. */
export function weekdayOf(iso: string): number {
  return requireIso(iso).getUTCDay();
}

export function startOfWeek(iso: string, weekStartsOn: WeekStart): string {
  return addDays(iso, -((weekdayOf(iso) - weekStartsOn + 7) % 7));
}

export function endOfWeek(iso: string, weekStartsOn: WeekStart): string {
  return addDays(startOfWeek(iso, weekStartsOn), 6);
}

/** Whole days from `b` to `a`, so `diffDays("2026-10-25", "2026-10-23")` is 2. */
export function diffDays(a: string, b: string): number {
  return Math.round((requireIso(a).getTime() - requireIso(b).getTime()) / MS_PER_DAY);
}

/** ISO 8601 week number: weeks start on Monday and week 1 holds the year's first Thursday. */
export function isoWeekNumber(iso: string): number {
  const thursday = addDays(iso, 3 - ((weekdayOf(iso) + 6) % 7));
  const jan4 = `${thursday.slice(0, 4)}-01-04`;
  const firstThursday = addDays(jan4, 3 - ((weekdayOf(jan4) + 6) % 7));
  return 1 + diffDays(thursday, firstThursday) / 7;
}

/** The rows of a month grid, each a week of seven days, outside days included: 4 to 6 rows. */
export function monthMatrix(anchor: string, weekStartsOn: WeekStart): string[][] {
  const first = startOfMonth(anchor);
  const lastRowStart = startOfWeek(endOfMonth(anchor), weekStartsOn);
  const rows: string[][] = [];
  for (
    let start = startOfWeek(first, weekStartsOn);
    start <= lastRowStart;
    start = addDays(start, 7)
  ) {
    rows.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }
  return rows;
}

/** The seven days of the week that holds `anchor`. */
export function weekDays(anchor: string, weekStartsOn: WeekStart): string[] {
  const start = startOfWeek(anchor, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Every cell on screen. A month includes the outside days that pad its first and last week. */
export function getVisibleRange(
  anchor: string,
  view: CalendarView,
  weekStartsOn: WeekStart = 1,
): DateRange {
  if (view === "week")
    return { from: startOfWeek(anchor, weekStartsOn), to: endOfWeek(anchor, weekStartsOn) };
  return {
    from: startOfWeek(startOfMonth(anchor), weekStartsOn),
    to: endOfWeek(endOfMonth(anchor), weekStartsOn),
  };
}

/**
 * What an app fetches to fill the calendar: the visible range plus the day before it. The week view
 * draws the tail of an entry that started the evening before its first column, and only entries it
 * is given can be drawn, so a night shift that began on the day before `from` has to be in the
 * fetch. (A timer left running for days is the app's own to add; it is not bounded by any range.)
 */
export function getFetchRange(
  anchor: string,
  view: CalendarView,
  weekStartsOn: WeekStart = 1,
): DateRange {
  const visible = getVisibleRange(anchor, view, weekStartsOn);
  return { from: addDays(visible.from, -1), to: visible.to };
}

/** The period the title and totals describe: the month proper, or the week. */
export function getPeriodRange(
  anchor: string,
  view: CalendarView,
  weekStartsOn: WeekStart = 1,
): DateRange {
  if (view === "week") return getVisibleRange(anchor, "week", weekStartsOn);
  return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
}

/** The anchor after the previous (-1) or next (1) button. */
export function stepPeriod(anchor: string, view: CalendarView, dir: -1 | 1): string {
  return view === "month" ? addMonths(anchor, dir) : addDays(anchor, 7 * dir);
}

/**
 * Where a key moves the focused day, or `null` when the key means nothing in this view. The caller
 * should ignore events with Ctrl, Alt or Meta held and only `preventDefault` when this returns a date.
 *
 * Month: arrows step a day or a week, Home and End go to the ends of the week, PageUp and PageDown
 * a month (the day clamps), and Shift with them a year. Week: left and right step a day, Home and End
 * go to the ends of the week, and PageUp and PageDown a week. Up and down stay unhandled so the tall
 * day column scrolls natively, and Shift with the page keys means nothing there.
 */
export function nextFocusDate(
  key: string,
  shift: boolean,
  from: string,
  view: CalendarView,
  weekStartsOn: WeekStart,
): string | null {
  switch (key) {
    case "ArrowLeft":
      return addDays(from, -1);
    case "ArrowRight":
      return addDays(from, 1);
    case "ArrowUp":
      return view === "month" ? addDays(from, -7) : null;
    case "ArrowDown":
      return view === "month" ? addDays(from, 7) : null;
    case "Home":
      return startOfWeek(from, weekStartsOn);
    case "End":
      return endOfWeek(from, weekStartsOn);
    case "PageUp":
    case "PageDown": {
      const dir = key === "PageUp" ? -1 : 1;
      if (view === "month") return addMonths(from, shift ? 12 * dir : dir);
      return shift ? null : addDays(from, 7 * dir);
    }
    default:
      return null;
  }
}

const zoneFormats = new Map<string, Intl.DateTimeFormat>();

function zoneFormat(timeZone: string | undefined): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    // `h23` and not `hour12: false`: the latter prints midnight as 24 in some engines.
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  };
  if (timeZone === undefined) return new Intl.DateTimeFormat("en-US", options);
  let format = zoneFormats.get(timeZone);
  if (!format) {
    try {
      format = new Intl.DateTimeFormat("en-US", options);
    } catch {
      // An unknown zone name is a configuration slip, not a reason to break the calendar.
      return new Intl.DateTimeFormat("en-US", { ...options, timeZone: undefined });
    }
    zoneFormats.set(timeZone, format);
  }
  return format;
}

/**
 * The calendar day and minutes since midnight that the wall clock in `timeZone` reads at `now`.
 * Without a zone it reads the machine's own.
 */
export function zonedNow(now: Date, timeZone?: string): CalendarClock {
  const parts: Record<string, string> = {};
  for (const part of zoneFormat(timeZone).formatToParts(now)) parts[part.type] = part.value;
  return {
    date: `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`,
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  };
}
