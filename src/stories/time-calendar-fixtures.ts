import { calendarColorForKey, type TimeCalendarEvent } from "@/components/ui/time-calendar";

/**
 * Time entries shaped like those of a time-tracking API, and the mapping an app writes to put them
 * on the calendar. Everything here is deterministic (no clock, no random numbers), and the stories
 * pin `now` to {@link NOW}, so a story renders the same today and in a year.
 */

/** Friday 23 October 2026, 14:30, in the machine's own zone (the stories pass no `timeZone`). */
export const NOW = new Date(2026, 9, 23, 14, 30);

/** The day {@link NOW} falls on. */
export const TODAY = "2026-10-23";

/** A logged entry. `date` is the day it started; an `end` at or before `start` is the next day. */
export interface TimeEntry {
  id: number;
  date: string;
  /** `HH:MM`, or empty for an entry that only has hours. */
  start: string;
  /** `HH:MM`, or `null` while the timer runs. */
  end: string | null;
  hours: number;
  timezone: string;
  project: string;
  client: string | null;
  activity: string;
  message: string;
  running: boolean;
  currency: string;
  rate: number;
  amount: number;
}

/**
 * The mapping an app writes: a project keeps its colour. The server's `hours` goes across as it is,
 * running timer included; the calendar lets a running timer follow the clock whatever `hours` says.
 */
export function toEvent(entry: TimeEntry): TimeCalendarEvent<TimeEntry> {
  return {
    id: String(entry.id),
    date: entry.date,
    start: entry.start || undefined,
    end: entry.end ?? undefined,
    hours: entry.hours,
    title: entry.project,
    description: entry.message ? `${entry.activity}: ${entry.message}` : entry.activity,
    color: calendarColorForKey(entry.project),
    running: entry.running,
    meta: entry,
  };
}

const ACME = { project: "Acme Logistik", client: "Acme AB", rate: 1100 } as const;
const FJALLBACKA = {
  project: "Fjällbacka webbplats",
  client: "Fjällbacka Turism",
  rate: 950,
} as const;
const INTERN = { project: "Intern", client: null, rate: 0 } as const;

type Customer = typeof ACME | typeof FJALLBACKA | typeof INTERN;

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

function hoursBetween(start: string, end: string): number {
  const span = toMinutes(end) - toMinutes(start);
  return Math.round(((span <= 0 ? span + 1440 : span) / 60) * 100) / 100;
}

let nextId = 1;

function entry(
  date: string,
  start: string,
  end: string | null,
  customer: Customer,
  activity: string,
  message: string,
  extra: Partial<TimeEntry> = {},
): TimeEntry {
  const hours = end ? hoursBetween(start, end) : 0;
  return {
    id: nextId++,
    date,
    start,
    end,
    hours,
    timezone: "Europe/Stockholm",
    project: customer.project,
    client: customer.client,
    activity,
    message,
    running: end === null,
    currency: "SEK",
    rate: customer.rate,
    amount: Math.round(hours * customer.rate * 100) / 100,
    ...extra,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (day: number) => `2026-10-${pad(day)}`;

/** Day of the week of an October 2026 day, 0 = Sunday. 1 October 2026 is a Thursday. */
const weekdayOf = (day: number) => (4 + day - 1) % 7;

/**
 * October 2026 as the demo script logs it, up to the pinned "now" (Friday the 23rd, 14:30):
 * every weekday has building 08:30 to 12:00 and a meeting at 13:00 for Acme, Mondays add
 * strategizing for Fjällbacka and Fridays building for Intern. On top of that:
 * a week off (12 to 16 October), a day with six entries (8 October), a Saturday session, a
 * night shift that crosses midnight (22 October), an overlap that only exists because the two
 * entries were logged in different time zones (20 October), an entry with only hours (21 October)
 * and a timer that is still running today.
 */
function buildEntries(): TimeEntry[] {
  nextId = 1;
  const entries: TimeEntry[] = [];
  for (let day = 1; day <= 23; day += 1) {
    const weekday = weekdayOf(day);
    if (weekday === 0 || weekday === 6) continue;
    if (day >= 12 && day <= 16) continue;
    const date = isoDay(day);
    if (day === 8) {
      entries.push(
        entry(date, "08:00", "08:45", ACME, "planning", "Sprint planning"),
        entry(date, "09:00", "10:30", ACME, "building", "Route planning API"),
        entry(date, "10:45", "11:15", INTERN, "admin", "Expense reports"),
        entry(date, "11:30", "12:30", FJALLBACKA, "strategizing", "Booking flow"),
        entry(date, "13:30", "15:00", ACME, "building", "Driver app sync"),
        entry(date, "15:15", "16:30", INTERN, "support", "Customer questions"),
      );
      continue;
    }
    entries.push(
      entry(date, "08:30", "12:00", ACME, "building", "Route planning API"),
      entry(date, "13:00", "13:30", ACME, "meeting", "Weekly sync"),
    );
    if (weekday === 1) {
      entries.push(entry(date, "14:00", "16:30", FJALLBACKA, "strategizing", "Content structure"));
    }
    // Today's Intern session would start after the pinned "now", so it is not logged yet.
    if (weekday === 5 && day < 23) {
      entries.push(entry(date, "15:00", "17:00", INTERN, "building", "Internal tools"));
    }
  }

  entries.push(
    entry(isoDay(17), "10:00", "12:00", INTERN, "documentation", "Runbook for the deploy"),
    entry(isoDay(22), "22:00", "02:00", ACME, "on-call", "Night shift for the warehouse launch"),
    entry(isoDay(20), "10:00", "11:00", INTERN, "review", "Pull request review", {
      timezone: "Asia/Tokyo",
    }),
    entry(isoDay(21), "", null, INTERN, "admin", "Quarterly paperwork", {
      hours: 1.5,
      running: false,
      amount: 0,
    }),
    entry(TODAY, "13:45", null, FJALLBACKA, "strategizing", "Navigation concept"),
  );
  return entries;
}

/** The entries behind the Month and Week stories. */
export const DEMO_ENTRIES: readonly TimeEntry[] = buildEntries();

/** {@link DEMO_ENTRIES} mapped for the calendar. */
export const DEMO_EVENTS: readonly TimeCalendarEvent<TimeEntry>[] = DEMO_ENTRIES.map(toEvent);
