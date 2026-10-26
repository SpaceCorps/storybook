import type { Locale } from "date-fns";

import type { Densities } from "@/types/density";
import { endOfWeek, isoWeekNumber, startOfWeek } from "./calendar-math";
import { formatWeekTitle } from "./format";
import type { CalendarClock, TimeCalendarEvent, TimeCalendarLabels, WeekStart } from "./types";

/** What every view needs besides its own data. The root builds it once per render. */
export interface CalendarViewContext {
  density: Densities;
  labels: TimeCalendarLabels;
  locale?: Locale;
  weekStartsOn: WeekStart;
  /** Today and the time of day in the calendar's time zone. */
  clock: CalendarClock;
  formatHours: (hours: number) => string;
  onEventClick?: (event: TimeCalendarEvent) => void;
  onDayClick?: (date: string) => void;
}

export type HeadingLevel = 2 | 3 | 4 | 5 | 6;

/** One level below `level`, stopping at 6, for the days inside a view. */
export function subHeadingLevel(level: HeadingLevel): HeadingLevel {
  return Math.min(level + 1, 6) as HeadingLevel;
}

/** The week's date range as text, and its ISO number when the week starts on Monday (the only start that has one). */
export function weekTitleParts(
  anchor: string,
  ctx: Pick<CalendarViewContext, "weekStartsOn" | "locale" | "labels">,
): { range: string; week: string | undefined } {
  const range = formatWeekTitle(
    { from: startOfWeek(anchor, ctx.weekStartsOn), to: endOfWeek(anchor, ctx.weekStartsOn) },
    ctx.locale,
  );
  return {
    range,
    week: ctx.weekStartsOn === 1 ? ctx.labels.weekNumber(isoWeekNumber(anchor)) : undefined,
  };
}
