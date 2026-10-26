import { sv } from "date-fns/locale";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import {
  addDays,
  addMonths,
  diffDays,
  endOfMonth,
  endOfWeek,
  getPeriodRange,
  getVisibleRange,
  isoWeekNumber,
  isValidIsoDate,
  monthMatrix,
  nextFocusDate,
  startOfMonth,
  startOfWeek,
  stepPeriod,
  weekDays,
  weekdayOf,
  zonedNow,
} from "../src/components/ui/time-calendar/calendar-math";
import {
  formatDayHeading,
  formatDayLabel,
  formatMonthTitle,
  formatWeekdayName,
  formatWeekTitle,
} from "../src/components/ui/time-calendar/format";
import type { WeekStart } from "../src/components/ui/time-calendar/types";

// A reference calendar built from integer arithmetic alone (Howard Hinnant's civil-from-days), with
// no Date object anywhere. The functions under test read UTC components, so they must agree with it
// in every process time zone; a version that slid into local time would drift under a zone with a
// daylight-saving change at midnight or a large offset.
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(days: number): string {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function refDays(iso: string): number {
  return daysFromCivil(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10)));
}

/** 0 is Sunday; 1970-01-01 (day 0) was a Thursday. */
function refWeekday(iso: string): number {
  return (((refDays(iso) + 4) % 7) + 7) % 7;
}

/** Every day from 2023-12-01 to 2029-01-31, which takes in leap days and every zone's transitions. */
const SAMPLE_DAYS: string[] = [];
for (let n = refDays("2023-12-01"); n <= refDays("2029-01-31"); n++)
  SAMPLE_DAYS.push(civilFromDays(n));

const OFFSETS = [-400, -31, -7, -1, 0, 1, 7, 31, 400];

/** Every disagreement with the reference, as readable lines; one assertion on the list keeps a 20k-check sweep fast. */
function disagreements(): string[] {
  const found: string[] = [];
  const check = (label: string, actual: unknown, expected: unknown) => {
    if (actual !== expected)
      found.push(`${label}: got ${String(actual)}, want ${String(expected)}`);
  };
  for (const day of SAMPLE_DAYS) {
    for (const n of OFFSETS)
      check(`${day} + ${n} days`, addDays(day, n), civilFromDays(refDays(day) + n));
    check(`weekday of ${day}`, weekdayOf(day), refWeekday(day));
  }
  for (let i = 0; i < SAMPLE_DAYS.length; i += 37) {
    for (let j = 0; j < SAMPLE_DAYS.length; j += 211) {
      const [a, b] = [SAMPLE_DAYS[i], SAMPLE_DAYS[j]];
      check(`${a} - ${b}`, diffDays(a, b), refDays(a) - refDays(b));
    }
  }
  for (const ws of [0, 1, 6] as const) {
    for (const day of SAMPLE_DAYS.filter((_, i) => i % 13 === 0)) {
      const start = startOfWeek(day, ws);
      const behind = refDays(day) - refDays(start);
      check(`start of week of ${day} (${ws}) is a ${ws}`, refWeekday(start), ws);
      check(
        `start of week of ${day} (${ws}) is at most 6 days back`,
        behind >= 0 && behind < 7,
        true,
      );
    }
  }
  return found;
}

function expectMatchesReference(): void {
  expect(disagreements()).toEqual([]);
}

describe("process time zone", () => {
  it("is the one requested through EXPECT_TZ, when a run asks for one", () => {
    // `TZ=Pacific/Auckland vp test ...` is easy to get wrong on Windows shells, which drop zone names
    // they do not recognise; set EXPECT_TZ next to TZ and a silent fallback to the local zone fails here.
    const expected = process.env.EXPECT_TZ;
    if (!expected) return;
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(expected);
  });
});

describe("isValidIsoDate", () => {
  it("accepts real calendar dates", () => {
    for (const ok of ["2026-10-23", "2024-02-29", "2000-02-29", "0025-01-01", "2026-12-31"]) {
      expect(isValidIsoDate(ok), ok).toBe(true);
    }
  });

  it("rejects everything else", () => {
    for (const bad of [
      "",
      "2026-13-01",
      "2026-02-30",
      "2026-02-29",
      "1900-02-29",
      "2026-1-5",
      "26-10-23",
      "2026/10/23",
      "2026-10-23T00:00",
      " 2026-10-23",
      "x",
    ]) {
      expect(isValidIsoDate(bad), bad).toBe(false);
    }
  });

  it("throws a RangeError from the arithmetic instead of returning garbage", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
    expect(() => monthMatrix("nope", 1)).toThrow(RangeError);
    expect(() => diffDays("2026-10-23", "")).toThrow(RangeError);
    expect(() => startOfMonth("2026-1-1")).toThrow(RangeError);
  });
});

describe("addDays", () => {
  it("crosses month, year and leap boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-10-23", 0)).toBe("2026-10-23");
  });

  it("is not moved by a daylight-saving change", () => {
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30"); // Europe, clocks forward
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26"); // Europe, clocks back
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09"); // United States
    expect(addDays("2026-09-27", 1)).toBe("2026-09-28"); // New Zealand
    expect(addDays("2018-11-04", 1)).toBe("2018-11-05"); // Brazil, whose DST began at midnight
    expect(addDays("2018-11-03", 1)).toBe("2018-11-04");
  });

  it("keeps years below 100 as written", () => {
    expect(addDays("0025-12-31", 1)).toBe("0026-01-01");
  });
});

describe("addMonths", () => {
  it("clamps the day to the target month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-05-31", 1)).toBe("2026-06-30");
    expect(addMonths("2028-02-29", 12)).toBe("2029-02-28");
    expect(addMonths("2028-02-29", -12)).toBe("2027-02-28");
  });

  it("rolls the year", () => {
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonths("2026-10-23", 15)).toBe("2028-01-23");
    expect(addMonths("2026-10-23", 0)).toBe("2026-10-23");
  });
});

describe("month and week boundaries", () => {
  it("finds the first and last day of a month", () => {
    expect(startOfMonth("2026-10-23")).toBe("2026-10-01");
    expect(endOfMonth("2026-10-23")).toBe("2026-10-31");
    expect(endOfMonth("2026-02-01")).toBe("2026-02-28");
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(endOfMonth("2026-12-31")).toBe("2026-12-31");
  });

  it("finds the week around a day for each first weekday", () => {
    // 2026-10-23 is a Friday.
    expect(weekdayOf("2026-10-23")).toBe(5);
    expect(startOfWeek("2026-10-23", 1)).toBe("2026-10-19");
    expect(endOfWeek("2026-10-23", 1)).toBe("2026-10-25");
    expect(startOfWeek("2026-10-23", 0)).toBe("2026-10-18");
    expect(endOfWeek("2026-10-23", 0)).toBe("2026-10-24");
    expect(startOfWeek("2026-10-23", 6)).toBe("2026-10-17");
    expect(startOfWeek("2026-10-19", 1)).toBe("2026-10-19");
    expect(startOfWeek("2026-10-25", 1)).toBe("2026-10-19");
    expect(startOfWeek("2026-10-25", 0)).toBe("2026-10-25");
  });

  it("counts whole days between two dates, signed", () => {
    expect(diffDays("2026-10-25", "2026-10-23")).toBe(2);
    expect(diffDays("2026-10-23", "2026-10-25")).toBe(-2);
    expect(diffDays("2026-10-23", "2026-10-23")).toBe(0);
    // The day clocks go back is 25 hours long and the one they go forward is 23; both are one day.
    expect(diffDays("2026-10-26", "2026-10-25")).toBe(1);
    expect(diffDays("2026-03-30", "2026-03-29")).toBe(1);
    expect(diffDays("2027-01-01", "2026-01-01")).toBe(365);
    expect(diffDays("2029-01-01", "2028-01-01")).toBe(366);
  });
});

describe("isoWeekNumber", () => {
  it.each([
    ["2026-10-19", 43],
    ["2026-10-25", 43],
    ["2026-10-26", 44],
    ["2026-01-01", 1], // a Thursday: week 1 holds the first Thursday
    ["2025-12-29", 1], // belongs to the next year's week 1
    ["2024-12-30", 1],
    ["2026-12-31", 53],
    ["2027-01-01", 53], // still the previous year's last week
    ["2027-01-03", 53],
    ["2027-01-04", 1],
    ["2021-01-03", 53],
    ["2020-12-31", 53],
    ["2024-12-29", 52],
  ])("%s is week %i", (iso, week) => {
    expect(isoWeekNumber(iso)).toBe(week);
  });
});

describe("monthMatrix", () => {
  const first = (rows: string[][]) => rows[0][0];
  const last = (rows: string[][]) => rows[rows.length - 1][6];

  it("is 5 rows for October 2026, Monday to Sunday", () => {
    const rows = monthMatrix("2026-10-23", 1);
    expect(rows).toHaveLength(5);
    expect(first(rows)).toBe("2026-09-28");
    expect(last(rows)).toBe("2026-11-01");
  });

  it("is 6 rows for November 2026 and 4 for February 2027", () => {
    const november = monthMatrix("2026-11-10", 1);
    expect(november).toHaveLength(6);
    expect(first(november)).toBe("2026-10-26");
    expect(last(november)).toBe("2026-12-06");
    const february = monthMatrix("2027-02-10", 1);
    expect(february).toHaveLength(4);
    expect(first(february)).toBe("2027-02-01");
    expect(last(february)).toBe("2027-02-28");
  });

  it("starts on Sunday when asked to", () => {
    const rows = monthMatrix("2026-10-23", 0);
    expect(rows).toHaveLength(5);
    expect(first(rows)).toBe("2026-09-27");
    expect(last(rows)).toBe("2026-10-31");
  });

  it("is made of consecutive weeks that hold the whole month, for every month and first weekday", () => {
    for (const ws of [0, 1, 2, 3, 4, 5, 6] as WeekStart[]) {
      for (let month = 0; month < 26; month++) {
        const anchor = addMonths("2026-01-15", month);
        const rows = monthMatrix(anchor, ws);
        const days = rows.flat();
        expect(rows.length, `${anchor} ws ${ws}`).toBeGreaterThanOrEqual(4);
        expect(rows.length).toBeLessThanOrEqual(6);
        for (const row of rows) expect(row).toHaveLength(7);
        expect(weekdayOf(first(rows))).toBe(ws);
        for (let i = 1; i < days.length; i++) expect(days[i]).toBe(addDays(days[i - 1], 1));
        expect(days).toContain(startOfMonth(anchor));
        expect(days).toContain(endOfMonth(anchor));
        // No spare week at either end: the first row holds the 1st and the last row the last day.
        expect(rows[0]).toContain(startOfMonth(anchor));
        expect(rows[rows.length - 1]).toContain(endOfMonth(anchor));
      }
    }
  });

  it("lays out a week the same way weekDays does", () => {
    expect(weekDays("2026-10-23", 1)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
    expect(weekDays("2026-10-23", 0)[0]).toBe("2026-10-18");
  });
});

describe("ranges and stepping", () => {
  it("separates what is visible from what the period describes", () => {
    expect(getVisibleRange("2026-10-23", "month")).toEqual({
      from: "2026-09-28",
      to: "2026-11-01",
    });
    expect(getPeriodRange("2026-10-23", "month")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(getVisibleRange("2026-10-23", "week")).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    expect(getPeriodRange("2026-10-23", "week")).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    expect(getVisibleRange("2026-10-23", "week", 0)).toEqual({
      from: "2026-10-18",
      to: "2026-10-24",
    });
    expect(getVisibleRange("2026-10-23", "month", 0)).toEqual({
      from: "2026-09-27",
      to: "2026-10-31",
    });
  });

  it("defaults the first weekday to Monday", () => {
    expect(getVisibleRange("2026-10-23", "week")).toEqual(getVisibleRange("2026-10-23", "week", 1));
    expect(getPeriodRange("2026-10-23", "week")).toEqual(getPeriodRange("2026-10-23", "week", 1));
  });

  it("reports the same range as the matrix it draws", () => {
    for (const anchor of ["2026-10-23", "2026-11-10", "2027-02-10", "2026-03-31"]) {
      const rows = monthMatrix(anchor, 1);
      expect(getVisibleRange(anchor, "month", 1)).toEqual({
        from: rows[0][0],
        to: rows[rows.length - 1][6],
      });
    }
  });

  it("steps a month with the day clamped and a week by seven days", () => {
    expect(stepPeriod("2026-10-23", "month", 1)).toBe("2026-11-23");
    expect(stepPeriod("2026-10-23", "month", -1)).toBe("2026-09-23");
    expect(stepPeriod("2026-01-31", "month", 1)).toBe("2026-02-28");
    expect(stepPeriod("2026-12-15", "month", 1)).toBe("2027-01-15");
    expect(stepPeriod("2026-10-23", "week", 1)).toBe("2026-10-30");
    expect(stepPeriod("2026-10-23", "week", -1)).toBe("2026-10-16");
    expect(stepPeriod("2026-10-28", "week", 1)).toBe("2026-11-04");
  });
});

describe("nextFocusDate", () => {
  const month = (key: string, from: string, shift = false, ws: WeekStart = 1) =>
    nextFocusDate(key, shift, from, "month", ws);
  const week = (key: string, from: string, shift = false, ws: WeekStart = 1) =>
    nextFocusDate(key, shift, from, "week", ws);

  it("moves by day and week in a month", () => {
    expect(month("ArrowRight", "2026-10-23")).toBe("2026-10-24");
    expect(month("ArrowLeft", "2026-10-23")).toBe("2026-10-22");
    expect(month("ArrowDown", "2026-10-23")).toBe("2026-10-30");
    expect(month("ArrowUp", "2026-10-23")).toBe("2026-10-16");
  });

  it("crosses the edge of the month", () => {
    expect(month("ArrowRight", "2026-10-31")).toBe("2026-11-01");
    expect(month("ArrowLeft", "2026-11-01")).toBe("2026-10-31");
    expect(month("ArrowDown", "2026-10-28")).toBe("2026-11-04");
    expect(month("ArrowUp", "2026-11-03")).toBe("2026-10-27");
  });

  it("goes to the ends of the week, by the first weekday", () => {
    expect(month("Home", "2026-10-23")).toBe("2026-10-19");
    expect(month("End", "2026-10-23")).toBe("2026-10-25");
    expect(month("Home", "2026-10-23", false, 0)).toBe("2026-10-18");
    expect(month("End", "2026-10-23", false, 0)).toBe("2026-10-24");
    expect(month("Home", "2026-10-19")).toBe("2026-10-19");
    expect(month("End", "2026-10-25")).toBe("2026-10-25");
  });

  it("pages by month, clamping the day, and by year with Shift", () => {
    expect(month("PageDown", "2026-10-10")).toBe("2026-11-10");
    expect(month("PageUp", "2026-10-10")).toBe("2026-09-10");
    expect(month("PageDown", "2026-01-31")).toBe("2026-02-28");
    expect(month("PageUp", "2026-03-31")).toBe("2026-02-28");
    expect(month("PageDown", "2026-10-10", true)).toBe("2027-10-10");
    expect(month("PageUp", "2026-10-10", true)).toBe("2025-10-10");
    expect(month("PageDown", "2028-02-29", true)).toBe("2029-02-28");
  });

  it("steps by day in a week, and over the edge of it", () => {
    expect(week("ArrowRight", "2026-10-23")).toBe("2026-10-24");
    expect(week("ArrowLeft", "2026-10-23")).toBe("2026-10-22");
    expect(week("ArrowRight", "2026-10-25")).toBe("2026-10-26");
    expect(week("ArrowLeft", "2026-10-19")).toBe("2026-10-18");
  });

  it("goes to the ends of the week and pages by week in a week", () => {
    expect(week("Home", "2026-10-23")).toBe("2026-10-19");
    expect(week("End", "2026-10-23")).toBe("2026-10-25");
    expect(week("PageDown", "2026-10-23")).toBe("2026-10-30");
    expect(week("PageUp", "2026-10-23")).toBe("2026-10-16");
  });

  it("leaves the keys it does not own to the browser", () => {
    expect(week("ArrowUp", "2026-10-23")).toBeNull();
    expect(week("ArrowDown", "2026-10-23")).toBeNull();
    expect(week("PageDown", "2026-10-23", true)).toBeNull();
    for (const key of ["Enter", " ", "Tab", "Escape", "a", "Delete", "arrowleft", ""]) {
      expect(month(key, "2026-10-23"), key).toBeNull();
      expect(week(key, "2026-10-23"), key).toBeNull();
    }
  });
});

describe("zonedNow", () => {
  it("reads the wall clock of the zone it is given", () => {
    expect(zonedNow(new Date("2026-10-25T22:30:00Z"), "Europe/Stockholm")).toEqual({
      date: "2026-10-25",
      minutes: 23 * 60 + 30,
    });
    expect(zonedNow(new Date("2026-10-25T23:30:00Z"), "Europe/Stockholm")).toEqual({
      date: "2026-10-26",
      minutes: 30,
    });
    expect(zonedNow(new Date("2026-10-25T12:00:00Z"), "UTC")).toEqual({
      date: "2026-10-25",
      minutes: 720,
    });
  });

  it("reads midnight as 0, never 24", () => {
    expect(zonedNow(new Date("2026-10-25T00:00:00Z"), "UTC")).toEqual({
      date: "2026-10-25",
      minutes: 0,
    });
    expect(zonedNow(new Date("2026-10-25T23:00:00Z"), "Europe/Stockholm").minutes).toBe(0);
    expect(zonedNow(new Date("2026-10-25T09:00:00Z"), "Pacific/Auckland")).toEqual({
      date: "2026-10-25",
      minutes: 22 * 60,
    });
  });

  it("handles zones that are half an hour off, a day ahead, or a day behind", () => {
    expect(zonedNow(new Date("2026-10-25T00:00:00Z"), "Asia/Kolkata")).toEqual({
      date: "2026-10-25",
      minutes: 5 * 60 + 30,
    });
    expect(zonedNow(new Date("2026-10-25T20:00:00Z"), "Pacific/Kiritimati")).toEqual({
      date: "2026-10-26",
      minutes: 10 * 60,
    });
    expect(zonedNow(new Date("2026-10-25T02:00:00Z"), "Pacific/Pago_Pago")).toEqual({
      date: "2026-10-24",
      minutes: 15 * 60,
    });
  });

  it("follows daylight saving, including the repeated hour", () => {
    // Clocks go back in Stockholm at 01:00 UTC on 2026-10-25: 02:30 happens twice.
    expect(zonedNow(new Date("2026-10-25T00:30:00Z"), "Europe/Stockholm").minutes).toBe(150);
    expect(zonedNow(new Date("2026-10-25T01:30:00Z"), "Europe/Stockholm").minutes).toBe(150);
    expect(zonedNow(new Date("2026-10-25T02:30:00Z"), "Europe/Stockholm").minutes).toBe(210);
    // Brazil's 2018 DST began at local midnight, so the day has no 00:xx.
    expect(zonedNow(new Date("2018-11-04T03:00:00Z"), "America/Sao_Paulo")).toEqual({
      date: "2018-11-04",
      minutes: 60,
    });
  });

  it("reads the machine's own zone without one", () => {
    const at = new Date(2026, 5, 15, 7, 45);
    expect(zonedNow(at)).toEqual({ date: "2026-06-15", minutes: 7 * 60 + 45 });
    const midnight = new Date(2026, 0, 1, 0, 0);
    expect(zonedNow(midnight)).toEqual({ date: "2026-01-01", minutes: 0 });
  });

  it("falls back to the machine's zone for a name it does not know", () => {
    const at = new Date(2026, 5, 15, 7, 45);
    expect(zonedNow(at, "Not/AZone")).toEqual({ date: "2026-06-15", minutes: 7 * 60 + 45 });
  });
});

describe("date text", () => {
  it("writes month titles and day labels", () => {
    expect(formatMonthTitle("2026-10-23")).toBe("October 2026");
    expect(formatMonthTitle("2027-02-01")).toBe("February 2027");
    expect(formatDayLabel("2026-10-23")).toBe("Friday 23 October 2026");
    expect(formatDayLabel("2026-03-29")).toBe("Sunday 29 March 2026");
    expect(formatDayHeading("2026-10-23")).toBe("Friday 23 October");
    expect(formatWeekdayName("2026-10-19", "short")).toBe("Mon");
    expect(formatWeekdayName("2026-10-19", "long")).toBe("Monday");
  });

  it("writes a week title that drops what the two ends share, with en dashes", () => {
    expect(formatWeekTitle({ from: "2026-10-19", to: "2026-10-25" })).toBe("19–25 Oct 2026");
    expect(formatWeekTitle({ from: "2026-09-28", to: "2026-10-04" })).toBe("28 Sep – 4 Oct 2026");
    expect(formatWeekTitle({ from: "2026-12-28", to: "2027-01-03" })).toBe(
      "28 Dec 2026 – 3 Jan 2027",
    );
  });

  it("follows a date-fns locale", () => {
    expect(formatMonthTitle("2026-10-23", sv)).toBe("oktober 2026");
    expect(formatDayLabel("2026-10-23", sv)).toBe("fredag 23 oktober 2026");
    expect(formatWeekdayName("2026-10-19", "short", sv)).toBe("mån");
  });

  it("refuses a date that is not real", () => {
    expect(() => formatDayLabel("2026-02-30")).toThrow(RangeError);
    expect(() => formatMonthTitle("")).toThrow(RangeError);
  });
});

// The process time zone is a global, so these run one after another in a file of their own worker,
// and each restores what it found. Where the runtime cannot change zone at run time (a worker thread
// shares the parent's) the suite is skipped rather than passing without proving anything.
const ZONES = [
  "UTC",
  "Pacific/Auckland",
  "America/Sao_Paulo",
  "Europe/Stockholm",
  "America/Los_Angeles",
  "Pacific/Kiritimati",
] as const;

function canSwitchZone(): boolean {
  const original = process.env.TZ;
  try {
    process.env.TZ = "Pacific/Auckland";
    return Intl.DateTimeFormat().resolvedOptions().timeZone === "Pacific/Auckland";
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
}

describe.skipIf(!canSwitchZone())("independent of the process time zone", () => {
  describe.each(ZONES)("in %s", (zone) => {
    const original = process.env.TZ;

    beforeAll(() => {
      process.env.TZ = zone;
    });

    afterAll(() => {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    });

    it("really runs in that zone", () => {
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
    });

    it("adds days, finds weekdays and counts differences like the integer reference", () => {
      expectMatchesReference();
    });

    it("builds the same month grid and week", () => {
      expect(monthMatrix("2026-10-23", 1).flat()).toHaveLength(35);
      expect(monthMatrix("2026-10-23", 1)[0][0]).toBe("2026-09-28");
      expect(getVisibleRange("2026-11-10", "month")).toEqual({
        from: "2026-10-26",
        to: "2026-12-06",
      });
      expect(weekDays("2026-03-29", 1)[6]).toBe("2026-03-29");
      expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
      expect(isoWeekNumber("2026-10-19")).toBe(43);
    });

    it("labels the right day", () => {
      expect(formatDayLabel("2026-03-29")).toBe("Sunday 29 March 2026");
      expect(formatDayLabel("2026-10-25")).toBe("Sunday 25 October 2026");
      expect(formatWeekdayName("2018-11-04", "long")).toBe("Sunday");
      expect(formatMonthTitle("2026-12-31")).toBe("December 2026");
    });

    it("reads an explicit zone the same wherever the process runs", () => {
      expect(zonedNow(new Date("2026-10-25T23:30:00Z"), "Europe/Stockholm")).toEqual({
        date: "2026-10-26",
        minutes: 30,
      });
    });

    it("reads the machine's zone as that zone", () => {
      const probe = new Date("2026-06-15T12:00:00Z");
      const clock = zonedNow(probe);
      const formatted = new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(probe);
      expect(clock.date).toBe(formatted);
    });
  });
});

describe("the integer reference itself", () => {
  it("agrees with known dates, so the comparison above means something", () => {
    expect(civilFromDays(0)).toBe("1970-01-01");
    expect(civilFromDays(refDays("2026-10-23"))).toBe("2026-10-23");
    expect(refWeekday("1970-01-01")).toBe(4);
    expect(refWeekday("2026-10-23")).toBe(5);
    expect(refWeekday("2024-02-29")).toBe(4);
    expect(civilFromDays(refDays("2028-02-28") + 1)).toBe("2028-02-29");
  });

  it("holds in the zone this run started in", () => {
    expectMatchesReference();
  });
});
