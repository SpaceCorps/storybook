/**
 * ISO 8601 calendar dates (`yyyy-mm-dd`) as plain strings.
 *
 * Everything here works on local calendar components and never touches `toISOString()`, which
 * converts to UTC and so moves a local midnight to the previous day east of Greenwich.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `"2026-10-23"` as a local-midnight `Date`, or `undefined` for anything that is not a real date. */
export function parseIsoDate(value: string | null | undefined): Date | undefined {
  const match = value ? ISO_DATE.exec(value) : null;
  if (!match) return undefined;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // `new Date(25, ...)` would mean 1925; setFullYear takes the year literally.
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, month - 1, day);

  // `2026-02-30` rolls over to March 2: reject anything that does not survive the round trip.
  const real =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return real ? date : undefined;
}

/** A local `Date` as `yyyy-mm-dd`. */
export function formatIsoDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isIsoDate(value: string | null | undefined): value is string {
  return parseIsoDate(value) !== undefined;
}

/**
 * Turns keystrokes into a partially typed ISO date: digits only, dashes inserted after the year and
 * month. `20261023`, `2026/10/23` and `2026-10-23` all become `2026-10-23`, and a dash is only
 * written once a digit follows it, so Backspace over `2026-1` lands on `2026-` → `2026`, not on a
 * dash that grows straight back.
 */
export function formatTypedDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  return [year, month, day].filter(Boolean).join("-");
}

/** Orders two ISO strings; ISO dates sort lexicographically, which is the point of the format. */
export function compareIsoDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
