/** Text for the calendar: durations, titles and the English default labels. */

import { format, type Locale } from "date-fns";

import { isValidIsoDate } from "./calendar-math";
import type { DateRange, TimeCalendarLabels } from "./types";

const NBSP = "\u00a0";
const EN_DASH = "\u2013";

const decimalFormats = new Map<string, Intl.NumberFormat>();

function decimalFormat(localeCode: string | undefined): Intl.NumberFormat {
  const key = localeCode ?? "";
  let numberFormat = decimalFormats.get(key);
  if (!numberFormat) {
    const options = { minimumFractionDigits: 1, maximumFractionDigits: 2 };
    try {
      numberFormat = new Intl.NumberFormat(localeCode, options);
    } catch {
      // A malformed locale tag falls back to the default locale rather than throwing mid-render.
      numberFormat = new Intl.NumberFormat(undefined, options);
    }
    decimalFormats.set(key, numberFormat);
  }
  return numberFormat;
}

/**
 * A number of hours as text. `"hm"` rounds to whole minutes: 0 is `0m`, 0.75 is `45m`, 8 is `8h`,
 * 7.5 is `7h 30m` and 2.08 is `2h 05m` (the minutes are zero-padded once there are hours). `"decimal"`
 * writes `7,5 h` in a Swedish locale and `7.5 h` in an English one, with non-breaking spaces so it
 * never wraps. Negative and non-finite values read as zero.
 *
 * The component index exposes this as `formatTrackedHours`.
 */
export function formatDuration(
  hours: number,
  style: "hm" | "decimal" = "hm",
  localeCode?: string,
): string {
  const value = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  if (style === "decimal") {
    return `${decimalFormat(localeCode).format(value).replace(/\s/g, NBSP)}${NBSP}h`;
  }
  const total = Math.round(value * 60);
  const wholeHours = Math.floor(total / 60);
  const minutes = total % 60;
  if (total === 0) return "0m";
  if (wholeHours === 0) return `${minutes}m`;
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${String(minutes).padStart(2, "0")}m`;
}

/**
 * A calendar day as a local `Date` at noon. `format` reads local components, and noon is the one hour
 * no daylight-saving change ever skips, so the day cannot slide to its neighbour.
 */
function dayAtNoon(iso: string): Date {
  if (!isValidIsoDate(iso)) throw new RangeError(`Invalid ISO date: ${JSON.stringify(iso)}`);
  const date = new Date(2000, 0, 1, 12);
  // setFullYear takes the year literally where `new Date(25, ...)` would mean 1925.
  date.setFullYear(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return date;
}

/** `October 2026`. */
export function formatMonthTitle(iso: string, locale?: Locale): string {
  return format(dayAtNoon(iso), "LLLL yyyy", { locale });
}

/** `Friday 23 October 2026`, the accessible name of a day. */
export function formatDayLabel(iso: string, locale?: Locale): string {
  return format(dayAtNoon(iso), "EEEE d MMMM yyyy", { locale });
}

/** `Friday 23 October`, the heading of a day in the agenda. */
export function formatDayHeading(iso: string, locale?: Locale): string {
  return format(dayAtNoon(iso), "EEEE d MMMM", { locale });
}

/** `Mon` or `Monday`, taken from the weekday of `iso`. */
export function formatWeekdayName(iso: string, style: "short" | "long", locale?: Locale): string {
  return format(dayAtNoon(iso), style === "short" ? "EEE" : "EEEE", { locale });
}

/** `19-25 Oct 2026`, `28 Sep - 4 Oct 2026` or `29 Dec 2026 - 4 Jan 2027`, with en dashes. */
export function formatWeekTitle(range: DateRange, locale?: Locale): string {
  const from = dayAtNoon(range.from);
  const to = dayAtNoon(range.to);
  const sameYear = from.getFullYear() === to.getFullYear();
  if (sameYear && from.getMonth() === to.getMonth()) {
    return `${format(from, "d", { locale })}${EN_DASH}${format(to, "d MMM yyyy", { locale })}`;
  }
  const start = format(from, sameYear ? "d MMM" : "d MMM yyyy", { locale });
  return `${start} ${EN_DASH} ${format(to, "d MMM yyyy", { locale })}`;
}

/** The English strings; a `labels` prop overrides any of them. */
export const DEFAULT_CALENDAR_LABELS: TimeCalendarLabels = {
  today: "Today",
  previousMonth: "Previous month",
  nextMonth: "Next month",
  previousWeek: "Previous week",
  nextWeek: "Next week",
  month: "Month",
  week: "Week",
  view: "Calendar view",
  more: (count) => `+${count} more`,
  add: "Add entry",
  noEntries: "No entries",
  hoursOnly: "No time",
  time: "Time",
  running: "running",
  entries: (count) => `${count} ${count === 1 ? "entry" : "entries"}`,
  endsNextDay: (end) => `ends ${end} next day`,
  continuesFromPreviousDay: "continues from previous day",
  weekNumber: (week) => `week ${week}`,
  timeRange: (start, end) => `${start} to ${end}`,
  since: (start) => `since ${start}`,
};

/** The defaults with the caller's overrides laid over them; an `undefined` override keeps the default. */
export function resolveCalendarLabels(overrides?: Partial<TimeCalendarLabels>): TimeCalendarLabels {
  const defined = Object.entries(overrides ?? {}).filter(([, value]) => value !== undefined);
  return {
    ...DEFAULT_CALENDAR_LABELS,
    ...(Object.fromEntries(defined) as Partial<TimeCalendarLabels>),
  };
}
