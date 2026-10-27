import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  TimeCalendar,
  type TimeCalendarEvent,
  type TimeCalendarProps,
} from "../src/components/ui/time-calendar";

/** Friday 23 October 2026, 14:30, in the machine's zone, which is what the calendar reads without `timeZone`. */
const NOW = new Date(2026, 9, 23, 14, 30);

const dateOf = (element: Element | null) => element?.getAttribute("data-date");
const active = () => document.activeElement;

function cell(container: HTMLElement, date: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[role="gridcell"][data-date="${date}"]`);
  if (!found) throw new Error(`no cell for ${date}`);
  return found;
}

async function tabToGrid(user: ReturnType<typeof userEvent.setup>) {
  for (let step = 0; step < 12; step += 1) {
    await user.tab();
    if (active()?.getAttribute("role") === "gridcell") return;
  }
  throw new Error("Tab never reached the grid");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("keyboard focus follows a controlled `date` that the parent applies later", () => {
  /** A parent that keeps `date` in state and applies a new one through `apply`, as an app would. */
  function Parent({
    apply,
    defaultView = "month",
    start = "2026-10-15",
  }: {
    apply: (change: () => void) => void;
    defaultView?: "month" | "week";
    start?: string;
  }) {
    const [date, setDate] = React.useState(start);
    return (
      <TimeCalendar
        events={[]}
        now={NOW}
        date={date}
        defaultView={defaultView}
        compact={false}
        onNavigate={(next) => apply(() => setDate(next.date))}
      />
    );
  }

  const later: Array<[string, (change: () => void) => void]> = [
    ["startTransition", (change) => React.startTransition(change)],
    ["queueMicrotask", (change) => queueMicrotask(change)],
    ["a timer", (change) => void setTimeout(change, 25)],
  ];

  it.each(later)("lands on the new month's day after %s", async (_name, apply) => {
    const user = userEvent.setup();
    const { container } = render(<Parent apply={apply} />);
    await tabToGrid(user);
    expect(dateOf(active())).toBe("2026-10-15");

    await user.keyboard("{PageDown}");
    await waitFor(() => expect(active()).toBe(cell(container, "2026-11-15")));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("November 2026");
    // The tab stop and the focus agree, so the next key moves from where the user is.
    expect(container.querySelectorAll('[role="gridcell"][tabindex="0"]')).toHaveLength(1);
    expect(cell(container, "2026-11-15")).toHaveAttribute("tabindex", "0");
    await user.keyboard("{ArrowRight}");
    expect(dateOf(active())).toBe("2026-11-16");
  });

  it("lands on the next week's day after a timer, in the week view", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Parent apply={(change) => void setTimeout(change, 25)} defaultView="week" />,
    );
    await tabToGrid(user);
    expect(dateOf(active())).toBe("2026-10-15");
    await user.keyboard("{PageDown}");
    await waitFor(() => expect(active()).toBe(cell(container, "2026-10-22")));
  });

  it("does not leave focus on the old cell when the old day is still on screen as an outside day", async () => {
    // 28 October is on screen in the November grid too, so the old cell survives the change.
    const user = userEvent.setup();
    const { container } = render(
      <Parent apply={(change) => void setTimeout(change, 25)} start="2026-10-28" />,
    );
    await tabToGrid(user);
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(active()).toBe(cell(container, "2026-11-04")));
    await user.keyboard("{PageDown}");
    await waitFor(() => expect(active()).toBe(cell(container, "2026-12-04")));
  });

  it("does not grab focus later when the parent never moves the date", async () => {
    const user = userEvent.setup();
    const props: TimeCalendarProps = {
      events: [],
      now: NOW,
      date: "2026-10-15",
      compact: false,
    };
    const { container, rerender } = render(
      <>
        <button type="button">elsewhere</button>
        <TimeCalendar {...props} />
      </>,
    );
    await tabToGrid(user);
    await user.keyboard("{PageDown}");
    // The parent ignored it. The user goes on to something else.
    await user.click(screen.getByRole("button", { name: "elsewhere" }));
    expect(active()).toBe(screen.getByRole("button", { name: "elsewhere" }));

    rerender(
      <>
        <button type="button">elsewhere</button>
        <TimeCalendar {...props} date="2026-11-15" />
      </>,
    );
    expect(cell(container, "2026-11-15")).toBeInTheDocument();
    expect(active()).toBe(screen.getByRole("button", { name: "elsewhere" }));
  });

  it("does not grab focus when the user pressed another key before the date arrived", async () => {
    const user = userEvent.setup();
    const props: TimeCalendarProps = {
      events: [],
      now: NOW,
      date: "2026-10-15",
      compact: false,
    };
    const { container, rerender } = render(<TimeCalendar {...props} />);
    await tabToGrid(user);
    await user.keyboard("{PageDown}");
    await user.keyboard("{Escape}{Tab}");
    expect(container.contains(active())).toBe(false);
    rerender(<TimeCalendar {...props} date="2026-11-15" />);
    expect(container.contains(active())).toBe(false);
  });

  describe("while it waits", () => {
    // user-event cannot run under fake timers with Testing Library, so the key is fired directly.
    const props: TimeCalendarProps = { events: [], now: NOW, date: "2026-10-15", compact: false };
    const WATCHED = new Set(["keydown", "pointerdown"]);

    /** Listeners the calendar has put on the document and not taken off again. */
    function watchDocument() {
      const added = vi.spyOn(document, "addEventListener");
      const removed = vi.spyOn(document, "removeEventListener");
      return () =>
        added.mock.calls.filter(([type]) => WATCHED.has(type)).length -
        removed.mock.calls.filter(([type]) => WATCHED.has(type)).length;
    }

    function pressPageDown(container: HTMLElement, options: { shiftKey?: boolean } = {}) {
      if (!container.contains(active())) act(() => cell(container, "2026-10-15").focus());
      fireEvent.keyDown(active() as Element, { key: "PageDown", ...options });
    }

    it("is still waiting a few seconds on, for a router or a store that is slow", () => {
      vi.useFakeTimers();
      const { container, rerender } = render(<TimeCalendar {...props} />);
      pressPageDown(container);
      act(() => {
        vi.advanceTimersByTime(4_000);
      });
      rerender(<TimeCalendar {...props} date="2026-11-15" />);
      expect(active()).toBe(cell(container, "2026-11-15"));
    });

    it("gives up on a date that never arrives, and leaves no listener behind", () => {
      vi.useFakeTimers();
      const armed = watchDocument();
      const { container, rerender } = render(<TimeCalendar {...props} />);
      pressPageDown(container);
      expect(armed()).toBe(2);

      act(() => {
        vi.advanceTimersByTime(30_000);
      });
      expect(armed()).toBe(0);
      rerender(<TimeCalendar {...props} date="2026-11-15" />);
      expect(active()).not.toBe(cell(container, "2026-11-15"));
    });

    it("clears what it was waiting for when the calendar unmounts", () => {
      vi.useFakeTimers();
      const armed = watchDocument();
      const { container, unmount } = render(<TimeCalendar {...props} />);
      pressPageDown(container);
      expect(armed()).toBe(2);
      unmount();
      expect(armed()).toBe(0);
      // Nothing is left to fire into an unmounted calendar.
      expect(() => vi.advanceTimersByTime(30_000)).not.toThrow();
    });

    it("waits for one date at a time: a second key replaces the first request", () => {
      vi.useFakeTimers();
      const armed = watchDocument();
      const { container, rerender } = render(<TimeCalendar {...props} />);
      pressPageDown(container);
      act(() => {
        vi.advanceTimersByTime(4_000);
      });
      pressPageDown(container, { shiftKey: true });
      expect(armed()).toBe(2);
      // The first request's time is up, the second's is not.
      act(() => {
        vi.advanceTimersByTime(4_000);
      });
      expect(armed()).toBe(2);
      rerender(<TimeCalendar {...props} date="2027-10-15" />);
      expect(active()).toBe(cell(container, "2027-10-15"));
      expect(armed()).toBe(0);
    });
  });
});

describe("the title is the only live region", () => {
  const RUNNING: TimeCalendarEvent[] = [
    { id: "r", date: "2026-10-23", start: "13:45", title: "Timer", running: true },
  ];

  it("announces the period and not its total, so a running timer is not read out every minute", () => {
    render(<TimeCalendar events={RUNNING} now={NOW} defaultDate="2026-10-23" compact={false} />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).not.toHaveAttribute("aria-live");
    const live = heading.querySelector('[aria-live="polite"]');
    expect(live).toHaveAttribute("aria-atomic", "true");
    expect(live?.textContent).toBe("October 2026");
    expect(heading).toHaveTextContent("October 2026 · 45m");
    // The total is part of the heading, but sits outside the live part.
    const summary = heading.lastElementChild as HTMLElement;
    expect(summary.textContent).toBe(" · 45m");
    expect(live?.contains(summary)).toBe(false);
  });

  it("keeps the live text steady while the timer's total moves with the clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 14, 30, 0));
    render(<TimeCalendar events={RUNNING} defaultDate="2026-10-23" compact={false} />);
    const heading = screen.getByRole("heading", { level: 2 });
    const live = heading.querySelector('[aria-live="polite"]') as HTMLElement;
    const mutations: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) mutations.push(record.type);
    });
    observer.observe(live, { childList: true, characterData: true, subtree: true });
    expect(heading).toHaveTextContent("October 2026 · 45m");
    act(() => {
      vi.advanceTimersByTime(3 * 60_000);
    });
    expect(heading).toHaveTextContent("October 2026 · 48m");
    expect(observer.takeRecords()).toEqual([]);
    expect(mutations).toEqual([]);
    expect(live.textContent).toBe("October 2026");
    observer.disconnect();
  });

  it("announces a new period when the title changes", async () => {
    const user = userEvent.setup();
    render(<TimeCalendar events={[]} now={NOW} defaultDate="2026-10-23" compact={false} />);
    const live = () =>
      screen.getByRole("heading", { level: 2 }).querySelector('[aria-live="polite"]');
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(live()).toHaveTextContent(/^November 2026$/);
    await user.click(screen.getByRole("radio", { name: "Week" }));
    expect(live()?.textContent).toMatch(/^\d+[–-]\d+ \w+ 2026$|^\d+ \w+ [–-] /);
  });

  it("makes the compact agenda announce the selected day and not its total", () => {
    render(
      <TimeCalendar events={RUNNING} now={NOW} defaultDate="2026-10-23" compact headingLevel={2} />,
    );
    const day = screen.getByRole("heading", { level: 3 });
    expect(day).not.toHaveAttribute("aria-live");
    const live = day.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("Friday 23 October");
    expect(day).toHaveTextContent("Friday 23 October · 45m");
  });

  it("does not make the days of a stacked week live", () => {
    const { container } = render(
      <TimeCalendar
        events={RUNNING}
        now={NOW}
        defaultDate="2026-10-23"
        defaultView="week"
        compact
      />,
    );
    expect(container.querySelectorAll("section section [aria-live]")).toHaveLength(0);
  });
});

describe("the week grid's column numbers", () => {
  const events: TimeCalendarEvent[] = [
    { id: "a", date: "2026-10-21", start: "09:00", end: "10:00", title: "Timed" },
    { id: "b", date: "2026-10-21", title: "No time", hours: 1 },
  ];

  it("number the gutter 1 and the seven days 2 to 8 in the header, the strip and the body", () => {
    const { container } = render(
      <TimeCalendar
        events={events}
        now={NOW}
        defaultDate="2026-10-23"
        defaultView="week"
        compact={false}
      />,
    );
    const grid = screen.getByRole("grid");
    expect(grid).toHaveAttribute("aria-colcount", "8");

    const headers = within(grid).getAllByRole("columnheader");
    expect(headers.map((header) => header.getAttribute("aria-colindex"))).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
    ]);

    const stripHeader = within(grid).getByRole("rowheader");
    expect(stripHeader).toHaveAttribute("aria-colindex", "1");
    const strip = [...container.querySelectorAll<HTMLElement>("[data-strip-date]")];
    expect(strip.map((c) => c.getAttribute("aria-colindex"))).toEqual([
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
    ]);

    const days = [...container.querySelectorAll<HTMLElement>('[role="gridcell"][data-date]')];
    expect(days.map((c) => c.getAttribute("aria-colindex"))).toEqual([
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
    ]);
    // The same date sits under the same number in every row.
    const index = (date: string) => cell(container, date).getAttribute("aria-colindex");
    expect(index("2026-10-21")).toBe(
      container.querySelector('[data-strip-date="2026-10-21"]')?.getAttribute("aria-colindex"),
    );
    expect(
      within(grid)
        .getByRole("columnheader", { name: "Wednesday 21 October 2026" })
        .getAttribute("aria-colindex"),
    ).toBe(index("2026-10-21"));
  });
});

describe("a week with only onSlotClick can be used from the keyboard", () => {
  const render_ = (props: Partial<TimeCalendarProps>) =>
    render(
      <TimeCalendar
        events={[]}
        now={NOW}
        defaultDate="2026-10-23"
        defaultView="week"
        compact={false}
        {...props}
      />,
    );

  it("creates at the snapped present on today's column, with Enter and with Space", async () => {
    const user = userEvent.setup();
    const onSlotClick = vi.fn();
    render_({ onSlotClick });
    await tabToGrid(user);
    expect(dateOf(active())).toBe("2026-10-23");
    await user.keyboard("{Enter}");
    expect(onSlotClick).toHaveBeenLastCalledWith("2026-10-23", "14:30");
    await user.keyboard(" ");
    expect(onSlotClick).toHaveBeenCalledTimes(2);
  });

  it("snaps the present down to snapMinutes", async () => {
    const user = userEvent.setup();
    const onSlotClick = vi.fn();
    render_({ onSlotClick, snapMinutes: 60 });
    await tabToGrid(user);
    await user.keyboard("{Enter}");
    expect(onSlotClick).toHaveBeenLastCalledWith("2026-10-23", "14:00");
  });

  it("creates at the first hour of the grid on any other day", async () => {
    const user = userEvent.setup();
    const onSlotClick = vi.fn();
    render_({ onSlotClick });
    await tabToGrid(user);
    await user.keyboard("{ArrowLeft}{Enter}");
    expect(onSlotClick).toHaveBeenLastCalledWith("2026-10-22", "06:00");
  });

  it("follows the configured hours", async () => {
    const user = userEvent.setup();
    const onSlotClick = vi.fn();
    render_({ onSlotClick, hourRange: [8, 18] });
    await tabToGrid(user);
    await user.keyboard("{ArrowLeft}{Enter}");
    expect(onSlotClick).toHaveBeenLastCalledWith("2026-10-22", "08:00");
  });

  it("reports the day, as before, when onDayClick is there too", async () => {
    const user = userEvent.setup();
    const onSlotClick = vi.fn();
    const onDayClick = vi.fn();
    render_({ onSlotClick, onDayClick });
    await tabToGrid(user);
    await user.keyboard("{Enter}");
    expect(onDayClick).toHaveBeenCalledExactlyOnceWith("2026-10-23");
    expect(onSlotClick).not.toHaveBeenCalled();
  });

  it("does nothing on a block, and nothing when no callback is given", async () => {
    const user = userEvent.setup();
    const onSlotClick = vi.fn();
    const { container } = render_({
      onSlotClick,
      events: [{ id: "a", date: "2026-10-23", start: "09:00", end: "10:00", title: "Block" }],
    });
    await tabToGrid(user);
    await user.tab();
    expect(active()).toHaveAttribute("data-event-id", "a");
    await user.keyboard("{Enter}");
    expect(onSlotClick).not.toHaveBeenCalled();
    expect(container).toBeInTheDocument();

    const bare = render_({});
    cell(bare.container, "2026-10-23").focus();
    await user.keyboard("{Enter}");
    expect(onSlotClick).not.toHaveBeenCalled();
  });
});

describe("the '+N more' popover", () => {
  const BUSY: TimeCalendarEvent[] = Array.from({ length: 30 }, (_, index) => ({
    id: `busy-${index}`,
    date: "2026-10-08",
    start: `${String(6 + Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`,
    end: `${String(6 + Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "50" : "20"}`,
    title: `Task ${index + 1}`,
  }));

  it("is capped to the room the window has, and its list is what scrolls", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TimeCalendar events={BUSY} now={NOW} defaultDate="2026-10-08" compact={false} />,
    );
    await user.click(within(cell(container, "2026-10-08")).getByText("+28 more"));
    const popover = await screen.findByRole("dialog", { name: "Thursday 8 October 2026" });
    expect(popover.className).toContain("max-h-(--radix-popover-content-available-height)");
    const rows = within(popover).getAllByRole("button");
    expect(rows).toHaveLength(30);
    const list = rows[0].parentElement as HTMLElement;
    expect(list).toHaveAttribute("data-slot", "time-calendar-more-list");
    expect(list.className).toContain("overflow-y-auto");
    expect(list.className).toContain("min-h-0");
    // The day's heading stays put above the scrolling list.
    expect(popover.firstElementChild?.tagName).toBe("P");
    expect(popover.firstElementChild?.contains(list)).toBe(false);
  });
});

describe("what marks a day, a block and a ring", () => {
  it("draws the selected day of the compact month with more than a fill", () => {
    const { container } = render(
      <TimeCalendar events={[]} now={NOW} defaultDate="2026-10-21" compact />,
    );
    const selected = cell(container, "2026-10-21");
    expect(selected).toHaveAttribute("aria-selected", "true");
    // A 2px bar along the top of the cell in the primary colour, which keeps 3:1 against the fill
    // and does not compete with the ring a focused cell draws.
    expect(selected.className).toContain("after:bg-primary");
    expect(selected.className).toContain("after:h-0.5");
    expect(selected.className).toContain("bg-accent");
    expect(cell(container, "2026-10-22").className).not.toContain("after:bg-primary");
  });

  it("keeps the cues forced-colors mode would flatten", () => {
    const { container } = render(
      <TimeCalendar
        events={[
          { id: "run", date: "2026-10-23", start: "13:45", title: "Timer", running: true },
          { id: "b", date: "2026-10-23", start: "09:00", end: "10:00", title: "Block" },
        ]}
        now={NOW}
        defaultDate="2026-10-23"
        defaultView="week"
        compact={false}
      />,
    );
    // The now-line and its dot are backgrounds, which forced colors turn into the canvas.
    const line = container.querySelector<HTMLElement>("[data-now-line]");
    expect(line?.className).toContain("forced-colors:bg-[CanvasText]");
    expect(line?.className).toContain("forced-colors:before:bg-[CanvasText]");
    // So is the day number's pill.
    const pill = container.querySelector('[role="columnheader"] span[class*="bg-primary"]');
    expect(pill?.className).toContain("forced-colors:border-2");
  });

  it("keeps the running dot of a chip in forced-colors mode", () => {
    const { container } = render(
      <TimeCalendar
        events={[{ id: "run", date: "2026-10-23", start: "13:45", title: "Timer", running: true }]}
        now={NOW}
        defaultDate="2026-10-23"
        compact={false}
      />,
    );
    const dot = container.querySelector('button[data-event-id="run"] span[aria-hidden="true"]');
    expect(dot?.className).toContain("rounded-full");
    expect(dot?.className).toContain("forced-colors:bg-[CanvasText]");
  });

  it("keeps the compact month's dots in forced-colors mode", () => {
    const { container } = render(
      <TimeCalendar
        events={[{ id: "b", date: "2026-10-23", start: "09:00", end: "10:00", title: "Block" }]}
        now={NOW}
        defaultDate="2026-10-23"
        compact
      />,
    );
    const dots = cell(container, "2026-10-23").querySelectorAll("span.flex-wrap > span");
    expect(dots.length).toBeGreaterThan(0);
    for (const dot of dots) {
      expect(dot.className).toContain("forced-colors:bg-[CanvasText]");
    }
  });

  it("squares off the continuing edge of a night shift with a corner that beats rounded-selector", () => {
    // `rounded-selector` is a custom shorthand that sorts after the generated corner utilities, so a
    // plain `rounded-b-none` loses to it; only the important form wins. The cascade itself is
    // asserted in the Week story, in a real browser.
    const { container } = render(
      <TimeCalendar
        events={[{ id: "n", date: "2026-10-22", start: "22:00", end: "02:00", title: "Night" }]}
        now={NOW}
        defaultDate="2026-10-23"
        defaultView="week"
        compact={false}
      />,
    );
    const tail = cell(container, "2026-10-22").querySelector("button");
    const rest = cell(container, "2026-10-23").querySelector("button");
    expect(tail?.className).toContain("rounded-b-none!");
    expect(tail?.className).not.toContain("rounded-t-none");
    expect(rest?.className).toContain("rounded-t-none!");
    expect(rest?.className).not.toContain("rounded-b-none");
    // The opaque plate under the block has the same corners.
    const plate = (button: Element | null | undefined) =>
      button?.previousElementSibling as HTMLElement;
    expect(plate(tail).className).toContain("rounded-b-none!");
    expect(plate(rest).className).toContain("rounded-t-none!");
  });
});

describe("a week that was mounted without any size", () => {
  const originalOffsetHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetHeight",
  );

  class FakeResizeObserver {
    static instances: FakeResizeObserver[] = [];
    disconnected = false;
    target: Element | undefined;
    constructor(private callback: ResizeObserverCallback) {
      FakeResizeObserver.instances.push(this);
    }
    observe(element: Element) {
      this.target = element;
    }
    unobserve() {}
    disconnect() {
      this.disconnected = true;
    }
    emit() {
      if (!this.disconnected) {
        this.callback([{} as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
    }
  }

  let bodyHeight = 0;
  let stickyHeight = 0;

  beforeEach(() => {
    bodyHeight = 0;
    stickyHeight = 0;
    FakeResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    // jsdom lays nothing out; the week's body is the one row whose height is set in hours, and the
    // sticky header is the one rowgroup.
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        if (this.matches('[role="row"][style*="--sc-hour"]')) return bodyHeight;
        return this.matches('[role="rowgroup"]') ? stickyHeight : 0;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
    }
  });

  const AFTERNOON: TimeCalendarEvent[] = [
    { id: "pm", date: "2026-10-23", start: "15:30", end: "17:00", title: "Afternoon" },
  ];
  const grid = () => screen.getByRole("grid");
  const layOut = () => {
    // 06:00 to 22:00 at 48px an hour, under a header 102px tall.
    bodyHeight = 768;
    stickyHeight = 102;
    act(() => FakeResizeObserver.instances.forEach((observer) => observer.emit()));
  };

  it("opens on its first entry as soon as it is laid out, and not before", () => {
    render(
      <TimeCalendar
        events={AFTERNOON}
        now={NOW}
        defaultDate="2026-10-23"
        defaultView="week"
        compact={false}
      />,
    );
    expect(grid().scrollTop).toBe(0);
    layOut();
    // 15:30 less half an hour of air is 15:00, nine hours down, less a fifth of an hour for its label.
    expect(grid().scrollTop).toBeCloseTo((9 - 0.2) * 48, 5);
  });

  it("pads the scroll area by the sticky header once it has a height to pad by", () => {
    render(
      <TimeCalendar
        events={AFTERNOON}
        now={NOW}
        defaultDate="2026-10-23"
        defaultView="week"
        compact={false}
      />,
    );
    expect(grid().style.scrollPaddingTop).toBe("0px");
    layOut();
    expect(grid().style.scrollPaddingTop).toBe("102px");
  });

  it("scrolls once and then leaves the user's place alone", () => {
    render(
      <TimeCalendar
        events={AFTERNOON}
        now={NOW}
        defaultDate="2026-10-23"
        defaultView="week"
        compact={false}
      />,
    );
    layOut();
    grid().scrollTop = 100;
    layOut();
    expect(grid().scrollTop).toBe(100);
  });

  it("stops watching the body once it has scrolled, and when it unmounts first", () => {
    const watchingBody = () =>
      FakeResizeObserver.instances.filter(
        (observer) => !observer.disconnected && observer.target?.getAttribute("role") === "row",
      );
    const first = render(
      <TimeCalendar
        events={AFTERNOON}
        now={NOW}
        defaultDate="2026-10-23"
        defaultView="week"
        compact={false}
      />,
    );
    expect(watchingBody()).toHaveLength(1);
    layOut();
    expect(watchingBody()).toHaveLength(0);
    first.unmount();

    bodyHeight = 0;
    const second = render(
      <TimeCalendar
        events={AFTERNOON}
        now={NOW}
        defaultDate="2026-10-23"
        defaultView="week"
        compact={false}
      />,
    );
    expect(watchingBody()).toHaveLength(1);
    second.unmount();
    expect(watchingBody()).toHaveLength(0);
  });

  it("keeps focused blocks clear of the sticky header by padding the scroll area by its height", () => {
    stickyHeight = 102;
    render(
      <TimeCalendar
        events={AFTERNOON}
        now={NOW}
        defaultDate="2026-10-23"
        defaultView="week"
        compact={false}
      />,
    );
    expect(grid().style.scrollPaddingTop).toBe("102px");
  });

  it("opens on the present in an empty current week", () => {
    bodyHeight = 768;
    render(
      <TimeCalendar
        events={[]}
        now={NOW}
        defaultDate="2026-10-23"
        defaultView="week"
        compact={false}
      />,
    );
    // 14:30 less an hour is 13:30, less half an hour of air is 13:00: seven hours down.
    expect(grid().scrollTop).toBeCloseTo((7 - 0.2) * 48, 5);
  });

  it("opens on the first entry straight away when it is laid out from the start", () => {
    bodyHeight = 768;
    render(
      <TimeCalendar
        events={AFTERNOON}
        now={NOW}
        defaultDate="2026-10-23"
        defaultView="week"
        compact={false}
      />,
    );
    expect(grid().scrollTop).toBeCloseTo((9 - 0.2) * 48, 5);
  });
});

describe("a block too short for any text", () => {
  // Three ten-minute entries back to back: the first two are drawn at their true length, which is
  // too short for a line of text, so they are bars. A bar is still a button with a name.
  const CHAIN: TimeCalendarEvent[] = [
    ["10:00", "10:10"],
    ["10:10", "10:20"],
    ["10:20", "10:30"],
  ].map(([start, end], index) => ({
    id: `chain-${index}`,
    date: "2026-10-23",
    start,
    end,
    title: `Entry ${index + 1}`,
  }));

  function renderChain() {
    return render(
      <TimeCalendar
        events={CHAIN}
        now={NOW}
        defaultDate="2026-10-23"
        defaultView="week"
        compact={false}
      />,
    );
  }

  it("is reached by Tab from its day, in order, like any other block", async () => {
    const user = userEvent.setup();
    const { container } = renderChain();
    const bars = [0, 1].map((index) =>
      container.querySelector<HTMLElement>(`button[data-event-id="chain-${index}"]`),
    );
    expect(bars.map((bar) => bar?.dataset.fit)).toEqual(["bar", "bar"]);
    await tabToGrid(user);
    expect(dateOf(active())).toBe("2026-10-23");
    await user.tab();
    expect(active()).toBe(bars[0]);
    await user.tab();
    expect(active()).toBe(bars[1]);
    await user.tab();
    expect(active()).toBe(container.querySelector('button[data-event-id="chain-2"]'));
  });

  it("is named by its label, though it has no text, and activates like a block", async () => {
    const user = userEvent.setup();
    const onEventClick = vi.fn();
    render(
      <TimeCalendar
        events={CHAIN}
        now={NOW}
        defaultDate="2026-10-23"
        defaultView="week"
        compact={false}
        onEventClick={onEventClick}
      />,
    );
    const bar = screen.getByRole("button", { name: "Entry 1, 10:00 to 10:10, 10m" });
    expect(bar).toHaveTextContent("");
    expect(bar).toHaveAttribute("title", "Entry 1, 10:00 to 10:10, 10m");
    bar.focus();
    await user.keyboard("{Enter}");
    expect(onEventClick).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "chain-0" }),
    );
  });

  it("keeps the inset focus ring and the forced-colors border of every other block", () => {
    const { container } = renderChain();
    const bar = container.querySelector<HTMLElement>('button[data-event-id="chain-0"]');
    const classes = bar?.className.split(/\s+/) ?? [];
    expect(classes).toEqual(
      expect.arrayContaining([
        "focus-visible:outline-hidden",
        "focus-visible:ring-2",
        "focus-visible:ring-inset",
        "forced-colors:border-y",
        "forced-colors:border-r",
        "border-l-[3px]",
      ]),
    );
    // A bare `outline-hidden` would be a permanent outline in forced-colors mode.
    expect(classes).not.toContain("outline-hidden");
  });
});
