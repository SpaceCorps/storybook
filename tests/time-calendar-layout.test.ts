import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { NAMED_COLORS } from "../src/stories/colors.stories.tsx";
import {
  CALENDAR_COLORS,
  CALENDAR_PALETTE,
  calendarColorForKey,
} from "../src/components/ui/time-calendar/colors";
import {
  dayTotals,
  eventHours,
  eventSpan,
  fromMinutes,
  groupByDate,
  hourRangeFor,
  isHoursOnly,
  layoutDayEvents,
  segmentsForDay,
  slotAt,
  slotMinutes,
  toMinutes,
  type DaySegment,
  type PositionedSegment,
} from "../src/components/ui/time-calendar/event-layout";
import { getFetchRange, getVisibleRange } from "../src/components/ui/time-calendar/calendar-math";
import {
  MIN_BLOCK_REM,
  TIGHT_HEADROOM_EM,
  blockFit,
  blockStyle,
  minBlockMinutes,
  tightBlockMinutes,
} from "../src/components/ui/time-calendar/event-button";
import {
  DEFAULT_CALENDAR_LABELS,
  formatDuration,
  resolveCalendarLabels,
} from "../src/components/ui/time-calendar/format";
import {
  EVENT_COLOR_CLASSES,
  chipTimeVariant,
  eventChipVariant,
  eventDotVariant,
  eventRowVariant,
  timeCalendarVariant,
  weekBlockTitleVariant,
  weekBlockVariant,
} from "../src/components/ui/time-calendar/time-calendar-variant";
import type { CalendarClock, TimeCalendarEvent } from "../src/components/ui/time-calendar/types";
import { Densities } from "../src/types/density";
import { readCssInlined } from "./read-css.ts";

const NBSP = "\u00a0";

function ev(partial: Partial<TimeCalendarEvent> & { id: string }): TimeCalendarEvent {
  return { date: "2026-10-23", title: partial.id, ...partial };
}

describe("process time zone", () => {
  it("is the one requested through EXPECT_TZ, when a run asks for one", () => {
    const expected = process.env.EXPECT_TZ;
    if (!expected) return;
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(expected);
  });
});

describe("toMinutes and fromMinutes", () => {
  it.each([
    ["00:00", 0],
    ["09:30", 570],
    ["9:30", 570],
    ["12:00", 720],
    ["23:59", 1439],
  ])("reads %s as %i minutes", (text, minutes) => {
    expect(toMinutes(text)).toBe(minutes);
  });

  it.each([
    "24:00",
    "9:5",
    "09:60",
    "9",
    "0930",
    "",
    " 09:30",
    "09:30:00",
    "ab:cd",
    "-1:00",
    "9:3",
  ])("rejects %j", (text) => {
    expect(toMinutes(text)).toBeUndefined();
  });

  it("rejects a missing value", () => {
    expect(toMinutes(undefined)).toBeUndefined();
  });

  it("writes minutes as HH:MM and wraps around midnight", () => {
    expect(fromMinutes(0)).toBe("00:00");
    expect(fromMinutes(570)).toBe("09:30");
    expect(fromMinutes(1439)).toBe("23:59");
    expect(fromMinutes(1440)).toBe("00:00");
    expect(fromMinutes(1500)).toBe("01:00");
    expect(fromMinutes(-60)).toBe("23:00");
    expect(fromMinutes(90.4)).toBe("01:30");
  });

  it("round-trips every minute of the day", () => {
    for (let m = 0; m < 1440; m++) expect(toMinutes(fromMinutes(m))).toBe(m);
  });
});

describe("eventSpan", () => {
  it("places a plain entry", () => {
    expect(eventSpan({ start: "09:00", end: "10:30" })).toEqual({
      startMin: 540,
      endMin: 630,
      crossesMidnight: false,
    });
  });

  it("reads an end at or before the start as the next day", () => {
    expect(eventSpan({ start: "22:00", end: "02:00" })).toEqual({
      startMin: 1320,
      endMin: 1560,
      crossesMidnight: true,
    });
    expect(eventSpan({ start: "09:00", end: "09:00" })).toEqual({
      startMin: 540,
      endMin: 1980,
      crossesMidnight: true,
    });
    // Ending exactly at midnight is the end of the day, not a second day.
    expect(eventSpan({ start: "22:00", end: "00:00" })).toEqual({
      startMin: 1320,
      endMin: 1440,
      crossesMidnight: false,
    });
  });

  it("is null for an entry without a usable start", () => {
    expect(eventSpan({})).toBeNull();
    expect(eventSpan({ end: "10:00" })).toBeNull();
    expect(eventSpan({ start: "24:00", end: "10:00" })).toBeNull();
    expect(eventSpan({ start: "9:5" })).toBeNull();
  });

  it("leaves the end unknown when there is none to follow", () => {
    expect(eventSpan({ start: "09:00" })).toEqual({
      startMin: 540,
      endMin: undefined,
      crossesMidnight: false,
    });
    expect(eventSpan({ start: "09:00", end: "25:00" })?.endMin).toBeUndefined();
    expect(eventSpan({ start: "09:00", running: true })?.endMin).toBeUndefined();
    // Only a running entry follows the clock.
    expect(eventSpan({ start: "09:00" }, 700)?.endMin).toBeUndefined();
  });

  it("makes a running entry follow now, never ending before it started", () => {
    expect(eventSpan({ start: "09:00", running: true }, 600)).toEqual({
      startMin: 540,
      endMin: 600,
      crossesMidnight: false,
    });
    expect(eventSpan({ start: "09:00", running: true }, 500)?.endMin).toBe(540);
    expect(eventSpan({ start: "09:00", running: true }, -600)?.endMin).toBe(540);
    expect(eventSpan({ start: "22:00", running: true }, 1530)).toEqual({
      startMin: 1320,
      endMin: 1530,
      crossesMidnight: true,
    });
  });

  it("lets an explicit end win over a running flag", () => {
    expect(eventSpan({ start: "09:00", end: "11:00", running: true }, 700)?.endMin).toBe(660);
  });
});

describe("isHoursOnly", () => {
  it("is true without a usable start and false with one", () => {
    expect(isHoursOnly({})).toBe(true);
    expect(isHoursOnly({ start: "" })).toBe(true);
    expect(isHoursOnly({ start: "24:00" })).toBe(true);
    expect(isHoursOnly({ start: "9:5" })).toBe(true);
    expect(isHoursOnly({ start: "00:00" })).toBe(false);
    expect(isHoursOnly({ start: "9:30" })).toBe(false);
  });

  it("is exactly the entries that never become segments or spans", () => {
    for (const start of [undefined, "", "24:00", "9:5", "00:00", "09:30", "23:59"]) {
      const entry = ev({ id: "a", start, end: "10:00" });
      expect(isHoursOnly(entry)).toBe(eventSpan(entry) === null);
      expect(segmentsForDay([entry], entry.date).length === 0).toBe(isHoursOnly(entry));
    }
  });
});

describe("eventHours", () => {
  const now: CalendarClock = { date: "2026-10-23", minutes: 14 * 60 + 30 };

  it("takes `hours` when given, even against the times", () => {
    expect(eventHours(ev({ id: "a", hours: 2.5, start: "09:00", end: "10:00" }))).toBe(2.5);
    expect(eventHours(ev({ id: "a", hours: 0, start: "09:00", end: "10:00" }))).toBe(0);
    expect(eventHours(ev({ id: "a", hours: 2 }))).toBe(2);
  });

  it("never goes negative or non-finite", () => {
    expect(eventHours(ev({ id: "a", hours: -1 }))).toBe(0);
    expect(eventHours(ev({ id: "a", hours: Number.NaN, start: "09:00", end: "10:00" }))).toBe(1);
    expect(eventHours(ev({ id: "a", hours: Number.POSITIVE_INFINITY }))).toBe(0);
  });

  it("works it out from start and end", () => {
    expect(eventHours(ev({ id: "a", start: "08:30", end: "12:00" }))).toBe(3.5);
    expect(eventHours(ev({ id: "a", start: "22:00", end: "02:00" }))).toBe(4);
    expect(eventHours(ev({ id: "a", start: "09:00", end: "09:00" }))).toBe(24);
  });

  it("is zero when there is nothing to work it out from", () => {
    expect(eventHours(ev({ id: "a" }))).toBe(0);
    expect(eventHours(ev({ id: "a", start: "09:00" }))).toBe(0);
    expect(eventHours(ev({ id: "a", start: "09:00", running: true }))).toBe(0);
  });

  it("measures a running entry up to now", () => {
    expect(eventHours(ev({ id: "a", start: "13:00", running: true }), now)).toBe(1.5);
  });

  it("measures a running entry across midnight", () => {
    const started = ev({ id: "a", date: "2026-10-22", start: "22:00", running: true });
    expect(eventHours(started, { date: "2026-10-23", minutes: 90 })).toBe(3.5);
  });

  it("gives a running entry that starts after now no duration", () => {
    expect(
      eventHours(ev({ id: "a", date: "2026-10-24", start: "08:00", running: true }), now),
    ).toBe(0);
    expect(eventHours(ev({ id: "a", start: "15:00", running: true }), now)).toBe(0);
  });

  it("does not follow the clock unless it is running", () => {
    expect(eventHours(ev({ id: "a", start: "13:00" }), now)).toBe(0);
  });

  it("keeps a running entry on the clock even when the server sent `hours` for it", () => {
    // The API reports elapsed time as of the fetch for a running entry too. Taken literally it would
    // freeze beside a block that keeps growing, so the clock wins while the timer runs.
    const running = ev({ id: "a", start: "13:00", running: true, hours: 0.25 });
    expect(eventHours(running, now)).toBe(1.5);
    expect(eventHours(running, { ...now, minutes: 17 * 60 })).toBe(4);
    expect(dayTotals([running], now).get("2026-10-23")).toBe(1.5);
    const overnight = ev({ id: "b", date: "2026-10-22", start: "22:00", running: true, hours: 1 });
    expect(eventHours(overnight, { date: "2026-10-23", minutes: 90 })).toBe(3.5);
  });

  it("falls back to `hours` for a running entry when there is no clock to follow", () => {
    expect(eventHours(ev({ id: "a", start: "13:00", running: true, hours: 0.25 }))).toBe(0.25);
    expect(
      eventHours(ev({ id: "a", date: "nope", start: "13:00", running: true, hours: 0.25 }), now),
    ).toBe(0.25);
  });

  it("treats a running entry that has an end as stopped, so `hours` stays authoritative", () => {
    expect(
      eventHours(ev({ id: "a", start: "13:00", end: "14:00", running: true, hours: 2 }), now),
    ).toBe(2);
  });

  it("copes with a bad date on a running entry", () => {
    expect(eventHours(ev({ id: "a", date: "nope", start: "13:00", running: true }), now)).toBe(0);
  });
});

describe("groupByDate", () => {
  it("groups by the start date and orders each day", () => {
    const events = [
      ev({ id: "c", start: "13:00", title: "B" }),
      ev({ id: "a", start: "08:30", title: "Z" }),
      ev({ id: "h", title: "A", hours: 1 }),
      ev({ id: "b", start: "08:30", title: "A" }),
      ev({ id: "x", date: "2026-10-22", start: "22:00", end: "02:00" }),
    ];
    const days = groupByDate(events);
    expect([...days.keys()].sort()).toEqual(["2026-10-22", "2026-10-23"]);
    expect(days.get("2026-10-23")?.map((e) => e.id)).toEqual(["b", "a", "c", "h"]);
    expect(days.get("2026-10-22")?.map((e) => e.id)).toEqual(["x"]);
  });

  it("puts a night shift under the day it starts on only", () => {
    const days = groupByDate([ev({ id: "x", date: "2026-10-22", start: "22:00", end: "02:00" })]);
    expect(days.has("2026-10-23")).toBe(false);
  });

  it("breaks ties by title, then id, so the order is stable", () => {
    const days = groupByDate([
      ev({ id: "2", start: "09:00", title: "Same" }),
      ev({ id: "1", start: "09:00", title: "Same" }),
      ev({ id: "3", start: "09:00", title: "Earlier" }),
      ev({ id: "5", title: "Same" }),
      ev({ id: "4", title: "Same" }),
    ]);
    expect(days.get("2026-10-23")?.map((e) => e.id)).toEqual(["3", "1", "2", "4", "5"]);
  });

  it("leaves out entries whose date is not a real date", () => {
    const days = groupByDate([
      ev({ id: "a", date: "2026-02-30" }),
      ev({ id: "b", date: "" }),
      ev({ id: "c", date: "garbage" }),
      ev({ id: "d", date: "2026-10-23" }),
    ]);
    expect([...days.keys()]).toEqual(["2026-10-23"]);
  });

  it("hands back the caller's objects and leaves the input order alone", () => {
    const first = ev({ id: "b", start: "10:00" });
    const second = ev({ id: "a", start: "09:00" });
    const input = [first, second];
    const days = groupByDate(input);
    expect(input).toEqual([first, second]);
    expect(days.get("2026-10-23")?.[0]).toBe(second);
  });

  it("keeps the payload type", () => {
    const days = groupByDate<{ n: number }>([{ ...ev({ id: "a" }), meta: { n: 1 } }]);
    expect(days.get("2026-10-23")?.[0].meta?.n).toBe(1);
  });
});

describe("dayTotals", () => {
  it("sums by the start date, a night shift counting wholly for the day it began", () => {
    const totals = dayTotals([
      ev({ id: "night", date: "2026-10-22", start: "22:00", end: "02:00" }),
      ev({ id: "a", start: "08:30", end: "12:00" }),
      ev({ id: "b", start: "13:00", end: "13:30", hours: 0.5 }),
      ev({ id: "c", hours: 2 }),
    ]);
    expect(totals.get("2026-10-22")).toBe(4);
    expect(totals.get("2026-10-23")).toBe(6);
    expect(totals.size).toBe(2);
  });

  it("counts a running entry up to now", () => {
    const totals = dayTotals([ev({ id: "r", start: "13:00", running: true })], {
      date: "2026-10-23",
      minutes: 870,
    });
    expect(totals.get("2026-10-23")).toBe(1.5);
  });

  it("skips entries with an invalid date and gives empty input an empty map", () => {
    expect(dayTotals([ev({ id: "a", date: "x", hours: 3 })]).size).toBe(0);
    expect(dayTotals([]).size).toBe(0);
  });
});

describe("segmentsForDay", () => {
  const night = ev({ id: "night", date: "2026-10-22", start: "22:00", end: "02:00" });
  const day = ev({ id: "day", date: "2026-10-23", start: "08:30", end: "12:00" });

  it("clips a night shift to midnight on its own day", () => {
    expect(segmentsForDay([night], "2026-10-22")).toEqual([
      { id: "night", startMin: 1320, endMin: 1440, continued: false, continues: true },
    ]);
  });

  it("continues a night shift on the next day from 00:00", () => {
    expect(segmentsForDay([night], "2026-10-23")).toEqual([
      { id: "night", startMin: 0, endMin: 120, continued: true, continues: false },
    ]);
  });

  it("shows both the continuation and the day's own entries", () => {
    const segments = segmentsForDay([day, night], "2026-10-23");
    expect(segments.map((s) => [s.id, s.startMin, s.endMin])).toEqual([
      ["day", 510, 720],
      ["night", 0, 120],
    ]);
  });

  it("shows nothing on the days before or two after", () => {
    expect(segmentsForDay([night], "2026-10-21")).toEqual([]);
    expect(segmentsForDay([night], "2026-10-24")).toEqual([]);
  });

  it("leaves hours-only entries out", () => {
    expect(segmentsForDay([ev({ id: "h", hours: 2 })], "2026-10-23")).toEqual([]);
  });

  it("does not make an entry that ends exactly at midnight continue", () => {
    const toMidnight = ev({ id: "m", start: "22:00", end: "00:00" });
    expect(segmentsForDay([toMidnight], "2026-10-23")[0]).toMatchObject({
      startMin: 1320,
      endMin: 1440,
      continues: false,
    });
    expect(segmentsForDay([toMidnight], "2026-10-24")).toEqual([]);
  });

  it("keeps an entry with an unknown end visible, as long as `hours` or one minute", () => {
    expect(segmentsForDay([ev({ id: "z", start: "09:00" })], "2026-10-23")).toEqual([
      { id: "z", startMin: 540, endMin: 540, continued: false, continues: false },
    ]);
    expect(segmentsForDay([ev({ id: "z", start: "09:00", hours: 1.5 })], "2026-10-23")).toEqual([
      { id: "z", startMin: 540, endMin: 630, continued: false, continues: false },
    ]);
  });

  it("makes a running entry follow now", () => {
    const running = ev({ id: "r", start: "13:00", running: true });
    const now: CalendarClock = { date: "2026-10-23", minutes: 870 };
    expect(segmentsForDay([running], "2026-10-23", now)[0]).toMatchObject({
      startMin: 780,
      endMin: 870,
    });
    // Without a clock there is no end to follow.
    expect(segmentsForDay([running], "2026-10-23")[0]).toMatchObject({
      startMin: 780,
      endMin: 780,
    });
  });

  it("runs a timer left on for days across every column up to now", () => {
    const left = ev({ id: "r", date: "2026-10-21", start: "20:00", running: true });
    const now: CalendarClock = { date: "2026-10-23", minutes: 360 };
    const at = (date: string) => segmentsForDay([left], date, now);
    expect(at("2026-10-20")).toEqual([]);
    expect(at("2026-10-21")).toEqual([
      { id: "r", startMin: 1200, endMin: 1440, continued: false, continues: true },
    ]);
    expect(at("2026-10-22")).toEqual([
      { id: "r", startMin: 0, endMin: 1440, continued: true, continues: true },
    ]);
    expect(at("2026-10-23")).toEqual([
      { id: "r", startMin: 0, endMin: 360, continued: true, continues: false },
    ]);
    expect(at("2026-10-24")).toEqual([]);
  });

  it("ignores a bad date, on either side", () => {
    expect(
      segmentsForDay([ev({ id: "a", date: "x", start: "09:00", end: "10:00" })], "2026-10-23"),
    ).toEqual([]);
    expect(segmentsForDay([day], "not a date")).toEqual([]);
  });

  it("agrees with eventHours for every entry across the days it touches", () => {
    const events = [
      night,
      day,
      ev({ id: "long", date: "2026-10-22", start: "10:00", end: "09:59" }),
      ev({ id: "m", start: "22:00", end: "00:00" }),
    ];
    for (const e of events) {
      let minutes = 0;
      for (const date of ["2026-10-22", "2026-10-23", "2026-10-24"]) {
        for (const s of segmentsForDay([e], date)) minutes += s.endMin - s.startMin;
      }
      expect(minutes / 60, e.id).toBeCloseTo(eventHours(e), 10);
    }
  });
});

describe("layoutDayEvents", () => {
  const seg = (id: string, startMin: number, endMin: number): DaySegment => ({
    id,
    startMin,
    endMin,
    continued: false,
    continues: false,
  });

  /** id to [col, cols, span] */
  function place(input: DaySegment[]): Record<string, number[]> {
    return Object.fromEntries(layoutDayEvents(input).map((p) => [p.id, [p.col, p.cols, p.span]]));
  }

  it("gives entries that only touch the full width each", () => {
    expect(place([seg("a", 540, 600), seg("b", 600, 660)])).toEqual({
      a: [0, 1, 1],
      b: [0, 1, 1],
    });
  });

  it("puts two overlapping entries side by side", () => {
    expect(place([seg("a", 540, 660), seg("b", 600, 720)])).toEqual({
      a: [0, 2, 1],
      b: [1, 2, 1],
    });
  });

  it("lets two shorter entries share the column beside a long one", () => {
    expect(place([seg("a", 540, 720), seg("b", 550, 600), seg("c", 610, 700)])).toEqual({
      a: [0, 2, 1],
      b: [1, 2, 1],
      c: [1, 2, 1],
    });
  });

  it("reuses the first column once its entry has ended (a chain)", () => {
    expect(place([seg("a", 540, 600), seg("b", 570, 640), seg("c", 620, 700)])).toEqual({
      a: [0, 2, 1],
      b: [1, 2, 1],
      c: [0, 2, 1],
    });
  });

  it("widens an entry into the column beside it when that is free during its time", () => {
    expect(
      place([seg("A", 540, 720), seg("B", 540, 600), seg("C", 540, 600), seg("D", 610, 720)]),
    ).toEqual({
      A: [0, 3, 1],
      B: [1, 3, 1],
      C: [2, 3, 1],
      D: [1, 3, 2],
    });
  });

  it("keeps separate clusters at full width", () => {
    const placed = place([seg("a", 540, 660), seg("b", 600, 720), seg("z", 900, 960)]);
    expect(placed.z).toEqual([0, 1, 1]);
    expect(placed.a).toEqual([0, 2, 1]);
  });

  it("judges overlap on the true intervals when it is not told how tall a block is drawn", () => {
    expect(place([seg("a", 600, 610), seg("b", 610, 620)])).toEqual({
      a: [0, 1, 1],
      b: [0, 1, 1],
    });
  });

  describe("with a minimum drawn length", () => {
    // THE PREMISE CHANGED here. These cases used to say that entries drawn on top of each other get
    // separate columns: the layout lifted every block to the minimum height before it decided what
    // overlapped, so a 20-minute entry followed by one that starts the minute it ends was put beside
    // it, and ten-minute entries back to back took a column each. That drew entries that do not overlap
    // as if they did. A column now means a TRUE overlap and nothing else; a short block is lifted to
    // its minimum only into free space (`drawnEndMin`), so touching entries, and entries with any gap
    // between them, share one full-width column whatever the density. Genuine overlaps split exactly
    // as they did, and an entry with no known end keeps the old lifted rule (see below).

    /** The 27 minutes a Medium block is drawn at least, as `minBlockMinutes` says. */
    const MIN = 27;
    const placeMin = (input: DaySegment[], min = MIN) =>
      Object.fromEntries(layoutDayEvents(input, min).map((p) => [p.id, [p.col, p.cols, p.span]]));
    const drawnMin = (input: DaySegment[], min = MIN) =>
      Object.fromEntries(layoutDayEvents(input, min).map((p) => [p.id, p.drawnEndMin]));

    it("keeps ten-minute entries back to back in one column, each drawn at its true length", () => {
      const input = [seg("a", 600, 610), seg("b", 610, 620), seg("c", 620, 630)];
      expect(placeMin(input)).toEqual({ a: [0, 1, 1], b: [0, 1, 1], c: [0, 1, 1] });
      // The first two end where the next one starts; only the last has room below it to be lifted.
      expect(drawnMin(input)).toEqual({ a: 610, b: 620, c: 647 });
    });

    it("keeps entries a minute apart in one column, drawn up to the next one", () => {
      const input = [seg("a", 600, 610), seg("b", 611, 640)];
      expect(placeMin(input)).toEqual({ a: [0, 1, 1], b: [0, 1, 1] });
      expect(drawnMin(input)).toEqual({ a: 611, b: 640 });
    });

    it("lifts a short entry to the minimum when nothing is below it", () => {
      expect(drawnMin([seg("a", 600, 610)])).toEqual({ a: 627 });
      expect(drawnMin([seg("a", 600, 610), seg("b", 627, 660)])).toEqual({ a: 627, b: 660 });
      expect(drawnMin([seg("a", 600, 610), seg("b", 700, 760)])).toEqual({ a: 627, b: 760 });
    });

    it("cuts the lift at the start of the next entry, and only looks downwards", () => {
      const input = [seg("above", 590, 600), seg("a", 600, 610), seg("below", 615, 700)];
      // `above` ends where `a` starts; `a` is cut at 615; neither is cut by what is above it.
      expect(drawnMin(input)).toEqual({ above: 600, a: 615, below: 700 });
    });

    it("leaves entries that are far enough apart at full width", () => {
      expect(placeMin([seg("a", 600, 625), seg("b", 627, 660)])).toEqual({
        a: [0, 1, 1],
        b: [0, 1, 1],
      });
      expect(placeMin([seg("a", 600, 630), seg("b", 630, 660)])).toEqual({
        a: [0, 1, 1],
        b: [0, 1, 1],
      });
    });

    it("measures the minimum from the start, so a long block is unaffected", () => {
      const input = [seg("a", 600, 700), seg("b", 700, 710)];
      expect(placeMin(input)).toEqual({ a: [0, 1, 1], b: [0, 1, 1] });
      expect(drawnMin(input)).toEqual({ a: 700, b: 727 });
    });

    it("still splits a true overlap into columns, a short entry included", () => {
      expect(placeMin([seg("a", 540, 660), seg("b", 600, 720)])).toEqual({
        a: [0, 2, 1],
        b: [1, 2, 1],
      });
      // A ten-minute entry inside a long one is beside it, and keeps the least height.
      const nested = [seg("long", 540, 720), seg("short", 600, 610)];
      expect(placeMin(nested)).toEqual({ long: [0, 2, 1], short: [1, 2, 1] });
      expect(drawnMin(nested)).toEqual({ long: 720, short: 627 });
      // Two entries that overlap by a single minute are still two columns.
      expect(placeMin([seg("a", 600, 630), seg("b", 629, 660)])).toEqual({
        a: [0, 2, 1],
        b: [1, 2, 1],
      });
    });

    it("cuts a block at the next one that shares its width, even in the next cluster", () => {
      // `x` is alone at full width; the two below it overlap each other, so they are side by side in a
      // cluster of their own. Both are under `x`, so the earlier of them ends the lift.
      const input = [seg("x", 600, 605), seg("p", 612, 700), seg("q", 615, 700)];
      expect(placeMin(input)).toEqual({ x: [0, 1, 1], p: [0, 2, 1], q: [1, 2, 1] });
      expect(drawnMin(input).x).toBe(612);
      // The reverse: a half-width block is cut by a full-width one below it.
      const half = [seg("l", 540, 560), seg("s", 541, 545), seg("below", 560, 640)];
      expect(placeMin(half)).toEqual({ l: [0, 2, 1], s: [1, 2, 1], below: [0, 1, 1] });
      expect(drawnMin(half).s).toBe(560);
    });

    it("is cut only by a block that shares its width, not by one in the column beside it", () => {
      // B is short and sits in column 1 of three: it is lifted to 541 + 27 = 568. C starts at 560, but
      // in column 0, beside B, so it must not cut B. A mutant that cut a lift at any later block,
      // whatever its width, passed every other case here.
      const input = [
        seg("A", 540, 560),
        seg("B", 541, 545),
        seg("D", 544, 600),
        seg("C", 560, 640),
        seg("E", 570, 580),
      ];
      expect(placeMin(input)).toEqual({
        A: [0, 3, 1],
        B: [1, 3, 1],
        D: [2, 3, 1],
        C: [0, 3, 1],
        E: [1, 3, 1],
      });
      expect(drawnMin(input)).toEqual({ A: 560, B: 568, D: 600, C: 640, E: 597 });
    });

    it("orders entries that start in the same minute as before: longer first, then by id", () => {
      // Requirement 4: a genuine overlap splits exactly as it did. Two entries that start together and
      // are both shorter than the minimum used to tie on their lifted end and fall back to the id, so
      // `a-short` took the left column although `z-long` is the longer one. Judged on the true ends the
      // longer one would have gone left; the tie is on the lifted end, as it was.
      const input = [seg("z-long", 600, 610), seg("a-short", 600, 605)];
      expect(placeMin(input)).toEqual({ "a-short": [0, 2, 1], "z-long": [1, 2, 1] });
      // Once the longer one is longer than the minimum it is the first, as with no minimum at all.
      const longer = [seg("z-long", 600, 640), seg("a-short", 600, 605)];
      expect(placeMin(longer)).toEqual({ "z-long": [0, 2, 1], "a-short": [1, 2, 1] });
      expect(place([seg("z-long", 600, 610), seg("a-short", 600, 605)])).toEqual({
        "z-long": [0, 2, 1],
        "a-short": [1, 2, 1],
      });
    });

    it("keeps an entry with no known end on the old rule: its extent is the lifted minimum", () => {
      // Without an interval it cannot be mistaken for an overlap, and a cut would leave a sliver, so
      // something that starts inside the minimum is put beside it, and it is always drawn in full.
      expect(placeMin([seg("x", 600, 600), seg("y", 601, 660)])).toEqual({
        x: [0, 2, 1],
        y: [1, 2, 1],
      });
      expect(drawnMin([seg("x", 600, 600), seg("y", 601, 660)])).toEqual({ x: 627, y: 660 });
      // One that starts at or after the minimum is below it, in the same column.
      expect(placeMin([seg("x", 600, 600), seg("y", 627, 660)])).toEqual({
        x: [0, 1, 1],
        y: [0, 1, 1],
      });
      expect(drawnMin([seg("x", 600, 600), seg("y", 627, 660)]).x).toBe(627);
      // An entry that has an end is judged on it, so it does not get the same treatment.
      expect(placeMin([seg("x", 600, 610), seg("y", 611, 660)])).toEqual({
        x: [0, 1, 1],
        y: [0, 1, 1],
      });
    });

    it("reports the real interval of each block, not the drawn one", () => {
      const [first] = layoutDayEvents([seg("a", 600, 610)], MIN);
      expect([first.startMin, first.endMin]).toEqual([600, 610]);
      expect(first.drawnEndMin).toBe(627);
    });

    it("is the same as no minimum for a minimum of a minute or less, or one that is not a number", () => {
      const input = [
        seg("a", 600, 610),
        seg("b", 610, 620),
        seg("z", 600, 600),
        seg("y", 601, 602),
      ];
      const plain = layoutDayEvents(input);
      for (const min of [0, 1, -5, Number.NaN]) {
        expect(layoutDayEvents(input, min)).toEqual(plain);
      }
      expect(place(input)).toEqual(
        Object.fromEntries(plain.map((p) => [p.id, [p.col, p.cols, p.span]])),
      );
      // With no minimum a block is drawn at its true end, and an entry with no end a minute tall.
      expect(Object.fromEntries(plain.map((p) => [p.id, p.drawnEndMin]))).toEqual({
        a: 610,
        b: 620,
        z: 601,
        y: 602,
      });
    });

    describe("the owner's day, at every density", () => {
      // An accounting app's week view drew 07:24 to 07:44 beside 07:45 to 08:15, though the server
      // refuses real overlaps. `minBlockMinutes` is what the week view passes.
      const at = (h: number, m: number) => h * 60 + m;
      const ownerDay = [
        seg("a", at(7, 24), at(7, 44)),
        seg("b", at(7, 45), at(8, 15)),
        seg("c", at(8, 45), at(9, 55)),
        seg("d", at(11, 30), at(13, 0)),
      ];

      describe.each(["Small", "Medium", "Large"] as const)("%s", (density) => {
        const least = minBlockMinutes(density);
        const placed = (input: DaySegment[]) =>
          Object.fromEntries(layoutDayEvents(input, least).map((p) => [p.id, p]));
        const shape = (p: PositionedSegment) => [p.col, p.cols, p.span];

        it("puts 07:24 to 07:44 and 07:45 to 08:15 in one column at full width", () => {
          const { a, b } = placed(ownerDay);
          expect(shape(a)).toEqual([0, 1, 1]);
          expect(shape(b)).toEqual([0, 1, 1]);
          // The 20-minute entry would be lifted past 07:45, so it is trimmed to end where the next begins.
          expect(a.drawnEndMin).toBe(at(7, 45));
          expect(b.drawnEndMin).toBeGreaterThanOrEqual(at(8, 15));
        });

        it("leaves 08:45 to 09:55 and 11:30 to 13:00 untouched", () => {
          const { c, d } = placed(ownerDay);
          expect(shape(c)).toEqual([0, 1, 1]);
          expect(shape(d)).toEqual([0, 1, 1]);
          expect(c.drawnEndMin).toBe(at(9, 55));
          expect(d.drawnEndMin).toBe(at(13, 0));
        });

        it("puts a 20-minute entry and one that starts the minute it ends in one column", () => {
          const { a, b } = placed([seg("a", at(9, 0), at(9, 20)), seg("b", at(9, 20), at(10, 0))]);
          expect(shape(a)).toEqual([0, 1, 1]);
          expect(shape(b)).toEqual([0, 1, 1]);
          expect(a.drawnEndMin).toBe(at(9, 20));
        });

        it("puts a 20-minute entry and one a minute later in one column", () => {
          const { a, b } = placed([seg("a", at(9, 0), at(9, 20)), seg("b", at(9, 21), at(10, 0))]);
          expect(shape(a)).toEqual([0, 1, 1]);
          expect(shape(b)).toEqual([0, 1, 1]);
          expect(a.drawnEndMin).toBe(at(9, 21));
        });

        it("keeps a chain of three ten-minute entries in one column", () => {
          const { a, b, c } = placed([
            seg("a", at(10, 0), at(10, 10)),
            seg("b", at(10, 10), at(10, 20)),
            seg("c", at(10, 20), at(10, 30)),
          ]);
          for (const block of [a, b, c]) expect(shape(block)).toEqual([0, 1, 1]);
          expect([a.drawnEndMin, b.drawnEndMin]).toEqual([at(10, 10), at(10, 20)]);
          expect(c.drawnEndMin).toBeCloseTo(at(10, 20) + least, 9);
        });

        it("still splits one genuine overlap into two columns", () => {
          const { a, b } = placed([seg("a", at(9, 0), at(10, 0)), seg("b", at(9, 30), at(10, 30))]);
          expect(shape(a)).toEqual([0, 2, 1]);
          expect(shape(b)).toEqual([1, 2, 1]);
          expect([a.drawnEndMin, b.drawnEndMin]).toEqual([at(10, 0), at(10, 30)]);
        });
      });
    });
  });

  it("keeps a zero-length entry, and gives it a minute so it cannot hide behind a neighbour", () => {
    expect(layoutDayEvents([seg("x", 600, 600)])).toEqual([
      {
        id: "x",
        startMin: 600,
        endMin: 600,
        continued: false,
        continues: false,
        col: 0,
        cols: 1,
        span: 1,
        drawnEndMin: 601,
      },
    ]);
    expect(place([seg("x", 600, 600), seg("y", 600, 660)])).toEqual({
      y: [0, 2, 1],
      x: [1, 2, 1],
    });
    expect(place([seg("x", 600, 600), seg("y", 601, 660)])).toEqual({
      x: [0, 1, 1],
      y: [0, 1, 1],
    });
  });

  it("carries the continuation flags through", () => {
    const [out] = layoutDayEvents([
      { id: "n", startMin: 0, endMin: 120, continued: true, continues: false },
    ]);
    expect(out).toMatchObject({ continued: true, continues: false });
    const [tail] = layoutDayEvents([
      { id: "n", startMin: 1320, endMin: 1440, continued: false, continues: true },
    ]);
    expect(tail).toMatchObject({ continued: false, continues: true });
  });

  it("returns nothing for nothing and does not touch its input", () => {
    expect(layoutDayEvents([])).toEqual([]);
    const input = [seg("b", 600, 660), seg("a", 540, 700)];
    const before = JSON.stringify(input);
    layoutDayEvents(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("places each entry the same whatever order they arrive in", () => {
    const input = [
      seg("a", 540, 660),
      seg("b", 560, 700),
      seg("c", 600, 640),
      seg("d", 650, 720),
      seg("e", 900, 960),
      seg("f", 905, 915),
    ];
    const expected = place(input);
    for (const shuffled of [
      [...input].reverse(),
      [input[3], input[0], input[5], input[2], input[4], input[1]],
    ]) {
      expect(place(shuffled)).toEqual(expected);
    }
  });

  it("returns segments ordered by start", () => {
    const out = layoutDayEvents([
      seg("late", 900, 960),
      seg("early", 100, 200),
      seg("mid", 500, 600),
    ]);
    expect(out.map((p) => p.id)).toEqual(["early", "mid", "late"]);
  });

  describe("on random days", () => {
    // mulberry32: a small seeded generator, so a failure names a seed that replays exactly.
    function random(seed: number): () => number {
      let a = seed;
      return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    const end = (s: DaySegment) => Math.max(s.endMin, s.startMin + 1);
    const overlap = (a: DaySegment, b: DaySegment) => a.startMin < end(b) && b.startMin < end(a);

    it.each(Array.from({ length: 30 }, (_, i) => i + 1))(
      "keeps 50 random intervals apart and as narrow as their overlap allows (seed %i)",
      (seed) => {
        const next = random(seed);
        const input: DaySegment[] = Array.from({ length: 50 }, (_, i) => {
          const startMin = Math.floor(next() * 1400);
          // Lengths run from zero to four hours, with a share of short ones so overlaps are dense.
          const length = next() < 0.3 ? Math.floor(next() * 30) : Math.floor(next() * 240);
          return seg(`s${String(i).padStart(2, "0")}`, startMin, Math.min(startMin + length, 1440));
        });
        const out = layoutDayEvents(input);
        const byId = new Map(input.map((s) => [s.id, s]));

        expect(out).toHaveLength(input.length);
        expect(new Set(out.map((p) => p.id)).size).toBe(input.length);

        for (const p of out) {
          expect(p.col).toBeGreaterThanOrEqual(0);
          expect(p.span).toBeGreaterThanOrEqual(1);
          expect(p.col + p.span).toBeLessThanOrEqual(p.cols);
          const original = byId.get(p.id)!;
          expect([p.startMin, p.endMin]).toEqual([original.startMin, original.endMin]);
        }

        // Pairs: overlapping segments never share a column, always agree on the column count, and
        // a block never widens over a column that an overlapping segment sits in.
        for (let i = 0; i < out.length; i++) {
          for (let j = i + 1; j < out.length; j++) {
            const [a, b] = [out[i], out[j]];
            if (!overlap(a, b)) continue;
            expect(a.col, `${a.id} and ${b.id} share a column`).not.toBe(b.col);
            expect(a.cols).toBe(b.cols);
            expect(b.col >= a.col && b.col < a.col + a.span, `${a.id} covers ${b.id}`).toBe(false);
            expect(a.col >= b.col && a.col < b.col + b.span, `${b.id} covers ${a.id}`).toBe(false);
          }
        }

        // A cluster takes exactly as many columns as the most segments that are ever at once.
        const parent = out.map((_, i) => i);
        const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
        for (let i = 0; i < out.length; i++) {
          for (let j = i + 1; j < out.length; j++) {
            if (overlap(out[i], out[j])) parent[find(i)] = find(j);
          }
        }
        const deepest = new Map<number, number>();
        for (const [i, p] of out.entries()) {
          const depth = out.filter((q) => q.startMin <= p.startMin && p.startMin < end(q)).length;
          deepest.set(find(i), Math.max(deepest.get(find(i)) ?? 0, depth));
        }
        for (const [i, p] of out.entries()) {
          expect(p.cols, `${p.id} cluster width`).toBe(deepest.get(find(i)));
        }
      },
    );
  });
});

describe("layoutDayEvents on random days, with a minimum drawn height", () => {
  // THE PREMISE CHANGED here, as in "with a minimum drawn length" above. This used to assert that no
  // two blocks in one column are drawn over each other, judged on the extent they are drawn at, which
  // it got by giving entries that merely sit close their own columns. The layout now keeps columns for
  // true overlaps and keeps blocks apart by trimming the lift instead, so the properties are about
  // those two things: where columns appear, and how far down each block is drawn.
  function random(seed: number): () => number {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const id = (i: number) => `s${String(i).padStart(2, "0")}`;
  const segment = (i: number, startMin: number, endMin: number): DaySegment => ({
    id: id(i),
    startMin,
    endMin,
    continued: false,
    continues: false,
  });
  const EPS = 1e-9;
  /** Whether two placed blocks share any of the day column's width, as fractions (clusters differ in `cols`). */
  const sharesWidth = (a: PositionedSegment, b: PositionedSegment) =>
    a.col * b.cols < (b.col + b.span) * a.cols && b.col * a.cols < (a.col + a.span) * b.cols;
  const seeds = Array.from({ length: 20 }, (_, i) => i + 1);

  describe.each(["Small", "Medium", "Large"] as const)("at %s density", (density) => {
    const least = minBlockMinutes(density);
    /**
     * Where an entry's extent ends for overlap purposes: its true end, or for one with no known end
     * (`endMin <= startMin`) the lifted minimum, which is the one case the true interval is not used.
     */
    const extentEnd = (s: DaySegment) => (s.endMin > s.startMin ? s.endMin : s.startMin + least);
    const overlap = (a: DaySegment, b: DaySegment) =>
      a.startMin < extentEnd(b) && b.startMin < extentEnd(a);

    it.each(seeds)(
      "puts columns only where true intervals overlap and keeps every block clear of the next (seed %i)",
      (seed) => {
        const next = random(seed);
        const input: DaySegment[] = Array.from({ length: 45 }, (_, i) => {
          // Half of the entries sit on a five-minute grid, so entries that touch are common.
          const onGrid = next() < 0.5;
          const startMin = onGrid ? 360 + 5 * Math.floor(next() * 60) : Math.floor(next() * 1400);
          const kind = next();
          let length: number;
          if (kind < 0.1) length = 0;
          else if (kind < 0.6) {
            length = onGrid ? 5 * (1 + Math.floor(next() * 8)) : 1 + Math.floor(next() * 40);
          } else length = Math.floor(next() * 200);
          return segment(i, startMin, Math.min(startMin + length, 1440));
        });
        const before = JSON.stringify(input);
        const out = layoutDayEvents(input, least);
        const byId = new Map(input.map((s) => [s.id, s]));

        expect(JSON.stringify(input)).toBe(before);
        expect(out).toHaveLength(input.length);
        expect(new Set(out.map((p) => p.id)).size).toBe(input.length);
        // The same whatever order the entries arrive in, and ordered by start.
        expect(layoutDayEvents([...input].reverse(), least)).toEqual(out);
        for (let i = 1; i < out.length; i++) {
          expect(out[i].startMin).toBeGreaterThanOrEqual(out[i - 1].startMin);
        }

        for (const p of out) {
          const original = byId.get(p.id)!;
          // The positions report the true interval.
          expect([p.startMin, p.endMin]).toEqual([original.startMin, original.endMin]);
          // (e) columns, spans and the column count agree.
          expect(p.col).toBeGreaterThanOrEqual(0);
          expect(p.span).toBeGreaterThanOrEqual(1);
          expect(p.col + p.span).toBeLessThanOrEqual(p.cols);
          // (c) a block is never drawn shorter than its entry, and has some height.
          const drawnEnd = p.drawnEndMin!;
          expect(drawnEnd, `${p.id} drawn end`).toBeGreaterThanOrEqual(p.endMin);
          expect(drawnEnd, `${p.id} drawn end`).toBeGreaterThanOrEqual(p.startMin + 1);
          // (d) it is lifted to the least height and no further, unless the entry is longer.
          expect(drawnEnd, `${p.id} drawn end`).toBeLessThanOrEqual(
            Math.max(p.endMin, p.startMin + least) + EPS,
          );
          // An entry with no known end is never cut: it is drawn the whole minimum.
          if (p.endMin <= p.startMin) expect(drawnEnd).toBeCloseTo(p.startMin + least, 9);
          // (f) exactly how far: the lifted end, cut at the nearest block below that shares its width and
          // nowhere else. The bounds above only say "not more than"; this says "not less", so a lift that
          // is cut by a block beside it, or not lifted at all, fails here.
          const lifted = Math.max(p.endMin, p.startMin + least);
          const cut = Math.min(
            Number.POSITIVE_INFINITY,
            ...out
              .filter((q) => q !== p && q.startMin >= extentEnd(original) && sharesWidth(p, q))
              .map((q) => q.startMin),
          );
          expect(drawnEnd, `${p.id} drawn end`).toBeCloseTo(Math.min(lifted, cut), 9);
        }

        for (let i = 0; i < out.length; i++) {
          for (let j = i + 1; j < out.length; j++) {
            const [a, b] = [out[i], out[j]];
            if (overlap(a, b)) {
              // (a) a true overlap: separate columns of one cluster, neither covering the other.
              expect(a.col, `${a.id} and ${b.id} share a column`).not.toBe(b.col);
              expect(a.cols).toBe(b.cols);
              expect(b.col >= a.col && b.col < a.col + a.span, `${a.id} covers ${b.id}`).toBe(
                false,
              );
              expect(a.col >= b.col && a.col < b.col + b.span, `${b.id} covers ${a.id}`).toBe(
                false,
              );
            }
            // (b) blocks that share any width have drawn extents that do not intersect.
            if (sharesWidth(a, b)) {
              const drawnOver =
                a.startMin < b.drawnEndMin! - EPS && b.startMin < a.drawnEndMin! - EPS;
              expect(drawnOver, `${a.id} and ${b.id} are drawn over each other`).toBe(false);
            }
          }
        }

        // (a) Columns exist only for overlap: an entry that overlaps nothing is alone at full width,
        // and a cluster has as many columns as the most entries that are ever at once.
        const parent = out.map((_, i) => i);
        const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
        for (let i = 0; i < out.length; i++) {
          for (let j = i + 1; j < out.length; j++) {
            if (overlap(out[i], out[j])) parent[find(i)] = find(j);
          }
        }
        const deepest = new Map<number, number>();
        for (const [i, p] of out.entries()) {
          const depth = out.filter(
            (q) => q.startMin <= p.startMin && p.startMin < extentEnd(q),
          ).length;
          deepest.set(find(i), Math.max(deepest.get(find(i)) ?? 0, depth));
        }
        for (const [i, p] of out.entries()) {
          expect(p.cols, `${p.id} cluster width`).toBe(deepest.get(find(i)));
          if (!out.some((q, j) => j !== i && overlap(p, q))) {
            expect([p.col, p.cols, p.span], `${p.id} overlaps nothing`).toEqual([0, 1, 1]);
          }
        }
      },
    );

    it.each(seeds)(
      "keeps entries that do not overlap in one full-width column, whatever the gap (seed %i)",
      (seed) => {
        const next = random(seed);
        // One after the other with gaps of nothing, one minute, a few minutes or an hour, and lengths from
        // a minute to an hour: touching and nearly touching entries, the case the bug was reported on.
        const input: DaySegment[] = [];
        let at = Math.floor(next() * 300);
        for (let i = 0; i < 30 && at < 1380; i++) {
          const length = 1 + Math.floor(next() * 60);
          input.push(segment(i, at, at + length));
          at += length + [0, 0, 1, 2, 5, 60][Math.floor(next() * 6)];
        }
        const out = layoutDayEvents(input, least);
        for (const p of out) {
          expect([p.col, p.cols, p.span], `${p.id} is in a column of its own`).toEqual([0, 1, 1]);
        }
        // Each is drawn from its start to its true end, or lifted into the free space below it.
        for (const [i, p] of out.entries()) {
          const nextStart = out[i + 1]?.startMin ?? Number.POSITIVE_INFINITY;
          expect(p.drawnEndMin).toBeCloseTo(
            Math.min(Math.max(p.endMin, p.startMin + least), nextStart),
            9,
          );
        }
      },
    );
  });
});

describe("the drawn height of a block", () => {
  it("is at least 1.35rem, which is what the layout counts on", () => {
    expect(MIN_BLOCK_REM).toBe(1.35);
    const style = blockStyle(
      {
        id: "a",
        startMin: 600,
        endMin: 610,
        continued: false,
        continues: false,
        col: 0,
        cols: 1,
        span: 1,
      },
      6,
    );
    expect(style.minHeight).toBe("1.35rem");
  });

  it("converts to minutes through the hour height of the density", () => {
    expect(minBlockMinutes("Small")).toBeCloseTo(32.4, 5);
    expect(minBlockMinutes("Medium")).toBeCloseTo(27, 5);
    expect(minBlockMinutes("Large")).toBeCloseTo(23.142857, 5);
  });

  it("is the 5 units that the class `min-h-5` gave, at this theme's 0.27rem spacing", () => {
    const globalsCss = readCssInlined(resolve(__dirname, "..", "src/styles/globals.css"));
    const spacing = /--spacing:\s*([\d.]+)rem/.exec(globalsCss)?.[1];
    expect(Number(spacing) * 5).toBeCloseTo(MIN_BLOCK_REM, 10);
  });
});

describe("the drawn height of a block that the layout has placed", () => {
  const positioned = (drawnEndMin: number | undefined, endMin = 610): PositionedSegment => ({
    id: "a",
    startMin: 600,
    endMin,
    continued: false,
    continues: false,
    col: 0,
    cols: 1,
    span: 1,
    drawnEndMin,
  });

  it("takes its height from `drawnEndMin` and leaves no CSS minimum, which the layout has counted", () => {
    const style = blockStyle(positioned(627), 6);
    // 27 minutes is 0.45 of an hour, and 600 is 10 hours from midnight, 4 below the 06:00 grid start.
    expect(style.height).toBe("calc(var(--sc-hour) * 0.45)");
    expect(style.top).toBe("calc(var(--sc-hour) * 4)");
    expect("minHeight" in style).toBe(false);
  });

  it("draws a block trimmed to the next one at its true length, with no minimum under it", () => {
    const style = blockStyle(positioned(610), 6);
    expect(style.height).toBe("calc(var(--sc-hour) * 0.1667)");
    expect(style.minHeight).toBeUndefined();
  });

  it("keeps today's behaviour for a position without it: the true length and a CSS minimum", () => {
    const style = blockStyle(positioned(undefined), 6);
    expect(style.height).toBe("calc(var(--sc-hour) * 0.1667)");
    expect(style.minHeight).toBe(`${MIN_BLOCK_REM}rem`);
    // A value that is not a number is no value.
    expect(blockStyle(positioned(Number.NaN), 6).minHeight).toBe(`${MIN_BLOCK_REM}rem`);
  });

  it("never draws a block shorter than its entry, whatever `drawnEndMin` says", () => {
    expect(blockStyle(positioned(605), 6).height).toBe("calc(var(--sc-hour) * 0.1667)");
    expect(blockStyle(positioned(600, 600), 6).height).toBe("calc(var(--sc-hour) * 0.0167)");
  });

  it("is what the layout hands it, for the same hour height the density gives", () => {
    for (const density of ["Small", "Medium", "Large"] as const) {
      const [placed] = layoutDayEvents(
        [{ id: "a", startMin: 600, endMin: 610, continued: false, continues: false }],
        minBlockMinutes(density),
      );
      const hours = Number(/\* ([\d.]+)\)/.exec(String(blockStyle(placed, 6).height))?.[1]);
      // The lifted block is exactly the least height, in rem, at that density's hour height.
      const rem = hours * { Small: 2.5, Medium: 3, Large: 3.5 }[density];
      expect(rem).toBeCloseTo(MIN_BLOCK_REM, 3);
    }
  });
});

describe("how much of its label a block shows", () => {
  const HOUR = { Small: 2.5, Medium: 3, Large: 3.5 } as const;
  /** The text size of a week block at each density, in px: `text-[10px]`, `text-xs`, `text-sm`. */
  const TEXT_PX = { Small: 10, Medium: 12, Large: 14 } as const;
  const DENSITIES = ["Small", "Medium", "Large"] as const;
  /** Minutes that make a block `rem` tall at `density`. */
  const minutesFor = (rem: number, density: keyof typeof HOUR) => (rem / HOUR[density]) * 60;
  /** How tall, in px, a block drawn `minutes` is (a 16px root). */
  const pxFor = (minutes: number, density: keyof typeof HOUR) =>
    (minutes / 60) * HOUR[density] * 16;
  /**
   * What a tight block has to hold, in px: its title's box, which is the line (the text size, at
   * `leading-none`) plus the room above and below it that keeps the ring of an Å and the descenders
   * inside the title's clip box.
   */
  const tightNeedPx = (density: keyof typeof HOUR) =>
    TEXT_PX[density] * (1 + TIGHT_HEADROOM_EM.top + TIGHT_HEADROOM_EM.bottom);

  it.each(DENSITIES)(
    "is full from the least block height, tight from what its label needs and a bar below, at %s",
    (density) => {
      const tight = minutesFor(tightNeedPx(density) / 16, density);
      expect(tightBlockMinutes(density)).toBeCloseTo(tight, 9);
      expect(blockFit(minBlockMinutes(density), density)).toBe("full");
      expect(blockFit(minutesFor(MIN_BLOCK_REM, density) - 0.01, density)).toBe("tight");
      expect(blockFit(tight, density)).toBe("tight");
      expect(blockFit(tight - 0.01, density)).toBe("bar");
      expect(blockFit(240, density)).toBe("full");
      expect(blockFit(1, density)).toBe("bar");
      expect(blockFit(0, density)).toBe("bar");
      expect(blockFit(-5, density)).toBe("bar");
    },
  );

  it("starts the tight label at 19.5 minutes at every density, so a quarter of an hour is a bar", () => {
    // THE THRESHOLD MOVED. A tight block used to start at one line of text, a quarter of an hour at
    // every density. That left no room for the ring of an Å (the title's own clip box cut it, and so
    // did the block's edge): the label now starts where the line, the room above it and the room
    // below it fit. The line is a quarter of an hour at every density, the room 30 percent of it.
    for (const density of DENSITIES) {
      expect(tightBlockMinutes(density)).toBeCloseTo(19.5, 9);
      expect(blockFit(15, density)).toBe("bar");
      expect(blockFit(19, density)).toBe("bar");
      expect(blockFit(19.5, density)).toBe("tight");
      // A 20-minute entry that another follows keeps its label; 07:24 to 07:44, drawn down to 07:45, is 21.
      expect(blockFit(20, density)).toBe("tight");
      expect(blockFit(21, density)).toBe("tight");
      expect(blockFit(22, density)).toBe("tight");
    }
    // The lifted minimum is full at every density, so a block that gets its whole lift looks as it did.
    expect(blockFit(32.4, "Small")).toBe("full");
    expect(blockFit(27, "Medium")).toBe("full");
    expect(blockFit(23.142857, "Large")).toBe("full");
  });

  it.each(DENSITIES)(
    "never calls a block tight that is too short for its title and the room it keeps, at %s",
    (density) => {
      for (let minutes = 0; minutes <= 60; minutes += 0.05) {
        const room = pxFor(minutes, density);
        const fit = blockFit(minutes, density);
        if (fit === "bar") {
          expect(room, `${minutes} min is a bar`).toBeLessThan(tightNeedPx(density));
        } else {
          expect(room, `${minutes} min is ${fit}`).toBeGreaterThanOrEqual(
            tightNeedPx(density) - 1e-6,
          );
        }
      }
    },
  );

  it("has a variant per fit that drops the padding when the block is short", () => {
    const full = weekBlockVariant({ fit: "full" }).split(/\s+/);
    const tight = weekBlockVariant({ fit: "tight" }).split(/\s+/);
    const bar = weekBlockVariant({ fit: "bar" }).split(/\s+/);
    expect(weekBlockVariant({}).split(/\s+/)).toEqual(full);
    expect(full).toContain("py-0.5");
    expect(tight).toEqual(expect.arrayContaining(["py-0", "leading-none"]));
    expect(bar).toContain("py-0");
    for (const classes of [tight, bar]) expect(classes).not.toContain("py-0.5");
    expect(full).not.toContain("leading-none");
    // The focus ring and the left bar stay on every fit.
    for (const classes of [full, tight, bar]) {
      expect(classes).toContain("focus-visible:ring-inset");
      expect(classes).toContain("border-l-[3px]");
    }
  });

  it("keeps a block's border in forced-colors mode, except at the top and the bottom of a tight one", () => {
    // Forced colors (Windows High Contrast) removes the colour wash, so a block is told apart by its
    // border. That border is taken out of the block's own height: a 1px top and bottom border left a
    // 15-minute tight block shorter than its line, and the foot of the text was cut off. A tight block
    // has exactly the room its title needs, so it keeps the left and right edge and not those two; a
    // full block and a bar (which has no text) keep all four.
    const classesOf = (fit: "full" | "tight" | "bar") => weekBlockVariant({ fit }).split(/\s+/);
    for (const fit of ["full", "tight", "bar"] as const) {
      expect(classesOf(fit)).toContain("forced-colors:border-r");
      expect(classesOf(fit)).toContain("border-l-[3px]");
    }
    expect(classesOf("full")).toContain("forced-colors:border-y");
    expect(classesOf("bar")).toContain("forced-colors:border-y");
    expect(classesOf("tight")).not.toContain("forced-colors:border-y");
    expect(classesOf("tight").filter((c) => /^forced-colors:border-[tby]/.test(c))).toEqual([]);
  });

  it("gives a tight title room for the ring of an Å inside its own clip box", () => {
    // The title is `truncate`, which clips at its padding box, and at `leading-none` that box is exactly
    // one em tall, so the ring of an Å, Ä or Ö (about 0.125em above the line in Geist) was cut off.
    // The headroom is padding on the title, so the clip box grows and the block centres the whole of it.
    // The classes are literals for Tailwind; `TIGHT_HEADROOM_EM` is what the threshold counts.
    const tight = weekBlockTitleVariant({ fit: "tight" }).split(/\s+/);
    expect(tight).toContain(`pt-[${TIGHT_HEADROOM_EM.top}em]`);
    expect(tight).toContain(`pb-[${TIGHT_HEADROOM_EM.bottom}em]`);
    expect(tight).toEqual(expect.arrayContaining(["block", "w-full", "truncate", "font-medium"]));
    expect(TIGHT_HEADROOM_EM.top).toBeGreaterThanOrEqual(0.125);
    expect(TIGHT_HEADROOM_EM.bottom).toBeGreaterThan(0);
    // Nowhere else: a full block's title is as it was, and a negative margin would undo the room.
    for (const fit of ["full", "bar"] as const) {
      const classes = weekBlockTitleVariant({ fit }).split(/\s+/);
      expect(classes.filter((c) => /^(pt|pb|py|-m)/.test(c))).toEqual([]);
      expect(classes).toEqual(
        expect.arrayContaining(["block", "w-full", "truncate", "font-medium"]),
      );
    }
    expect(weekBlockTitleVariant({}).split(/\s+/)).toEqual(
      weekBlockTitleVariant({ fit: "full" }).split(/\s+/),
    );
    expect(tight.filter((c) => c.startsWith("-m"))).toEqual([]);
  });
});

describe("getFetchRange", () => {
  it("is the visible range plus the day before it, so a night shift's start is fetched", () => {
    expect(getVisibleRange("2026-10-23", "week")).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    expect(getFetchRange("2026-10-23", "week")).toEqual({ from: "2026-10-18", to: "2026-10-25" });
    expect(getFetchRange("2026-10-23", "month")).toEqual({ from: "2026-09-27", to: "2026-11-01" });
  });

  it("follows the week start and crosses month and year ends", () => {
    expect(getFetchRange("2026-10-23", "week", 0)).toEqual({
      from: "2026-10-17",
      to: "2026-10-24",
    });
    expect(getFetchRange("2027-01-01", "week")).toEqual({ from: "2026-12-27", to: "2027-01-03" });
  });
});

describe("hourRangeFor", () => {
  const seg = (startMin: number, endMin: number): DaySegment => ({
    id: String(startMin),
    startMin,
    endMin,
    continued: false,
    continues: false,
  });

  it("is the configured range when everything fits", () => {
    expect(hourRangeFor([], [6, 22])).toEqual([6, 22]);
    expect(hourRangeFor([seg(8 * 60, 17 * 60)], [6, 22])).toEqual([6, 22]);
  });

  it("widens to whole hours that hold every segment", () => {
    expect(hourRangeFor([seg(5 * 60 + 30, 6 * 60 + 30)], [6, 22])).toEqual([5, 22]);
    expect(hourRangeFor([seg(21 * 60, 23 * 60 + 15)], [6, 22])).toEqual([6, 24]);
    expect(hourRangeFor([seg(0, 120)], [6, 22])).toEqual([0, 22]);
    expect(hourRangeFor([seg(1320, 1440)], [6, 22])).toEqual([6, 24]);
    expect(hourRangeFor([seg(4 * 60, 5 * 60), seg(23 * 60, 1440)], [6, 22])).toEqual([4, 24]);
  });

  it("makes room for a zero-length block, which is drawn a minute tall", () => {
    expect(hourRangeFor([seg(1320, 1320)], [6, 22])).toEqual([6, 23]);
    expect(hourRangeFor([seg(720, 720)], [6, 22])).toEqual([6, 22]);
    expect(hourRangeFor([seg(1439, 1439)], [6, 22])).toEqual([6, 24]);
  });

  it("keeps the configured range inside the day", () => {
    expect(hourRangeFor([], [-3, 30])).toEqual([0, 24]);
    expect(hourRangeFor([], [6.5, 21.2])).toEqual([6, 22]);
  });

  it("never returns an empty range, whatever it is given", () => {
    for (const cfg of [
      [22, 6],
      [24, 24],
      [10, 10],
      [0, 0],
      [23, 1],
    ] as const) {
      const [from, to] = hourRangeFor([], cfg);
      expect(to, JSON.stringify(cfg)).toBeGreaterThan(from);
      expect(from).toBeGreaterThanOrEqual(0);
      expect(to).toBeLessThanOrEqual(24);
    }
  });
});

describe("slotMinutes", () => {
  const range = [6, 22] as const;
  const time = (ratio: number, snap: number, r: readonly [number, number] = range) =>
    fromMinutes(slotMinutes(ratio, r, snap));

  it("maps the top, the middle and the clock position of a click", () => {
    expect(time(0, 15)).toBe("06:00");
    expect(time(0.5, 15)).toBe("14:00");
    // 3h20m into a 16h grid, snapped down to a quarter of an hour.
    expect(time(200 / 960, 15)).toBe("09:15");
    expect(time(209 / 960, 15)).toBe("09:15");
    expect(time(210 / 960, 15)).toBe("09:30");
  });

  it("snaps down to the minutes asked for", () => {
    expect(time(200 / 960, 60)).toBe("09:00");
    expect(time(200 / 960, 30)).toBe("09:00");
    expect(time(200 / 960, 5)).toBe("09:20");
    expect(time(200 / 960, 1)).toBe("09:20");
  });

  it("stays on the grid: the bottom edge is the last slot, not the next hour", () => {
    expect(time(1, 15)).toBe("21:45");
    expect(time(1, 60)).toBe("21:00");
    expect(time(1, 15, [0, 24])).toBe("23:45");
    expect(time(1, 1, [0, 24])).toBe("23:59");
  });

  it("clamps a pointer outside the grid and a ratio that is not a number", () => {
    expect(time(-0.2, 15)).toBe("06:00");
    expect(time(1.7, 15)).toBe("21:45");
    expect(time(Number.NaN, 15)).toBe("06:00");
  });

  it("reads a snap below one minute, or not a number, as one minute, and floors a fractional one", () => {
    expect(time(200 / 960, 0)).toBe("09:20");
    expect(time(200 / 960, -5)).toBe("09:20");
    expect(time(200 / 960, Number.NaN)).toBe("09:20");
    expect(time(200 / 960, 0.5)).toBe("09:20");
    // 7.9 floors to 7, so the slots are 06:00, 06:07, ... and 196 minutes in is the last before 200.
    expect(time(200 / 960, 7.9)).toBe("09:16");
  });

  it("never returns a time outside the range, on any ratio", () => {
    for (let i = 0; i <= 200; i++) {
      for (const snap of [1, 5, 15, 30, 60]) {
        const minutes = slotMinutes(i / 200, [5, 23], snap);
        expect(minutes).toBeGreaterThanOrEqual(5 * 60);
        expect(minutes).toBeLessThan(23 * 60);
      }
    }
  });

  it("copes with an empty range", () => {
    expect(slotMinutes(0.5, [10, 10], 15)).toBe(600);
  });
});

describe("slotAt", () => {
  const range = [6, 22] as const;
  const time = (minutes: number, snap: number, r: readonly [number, number] = range) =>
    fromMinutes(slotAt(minutes, r, snap));

  it("snaps a time of day down to the slot that holds it", () => {
    expect(time(14 * 60 + 30, 15)).toBe("14:30");
    expect(time(14 * 60 + 44, 15)).toBe("14:30");
    expect(time(14 * 60 + 59, 60)).toBe("14:00");
    expect(time(9 * 60 + 22, 30)).toBe("09:00");
    expect(time(9 * 60 + 20, 1)).toBe("09:20");
  });

  it("agrees with the slot a click on the same spot gives", () => {
    for (const snap of [1, 5, 15, 30, 60]) {
      for (let minutes = 360; minutes < 1320; minutes += 7) {
        const ratio = (minutes - 360) / 960;
        expect(slotAt(minutes, range, snap), `${minutes} at ${snap}`).toBe(
          slotMinutes(ratio + 1e-9, range, snap),
        );
      }
    }
  });

  it("keeps to the grid: before the first hour is the first slot, after the last the last slot", () => {
    expect(time(3 * 60, 15)).toBe("06:00");
    expect(time(23 * 60 + 40, 15)).toBe("21:45");
    expect(time(23 * 60 + 40, 60)).toBe("21:00");
    expect(time(1439, 15, [0, 24])).toBe("23:45");
  });

  it("reads a snap that is not a usable number as one minute, and a time that is not one as the start", () => {
    expect(time(9 * 60 + 22, 0)).toBe("09:22");
    expect(time(9 * 60 + 22, Number.NaN)).toBe("09:22");
    expect(time(Number.NaN, 15)).toBe("06:00");
    expect(slotAt(600, [10, 10], 15)).toBe(600);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0m"],
    [0.75, "45m"],
    [8, "8h"],
    [7.5, "7h 30m"],
    [2.08, "2h 05m"],
    [0.999, "1h"],
    [3.5 + 1 / 3, "3h 50m"],
    [142.5, "142h 30m"],
    [1 / 60, "1m"],
    [0.0001, "0m"],
    [24, "24h"],
    [-3, "0m"],
    [Number.NaN, "0m"],
    [Number.POSITIVE_INFINITY, "0m"],
  ])("writes %d hours as %j", (hours, text) => {
    expect(formatDuration(hours)).toBe(text);
    expect(formatDuration(hours, "hm")).toBe(text);
  });

  it("writes decimals the way a locale does, with spaces that do not wrap", () => {
    expect(formatDuration(7.5, "decimal", "sv-SE")).toBe(`7,5${NBSP}h`);
    expect(formatDuration(8, "decimal", "sv-SE")).toBe(`8,0${NBSP}h`);
    expect(formatDuration(0.126, "decimal", "sv-SE")).toBe(`0,13${NBSP}h`);
    expect(formatDuration(1234.5, "decimal", "sv-SE")).toBe(`1${NBSP}234,5${NBSP}h`);
    expect(formatDuration(7.5, "decimal", "en-US")).toBe(`7.5${NBSP}h`);
    expect(formatDuration(-1, "decimal", "en-US")).toBe(`0.0${NBSP}h`);
    expect(formatDuration(Number.NaN, "decimal", "en-US")).toBe(`0.0${NBSP}h`);
  });

  it("does not throw on a locale tag that is not one", () => {
    expect(formatDuration(7.5, "decimal", "not a locale")).toMatch(/h$/);
  });
});

describe("labels", () => {
  it("has English text for every label", () => {
    expect(DEFAULT_CALENDAR_LABELS.today).toBe("Today");
    expect(DEFAULT_CALENDAR_LABELS.more(3)).toBe("+3 more");
    expect(DEFAULT_CALENDAR_LABELS.entries(0)).toBe("0 entries");
    expect(DEFAULT_CALENDAR_LABELS.entries(1)).toBe("1 entry");
    expect(DEFAULT_CALENDAR_LABELS.entries(3)).toBe("3 entries");
    expect(DEFAULT_CALENDAR_LABELS.endsNextDay("02:00")).toBe("ends 02:00 next day");
    expect(DEFAULT_CALENDAR_LABELS.timeRange("08:30", "12:00")).toBe("08:30 to 12:00");
    expect(DEFAULT_CALENDAR_LABELS.since("08:30")).toBe("since 08:30");
    expect(DEFAULT_CALENDAR_LABELS.weekNumber(43)).toBe("week 43");
  });

  it("lays overrides over the defaults and ignores undefined ones", () => {
    const labels = resolveCalendarLabels({
      today: "Idag",
      more: (n) => `${n} till`,
      add: undefined,
    });
    expect(labels.today).toBe("Idag");
    expect(labels.more(2)).toBe("2 till");
    expect(labels.add).toBe(DEFAULT_CALENDAR_LABELS.add);
    expect(labels.month).toBe("Month");
  });

  it("returns a fresh object and leaves the defaults alone", () => {
    const labels = resolveCalendarLabels({ today: "Idag" });
    expect(labels).not.toBe(DEFAULT_CALENDAR_LABELS);
    expect(DEFAULT_CALENDAR_LABELS.today).toBe("Today");
    expect(resolveCalendarLabels()).toEqual(DEFAULT_CALENDAR_LABELS);
  });
});

describe("calendarColorForKey", () => {
  it("is stable: the same project is the same colour on every visit", () => {
    // Pinned on purpose. A different hash would recolour every project in every app.
    expect(calendarColorForKey("Acme Logistik")).toBe("violet");
    expect(calendarColorForKey("Fj\u00e4llbacka webbplats")).toBe("green");
    expect(calendarColorForKey("Intern")).toBe("rose");
    expect(calendarColorForKey("Acme Logistik")).toBe(calendarColorForKey("Acme Logistik"));
  });

  it("ignores case, surrounding space and Unicode normalisation", () => {
    expect(calendarColorForKey("  acme LOGISTIK ")).toBe(calendarColorForKey("Acme Logistik"));
    const composed = "Fj\u00e4llbacka";
    const decomposed = "Fja\u0308llbacka";
    expect(decomposed).not.toBe(composed);
    expect(calendarColorForKey(decomposed)).toBe(calendarColorForKey(composed));
  });

  it("only picks from the palette, and reaches all of it", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) seen.add(calendarColorForKey(`project ${i}`));
    expect([...seen].sort()).toEqual([...CALENDAR_PALETTE].sort());
  });

  it("keeps the greys and ivy-green out of the automatic palette", () => {
    for (const excluded of ["ivy-green", "slate", "gray", "zinc", "neutral", "stone"]) {
      expect(CALENDAR_PALETTE as readonly string[]).not.toContain(excluded);
    }
    expect(CALENDAR_PALETTE).toHaveLength(12);
  });

  it("takes another palette, and falls back to slate for an empty one", () => {
    expect(calendarColorForKey("anything", ["red"])).toBe("red");
    expect(["red", "blue"]).toContain(calendarColorForKey("anything", ["red", "blue"]));
    expect(calendarColorForKey("anything", [])).toBe("slate");
  });

  it("copes with the empty key and astral characters", () => {
    expect(CALENDAR_PALETTE as readonly string[]).toContain(calendarColorForKey(""));
    expect(CALENDAR_PALETTE as readonly string[]).toContain(
      calendarColorForKey("\u{1f680} launch"),
    );
  });
});

describe("the colour table", () => {
  const variantSource = readFileSync(
    resolve(__dirname, "..", "src/components/ui/time-calendar/time-calendar-variant.ts"),
    "utf-8",
  );
  const globalsCss = readCssInlined(resolve(__dirname, "..", "src/styles/globals.css"));
  const themeBlock = /@theme inline\s*\{([^}]+)\}/s.exec(globalsCss)?.[1] ?? "";
  const rootBlock = /:root\s*\{([^}]+)\}/s.exec(globalsCss)?.[1] ?? "";
  const darkBlock = /\.dark\s*\{([^}]+)\}/s.exec(globalsCss)?.[1] ?? "";

  const palette = NAMED_COLORS.map((c) => c.name).filter((n) => n !== "black" && n !== "white");

  it("offers exactly the named palette without black and white, in palette order", () => {
    expect(palette).toHaveLength(23);
    expect([...CALENDAR_COLORS]).toEqual(palette);
    expect(Object.keys(EVENT_COLOR_CLASSES)).toEqual(palette);
  });

  it.each(palette)("%s: every class names its own colour", (name) => {
    const entry = EVENT_COLOR_CLASSES[name as keyof typeof EVENT_COLOR_CLASSES];
    expect(entry.surface.split(/\s+/)).toEqual([`bg-${name}/15`, `hover:bg-${name}/25`]);
    expect(entry.bar).toBe(`border-l-${name}`);
    expect(entry.dot).toBe(`bg-${name}`);
  });

  it.each(palette)("%s: the class names exist as theme colours", (name) => {
    // `bg-<name>` only generates CSS when `--color-<name>` is aliased; a gap renders as nothing.
    expect(themeBlock).toContain(`--color-${name}: var(--${name});`);
    expect(rootBlock).toMatch(new RegExp(`--${name}:\\s*#[0-9a-f]{6};`));
    expect(darkBlock).toMatch(new RegExp(`--${name}:\\s*#[0-9a-f]{6};`));
  });

  it.each(palette)(
    "%s: the classes are written out in the variant file, where Tailwind looks",
    (name) => {
      for (const token of [
        `"bg-${name}/15 hover:bg-${name}/25"`,
        `"border-l-${name}"`,
        `"bg-${name}"`,
      ]) {
        expect(variantSource, token).toContain(token);
      }
    },
  );

  it("builds no class name from a template", () => {
    // Comments may name the pattern they warn about; only code is checked.
    const code = variantSource.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(/(?:bg|border-l|text|ring)-\$\{/);
  });

  it("follows the repository's focus and styling rules", () => {
    expect(variantSource).not.toMatch(/outline-none/);
    // A bare `outline-hidden` is a permanent 2px outline in forced-colors mode, so every cell, chip and
    // block looks focused and the real focus is told apart by hue alone; it belongs under focus-visible.
    const code = variantSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/(?<![:\w-])outline-hidden/);
    expect(code).toContain("focus-visible:outline-hidden");
    expect(variantSource).not.toMatch(/(?<![\w-])shadow-/);
    expect(variantSource).not.toMatch(/\.css["']/);
  });

  it("applies the colour to chips, rows, blocks and dots, and defaults to slate", () => {
    const blue = EVENT_COLOR_CLASSES.blue;
    for (const classes of [
      eventChipVariant({ color: "blue" }),
      eventRowVariant({ color: "blue" }),
      weekBlockVariant({ color: "blue" }),
    ]) {
      expect(classes).toContain(blue.surface);
      expect(classes).toContain(blue.bar);
    }
    expect(eventDotVariant({ color: "blue" })).toContain(blue.dot);
    expect(eventChipVariant({})).toContain(EVENT_COLOR_CLASSES.slate.bar);
    expect(eventDotVariant({})).toContain(EVENT_COLOR_CLASSES.slate.dot);
    expect(eventChipVariant({ color: "blue" })).not.toContain("border-l-slate");
  });

  it("sizes the grid through custom properties set by density", () => {
    expect(timeCalendarVariant({ density: "Small" })).toContain("[--sc-hour:2.5rem]");
    expect(timeCalendarVariant({ density: "Medium" })).toContain("[--sc-hour:3rem]");
    expect(timeCalendarVariant({ density: "Large" })).toContain("[--sc-hour:3.5rem]");
    expect(timeCalendarVariant({})).toContain("[--sc-cell-min:7.25rem]");
    // The density context hands components the enum, so the variants must take it as it comes.
    expect(timeCalendarVariant({ density: Densities.Large })).toBe(
      timeCalendarVariant({ density: "Large" }),
    );
    expect(eventChipVariant({ density: Densities.Small, color: "teal" })).toContain("h-4");
    expect(timeCalendarVariant({})).toContain("[--sc-max-body:40rem]");
    expect(timeCalendarVariant({})).toContain("@container");
    expect(chipTimeVariant()).toContain("@[60rem]:inline");
  });
});
