import type { Locale } from "date-fns";
import type * as React from "react";

import type { Densities } from "@/types/density";

export type CalendarView = "month" | "week";

/** 0 is Sunday, 1 is Monday. */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** The named palette tokens, minus `black` and `white`, which are not colours an entry can wear. */
export type CalendarColor =
  | "ivy-green"
  | "slate"
  | "gray"
  | "zinc"
  | "neutral"
  | "stone"
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "lime"
  | "green"
  | "emerald"
  | "teal"
  | "cyan"
  | "sky"
  | "blue"
  | "indigo"
  | "violet"
  | "purple"
  | "fuchsia"
  | "pink"
  | "rose";

/** Inclusive `yyyy-mm-dd` bounds. */
export interface DateRange {
  from: string;
  to: string;
}

/**
 * A wall-clock reading in some time zone: the calendar day and the minutes since midnight. This is
 * what "now" is reduced to, so that today and the now-line follow `timeZone` rather than the browser.
 */
export interface CalendarClock {
  date: string;
  minutes: number;
}

export interface TimeCalendarEvent<TMeta = unknown> {
  /** React key and focus identity; must be stable across refetches. */
  id: string;
  /** `yyyy-mm-dd`, the day the entry STARTS. Entries with an invalid date are ignored. */
  date: string;
  /** `HH:MM`, 00:00 to 23:59. Absent means an hours-only entry. */
  start?: string;
  /** `HH:MM`. `end <= start` means the entry ends on the next day. Absent on a running entry means open-ended. */
  end?: string;
  /**
   * Authoritative duration of a finished entry; otherwise it is derived from `start`, `end` and
   * `now`. A running entry without an `end` ignores it and follows the clock like its block does, so
   * an entry mapped straight from an API that reports `hours` for a running timer needs no special case.
   */
  hours?: number;
  /** Chip text (the project). */
  title: string;
  /** Second line and part of the accessible name (the activity and message). */
  description?: string;
  /** Defaults to `slate`. */
  color?: CalendarColor;
  /**
   * A timer that is still going: a dashed bottom edge, "running" in the label, and, unless there is
   * an `end`, an end and a duration that follow `now`. They are measured on the wall clock of
   * `timeZone`, so a timer that spans a daylight-saving change reads an hour off until it stops and
   * the server's own figure replaces it.
   */
  running?: boolean;
  /** Opaque payload handed back to callbacks. */
  meta?: TMeta;
}

/**
 * What `onNavigate` reports: the anchor day, the view, and the visible cells (outside days
 * included) as `range`. `range` is what is on screen; to fetch entries for it, use
 * `getFetchRange(date, view)`, which starts a day earlier so that a night shift that began the evening
 * before the first column still reaches the week view.
 */
export interface TimeCalendarNavigation {
  date: string;
  view: CalendarView;
  range: DateRange;
}

/** Every user-facing string the calendar renders itself. */
export interface TimeCalendarLabels {
  today: string;
  previousMonth: string;
  nextMonth: string;
  previousWeek: string;
  nextWeek: string;
  month: string;
  week: string;
  /** Accessible name of the Month/Week switch. */
  view: string;
  /** The "+N more" button of a month cell. */
  more: (count: number) => string;
  /** The agenda's button that adds an entry to a day. */
  add: string;
  noEntries: string;
  /** Row header of the strip that holds entries without a time. */
  hoursOnly: string;
  /** Screen-reader name of the week grid's gutter column. */
  time: string;
  running: string;
  entries: (count: number) => string;
  /** Appended to a block's name when it ends the next day, for example "ends 02:00 next day". */
  endsNextDay: (end: string) => string;
  continuesFromPreviousDay: string;
  /** For the week title, for example "week 43". */
  weekNumber: (week: number) => string;
  /** For example "08:30 to 12:00". */
  timeRange: (start: string, end: string) => string;
  /** For an open-ended running entry, for example "since 08:30". */
  since: (start: string) => string;
}

export interface TimeCalendarProps<TMeta = unknown> extends Omit<
  React.ComponentProps<"section">,
  "children" | "onChange"
> {
  events: readonly TimeCalendarEvent<TMeta>[];
  view?: CalendarView;
  defaultView?: CalendarView;
  onViewChange?: (view: CalendarView) => void;
  /** Default both; a single entry hides the switch. */
  views?: readonly CalendarView[];
  /** Anchor day (`yyyy-mm-dd`) inside the visible period; also the roving tab stop. */
  date?: string;
  defaultDate?: string;
  /**
   * Every change the user makes to the anchor day or the view: the buttons, the keys, the switch, and
   * a tap on a day in the narrow month (which selects it). Changes the parent makes through `date`
   * or `view` are not reported. `range` is the same while the user moves inside one period, so an
   * app that fetches by range should compare it before fetching again.
   */
  onNavigate?: (next: TimeCalendarNavigation) => void;
  /**
   * Click on an empty cell area, Enter or Space on a cell, a week header click, the agenda's add
   * button. In the narrow month a tap or Enter selects the day (see `onNavigate`) and the agenda's
   * add button is what reports it.
   */
  onDayClick?: (date: string) => void;
  /**
   * Week view: a click on a column reports the time under the pointer, snapped down to
   * `snapMinutes`. Enter or Space on a focused column reports the present on today's column and the
   * first configured hour on any other day, unless `onDayClick` is given too, which Enter or Space
   * then reports to, as it does without `onSlotClick`.
   */
  onSlotClick?: (date: string, time: string) => void;
  onEventClick?: (event: TimeCalendarEvent<TMeta>) => void;
  /** Defaults to 1 (Monday). */
  weekStartsOn?: WeekStart;
  /** Month and weekday names; the same type DatePicker takes. */
  locale?: Locale;
  /**
   * IANA name of the zone the entries' dates and times are in. It decides what "today" is, where the
   * now-line sits, and how far a running entry has got (its duration, total and block all follow the
   * zone's wall clock). Defaults to the browser's zone.
   */
  timeZone?: string;
  /** Omit to tick every 60 s; stories and tests pin it. */
  now?: Date;
  /** Defaults to [6, 22], widened to fit the week's entries. */
  hourRange?: readonly [startHour: number, endHour: number];
  /** Defaults to 15. */
  snapMinutes?: number;
  /** Month cell capacity; the overflow is shown as "+N more". Defaults to 3. */
  maxEventsPerDay?: number;
  /** Defaults to `formatDuration(hours, "hm")`; an app passes its own hours formatter. */
  formatHours?: (hours: number) => string;
  /** Force the narrow layout on or off; by default it follows the measured width. */
  compact?: boolean;
  /** Width in px under which the narrow layout applies. Defaults to 640. */
  compactBelow?: number;
  /** `aria-busy` plus an indeterminate bar; the grid stays visible. */
  loading?: boolean;
  /** Right side of the header. */
  toolbar?: React.ReactNode;
  labels?: Partial<TimeCalendarLabels>;
  /**
   * Falls back to `useDensity()` like every other component. Small is a deliberate trade: its month
   * chips, "+N more" and week blocks are 17px tall (Medium 22px, Large 26px), under the 24px target
   * size of WCAG 2.5.8, in return for more entries on screen. Use Medium or Large where touch or
   * pointing accuracy matters more than density; the narrow layout's rows are larger at every density.
   */
  density?: Densities;
  /** Defaults to 2. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** Height cap of the week scroll area. Defaults to "40rem". */
  maxBodyHeight?: string;
}
