import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { sv } from "date-fns/locale";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  TimeCalendar,
  formatTrackedHours,
  getPeriodRange,
  getVisibleRange,
  type TimeCalendarEvent,
  type TimeCalendarNavigation,
  type TimeCalendarProps,
} from "../src/components/ui/time-calendar";

/** Friday 23 October 2026, 14:30, in the machine's zone, which is what the calendar reads without `timeZone`. */
const NOW = new Date(2026, 9, 23, 14, 30);

interface Meta {
  n: number;
}

/**
 * Friday the 23rd has three entries (one running since 13:45), Thursday's night shift runs into
 * Friday, Tuesday's two entries overlap, and Wednesday has one with only hours.
 */
const EVENTS: TimeCalendarEvent<Meta>[] = [
  {
    id: "a",
    date: "2026-10-23",
    start: "08:30",
    end: "12:00",
    title: "Acme Logistik",
    description: "building: Route planning API",
    color: "violet",
    meta: { n: 1 },
  },
  {
    id: "b",
    date: "2026-10-23",
    start: "13:00",
    end: "13:30",
    title: "Acme Logistik",
    description: "meeting",
    color: "violet",
  },
  {
    id: "c",
    date: "2026-10-23",
    start: "13:45",
    title: "Fjällbacka webbplats",
    running: true,
    color: "green",
  },
  { id: "d", date: "2026-10-22", start: "22:00", end: "02:00", title: "On-call", color: "teal" },
  {
    id: "e",
    date: "2026-10-20",
    start: "10:00",
    end: "11:00",
    title: "Intern",
    color: "rose",
  },
  { id: "f", date: "2026-10-20", start: "08:30", end: "12:00", title: "Acme Logistik" },
  { id: "g", date: "2026-10-21", title: "Admin", hours: 1.5, color: "slate" },
];

/** Six short entries on Thursday 8 October, to overflow a month cell. */
const BUSY_DAY: TimeCalendarEvent<Meta>[] = Array.from({ length: 6 }, (_, index) => ({
  id: `busy-${index}`,
  date: "2026-10-08",
  start: `${String(8 + index).padStart(2, "0")}:00`,
  end: `${String(8 + index).padStart(2, "0")}:30`,
  title: `Task ${index + 1}`,
}));

function renderCalendar(props: Partial<TimeCalendarProps<Meta>> = {}) {
  return render(
    <TimeCalendar<Meta>
      events={EVENTS}
      now={NOW}
      defaultDate="2026-10-23"
      compact={false}
      {...props}
    />,
  );
}

const dateOf = (element: Element | null) => element?.getAttribute("data-date");
const active = () => document.activeElement;

function cell(container: HTMLElement, date: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[role="gridcell"][data-date="${date}"]`);
  if (!found) throw new Error(`no cell for ${date}`);
  return found;
}

/** Tab until a day cell has focus, so a test starts where a keyboard user would. */
async function tabToGrid(user: ReturnType<typeof userEvent.setup>) {
  for (let step = 0; step < 12; step += 1) {
    await user.tab();
    if (active()?.getAttribute("role") === "gridcell") return;
  }
  throw new Error("Tab never reached the grid");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TimeCalendar month", () => {
  it("is one grid with Monday-first weekday headers and 5 rows of 7 cells in October 2026", () => {
    const { container } = renderCalendar();
    const grid = screen.getByRole("grid", { name: "October 2026" });
    expect(screen.getAllByRole("grid")).toHaveLength(1);

    const headers = within(grid).getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(headers[0]).toHaveAccessibleName("Monday");

    const cells = within(grid).getAllByRole("gridcell");
    expect(cells).toHaveLength(35);
    expect(dateOf(cells[0])).toBe("2026-09-28");
    expect(dateOf(cells[34])).toBe("2026-11-01");
    // 1 header row and 5 weeks.
    expect(within(grid).getAllByRole("row")).toHaveLength(6);
    expect(container.querySelectorAll('[role="row"] > [role="gridcell"]')).toHaveLength(35);
  });

  it("starts the week on Sunday when asked", () => {
    renderCalendar({ weekStartsOn: 0 });
    const grid = screen.getByRole("grid");
    expect(within(grid).getAllByRole("columnheader")[0].textContent).toBe("Sun");
    expect(dateOf(within(grid).getAllByRole("gridcell")[0])).toBe("2026-09-27");
  });

  it("has exactly one tab stop, and marks today and the neighbouring months", () => {
    const { container } = renderCalendar();
    const stops = container.querySelectorAll('[role="gridcell"][tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(dateOf(stops[0])).toBe("2026-10-23");

    const today = container.querySelectorAll('[aria-current="date"]');
    expect(today).toHaveLength(1);
    expect(dateOf(today[0])).toBe("2026-10-23");

    const outside = [...container.querySelectorAll("[data-outside]")].map(dateOf);
    expect(outside).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-11-01"]);
  });

  it("names a day with its date, total and entry count, and leaves an empty day plain", () => {
    const { container } = renderCalendar();
    expect(cell(container, "2026-10-23")).toHaveAccessibleName(
      "Friday 23 October 2026, 4h 45m, 3 entries",
    );
    expect(cell(container, "2026-10-22")).toHaveAccessibleName(
      "Thursday 22 October 2026, 4h, 1 entry",
    );
    expect(cell(container, "2026-10-24")).toHaveAccessibleName("Saturday 24 October 2026");
  });

  it("shows the period's title and total, counting only days inside the month", () => {
    renderCalendar();
    // 4h 45m (23rd) + 4h (22nd) + 4h 30m (20th) + 1h 30m (21st).
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("October 2026 · 14h 45m");
  });

  it("leaves the days outside the month out of the title's total, though their own cells count them", () => {
    // An app that fetches the whole visible range hands the calendar entries from the neighbouring
    // months too; they are on screen in the outside cells and must not inflate the month.
    const outside: TimeCalendarEvent<Meta>[] = [
      { id: "before", date: "2026-09-30", start: "09:00", end: "10:00", title: "Before" },
      { id: "after", date: "2026-11-01", title: "After", hours: 2 },
    ];
    const { container } = renderCalendar({ events: [...EVENTS, ...outside] });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("October 2026 · 14h 45m");
    expect(cell(container, "2026-09-30")).toHaveAccessibleName(
      "Wednesday 30 September 2026, 1h, 1 entry",
    );
    expect(cell(container, "2026-11-01")).toHaveAccessibleName(
      "Sunday 1 November 2026, 2h, 1 entry",
    );
  });

  it("uses formatHours for the header, the cells and the entry names", () => {
    const { container } = renderCalendar({ formatHours: (hours) => `${hours.toFixed(2)} h` });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("October 2026 · 14.75 h");
    expect(cell(container, "2026-10-23")).toHaveAccessibleName(
      "Friday 23 October 2026, 4.75 h, 3 entries",
    );
    expect(within(cell(container, "2026-10-23")).getByText("4.75 h")).toBeInTheDocument();
  });

  it("lists a day's entries as chips in time order and names them fully", () => {
    const { container } = renderCalendar();
    const chips = within(cell(container, "2026-10-23")).getAllByRole("button");
    expect(chips.map((chip) => chip.getAttribute("data-event-id"))).toEqual(["a", "b", "c"]);
    expect(chips[0]).toHaveAccessibleName(
      "Acme Logistik, 08:30 to 12:00, 3h 30m, building: Route planning API",
    );
    expect(chips[2]).toHaveAccessibleName("Fjällbacka webbplats, since 13:45, 45m, running");
  });

  it("sorts timed entries first and shows an hours-only entry's duration where the time goes", () => {
    const { container } = renderCalendar();
    const hoursOnly = within(cell(container, "2026-10-21")).getByRole("button");
    expect(hoursOnly).toHaveAccessibleName("Admin, 1h 30m");
    expect(hoursOnly).toHaveTextContent("1h 30mAdmin");
  });

  it("says a night shift ends the next day", () => {
    const { container } = renderCalendar();
    expect(within(cell(container, "2026-10-22")).getByRole("button")).toHaveAccessibleName(
      "On-call, 22:00 to 02:00, 4h (ends 02:00 next day)",
    );
  });

  describe("more", () => {
    it("shows max-1 chips and +N more, and opens the whole day", async () => {
      const user = userEvent.setup();
      const onEventClick = vi.fn();
      const { container } = renderCalendar({ events: BUSY_DAY, onEventClick });
      const busy = cell(container, "2026-10-08");
      const buttons = within(busy).getAllByRole("button");
      // Two chips and the overflow button: a cell never exceeds 3 lines.
      expect(buttons).toHaveLength(3);
      expect(buttons[2]).toHaveTextContent("+4 more");
      expect(buttons[2]).toHaveAccessibleName("+4 more, Thursday 8 October 2026");

      await user.click(buttons[2]);
      const popover = await screen.findByRole("dialog", { name: "Thursday 8 October 2026" });
      expect(within(popover).getAllByRole("button")).toHaveLength(6);
      expect(popover).toHaveTextContent("Thursday 8 October · 3h");

      await user.click(within(popover).getByRole("button", { name: /^Task 5/ }));
      expect(onEventClick).toHaveBeenCalledTimes(1);
      expect(onEventClick.mock.calls[0][0].id).toBe("busy-4");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("clicking inside the popover does not count as a click on the day", async () => {
      const user = userEvent.setup();
      const onDayClick = vi.fn();
      const { container } = renderCalendar({ events: BUSY_DAY, onDayClick });
      await user.click(within(cell(container, "2026-10-08")).getByText("+4 more"));
      await user.click(await screen.findByText("Thursday 8 October", { exact: false }));
      expect(onDayClick).not.toHaveBeenCalled();
    });

    it("honours maxEventsPerDay", () => {
      const { container } = renderCalendar({ events: BUSY_DAY, maxEventsPerDay: 5 });
      const busy = cell(container, "2026-10-08");
      expect(within(busy).getAllByRole("button")).toHaveLength(5);
      expect(within(busy).getByText("+2 more")).toBeInTheDocument();
      // Exactly max entries: no overflow button.
      const exact = renderCalendar({ events: BUSY_DAY, maxEventsPerDay: 6 });
      expect(within(exact.container).queryByText(/more/)).not.toBeInTheDocument();
    });
  });

  describe("clicks", () => {
    it("reports the day for a click on the empty part of a cell", async () => {
      const user = userEvent.setup();
      const onDayClick = vi.fn();
      const onEventClick = vi.fn();
      const { container } = renderCalendar({ onDayClick, onEventClick });
      await user.click(cell(container, "2026-10-24"));
      expect(onDayClick).toHaveBeenCalledExactlyOnceWith("2026-10-24");
      expect(onEventClick).not.toHaveBeenCalled();
    });

    it("reports the entry, with its meta, and never also the day", async () => {
      const user = userEvent.setup();
      const onDayClick = vi.fn();
      const onEventClick = vi.fn();
      const { container } = renderCalendar({ onDayClick, onEventClick });
      await user.click(within(cell(container, "2026-10-23")).getAllByRole("button")[0]);
      expect(onEventClick).toHaveBeenCalledTimes(1);
      expect(onEventClick.mock.calls[0][0]).toBe(EVENTS[0]);
      expect(onEventClick.mock.calls[0][0].meta).toEqual({ n: 1 });
      expect(onDayClick).not.toHaveBeenCalled();
    });

    it("acts on a day with Enter and Space on the cell, but not on an entry inside it", async () => {
      const user = userEvent.setup();
      const onDayClick = vi.fn();
      const onEventClick = vi.fn();
      const { container } = renderCalendar({ onDayClick, onEventClick });
      cell(container, "2026-10-23").focus();
      await user.keyboard("{Enter}");
      await user.keyboard(" ");
      expect(onDayClick.mock.calls).toEqual([["2026-10-23"], ["2026-10-23"]]);

      await user.tab();
      expect(active()).toHaveAttribute("data-event-id", "a");
      await user.keyboard("{Enter}");
      expect(onEventClick).toHaveBeenCalledTimes(1);
      expect(onDayClick).toHaveBeenCalledTimes(2);
    });
  });

  describe("keyboard", () => {
    it("enters the grid on the active day with one Tab stop, and walks the chips of that day only", async () => {
      const user = userEvent.setup();
      const { container } = renderCalendar();
      await tabToGrid(user);
      expect(dateOf(active())).toBe("2026-10-23");

      await user.tab();
      expect(active()).toHaveAttribute("data-event-id", "a");
      await user.tab();
      expect(active()).toHaveAttribute("data-event-id", "b");
      await user.tab();
      expect(active()).toHaveAttribute("data-event-id", "c");
      // Other days' chips are not tab stops.
      expect(
        container.querySelectorAll('[data-date="2026-10-22"] button[tabindex="0"]'),
      ).toHaveLength(0);
      await user.tab();
      expect(container.contains(active())).toBe(false);
    });

    it("moves the focused day with the arrow keys, Home and End", async () => {
      const user = userEvent.setup();
      const { container } = renderCalendar();
      await tabToGrid(user);
      await user.keyboard("{ArrowRight}");
      expect(dateOf(active())).toBe("2026-10-24");
      await user.keyboard("{ArrowLeft}{ArrowLeft}");
      expect(dateOf(active())).toBe("2026-10-22");
      await user.keyboard("{ArrowUp}");
      expect(dateOf(active())).toBe("2026-10-15");
      await user.keyboard("{ArrowDown}{ArrowDown}");
      expect(dateOf(active())).toBe("2026-10-29");
      await user.keyboard("{Home}");
      expect(dateOf(active())).toBe("2026-10-26");
      await user.keyboard("{End}");
      expect(dateOf(active())).toBe("2026-11-01");
      // Still October: the 1st of November is one of the grid's own outside days.
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("October 2026");
      // The tab stop follows focus.
      expect(cell(container, "2026-11-01")).toHaveAttribute("tabindex", "0");
      expect(cell(container, "2026-10-23")).toHaveAttribute("tabindex", "-1");
    });

    it("moves a month with PageUp and PageDown and a year with Shift, clamping the day", async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn<(next: TimeCalendarNavigation) => void>();
      renderCalendar({ onNavigate, defaultDate: "2026-01-31" });
      await tabToGrid(user);
      expect(dateOf(active())).toBe("2026-01-31");
      await user.keyboard("{PageDown}");
      expect(dateOf(active())).toBe("2026-02-28");
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("February 2026");
      expect(onNavigate).toHaveBeenLastCalledWith({
        date: "2026-02-28",
        view: "month",
        range: { from: "2026-01-26", to: "2026-03-01" },
      });
      await user.keyboard("{PageUp}");
      expect(dateOf(active())).toBe("2026-01-28");
      await user.keyboard("{Shift>}{PageDown}{/Shift}");
      expect(dateOf(active())).toBe("2027-01-28");
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("January 2027");
    });

    it("changes the month when a key leads off the grid, and focuses the new day", async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn<(next: TimeCalendarNavigation) => void>();
      const { container } = renderCalendar({ onNavigate, defaultDate: "2026-10-28" });
      await tabToGrid(user);
      await user.keyboard("{ArrowDown}");
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("November 2026");
      expect(dateOf(active())).toBe("2026-11-04");
      expect(active()).toBe(cell(container, "2026-11-04"));
      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate.mock.calls[0][0]).toEqual({
        date: "2026-11-04",
        view: "month",
        range: { from: "2026-10-26", to: "2026-12-06" },
      });
    });

    it("ignores keys held with Ctrl, Alt or Meta, and keys that mean nothing", async () => {
      const user = userEvent.setup();
      renderCalendar();
      await tabToGrid(user);
      const before = dateOf(active());
      await user.keyboard("{Control>}{ArrowRight}{/Control}");
      await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
      await user.keyboard("{Meta>}{Home}{/Meta}");
      await user.keyboard("x");
      expect(dateOf(active())).toBe(before);
    });

    it("sends Escape on an entry back to its cell, and arrows from an entry move from the cell", async () => {
      const user = userEvent.setup();
      const { container } = renderCalendar();
      await tabToGrid(user);
      await user.tab();
      expect(active()).toHaveAttribute("data-event-id", "a");
      await user.keyboard("{Escape}");
      expect(active()).toBe(cell(container, "2026-10-23"));

      await user.tab();
      await user.keyboard("{ArrowRight}");
      expect(active()).toBe(cell(container, "2026-10-24"));
    });

    it("does not move focus when the keys arrive from a popover", async () => {
      const user = userEvent.setup();
      const { container } = renderCalendar({ events: BUSY_DAY, defaultDate: "2026-10-08" });
      await user.click(within(cell(container, "2026-10-08")).getByText("+4 more"));
      const popover = await screen.findByRole("dialog");
      within(popover).getAllByRole("button")[0].focus();
      await user.keyboard("{ArrowRight}");
      expect(popover.contains(active())).toBe(true);
    });
  });
});

describe("TimeCalendar header and navigation", () => {
  it("steps by month, goes back to today, and reports each change with the visible range", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn<(next: TimeCalendarNavigation) => void>();
    renderCalendar({ onNavigate });

    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("grid", { name: "November 2026" })).toBeInTheDocument();
    expect(onNavigate).toHaveBeenLastCalledWith({
      date: "2026-11-23",
      view: "month",
      range: { from: "2026-10-26", to: "2026-12-06" },
    });

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("grid", { name: "September 2026" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeInTheDocument();
    expect(onNavigate).toHaveBeenCalledTimes(4);
  });

  it("puts the roving tab stop on the anchor of the period it moves to", async () => {
    const user = userEvent.setup();
    const { container } = renderCalendar();
    await tabToGrid(user);
    await user.keyboard("{ArrowRight}");
    await user.click(screen.getByRole("button", { name: "Next month" }));
    const stops = container.querySelectorAll('[role="gridcell"][tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(dateOf(stops[0])).toBe("2026-11-23");
  });

  it("starts the tab stop over on the new anchor even when the old stop is still on screen", async () => {
    // 28 October is on screen in the November grid as well, so the stop only moves if it is reset.
    const user = userEvent.setup();
    const { container } = renderCalendar();
    await tabToGrid(user);
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(dateOf(active())).toBe("2026-10-28");
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(cell(container, "2026-10-28")).toBeInTheDocument();
    const stops = container.querySelectorAll('[role="gridcell"][tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(dateOf(stops[0])).toBe("2026-11-23");
  });

  it("leaves the period to the parent when `date` is controlled", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn<(next: TimeCalendarNavigation) => void>();
    const { rerender } = render(
      <TimeCalendar
        events={[]}
        now={NOW}
        date="2026-10-23"
        compact={false}
        onNavigate={onNavigate}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeInTheDocument();

    rerender(
      <TimeCalendar
        events={[]}
        now={NOW}
        date="2026-11-23"
        compact={false}
        onNavigate={onNavigate}
      />,
    );
    expect(screen.getByRole("grid", { name: "November 2026" })).toBeInTheDocument();
    // A change the user did not make is not reported.
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("switches between Month and Week, keeps the view when the active item is pressed again", async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    const onNavigate = vi.fn<(next: TimeCalendarNavigation) => void>();
    renderCalendar({ onViewChange, onNavigate });

    const switcher = screen.getByRole("group", { name: "Calendar view" });
    await user.click(within(switcher).getByRole("radio", { name: "Week" }));
    expect(screen.getByRole("grid", { name: "week 43, 19–25 Oct 2026" })).toBeInTheDocument();
    expect(onViewChange).toHaveBeenCalledExactlyOnceWith("week");
    expect(onNavigate).toHaveBeenLastCalledWith({
      date: "2026-10-23",
      view: "week",
      range: { from: "2026-10-19", to: "2026-10-25" },
    });

    await user.click(within(switcher).getByRole("radio", { name: "Week" }));
    expect(screen.getByRole("grid", { name: "week 43, 19–25 Oct 2026" })).toBeInTheDocument();
    expect(within(switcher).getByRole("radio", { name: "Week" })).toBeChecked();
    expect(onViewChange).toHaveBeenCalledTimes(1);
  });

  it("follows a controlled view", async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    renderCalendar({ view: "month", onViewChange });
    await user.click(screen.getByRole("radio", { name: "Week" }));
    expect(onViewChange).toHaveBeenCalledWith("week");
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeInTheDocument();
  });

  it("offers no switch for a single view, and shows that view", () => {
    renderCalendar({ views: ["week"] });
    expect(screen.queryByRole("group", { name: "Calendar view" })).not.toBeInTheDocument();
    expect(screen.getByRole("grid", { name: /week 43/ })).toBeInTheDocument();
  });

  it("renders the toolbar, the heading level and translated labels", () => {
    renderCalendar({
      toolbar: <button type="button">Log time</button>,
      headingLevel: 3,
      labels: { today: "Idag", nextMonth: "Nästa månad", more: (count) => `+${count} till` },
    });
    expect(screen.getByRole("button", { name: "Log time" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("October 2026");
    expect(screen.getByRole("button", { name: "Idag" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nästa månad" })).toBeInTheDocument();
  });

  it("forwards the ref and extra props to the section, and marks it busy while loading", () => {
    const ref = React.createRef<HTMLElement>();
    renderCalendar({
      ref,
      "aria-label": "Tracked time",
      "data-testid": "cal",
      loading: true,
    } as never);
    const section = screen.getByTestId("cal");
    expect(ref.current).toBe(section);
    expect(section.tagName).toBe("SECTION");
    expect(section).toHaveAttribute("aria-busy", "true");
    expect(section).toHaveAccessibleName("Tracked time");
    // The grid stays in place while it loads.
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("does not throw on a malformed date, and falls back to today", () => {
    renderCalendar({ defaultDate: "2026-02-30" });
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeInTheDocument();
    expect(() => renderCalendar({ date: "tomorrow" })).not.toThrow();
  });

  it("reads today in the given time zone", () => {
    // 23:30 UTC on the 25th is already the 26th in Stockholm (CET, UTC+1 after the clocks change).
    const late = new Date("2026-10-25T23:30:00.000Z");
    const { container } = render(
      <TimeCalendar events={[]} now={late} timeZone="Europe/Stockholm" compact={false} />,
    );
    expect(dateOf(container.querySelector('[aria-current="date"]'))).toBe("2026-10-26");
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeInTheDocument();
  });
});

describe("TimeCalendar week", () => {
  const renderWeek = (props: Partial<TimeCalendarProps<Meta>> = {}) =>
    renderCalendar({ defaultView: "week", ...props });

  /** `calc(var(--sc-hour) * N)` to N. */
  const hoursOf = (value: string) => Number(/\* ([\d.]+)\)/.exec(value)?.[1]);

  const block = (container: HTMLElement, date: string, id: string) =>
    within(cell(container, date))
      .getAllByRole("button")
      .find((button) => button.getAttribute("data-event-id") === id) as HTMLElement;

  it("is a grid of a gutter and seven days, in Monday-first order", () => {
    const { container } = renderWeek();
    const grid = screen.getByRole("grid", { name: "week 43, 19–25 Oct 2026" });
    const headers = within(grid).getAllByRole("columnheader");
    expect(headers).toHaveLength(8);
    expect(headers[0]).toHaveTextContent("Time");
    expect(headers.slice(1).map((header) => header.getAttribute("aria-label"))).toEqual([
      "Monday 19 October 2026",
      "Tuesday 20 October 2026",
      "Wednesday 21 October 2026",
      "Thursday 22 October 2026",
      "Friday 23 October 2026",
      "Saturday 24 October 2026",
      "Sunday 25 October 2026",
    ]);
    expect([...container.querySelectorAll('[role="gridcell"][data-date]')].map(dateOf)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
    expect(container.querySelectorAll('[role="gridcell"][tabindex="0"]')).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "19–25 Oct 2026 · week 43 · 14h 45m",
    );
  });

  it("totals only the week's own days, though a neighbouring week's entries are in `events`", () => {
    const { container } = renderWeek({
      events: [
        ...EVENTS,
        { id: "sun", date: "2026-10-18", title: "Last week", hours: 3 },
        { id: "mon", date: "2026-10-26", title: "Next week", hours: 5 },
      ],
    });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "19–25 Oct 2026 · week 43 · 14h 45m",
    );
    expect(container.querySelector('[data-date="2026-10-18"]')).toBeNull();
  });

  it("leaves the week number out when the week does not start on Monday", () => {
    renderWeek({ weekStartsOn: 0 });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("18–24 Oct 2026 · 14h 45m");
  });

  it("puts a block at its time with a height in hours", () => {
    const { container } = renderWeek({ events: [EVENTS[0]] });
    // The default grid starts at 06:00, so 08:30 is 2.5 hours down and 3.5 hours long.
    const morning = block(container, "2026-10-23", "a");
    expect(morning.style.top).toBe("calc(var(--sc-hour) * 2.5)");
    expect(morning.style.height).toBe("calc(var(--sc-hour) * 3.5)");
    expect(morning.style.left).toBe("calc(0% + 1px)");
    expect(morning.style.width).toBe("calc(100% - 2px)");
    expect(morning).toHaveAccessibleName(
      "Acme Logistik, 08:30 to 12:00, 3h 30m, building: Route planning API",
    );
  });

  it("sizes the body in visible hours, from 06:00 to 22:00 unless entries need more", () => {
    const { container } = renderWeek({ events: [EVENTS[0]] });
    const body = container.querySelector<HTMLElement>('[role="row"][style*="--sc-hour"]');
    expect(body?.style.height).toBe("calc(var(--sc-hour) * 16)");
    const labels = [...container.querySelectorAll('[aria-hidden="true"] span')]
      .map((span) => span.textContent)
      .filter((text) => /^\d\d:00$/.test(text ?? ""));
    expect(labels[0]).toBe("06:00");
    expect(labels).toHaveLength(16);
    expect(labels.at(-1)).toBe("21:00");
  });

  it("widens the range for an early entry and for a night shift, and splits the shift in two", () => {
    const early = renderWeek({
      events: [{ id: "x", date: "2026-10-21", start: "05:30", end: "07:00", title: "Early" }],
    });
    expect(block(early.container, "2026-10-21", "x").style.top).toBe("calc(var(--sc-hour) * 0.5)");
    early.unmount();

    const { container } = renderWeek();
    // 22:00 to 02:00 pulls the week to the whole day: 24 hours, 00:00 at the top.
    const tail = block(container, "2026-10-22", "d");
    const rest = block(container, "2026-10-23", "d");
    expect(hoursOf(tail.style.top)).toBe(22);
    expect(hoursOf(tail.style.height)).toBe(2);
    expect(hoursOf(rest.style.top)).toBe(0);
    expect(hoursOf(rest.style.height)).toBe(2);
    expect(tail).toHaveAccessibleName("On-call, 22:00 to 02:00, 4h (ends 02:00 next day)");
    expect(rest).toHaveAccessibleName("On-call, 22:00 to 02:00, 4h (continues from previous day)");
    expect(
      container.querySelector<HTMLElement>('[role="row"][style*="--sc-hour"]')?.style.height,
    ).toBe("calc(var(--sc-hour) * 24)");
    // The continuation sits above Friday's 08:30 entry and does not hide it.
    expect(hoursOf(block(container, "2026-10-23", "a").style.top)).toBe(8.5);
  });

  it("packs overlapping entries side by side", () => {
    const { container } = renderWeek();
    const long = block(container, "2026-10-20", "f");
    const short = block(container, "2026-10-20", "e");
    expect(long.style.left).toBe("calc(0% + 1px)");
    expect(long.style.width).toBe("calc(50% - 2px)");
    expect(short.style.left).toBe("calc(50% + 1px)");
    expect(short.style.width).toBe("calc(50% - 2px)");
  });

  describe("entries shorter than a block", () => {
    const short = (id: string, start: string, end: string): TimeCalendarEvent<Meta> => ({
      id,
      date: "2026-10-21",
      start,
      end,
      title: id,
    });
    const placement = (container: HTMLElement, id: string) => {
      const style = block(container, "2026-10-21", id).style;
      return [style.left, style.width];
    };

    it("are packed side by side, because a block is drawn taller than they are long", () => {
      const { container } = renderWeek({
        events: [
          short("a", "10:00", "10:10"),
          short("b", "10:10", "10:20"),
          short("c", "10:20", "10:30"),
        ],
      });
      expect(placement(container, "a")).toEqual(["calc(0% + 1px)", "calc(33.3333% - 2px)"]);
      expect(placement(container, "b")).toEqual(["calc(33.3333% + 1px)", "calc(33.3333% - 2px)"]);
      expect(placement(container, "c")).toEqual(["calc(66.6667% + 1px)", "calc(33.3333% - 2px)"]);
    });

    it("share a column again once the block above has ended, at the density's own height", () => {
      // 25 minutes apart is enough for a Medium block (27 minutes tall) only as the next one starts
      // below it; at Small (32 minutes) the same two overlap.
      const events = [short("a", "10:00", "10:10"), short("b", "10:28", "10:38")];
      const medium = renderWeek({ events, density: "Medium" as never });
      expect(placement(medium.container, "b")).toEqual(["calc(0% + 1px)", "calc(100% - 2px)"]);
      medium.unmount();
      const small = renderWeek({ events, density: "Small" as never });
      expect(placement(small.container, "a")).toEqual(["calc(0% + 1px)", "calc(50% - 2px)"]);
      expect(placement(small.container, "b")).toEqual(["calc(50% + 1px)", "calc(50% - 2px)"]);
    });

    it("keep their real length in the height, which the minimum then lifts in CSS", () => {
      const { container } = renderWeek({ events: [short("a", "10:00", "10:10")] });
      const style = block(container, "2026-10-21", "a").style;
      expect(hoursOf(style.height)).toBeCloseTo(10 / 60, 3);
      expect(style.minHeight).toBe("1.35rem");
    });
  });

  it("keeps entries without a time in a strip, and shows the strip only when there are any", () => {
    const { container } = renderWeek();
    const strip = screen.getByRole("rowheader", { name: "No time" });
    const row = strip.parentElement as HTMLElement;
    expect(within(row).getByRole("button", { name: "Admin, 1h 30m" })).toBeInTheDocument();
    // It is not drawn on the clock as well.
    expect(
      within(cell(container, "2026-10-21")).queryByRole("button", { name: /Admin/ }),
    ).not.toBeInTheDocument();

    const without = renderWeek({ events: [EVENTS[0]] });
    expect(within(without.container).queryByRole("rowheader")).not.toBeInTheDocument();
  });

  it("draws the now-line in today's column only, at the time of day", () => {
    const { container } = renderWeek();
    const lines = container.querySelectorAll<HTMLElement>("[data-now-line]");
    expect(lines).toHaveLength(1);
    expect(lines[0].closest("[data-date]")?.getAttribute("data-date")).toBe("2026-10-23");
    // 14:30 is 14.5 hours after midnight; the whole day is shown for the night shift, so 00:00 is the top.
    expect(lines[0].style.top).toBe("calc(var(--sc-hour) * 14.5)");
    expect(lines[0]).toHaveAttribute("aria-hidden", "true");
  });

  it("has no now-line in a week that does not contain today", async () => {
    const user = userEvent.setup();
    const { container } = renderWeek();
    await user.click(screen.getByRole("button", { name: "Previous week" }));
    expect(container.querySelectorAll("[data-now-line]")).toHaveLength(0);
  });

  it("ends a running entry at the present", () => {
    const { container } = renderWeek({
      events: [EVENTS[2]],
    });
    const running = block(container, "2026-10-23", "c");
    // 13:45 to 14:30 is 0.75 hours, starting 7.75 hours after 06:00.
    expect(running.style.top).toBe("calc(var(--sc-hour) * 7.75)");
    expect(running.style.height).toBe("calc(var(--sc-hour) * 0.75)");
    expect(running).toHaveAccessibleName("Fjällbacka webbplats, since 13:45, 45m, running");
  });

  it("turns a click on a column into a time, snapped down to snapMinutes", () => {
    const onSlotClick = vi.fn();
    const onDayClick = vi.fn();
    const { container } = renderWeek({ events: [], onSlotClick, onDayClick });
    const column = cell(container, "2026-10-21");
    // 06:00 to 22:00 is 960 px tall here, so 1 px is 1 minute.
    vi.spyOn(column, "getBoundingClientRect").mockReturnValue({
      top: 100,
      height: 960,
      bottom: 1060,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    fireEvent.click(column, { clientY: 100 + 195 + 7 });
    expect(onSlotClick).toHaveBeenCalledExactlyOnceWith("2026-10-21", "09:15");
    expect(onDayClick).not.toHaveBeenCalled();
    fireEvent.click(column, { clientY: 100 });
    expect(onSlotClick).toHaveBeenLastCalledWith("2026-10-21", "06:00");
    fireEvent.click(column, { clientY: 100 + 960 });
    expect(onSlotClick).toHaveBeenLastCalledWith("2026-10-21", "21:45");
  });

  it("reports the day for a click on a column when there is no onSlotClick", () => {
    const onDayClick = vi.fn();
    const { container } = renderWeek({ events: [], onDayClick });
    fireEvent.click(cell(container, "2026-10-21"));
    expect(onDayClick).toHaveBeenCalledExactlyOnceWith("2026-10-21");
  });

  it("does not report a slot for a click on a block, only the entry", async () => {
    const user = userEvent.setup();
    const onSlotClick = vi.fn();
    const onEventClick = vi.fn();
    const { container } = renderWeek({ onSlotClick, onEventClick });
    await user.click(block(container, "2026-10-23", "a"));
    expect(onSlotClick).not.toHaveBeenCalled();
    expect(onEventClick).toHaveBeenCalledExactlyOnceWith(EVENTS[0]);
  });

  it("reports the day for a click on its header", async () => {
    const user = userEvent.setup();
    const onDayClick = vi.fn();
    renderWeek({ onDayClick });
    await user.click(screen.getByRole("columnheader", { name: "Wednesday 21 October 2026" }));
    expect(onDayClick).toHaveBeenCalledExactlyOnceWith("2026-10-21");
  });

  describe("keyboard", () => {
    it("moves by day with the arrows, to the ends of the week with Home and End", async () => {
      const user = userEvent.setup();
      renderWeek();
      await tabToGrid(user);
      expect(dateOf(active())).toBe("2026-10-23");
      await user.keyboard("{ArrowLeft}");
      expect(dateOf(active())).toBe("2026-10-22");
      await user.keyboard("{Home}");
      expect(dateOf(active())).toBe("2026-10-19");
      await user.keyboard("{End}");
      expect(dateOf(active())).toBe("2026-10-25");
    });

    it("changes the week when an arrow leaves it, and with PageUp and PageDown", async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn<(next: TimeCalendarNavigation) => void>();
      const { container } = renderWeek({ onNavigate });
      await tabToGrid(user);
      await user.keyboard("{End}{ArrowRight}");
      expect(dateOf(active())).toBe("2026-10-26");
      expect(
        screen.getByRole("grid", { name: "week 44, 26 Oct – 1 Nov 2026" }),
      ).toBeInTheDocument();
      expect(active()).toBe(cell(container, "2026-10-26"));
      expect(onNavigate).toHaveBeenLastCalledWith({
        date: "2026-10-26",
        view: "week",
        range: { from: "2026-10-26", to: "2026-11-01" },
      });
      await user.keyboard("{PageUp}");
      expect(dateOf(active())).toBe("2026-10-19");
      await user.keyboard("{PageDown}{PageDown}");
      expect(dateOf(active())).toBe("2026-11-02");
    });

    it("leaves ArrowUp, ArrowDown and Shift+Page keys to the browser", async () => {
      const user = userEvent.setup();
      renderWeek();
      await tabToGrid(user);
      const down = new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      });
      active()?.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(false);
      const shiftPage = new KeyboardEvent("keydown", {
        key: "PageDown",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      active()?.dispatchEvent(shiftPage);
      expect(shiftPage.defaultPrevented).toBe(false);
      expect(dateOf(active())).toBe("2026-10-23");
    });

    it("walks the active day's blocks in time order with Tab, and Enter on a cell acts on the day", async () => {
      const user = userEvent.setup();
      const onDayClick = vi.fn();
      renderWeek({ onDayClick });
      await tabToGrid(user);
      await user.keyboard("{Enter}");
      expect(onDayClick).toHaveBeenCalledExactlyOnceWith("2026-10-23");
      const order: (string | null)[] = [];
      for (let step = 0; step < 3; step += 1) {
        await user.tab();
        order.push(active()?.getAttribute("data-event-id") ?? null);
      }
      // The night shift's continuation starts the day at 00:00, then 08:30, 13:00 and 13:45 follow.
      expect(order).toEqual(["d", "a", "b"]);
    });
  });
});

describe("TimeCalendar narrow layout", () => {
  it("selects a day on a tap and lists it below, reporting the day only from the add button", async () => {
    const user = userEvent.setup();
    const onDayClick = vi.fn();
    const onNavigate = vi.fn<(next: TimeCalendarNavigation) => void>();
    const { container } = renderCalendar({ compact: true, onDayClick, onNavigate });

    // The grid keeps its roles, with dots in place of chips and the selected day marked.
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeInTheDocument();
    expect(cell(container, "2026-10-23")).toHaveAttribute("aria-selected", "true");
    expect(within(cell(container, "2026-10-23")).queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Friday 23 October · 4h 45m",
    );
    expect(screen.getAllByRole("button", { name: /^Acme Logistik/ })).toHaveLength(2);

    await user.click(cell(container, "2026-10-22"));
    expect(onDayClick).not.toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(cell(container, "2026-10-22")).toHaveAttribute("aria-selected", "true");
    expect(cell(container, "2026-10-23")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Thursday 22 October · 4h");
    expect(screen.getByRole("button", { name: /^On-call/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add entry, Thursday 22 October 2026" }));
    expect(onDayClick).toHaveBeenCalledExactlyOnceWith("2026-10-22");
  });

  it("selects the focused day with Enter, and Space too", async () => {
    const user = userEvent.setup();
    const { container } = renderCalendar({ compact: true });
    await tabToGrid(user);
    await user.keyboard("{ArrowRight}{Enter}");
    expect(cell(container, "2026-10-24")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft} ");
    expect(cell(container, "2026-10-23")).toHaveAttribute("aria-selected", "true");
  });

  it("says when the selected day is empty, and omits the add button without onDayClick", () => {
    renderCalendar({ compact: true, defaultDate: "2026-10-24" });
    expect(screen.getByText("No entries")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add entry/ })).not.toBeInTheDocument();
  });

  it("stacks the seven days of the week as an agenda, with no grid", () => {
    renderCalendar({ compact: true, defaultView: "week", onDayClick: () => {} });
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    const days = screen.getAllByRole("heading", { level: 3 });
    expect(days.map((day) => day.textContent)).toEqual([
      "Monday 19 October",
      "Tuesday 20 October · 4h 30m",
      "Wednesday 21 October · 1h 30m",
      "Thursday 22 October · 4h",
      "Friday 23 October · 4h 45m",
      "Saturday 24 October",
      "Sunday 25 October",
    ]);
    // Monday, Saturday and Sunday have nothing.
    expect(screen.getAllByText("No entries")).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: /^Add entry,/ })).toHaveLength(7);
    // The entry with only hours is listed with the others.
    expect(screen.getByRole("button", { name: "Admin, 1h 30m" })).toBeInTheDocument();
  });

  describe("by width", () => {
    const widthOf = (width: number) =>
      vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(width);

    it("switches to the agenda under compactBelow, and not above it", () => {
      widthOf(500);
      renderCalendar({ compact: undefined });
      expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
    });

    it("keeps the full grid at or above compactBelow", () => {
      widthOf(640);
      renderCalendar({ compact: undefined });
      expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
      expect(screen.getByRole("grid")).toBeInTheDocument();
    });

    it("moves the threshold with compactBelow", () => {
      widthOf(500);
      renderCalendar({ compact: undefined, compactBelow: 400 });
      expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    });

    it("treats an unmeasured width as room enough", () => {
      widthOf(0);
      renderCalendar({ compact: undefined });
      expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    });

    it("lets `compact` override the width", () => {
      widthOf(300);
      renderCalendar({ compact: false });
      expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    });
  });
});

describe("TimeCalendar density", () => {
  it("sizes the grid through custom properties set by the density prop", () => {
    const { container, rerender } = renderCalendar({ density: "Large" as never });
    const section = container.querySelector("section") as HTMLElement;
    expect(section.className).toContain("[--sc-hour:3.5rem]");
    rerender(<TimeCalendar events={[]} now={NOW} density={"Small" as never} compact={false} />);
    expect(container.querySelector("section")?.className).toContain("[--sc-hour:2.5rem]");
  });

  it("takes maxBodyHeight as the week's height cap", () => {
    const { container } = renderCalendar({ defaultView: "week", maxBodyHeight: "20rem" });
    expect(
      container.querySelector<HTMLElement>("section")?.style.getPropertyValue("--sc-max-body"),
    ).toBe("20rem");
  });
});

describe("TimeCalendar props reach the parts", () => {
  it("merges className into the root, keeping the calendar's own classes", () => {
    const { container } = renderCalendar({ className: "my-calendar" });
    const section = container.querySelector("section") as HTMLElement;
    expect(section.className).toContain("my-calendar");
    expect(section.className).toContain("@container");
  });

  it("takes names from `locale`", () => {
    const { container } = renderCalendar({ locale: sv });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("oktober 2026");
    expect(screen.getByRole("grid", { name: "oktober 2026" })).toBeInTheDocument();
    expect(cell(container, "2026-10-24")).toHaveAccessibleName("lördag 24 oktober 2026");
  });

  it("draws the week from `hourRange`", () => {
    const { container } = renderCalendar({
      defaultView: "week",
      events: [EVENTS[0]],
      hourRange: [8, 12],
    });
    const body = container.querySelector<HTMLElement>('[role="row"][style*="--sc-hour"]');
    expect(body?.style.height).toBe("calc(var(--sc-hour) * 4)");
    const labels = [...container.querySelectorAll('[aria-hidden="true"] span')]
      .map((span) => span.textContent)
      .filter((text) => /^\d\d:00$/.test(text ?? ""));
    expect(labels).toEqual(["08:00", "09:00", "10:00", "11:00"]);
  });

  it("snaps a click on a column to `snapMinutes`", () => {
    const onSlotClick = vi.fn();
    const { container } = renderCalendar({
      defaultView: "week",
      events: [],
      onSlotClick,
      snapMinutes: 30,
    });
    const column = cell(container, "2026-10-21");
    vi.spyOn(column, "getBoundingClientRect").mockReturnValue({
      top: 100,
      height: 960,
      bottom: 1060,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    // 202 minutes after 06:00 is 09:22, which snaps down to 09:00 here (09:15 at the default 15).
    fireEvent.click(column, { clientY: 100 + 202 });
    expect(onSlotClick).toHaveBeenCalledExactlyOnceWith("2026-10-21", "09:00");
  });

  it("sets the heading levels from `headingLevel`, the agenda's days one below", () => {
    renderCalendar({ compact: true, defaultView: "week", headingLevel: 4 });
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 5 })).toHaveLength(7);
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
  });

  it("shows the loading bar in every layout, and only while loading", () => {
    const bars = (container: HTMLElement) => container.querySelectorAll(".animate-indeterminate");
    for (const props of [
      {},
      { defaultView: "week" as const },
      { compact: true },
      { compact: true, defaultView: "week" as const },
    ]) {
      const idle = renderCalendar(props);
      expect(bars(idle.container), JSON.stringify(props)).toHaveLength(0);
      idle.unmount();
      const busy = renderCalendar({ ...props, loading: true });
      expect(bars(busy.container), JSON.stringify(props)).toHaveLength(1);
      busy.unmount();
    }
  });
});

describe("TimeCalendar details the other tests lean on", () => {
  it("marks the root with its view and, when narrow, `data-compact`", () => {
    const wide = renderCalendar();
    expect(wide.container.querySelector("section")).toHaveAttribute("data-view", "month");
    expect(wide.container.querySelector("section")).not.toHaveAttribute("data-compact");
    wide.unmount();
    const narrow = renderCalendar({ compact: true, defaultView: "week" });
    expect(narrow.container.querySelector("section")).toHaveAttribute("data-view", "week");
    expect(narrow.container.querySelector("section")).toHaveAttribute("data-compact");
  });

  it("does not report a Today that changes nothing", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderCalendar({ onNavigate });
    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("lets a `style` custom property win over `maxBodyHeight`", () => {
    const { container } = renderCalendar({
      defaultView: "week",
      maxBodyHeight: "20rem",
      style: { "--sc-max-body": "10rem" } as React.CSSProperties,
    });
    expect(
      container.querySelector<HTMLElement>("section")?.style.getPropertyValue("--sc-max-body"),
    ).toBe("10rem");
  });

  it("caps the narrow month's dots at four colours, one dot each", () => {
    const colors = ["red", "blue", "green", "teal", "pink", "amber"] as const;
    const { container } = renderCalendar({
      compact: true,
      events: colors.map((color, index) => ({
        id: `dot-${index}`,
        date: "2026-10-21",
        start: "09:00",
        end: "10:00",
        title: color,
        color,
      })),
    });
    const dots = cell(container, "2026-10-21").querySelectorAll("span.flex-wrap > span");
    expect(dots).toHaveLength(4);
  });

  it("marks today's heading in the agenda", () => {
    renderCalendar({ compact: true, defaultView: "week" });
    const current = screen
      .getAllByRole("heading", { level: 3 })
      .filter((heading) => heading.getAttribute("aria-current") === "date");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Friday 23 October");
  });

  it("only shows a pointer over a month cell when there is something to click for", () => {
    const plain = renderCalendar();
    expect(cell(plain.container, "2026-10-24").className).toContain("cursor-default");
    plain.unmount();
    const clickable = renderCalendar({ onDayClick: () => {} });
    expect(cell(clickable.container, "2026-10-24").className).not.toContain("cursor-default");
  });

  describe("week blocks", () => {
    const blockOf = (container: HTMLElement, id: string) =>
      container.querySelector<HTMLElement>(`[data-event-id="${id}"]`) as HTMLElement;

    it("name themselves in a tooltip, with the same words as their accessible name", () => {
      const { container } = renderCalendar({ defaultView: "week" });
      const morning = blockOf(container, "a");
      expect(morning).toHaveAttribute("title", morning.getAttribute("aria-label"));
    });

    it("show the time and the description when there is height for them, and only the title when not", () => {
      const { container } = renderCalendar({ defaultView: "week" });
      const tall = blockOf(container, "a");
      expect(tall).toHaveTextContent("Acme Logistik08:30–12:00building: Route planning API");
      const short = blockOf(container, "b");
      expect(short).toHaveTextContent(/^Acme Logistik$/);
    });

    it("draw a running entry with a dashed bottom edge, and a stopped one without", () => {
      const { container } = renderCalendar({ defaultView: "week" });
      expect(blockOf(container, "c").className).toContain("[border-bottom-style:dashed]");
      expect(blockOf(container, "a").className).not.toContain("[border-bottom-style:dashed]");
    });
  });
});

describe("TimeCalendar helpers", () => {
  it("exposes the range helpers an app fetches by", () => {
    expect(getVisibleRange("2026-10-23", "month")).toEqual({
      from: "2026-09-28",
      to: "2026-11-01",
    });
    expect(getPeriodRange("2026-10-23", "month")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(getVisibleRange("2026-10-23", "week")).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    expect(formatTrackedHours(7.5)).toBe("7h 30m");
  });
});
