import type { CalendarColor } from "./types";

/** The palette an entry can wear: the named colour tokens without `black` and `white`. */
export const CALENDAR_COLORS = [
  "ivy-green",
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
] as const satisfies readonly CalendarColor[];

/**
 * What `calendarColorForKey` picks from: twelve colours that stay apart at a glance. `ivy-green` is
 * left out because its bar is only 2:1 against a white page, and the five greys because neighbouring
 * projects would be indistinguishable.
 */
export const CALENDAR_PALETTE = [
  "blue",
  "green",
  "orange",
  "violet",
  "teal",
  "rose",
  "amber",
  "indigo",
  "lime",
  "fuchsia",
  "sky",
  "red",
] as const satisfies readonly CalendarColor[];

/** 32-bit FNV-1a over the code points of `text`. */
function fnv1a(text: string): number {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/**
 * A stable colour for a key such as a project name, so the same project is the same colour on every
 * visit and for every user. Case, surrounding spaces and Unicode normalisation do not matter.
 */
export function calendarColorForKey(
  key: string,
  palette: readonly CalendarColor[] = CALENDAR_PALETTE,
): CalendarColor {
  if (palette.length === 0) return "slate";
  return palette[fnv1a(key.normalize("NFC").trim().toLowerCase()) % palette.length];
}
