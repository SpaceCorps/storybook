import { describe, expect, it } from "vite-plus/test";
import {
  isCompleteTimeText,
  isTimeWithin,
  isUnfinishedTimeText,
  minutesToTime,
  nearestTimeIndex,
  normalizeTimeValue,
  parseTimeText,
  shiftTime,
  startTime,
  stepTime,
  timeOptions,
  timeToMinutes,
} from "../src/components/ui/time-input/time-value";

describe("parseTimeText", () => {
  const readable: Array<[string, string]> = [
    ["9", "09:00"],
    ["09", "09:00"],
    ["0", "00:00"],
    ["23", "23:00"],
    ["930", "09:30"],
    ["0930", "09:30"],
    ["123", "01:23"],
    ["1230", "12:30"],
    ["2359", "23:59"],
    ["0000", "00:00"],
    ["9:30", "09:30"],
    ["09:30", "09:30"],
    ["09.30", "09:30"],
    ["9,30", "09:30"],
    ["9 30", "09:30"],
    ["9  30", "09:30"],
    ["  9:30  ", "09:30"],
    ["9:3", "09:03"],
    ["9:05", "09:05"],
    ["23:59", "23:59"],
    ["00:00", "00:00"],
  ];

  it.each(readable)("reads %j as %s", (text, expected) => {
    expect(parseTimeText(text)).toBe(expected);
  });

  const refused = [
    "",
    "   ",
    "24",
    "2400",
    "24:00",
    "9:60",
    "975",
    "960",
    "12345",
    "9pm",
    "9 PM",
    "9:30pm",
    // The AM/PM is not read, so a pasted 12-hour time is refused rather than taken for 24-hour.
    "1:30 PM",
    "9:45 PM",
    "9:45 pm",
    "09:30 AM",
    "abc",
    "9:",
    ":30",
    "9:30:00",
    "-9",
    "9.5.30",
    "٩٣٠",
  ];

  it.each(refused)("refuses %j", (text) => {
    expect(parseTimeText(text)).toBeNull();
  });
});

describe("isUnfinishedTimeText", () => {
  it("is true for an hour and its separator, where the minutes are still to come", () => {
    for (const text of ["9:", "09:", "9.", "9,", "12:", " 9: "]) {
      expect(isUnfinishedTimeText(text), text).toBe(true);
    }
  });

  it("is false for everything else", () => {
    for (const text of [
      "",
      "9",
      "09",
      "930",
      "9:3",
      "09:30",
      ":",
      "123:",
      "9pm",
      "9 ",
      "abc",
      "9:p",
    ]) {
      expect(isUnfinishedTimeText(text), text).toBe(false);
    }
  });
});

describe("normalizeTimeValue", () => {
  it("reduces a time with seconds to its HH:MM", () => {
    expect(normalizeTimeValue("09:30:00")).toBe("09:30");
    expect(normalizeTimeValue("23:59:59")).toBe("23:59");
    expect(normalizeTimeValue("00:00:00")).toBe("00:00");
    expect(normalizeTimeValue("09:30:15.250")).toBe("09:30");
    expect(normalizeTimeValue("09:30:00.5")).toBe("09:30");
  });

  it("leaves a plain HH:MM and anything that is not a time exactly as it was", () => {
    for (const text of [
      "09:30",
      "",
      "9:30",
      "9:30:00",
      "24:00:00",
      "09:60:00",
      "09:30:60",
      "09:30:",
      "09:30:00.",
      "09:30:00Z",
      "garbage",
    ]) {
      expect(normalizeTimeValue(text), text).toBe(text);
    }
  });

  it("gives something timeToMinutes can read", () => {
    expect(timeToMinutes(normalizeTimeValue("09:30:00"))).toBe(570);
  });
});

describe("isCompleteTimeText", () => {
  it("is true only when more typing could not change the time", () => {
    for (const text of ["9:30", "09:30", "09.30", "9,30", "9 30", "0930", "1230", " 9:30 "]) {
      expect(isCompleteTimeText(text), text).toBe(true);
    }
    for (const text of ["", "9", "09", "930", "123", "9:", "9:3", "09:3", "12345", "9pm"]) {
      expect(isCompleteTimeText(text), text).toBe(false);
    }
  });
});

describe("timeToMinutes and minutesToTime", () => {
  it("round-trips every strict HH:MM and rejects the rest", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("23:59")).toBe(1439);
    for (const bad of [
      "",
      "24:00",
      "9:30",
      "09:60",
      "09:30:00",
      "0930",
      "ab:cd",
      null,
      undefined,
    ]) {
      expect(timeToMinutes(bad), String(bad)).toBeNull();
    }
    for (let minutes = 0; minutes < 1440; minutes += 7) {
      expect(timeToMinutes(minutesToTime(minutes))).toBe(minutes);
    }
  });

  it("clamps minutes to the day instead of producing 24:00", () => {
    expect(minutesToTime(1440)).toBe("23:59");
    expect(minutesToTime(99999)).toBe("23:59");
    expect(minutesToTime(-5)).toBe("00:00");
  });
});

describe("isTimeWithin", () => {
  it("includes both ends and refuses non-times", () => {
    const bounds = { min: "08:00", max: "18:00" };
    expect(isTimeWithin("08:00", bounds)).toBe(true);
    expect(isTimeWithin("18:00", bounds)).toBe(true);
    expect(isTimeWithin("07:59", bounds)).toBe(false);
    expect(isTimeWithin("18:01", bounds)).toBe(false);
    expect(isTimeWithin("23:59")).toBe(true);
    expect(isTimeWithin("24:00")).toBe(false);
  });

  it("ignores bounds that are not times", () => {
    expect(isTimeWithin("12:00", { min: "soon", max: "" })).toBe(true);
  });
});

describe("stepTime", () => {
  const up = (from: string, step: number, bounds = {}) => stepTime(from, 1, step, bounds);
  const down = (from: string, step: number, bounds = {}) => stepTime(from, -1, step, bounds);

  it("moves a minute at a time by default", () => {
    expect(up("09:00", 1)).toBe("09:01");
    expect(down("09:00", 1)).toBe("08:59");
    expect(up("09:59", 1)).toBe("10:00");
  });

  it("snaps to the step grid rather than adding the step", () => {
    expect(up("09:10", 15)).toBe("09:15");
    expect(down("09:10", 15)).toBe("09:00");
    expect(up("09:15", 15)).toBe("09:30");
    expect(down("09:15", 15)).toBe("09:00");
    expect(up("09:00", 15)).toBe("09:15");
    expect(up("09:59", 5)).toBe("10:00");
    expect(down("10:00", 5)).toBe("09:55");
    expect(up("09:00", 60)).toBe("10:00");
  });

  it("stops at the ends of the day instead of wrapping", () => {
    expect(up("23:59", 1)).toBe("23:59");
    expect(down("00:00", 1)).toBe("00:00");
    expect(up("23:50", 15)).toBe("23:59");
    expect(down("00:10", 15)).toBe("00:00");
  });

  it("stops at min and max", () => {
    const bounds = { min: "08:00", max: "18:00" };
    expect(down("08:00", 15, bounds)).toBe("08:00");
    expect(down("08:05", 15, bounds)).toBe("08:00");
    expect(up("18:00", 15, bounds)).toBe("18:00");
    expect(up("17:50", 15, bounds)).toBe("18:00");
    expect(up("09:00", 15, bounds)).toBe("09:15");
  });

  it("starts an empty or unreadable field at min, else 09:00", () => {
    expect(up("", 15)).toBe("09:00");
    expect(down("", 15)).toBe("09:00");
    expect(stepTime(null, 1, 15)).toBe("09:00");
    expect(stepTime(undefined, -1, 15)).toBe("09:00");
    expect(up("junk", 15)).toBe("09:00");
    expect(up("", 15, { min: "08:00" })).toBe("08:00");
    expect(up("", 15, { max: "07:00" })).toBe("07:00");
  });

  it("treats a step that is not a positive number as one minute", () => {
    expect(up("09:00", 0)).toBe("09:01");
    expect(up("09:00", -5)).toBe("09:01");
    expect(up("09:00", Number.NaN)).toBe("09:01");
    expect(up("09:00", 0.4)).toBe("09:01");
  });
});

describe("shiftTime", () => {
  it("moves by whole minutes without snapping, clamped to the allowed range", () => {
    expect(shiftTime("09:10", 60)).toBe("10:10");
    expect(shiftTime("09:10", -60)).toBe("08:10");
    expect(shiftTime("23:30", 60)).toBe("23:59");
    expect(shiftTime("00:30", -60)).toBe("00:00");
    expect(shiftTime("09:10", 60, { max: "09:45" })).toBe("09:45");
    expect(shiftTime("", 60)).toBe("09:00");
  });
});

describe("startTime", () => {
  it("is min, else 09:00, held inside max", () => {
    expect(startTime()).toBe("09:00");
    expect(startTime({ min: "13:15" })).toBe("13:15");
    expect(startTime({ max: "06:00" })).toBe("06:00");
  });
});

describe("timeOptions", () => {
  it("lists every multiple of the step from midnight", () => {
    const hourly = timeOptions(60);
    expect(hourly).toHaveLength(24);
    expect(hourly[0]).toBe("00:00");
    expect(hourly.at(-1)).toBe("23:00");
    expect(timeOptions(30)).toHaveLength(48);
    expect(timeOptions(15)).toHaveLength(96);
    expect(timeOptions(1)).toHaveLength(1440);
  });

  it("keeps to min and max, both ends included", () => {
    const options = timeOptions(30, { min: "08:00", max: "10:00" });
    expect(options).toEqual(["08:00", "08:30", "09:00", "09:30", "10:00"]);
  });

  it("starts at the first grid time at or after min", () => {
    expect(timeOptions(30, { min: "08:10", max: "10:00" })).toEqual([
      "08:30",
      "09:00",
      "09:30",
      "10:00",
    ]);
  });

  it("is empty when no time fits", () => {
    expect(timeOptions(60, { min: "08:10", max: "08:50" })).toEqual([]);
    expect(timeOptions(30, { min: "18:00", max: "08:00" })).toEqual([]);
  });
});

describe("nearestTimeIndex", () => {
  const options = ["08:00", "08:30", "09:00", "09:30"];

  it("finds the closest option and lets the earlier one win a tie", () => {
    expect(nearestTimeIndex(options, timeToMinutes("09:00")!)).toBe(2);
    expect(nearestTimeIndex(options, timeToMinutes("09:10")!)).toBe(2);
    expect(nearestTimeIndex(options, timeToMinutes("09:20")!)).toBe(3);
    expect(nearestTimeIndex(options, timeToMinutes("08:15")!)).toBe(0);
    expect(nearestTimeIndex(options, timeToMinutes("00:00")!)).toBe(0);
    expect(nearestTimeIndex(options, timeToMinutes("23:00")!)).toBe(3);
  });
});
