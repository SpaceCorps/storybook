/** The last minute of a day: `23:59`. A time of day is `0..LAST_MINUTE`; `24:00` does not exist. */
const LAST_MINUTE = 24 * 60 - 1;

/** Where the arrow keys start from in an empty field, unless `min` says otherwise. */
export const DEFAULT_START_TIME = "09:00";

export interface TimeBounds {
  /** Earliest allowed time, `HH:MM`. */
  min?: string;
  /** Latest allowed time, `HH:MM`. */
  max?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Minutes since midnight as `HH:MM`, clamped to `00:00..23:59`. */
export function minutesToTime(minutes: number): string {
  const whole = Math.min(LAST_MINUTE, Math.max(0, Math.round(minutes)));
  return `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}`;
}

/** Minutes since midnight for a strict `HH:MM` (24-hour), or `null` for anything else. */
export function timeToMinutes(value: string | null | undefined): number | null {
  const match = value ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * The `HH:MM` of a time that carries seconds (`09:30:00`, `09:30:15.250`), which is how a database
 * `TIME` column or a time library serialises one. Anything else, a plain `HH:MM` included, comes
 * back untouched, so a value that is not a time stays visibly wrong instead of being guessed at.
 */
export function normalizeTimeValue(value: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d):[0-5]\d(?:\.\d+)?$/.exec(value);
  return match ? `${match[1]}:${match[2]}` : value;
}

const collapse = (raw: string) => raw.trim().replace(/\s+/g, " ");

/**
 * Reads what a person types into `HH:MM`, or `null` when it is not a time. Colon, dot, comma and
 * space all separate hours from minutes, and digits alone are enough: `9` is 09:00, `930` and
 * `0930` are 09:30. There is no AM/PM and `24:00` is not a time.
 */
export function parseTimeText(raw: string): string | null {
  const text = collapse(raw);
  let match: RegExpExecArray | null;
  let hours: number;
  let minutes: number;
  if ((match = /^(\d{1,2})[:.,\s](\d{1,2})$/.exec(text))) {
    hours = Number(match[1]);
    minutes = Number(match[2]);
  } else if ((match = /^(\d{1,2})$/.exec(text))) {
    hours = Number(match[1]);
    minutes = 0;
  } else if ((match = /^(\d)(\d{2})$/.exec(text))) {
    hours = Number(match[1]);
    minutes = Number(match[2]);
  } else if ((match = /^(\d{2})(\d{2})$/.exec(text))) {
    hours = Number(match[1]);
    minutes = Number(match[2]);
  } else {
    return null;
  }
  return hours > 23 || minutes > 59 ? null : `${pad(hours)}:${pad(minutes)}`;
}

/**
 * True once the text can no longer grow into a different time, so it may be committed while the
 * person is still in the field. `1230` is complete but `123` is not: it is on its way to `12:30`
 * and must not flash `01:23` on the way.
 */
export function isCompleteTimeText(raw: string): boolean {
  const text = collapse(raw);
  return /^\d{1,2}[:.,\s]\d{2}$/.test(text) || /^\d{4}$/.test(text);
}

/**
 * True for an hour and its separator (`9:`, `09.`), where the minutes are still to come. Such text
 * is not a time yet, but it is not wrong either.
 */
export function isUnfinishedTimeText(raw: string): boolean {
  return /^\d{1,2}[:.,]$/.test(collapse(raw));
}

function boundsInMinutes({ min, max }: TimeBounds): [lo: number, hi: number] {
  return [timeToMinutes(min) ?? 0, timeToMinutes(max) ?? LAST_MINUTE];
}

/** Whether `time` is a real `HH:MM` inside `min..max` (both ends allowed). */
export function isTimeWithin(time: string, bounds: TimeBounds = {}): boolean {
  const minutes = timeToMinutes(time);
  if (minutes === null) return false;
  const [lo, hi] = boundsInMinutes(bounds);
  return minutes >= lo && minutes <= hi;
}

const clampMinutes = (minutes: number, [lo, hi]: [number, number]) =>
  Math.min(Math.max(minutes, lo), hi);

/** The time an empty field takes on its first arrow press: `min`, else 09:00, held inside `max`. */
export function startTime(bounds: TimeBounds = {}): string {
  const range = boundsInMinutes(bounds);
  const start = timeToMinutes(bounds.min) ?? timeToMinutes(DEFAULT_START_TIME)!;
  return minutesToTime(clampMinutes(start, range));
}

const wholeMinutes = (step: number) => (Number.isFinite(step) && step >= 1 ? Math.round(step) : 1);

/**
 * One arrow-key step: to the next (`1`) or previous (`-1`) multiple of `step` minutes, so 09:10
 * with a 15 minute step goes up to 09:15 and down to 09:00. Stops at `min`, `max` and the ends of
 * the day instead of wrapping. An empty or unreadable `current` yields the start time.
 */
export function stepTime(
  current: string | null | undefined,
  direction: 1 | -1,
  step: number,
  bounds: TimeBounds = {},
): string {
  const minutes = timeToMinutes(current);
  if (minutes === null) return startTime(bounds);
  const size = wholeMinutes(step);
  const next =
    direction === 1
      ? (Math.floor(minutes / size) + 1) * size
      : (Math.ceil(minutes / size) - 1) * size;
  return minutesToTime(clampMinutes(next, boundsInMinutes(bounds)));
}

/** Moves a time by a plain number of minutes (PageUp/PageDown), clamped like {@link stepTime}. */
export function shiftTime(
  current: string | null | undefined,
  deltaMinutes: number,
  bounds: TimeBounds = {},
): string {
  const minutes = timeToMinutes(current);
  if (minutes === null) return startTime(bounds);
  return minutesToTime(clampMinutes(minutes + deltaMinutes, boundsInMinutes(bounds)));
}

/** Every multiple of `step` minutes from 00:00 that lies inside `min..max`. */
export function timeOptions(step: number, bounds: TimeBounds = {}): string[] {
  const [lo, hi] = boundsInMinutes(bounds);
  const size = wholeMinutes(step);
  const options: string[] = [];
  for (let minutes = Math.ceil(lo / size) * size; minutes <= hi; minutes += size) {
    options.push(minutesToTime(minutes));
  }
  return options;
}

/** The index of the option closest to `target` minutes; the earlier one wins a tie. */
export function nearestTimeIndex(options: readonly string[], target: number): number {
  let best = 0;
  let bestDistance = Infinity;
  options.forEach((option, index) => {
    const distance = Math.abs((timeToMinutes(option) ?? 0) - target);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}
