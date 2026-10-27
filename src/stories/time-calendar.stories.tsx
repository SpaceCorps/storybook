import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { sv } from "date-fns/locale";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle";
import {
  TimeCalendar,
  calendarColorForKey,
  formatTrackedHours,
  getFetchRange,
  getPeriodRange,
  type CalendarView,
  type TimeCalendarEvent,
  type TimeCalendarNavigation,
  type TimeCalendarProps,
} from "@/components/ui/time-calendar";
import { DEMO_ENTRIES, DEMO_EVENTS, NOW, type TimeEntry } from "./time-calendar-fixtures";

const meta: Meta<typeof TimeCalendar> = {
  title: "UI/TimeCalendar",
  component: TimeCalendar,
  parameters: {
    layout: "padded",
    // The entries are seeded around a pinned clock and "+N more" opens in a portal, so a screenshot is
    // only comparable in the Linux container that produces the baselines.
    visual: { disable: true },
  },
};

export default meta;

type Story = StoryObj<typeof TimeCalendar>;

/** The last thing a callback reported, so a story shows what an app would receive. */
function useLastAction() {
  const [action, setAction] = React.useState("nothing yet: click a day or an entry");
  const callbacks = {
    onDayClick: (date: string) => setAction(`onDayClick("${date}")`),
    onSlotClick: (date: string, time: string) => setAction(`onSlotClick("${date}", "${time}")`),
    onEventClick: (event: { id: string; title: string }) =>
      setAction(`onEventClick({ id: "${event.id}", title: "${event.title}" })`),
  };
  return { action, callbacks };
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm text-muted-foreground" aria-live="polite">
      {label}:{" "}
      <code className="rounded-selector bg-muted px-1 py-0.5 text-foreground">{value}</code>
    </p>
  );
}

/** A calendar wired to a callback readout; most stories below are this with different props. */
function Demo(props: Partial<TimeCalendarProps<TimeEntry>>) {
  const { action, callbacks } = useLastAction();
  return (
    <div className="flex flex-col gap-3">
      <TimeCalendar<TimeEntry>
        events={DEMO_EVENTS}
        now={NOW}
        defaultDate="2026-10-23"
        {...callbacks}
        {...props}
      />
      <Readout label="Last callback" value={action} />
    </div>
  );
}

/**
 * October 2026 as a time-tracking app logs it: Acme every weekday, strategizing on Mondays,
 * Intern on Fridays. Each day shows its total and its entries as chips, coloured by project. Look for
 * the day with six entries ("+4 more" opens the whole day), the Saturday session, the night shift on
 * the 22nd, the timer running today, and the week off.
 */
export const Month: Story = {
  render: () => <Demo />,
  parameters: { keyboard: { sweep: true, maxStops: 12, forcedColors: true } },
};

/**
 * The week of 19 to 25 October. Tuesday's two overlapping entries are packed side by side, the night
 * shift is split between Thursday and Friday, the entry with only hours sits in the strip under the
 * header, and today's column carries the now-line at 14:30 and the running timer.
 */
export const Week: Story = {
  render: () => <Demo defaultView="week" />,
  parameters: { keyboard: { sweep: true, maxStops: 12, forcedColors: true } },
  // The two halves of the night shift square off the edge they continue from. jsdom reads class names
  // only, so the cascade (a corner utility against the theme's `rounded-selector`) is checked here.
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pieces = await canvas.findAllByRole("button", { name: /^Acme Logistik, 22:00 to 02:00/ });
    await expect(pieces).toHaveLength(2);
    const [tail, rest] = pieces.map((piece) => getComputedStyle(piece));
    await expect([tail.borderBottomLeftRadius, tail.borderBottomRightRadius]).toEqual([
      "0px",
      "0px",
    ]);
    await expect(parseFloat(tail.borderTopLeftRadius)).toBeGreaterThan(0);
    await expect([rest.borderTopLeftRadius, rest.borderTopRightRadius]).toEqual(["0px", "0px"]);
    await expect(parseFloat(rest.borderBottomLeftRadius)).toBeGreaterThan(0);
  },
};

/** No entries: the grid stays in place, so the layout does not jump when data arrives. */
export const Empty: Story = {
  render: () => <Demo events={[]} />,
};

/** An empty week keeps its hours and still shows the now-line. */
export const EmptyWeek: Story = {
  render: () => <Demo events={[]} defaultView="week" />,
};

/**
 * The theme is a story-level `globals` entry (Storybook ignores `parameters.globals`), so these two
 * really render dark; the play function says so, because a story that silently stayed light would
 * sweep nothing. Colours are tokens that flip with the theme, so nothing here has a dark variant of
 * its own.
 */
const assertDark = async () => {
  await expect(document.documentElement.classList.contains("dark")).toBe(true);
};

export const Dark: Story = {
  render: () => <Demo />,
  globals: { theme: "dark" },
  parameters: { keyboard: { sweep: true, maxStops: 12 } },
  play: assertDark,
};

export const DarkWeek: Story = {
  render: () => <Demo defaultView="week" />,
  globals: { theme: "dark" },
  parameters: { keyboard: { sweep: true, maxStops: 12 } },
  play: assertDark,
};

/**
 * Under 640 px wide (the calendar's own width, not the window's) a month cell shrinks to the day
 * number, its total and one dot per project, and the selected day's entries are listed below. Tapping
 * a day selects it; the add button of the list reports it through `onDayClick`.
 */
export const Narrow: Story = {
  render: () => (
    <div className="w-[22rem]">
      <Demo />
    </div>
  ),
};

/** On a narrow screen the week becomes a stacked list of its seven days. */
export const NarrowWeek: Story = {
  render: () => (
    <div className="w-[22rem]">
      <Demo defaultView="week" />
    </div>
  ),
};

/** While `loading`, the grid stays where it is: `aria-busy` and an indeterminate bar on its top edge. */
export const Loading: Story = {
  render: () => <Demo loading />,
};

/** Density sets the hour height, the cell height and the type size; it follows `DensityProvider`. */
export const Densities: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      {(["Small", "Medium", "Large"] as const).map((density) => (
        <div key={density} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{density}</h3>
          <TimeCalendar<TimeEntry>
            events={DEMO_EVENTS}
            now={NOW}
            defaultDate="2026-10-23"
            defaultView="week"
            density={density as never}
            maxBodyHeight="16rem"
            headingLevel={4}
          />
        </div>
      ))}
    </div>
  ),
};

export const DensitiesMonth: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      {(["Small", "Medium", "Large"] as const).map((density) => (
        <div key={density} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{density}</h3>
          <TimeCalendar<TimeEntry>
            events={DEMO_EVENTS}
            now={NOW}
            defaultDate="2026-10-23"
            density={density as never}
            headingLevel={4}
          />
        </div>
      ))}
    </div>
  ),
};

/**
 * The grid is one tab stop. Tab into it, move with the arrow keys, Home, End and PageUp/PageDown,
 * Enter acts on the focused day. Tab again walks that day's entries; Enter opens one and Escape goes
 * back to its day.
 */
export const Keyboard: Story = {
  render: () => <Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("grid", { name: "October 2026" });
    const focused = () => document.activeElement as HTMLElement | null;
    const focusedDate = () => focused()?.dataset.date;
    const lastCallback = () =>
      canvas.getByText(/^(onDayClick|onEventClick|nothing yet)/).textContent;

    for (let step = 0; step < 10 && focused()?.getAttribute("role") !== "gridcell"; step += 1) {
      await userEvent.tab();
    }
    await expect(focusedDate()).toBe("2026-10-23");

    await userEvent.keyboard("{ArrowRight}");
    await expect(focusedDate()).toBe("2026-10-24");
    await userEvent.keyboard("{ArrowDown}");
    await expect(focusedDate()).toBe("2026-10-31");
    await userEvent.keyboard("{Home}");
    await expect(focusedDate()).toBe("2026-10-26");
    await userEvent.keyboard("{End}");
    await expect(focusedDate()).toBe("2026-11-01");
    await userEvent.keyboard("{PageUp}");
    await expect(focusedDate()).toBe("2026-10-01");

    // Back on the 23rd: Enter acts on the day, Tab reaches its first entry, Escape returns.
    await userEvent.click(canvas.getByRole("button", { name: "Today" }));
    canvas.getByRole("gridcell", { name: /^Friday 23 October 2026/ }).focus();
    await userEvent.keyboard("{Enter}");
    await expect(lastCallback()).toBe('onDayClick("2026-10-23")');
    await userEvent.tab();
    await expect(focused()?.dataset.eventId).toBeTruthy();
    await userEvent.keyboard("{Enter}");
    await expect(lastCallback()).toContain("onEventClick");
    await userEvent.keyboard("{Escape}");
    await expect(focusedDate()).toBe("2026-10-23");
  },
};

function ControlledDemo() {
  const [date, setDate] = React.useState("2026-10-23");
  const [view, setView] = React.useState<CalendarView>("month");
  const [last, setLast] = React.useState<TimeCalendarNavigation | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <TimeCalendar<TimeEntry>
        events={DEMO_EVENTS}
        now={NOW}
        date={date}
        view={view}
        onViewChange={setView}
        onNavigate={(next) => {
          setDate(next.date);
          setLast(next);
        }}
        toolbar={
          <Button type="button" onClick={() => setDate("2026-10-08")}>
            Jump to 8 Oct
          </Button>
        }
      />
      <Readout label="onNavigate" value={last ? JSON.stringify(last) : "nothing yet"} />
      <Readout label="fetch /time" value={rangeQuery(date, view)} />
    </div>
  );
}

/**
 * The query an app runs for what is on screen. `getFetchRange` starts a day before the first cell,
 * so a night shift that began the evening before the week still draws its tail in the first column.
 */
function rangeQuery(date: string, view: CalendarView) {
  const { from, to } = getFetchRange(date, view);
  return `?from=${from}&to=${to}`;
}

/**
 * `date` and `view` are controlled. `onNavigate` reports only what the user did (the buttons, the keys,
 * the switch), together with the `range` of cells on screen; `getFetchRange` turns the same position
 * into the range an app fetches entries for. The toolbar button changes `date` from outside and is not
 * reported.
 */
export const Controlled: Story = {
  render: () => <ControlledDemo />,
};

/**
 * A parent that applies the new `date` a moment after the key press, as a router, a store or a
 * `startTransition` does. Keyboard focus still follows the user to the day they moved to.
 */
function AsyncControlledDemo() {
  const [date, setDate] = React.useState("2026-10-15");
  return (
    <TimeCalendar<TimeEntry>
      events={DEMO_EVENTS}
      now={NOW}
      date={date}
      onNavigate={(next) => {
        window.setTimeout(() => setDate(next.date), 60);
      }}
    />
  );
}

export const ControlledAsync: Story = {
  render: () => <AsyncControlledDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("grid", { name: "October 2026" });
    const dayCell = (date: string) =>
      canvasElement.querySelector<HTMLElement>(`[role="gridcell"][data-date="${date}"]`);
    dayCell("2026-10-15")?.focus();
    await userEvent.keyboard("{PageDown}");
    await waitFor(() => expect(canvas.getByRole("grid", { name: "November 2026" })).toBeVisible());
    await waitFor(() => expect(document.activeElement).toBe(dayCell("2026-11-15")));
  },
};

/** Entries logged back to back, shorter than the least height of a block: see {@link ShortEntries}. */
const SHORT_ENTRIES: TimeCalendarEvent<TimeEntry>[] = [
  ["10:00", "10:10"],
  ["10:10", "10:20"],
  ["10:20", "10:30"],
  ["13:00", "13:15"],
  ["13:15", "13:30"],
  ["13:30", "13:45"],
].map(([start, end], index) => ({
  id: `short-${index}`,
  date: "2026-10-21",
  start,
  end,
  title: `Short ${index + 1}`,
  color: index % 2 === 0 ? "violet" : "teal",
}));

/** The `md` breakpoint: from here up a story has room for the week grid. */
const MD_PX = 768;

/**
 * Whether the calendars in this story have fallen back to their day agenda. Under `compactBelow`
 * (640px of the calendar's own width) there is no week grid, and a story about the grid has nothing
 * to assert: looking for the grid would throw, and the failure be logged as a console error. Below `md`
 * the calendars measure themselves after their first paint, so this waits for them to settle; a window
 * just under `md` can still be wide enough for the grid, and then this says so after the wait.
 */
async function showsDayAgenda(canvasElement: HTMLElement): Promise<boolean> {
  if (window.innerWidth >= MD_PX) return false;
  const calendars = () => [...canvasElement.querySelectorAll('[data-slot="time-calendar"]')];
  return waitFor(
    () =>
      expect(
        calendars().length > 0 &&
          calendars().every((calendar) => calendar.hasAttribute("data-compact")),
      ).toBe(true),
    { timeout: 1500 },
  ).then(
    () => true,
    () => false,
  );
}

/** Rectangles of two elements overlap by more than a pixel in both directions. */
function overlaps(a: DOMRect, b: DOMRect) {
  return (
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
  );
}

/**
 * Entries logged back to back, shorter than the least height of a block (three of 10 minutes and
 * three of 15). They do not overlap, so they share one full-width column and each is drawn at its
 * true length, up to the entry below it: only the last of each run has room to be lifted to the least
 * height. The trade-off is that a block drawn that short has no room for its label: it shows one tight
 * line from 19.5 minutes (see {@link TightLabels}), and below that it is a bare bar of colour with no
 * text at all, which is every block here but the last of each run; the name stays in its tooltip and
 * its accessible name. A 10-minute bar is 6.7 to 9.3px tall, and an entry of a minute or two that
 * another follows is a sliver of a pixel or two: that is the price of drawing every entry at its true
 * length and never over its neighbour. Every block is still reachable by keyboard (focus the day, then
 * Tab), and a bar that is tall enough to hit is clickable by pointer.
 */
export const ShortEntries: Story = {
  render: () => <Demo events={SHORT_ENTRIES} defaultView="week" defaultDate="2026-10-21" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("grid", { name: /week 43/ });
    const column = canvasElement.querySelector<HTMLElement>(
      '[role="gridcell"][data-date="2026-10-21"]',
    )!;
    const blocks = [...column.querySelectorAll<HTMLElement>("button[data-event-id]")];
    await expect(blocks).toHaveLength(SHORT_ENTRIES.length);

    // One column: every block has the whole width of the day, and some height.
    for (const block of blocks) {
      const { width, height } = block.getBoundingClientRect();
      await expect(height, `${block.dataset.eventId} has a height`).toBeGreaterThan(0);
      await expect(
        Math.abs(width - column.clientWidth),
        `${block.dataset.eventId}: width ${width.toFixed(1)} of ${column.clientWidth}`,
      ).toBeLessThan(4);
    }
    // None is drawn over another.
    for (const [i, first] of blocks.entries()) {
      for (const second of blocks.slice(i + 1)) {
        const message = `${first.dataset.eventId} and ${second.dataset.eventId} overlap`;
        await expect(
          overlaps(first.getBoundingClientRect(), second.getBoundingClientRect()),
          message,
        ).toBe(false);
      }
    }

    // A block too short for text is a bar: no text, but the name is still there.
    const bars = blocks.filter((block) => block.dataset.fit === "bar");
    await expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      await expect(bar.textContent, `${bar.dataset.eventId} shows no text`).toBe("");
      await expect(bar.getAttribute("aria-label"), `${bar.dataset.eventId} is named`).toMatch(
        /^Short \d, /,
      );
      await expect(bar.getAttribute("title")).toBe(bar.getAttribute("aria-label"));
    }
    for (const block of blocks.filter((b) => b.dataset.fit !== "bar")) {
      await expect(block.textContent).toContain("Short");
    }

    // Clickable by pointer: nothing sits on top of a block's middle.
    for (const block of blocks) {
      block.scrollIntoView({ block: "center" });
      const { left, top, width, height } = block.getBoundingClientRect();
      const hit = document.elementFromPoint(left + width / 2, top + height / 2);
      // The hit is the block or its label, never a neighbour or the column behind it.
      await expect(
        hit !== null && block.contains(hit),
        `${block.dataset.eventId} is hit at its middle`,
      ).toBe(true);
    }

    // Reachable by keyboard: from the day, Tab visits each block in turn.
    column.focus();
    for (const block of blocks) {
      await userEvent.tab();
      await expect(document.activeElement, `Tab reaches ${block.dataset.eventId}`).toBe(block);
    }
  },
};

/** One weekday of {@link ADJACENT_CASES}: what is logged, and whether any of it truly overlaps. */
interface AdjacentCase {
  /** The weekday column of the week of 19 October the case sits in. */
  date: string;
  /** Start and end of each entry, in the order they are logged. */
  times: readonly (readonly [string, string])[];
  /** The entries truly overlap, so the week view must put them side by side. */
  overlap: boolean;
}

/**
 * Entries that touch or nearly touch, one case per weekday. The first is the day an accounting app
 * reported: the server refuses real overlaps, yet the 20-minute entry was drawn beside the next one.
 */
const ADJACENT_CASES: readonly AdjacentCase[] = [
  {
    date: "2026-10-19",
    times: [
      ["07:24", "07:44"],
      ["07:45", "08:15"],
      ["08:45", "09:55"],
      ["11:30", "13:00"],
    ],
    overlap: false,
  },
  {
    date: "2026-10-20",
    times: [
      ["09:00", "09:20"],
      ["09:20", "10:00"],
    ],
    overlap: false,
  },
  {
    date: "2026-10-21",
    times: [
      ["09:00", "09:20"],
      ["09:21", "10:00"],
    ],
    overlap: false,
  },
  {
    date: "2026-10-22",
    times: [
      ["10:00", "10:10"],
      ["10:10", "10:20"],
      ["10:20", "10:30"],
    ],
    overlap: false,
  },
  {
    date: "2026-10-23",
    times: [
      ["09:00", "10:00"],
      ["09:30", "10:30"],
    ],
    overlap: true,
  },
];

const ADJACENT_PROJECTS = ["Acme Logistik", "Fjällbacka webbplats", "Intern"] as const;

const ADJACENT_EVENTS: TimeCalendarEvent<TimeEntry>[] = ADJACENT_CASES.flatMap(
  ({ date, times, overlap }, caseIndex) =>
    times.map(([start, end], index) => {
      // The owner's day is one project all day, as an accounting app logs it; the others alternate.
      const project = ADJACENT_PROJECTS[caseIndex === 0 ? 0 : (caseIndex + index) % 3];
      return {
        id: `adjacent-${caseIndex}-${index}`,
        date,
        start,
        end,
        title: project,
        description: overlap ? "Two entries that really overlap" : "building: Route planning API",
        color: calendarColorForKey(project),
      };
    }),
);

/**
 * Entries that do not overlap are never drawn as if they did. Each weekday is one case: the day an
 * accounting app reported (07:24 to 07:44, 07:45 to 08:15, 08:45 to 09:55, 11:30 to 13:00), a
 * 20-minute entry followed by one that starts the minute it ends, one that starts a minute later, a
 * chain of three 10-minute entries, and on Friday two entries that really overlap and so still sit
 * side by side. Extra columns mean a true overlap, whatever the density; a block shorter than the
 * least height is lifted only into free space, then trimmed to the next block, and its label
 * shrinks to one line and then to a bare bar (the name stays in its tooltip and accessible name).
 */
export const AdjacentEntries: Story = {
  render: () => <Demo events={ADJACENT_EVENTS} defaultView="week" defaultDate="2026-10-22" />,
  parameters: { keyboard: { sweep: true, maxStops: 12, forcedColors: true } },
  play: async ({ canvasElement }) => {
    if (await showsDayAgenda(canvasElement)) return;
    const canvas = within(canvasElement);
    await canvas.findByRole("grid", { name: /week 43/ });
    for (const { date, times, overlap } of ADJACENT_CASES) {
      const column = canvasElement.querySelector<HTMLElement>(
        `[role="gridcell"][data-date="${date}"]`,
      );
      await expect(column, `the column of ${date}`).not.toBeNull();
      // Blocks are positioned against the column's padding box, which is what `clientWidth` measures.
      const inner = column!.clientWidth;
      const blocks = [...column!.querySelectorAll<HTMLElement>("button[data-event-id]")].sort(
        (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
      );
      await expect(blocks, `${date}: entries drawn`).toHaveLength(times.length);

      for (const block of blocks) {
        const { width, height } = block.getBoundingClientRect();
        await expect(height, `${date} ${block.dataset.eventId}: height`).toBeGreaterThan(0);
        const label = `${date} ${block.dataset.eventId}: width ${width.toFixed(1)} of ${inner}`;
        if (overlap) await expect(Math.abs(width - inner / 2), label).toBeLessThan(4);
        else await expect(Math.abs(width - inner), label).toBeLessThan(4);
      }

      for (const [i, first] of blocks.slice(0, -1).entries()) {
        const a = first.getBoundingClientRect();
        const b = blocks[i + 1].getBoundingClientRect();
        const pair = `${date}: ${first.dataset.eventId} and ${blocks[i + 1].dataset.eventId}`;
        if (overlap) {
          // Side by side: the left one ends where the right one begins.
          await expect(a.right, `${pair} are side by side`).toBeLessThanOrEqual(b.left + 0.5);
        } else {
          await expect(
            a.bottom,
            `${pair}: the first ends before the next begins`,
          ).toBeLessThanOrEqual(b.top + 0.5);
        }
      }
    }
  },
};

/** Titles that start with an Å, Ä or Ö, in blocks of 21, 21, 21, 15, 15 and 20 minutes: see {@link TightLabels}. */
const TIGHT_LABEL_ENTRIES: TimeCalendarEvent<TimeEntry>[] = [
  ["09:00", "09:21", "Åre"],
  ["09:21", "09:42", "Östersund"],
  ["09:42", "10:03", "Ändra projekt"],
  ["10:03", "10:45", "Acme Logistik"],
  ["11:00", "11:15", "Åre"],
  ["11:15", "11:30", "Östersund"],
  ["11:30", "11:50", "Ändra projekt"],
  ["11:50", "12:30", "Intern"],
].map(([start, end, title], index) => ({
  id: `tight-${index}`,
  date: "2026-10-21",
  start,
  end,
  title,
  color: calendarColorForKey(title),
}));

/**
 * The one-line label of a short block, at every density. A block drawn between 19.5 and about 27
 * minutes (the 21, 21 and 21 minute entries and the 20 minute one below, each followed by another)
 * keeps its title on one tight line, and the line has room for what a title can have above and below
 * it: the ring of an Å, Ä or Ö above, the descenders below. The title clips at its own box, so the box
 * has that room as padding, and a block shorter than the box would cut the ink at its edge. Shorter
 * than that, a block is a bar with no text (the two 15 minute entries), because the text would be
 * cut. The play measures it for real: the title's box stays inside the block and has headroom for the
 * ring of an Å. (Forced-colors mode, Windows High Contrast, takes a 1px border out of a block's
 * height; a tight block does not get its top and bottom border there, so that it keeps this room.)
 */
export const TightLabels: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      {(["Small", "Medium", "Large"] as const).map((density) => (
        <section key={density} data-density={density} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{density}</h3>
          <TimeCalendar<TimeEntry>
            events={TIGHT_LABEL_ENTRIES}
            now={NOW}
            defaultDate="2026-10-21"
            defaultView="week"
            density={density as never}
            hourRange={[9, 13]}
            headingLevel={4}
          />
        </section>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (await showsDayAgenda(canvasElement)) return;
    for (const density of ["Small", "Medium", "Large"]) {
      const section = canvasElement.querySelector<HTMLElement>(
        `section[data-density="${density}"]`,
      )!;
      await within(section).findByRole("grid", { name: /week 43/ });
      const column = section.querySelector<HTMLElement>(
        '[role="gridcell"][data-date="2026-10-21"]',
      )!;
      const blocks = [...column.querySelectorAll<HTMLElement>("button[data-event-id]")].sort(
        (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
      );
      await expect(blocks, `${density}: entries drawn`).toHaveLength(TIGHT_LABEL_ENTRIES.length);

      const fits = blocks.map((block) => block.dataset.fit);
      // The 21 minute entries and the 20 minute one keep a label, the two 15 minute ones are bars.
      await expect(fits, `${density}: fit of each block`).toEqual([
        "tight",
        "tight",
        "tight",
        "full",
        "bar",
        "bar",
        "tight",
        "full",
      ]);

      for (const block of blocks.filter((b) => b.dataset.fit === "tight")) {
        const title = block.firstElementChild as HTMLElement;
        const name = `${density} ${block.dataset.eventId}`;
        const { fontSize, paddingTop, paddingBottom } = getComputedStyle(title);
        // Room above the line for the ring of an Å (0.125em in Geist) and below it for descenders.
        await expect(
          parseFloat(paddingTop),
          `${name}: room above the title`,
        ).toBeGreaterThanOrEqual(0.125 * parseFloat(fontSize));
        await expect(parseFloat(paddingBottom), `${name}: room below the title`).toBeGreaterThan(0);

        // The whole title box, headroom included, is inside the block: nothing is cut at its edge.
        const box = block.getBoundingClientRect();
        const text = title.getBoundingClientRect();
        await expect(text.top, `${name}: title top inside the block`).toBeGreaterThanOrEqual(
          box.top - 0.01,
        );
        await expect(text.bottom, `${name}: title bottom inside the block`).toBeLessThanOrEqual(
          box.bottom + 0.01,
        );
      }

      // A bar has no text, and still has a name.
      for (const bar of blocks.filter((b) => b.dataset.fit === "bar")) {
        await expect(bar.textContent).toBe("");
        await expect(bar.getAttribute("aria-label")).toMatch(/^(Åre|Östersund), /);
      }
    }
  },
};

/** Thirty entries on one day: "+N more" opens a list that scrolls inside the window and not past it. */
const BUSY_DAY: TimeCalendarEvent<TimeEntry>[] = Array.from({ length: 30 }, (_, index) => {
  const startMinutes = 6 * 60 + index * 30;
  const time = (minutes: number) =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return {
    id: `busy-${index}`,
    date: "2026-10-08",
    start: time(startMinutes),
    end: time(startMinutes + 20),
    title: `Task ${String(index + 1).padStart(2, "0")}`,
    description: "A second line, so the row is as tall as a real one",
  };
});

export const BusyDay: Story = {
  render: () => <Demo events={BUSY_DAY} defaultDate="2026-10-08" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: /^\+\d+ more, Thursday 8 October 2026/ }),
    );
    const popover = await within(document.body).findByRole("dialog", {
      name: "Thursday 8 October 2026",
    });
    const rows = within(popover).getAllByRole("button");
    await expect(rows).toHaveLength(BUSY_DAY.length);

    // The popover fits the window, and the list is what scrolls.
    await expect(popover.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      window.innerHeight + 1,
    );
    const list = rows[0].parentElement as HTMLElement;
    await expect(getComputedStyle(list).overflowY).toBe("auto");
    await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);

    // The last row is reachable: focusing it scrolls it into the list's visible part.
    rows.at(-1)?.focus();
    const row = rows.at(-1)!.getBoundingClientRect();
    const box = list.getBoundingClientRect();
    await expect(row.bottom).toBeLessThanOrEqual(box.bottom + 1);
    await expect(row.top).toBeGreaterThanOrEqual(box.top - 1);
    await userEvent.keyboard("{Escape}");
  },
};

/** A calendar in a tab panel that stays mounted but hidden, until it is shown. */
function HiddenThenShownDemo() {
  const [shown, setShown] = React.useState(false);
  const afternoon: TimeCalendarEvent[] = [
    {
      id: "pm",
      date: "2026-10-23",
      start: "15:30",
      end: "17:00",
      title: "Afternoon",
      color: "violet",
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      <Button type="button" onClick={() => setShown(true)}>
        Show calendar
      </Button>
      <div hidden={!shown} data-testid="panel">
        <TimeCalendar
          events={afternoon}
          now={NOW}
          defaultDate="2026-10-23"
          defaultView="week"
          maxBodyHeight="20rem"
        />
      </div>
    </div>
  );
}

export const HiddenThenShown: Story = {
  render: () => <HiddenThenShownDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Show calendar" }));
    const grid = await canvas.findByRole("grid");
    // The week opens on its first entry although it was measured while nothing was laid out.
    await waitFor(() => expect(grid.scrollTop).toBeGreaterThan(0));
  },
};

const LIST_COLUMNS: DataTableColumn<TimeEntry>[] = [
  { name: "date", header: "Date", nowrap: true },
  {
    name: "time",
    header: "Time",
    accessor: (e) => (e.start ? `${e.start}–${e.end ?? "now"}` : ""),
  },
  { name: "project", header: "Project" },
  { name: "activity", header: "Activity" },
  {
    name: "hours",
    header: "Hours",
    align: "Right",
    accessor: (e) => e.hours,
    cell: (value) => formatTrackedHours(Number(value)),
  },
];

type Mode = CalendarView | "list";

function InCardDemo() {
  const [mode, setMode] = React.useState<Mode>("month");
  const [date, setDate] = React.useState("2026-10-23");
  const period = getPeriodRange(date, mode === "week" ? "week" : "month");
  const rows = DEMO_ENTRIES.filter((e) => e.date >= period.from && e.date <= period.to);
  return (
    <Card className="max-w-full">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-y-1.5">
          <CardTitle>Time</CardTitle>
          <CardDescription>Calendar or list, the same entries and the same period.</CardDescription>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          value={mode}
          onValueChange={(next) => next && setMode(next as Mode)}
          aria-label="Display"
        >
          <ToggleGroupItem value="month">Month</ToggleGroupItem>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
          <ToggleGroupItem value="list">List</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent flush={mode === "list"}>
        {mode === "list" ? (
          <DataTable
            columns={LIST_COLUMNS}
            rows={rows}
            getRowId={(e) => String(e.id)}
            caption={`Time entries ${period.from} to ${period.to}`}
          />
        ) : (
          // The app's own switch (above) owns the view, so the calendar offers a single one.
          <TimeCalendar<TimeEntry>
            events={DEMO_EVENTS}
            now={NOW}
            date={date}
            view={mode}
            views={[mode]}
            onNavigate={(next) => setDate(next.date)}
            headingLevel={3}
            toolbar={<Button type="button">Log time</Button>}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** One switch for Month, Week and List, with a table as the list: the calendar as one view among several. */
export const InCard: Story = {
  render: () => <InCardDemo />,
};

/**
 * Names and labels in Swedish, hours as the app's own formatter writes them, and `formatHours` and
 * `locale` taken from the same place. The week starts on Monday by default, as in Sweden.
 */
export const Swedish: Story = {
  render: () => (
    <Demo
      locale={sv}
      formatHours={(hours) => formatTrackedHours(hours, "decimal", "sv-SE")}
      labels={{
        today: "Idag",
        previousMonth: "Föregående månad",
        nextMonth: "Nästa månad",
        previousWeek: "Föregående vecka",
        nextWeek: "Nästa vecka",
        month: "Månad",
        week: "Vecka",
        view: "Kalendervy",
        more: (count) => `+${count} till`,
        add: "Lägg till",
        noEntries: "Inga poster",
        hoursOnly: "Utan tid",
        time: "Tid",
        running: "pågår",
        entries: (count) => `${count} ${count === 1 ? "post" : "poster"}`,
        endsNextDay: (end) => `slutar ${end} nästa dag`,
        continuesFromPreviousDay: "fortsätter från föregående dag",
        weekNumber: (week) => `vecka ${week}`,
        timeRange: (start, end) => `${start} till ${end}`,
        since: (start) => `sedan ${start}`,
      }}
      toolbar={<Button type="button">Logga tid</Button>}
    />
  ),
};
