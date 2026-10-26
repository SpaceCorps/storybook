import * as React from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { monthMatrix } from "./calendar-math";
import type { CalendarViewContext } from "./calendar-shared";
import { EventChip, EventRow } from "./event-button";
import { formatDayHeading, formatDayLabel, formatMonthTitle, formatWeekdayName } from "./format";
import { CalendarLoadingBar } from "./loading-bar";
import {
  calendarFrameVariant,
  dayNumberVariant,
  dayTotalVariant,
  eventDotsVariant,
  eventDotVariant,
  eventListVariant,
  monthCellHeaderVariant,
  monthCellVariant,
  monthRowVariant,
  monthWeekdayVariant,
  moreButtonVariant,
} from "./time-calendar-variant";
import type { CalendarColor, TimeCalendarEvent } from "./types";

/** Most dots a narrow cell shows; one per distinct colour, so a busy day does not wrap. */
const MAX_DOTS = 4;

interface MonthViewProps {
  ctx: CalendarViewContext;
  /** Any day of the month to show. */
  anchor: string;
  /** The cell that is the grid's one tab stop. */
  tabStop: string;
  /** The narrow layout: dots instead of chips, and a tap selects the day (`anchor`). */
  compact: boolean;
  byDate: ReadonlyMap<string, TimeCalendarEvent[]>;
  totals: ReadonlyMap<string, number>;
  /** Cell capacity: with more entries than this, the last line becomes "+N more". */
  maxEvents: number;
  loading: boolean;
  gridRef: React.Ref<HTMLDivElement>;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>, date: string) => void;
  onFocusDate: (date: string) => void;
  /** A click on the cell's empty area, or Enter or Space on the cell. */
  onActivate: (date: string) => void;
}

export function MonthView({
  ctx,
  anchor,
  tabStop,
  compact,
  byDate,
  totals,
  maxEvents,
  loading,
  gridRef,
  onKeyDown,
  onFocusDate,
  onActivate,
}: MonthViewProps) {
  const { density, locale, weekStartsOn } = ctx;
  const rows = React.useMemo(() => monthMatrix(anchor, weekStartsOn), [anchor, weekStartsOn]);
  const month = anchor.slice(0, 7);
  return (
    <div className={cn(calendarFrameVariant(), "relative")}>
      {loading ? <CalendarLoadingBar /> : null}
      <div
        ref={gridRef}
        role="grid"
        aria-label={formatMonthTitle(anchor, locale)}
        aria-colcount={7}
        aria-rowcount={rows.length + 1}
      >
        <div role="row" className={monthRowVariant()}>
          {rows[0].map((date) => (
            <div
              key={date}
              role="columnheader"
              aria-label={formatWeekdayName(date, "long", locale)}
              className={monthWeekdayVariant({ density })}
            >
              {formatWeekdayName(date, "short", locale)}
            </div>
          ))}
        </div>
        {rows.map((row) => (
          <div key={row[0]} role="row" className={monthRowVariant()}>
            {row.map((date) => (
              <MonthCell
                key={date}
                ctx={ctx}
                date={date}
                outside={date.slice(0, 7) !== month}
                tabStop={date === tabStop}
                compact={compact}
                selected={date === anchor}
                events={byDate.get(date) ?? NO_EVENTS}
                total={totals.get(date) ?? 0}
                maxEvents={maxEvents}
                onKeyDown={onKeyDown}
                onFocusDate={onFocusDate}
                onActivate={onActivate}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const NO_EVENTS: TimeCalendarEvent[] = [];

interface MonthCellProps {
  ctx: CalendarViewContext;
  date: string;
  outside: boolean;
  tabStop: boolean;
  compact: boolean;
  selected: boolean;
  events: readonly TimeCalendarEvent[];
  total: number;
  maxEvents: number;
  onKeyDown: MonthViewProps["onKeyDown"];
  onFocusDate: MonthViewProps["onFocusDate"];
  onActivate: MonthViewProps["onActivate"];
}

function MonthCell({
  ctx,
  date,
  outside,
  tabStop,
  compact,
  selected,
  events,
  total,
  maxEvents,
  onKeyDown,
  onFocusDate,
  onActivate,
}: MonthCellProps) {
  const { density, labels, locale, clock } = ctx;
  const isToday = date === clock.date;
  const dayLabel = formatDayLabel(date, locale);
  const label =
    events.length > 0
      ? `${dayLabel}, ${ctx.formatHours(total)}, ${labels.entries(events.length)}`
      : dayLabel;

  const shown = events.length > maxEvents ? events.slice(0, Math.max(maxEvents - 1, 0)) : events;
  const hidden = events.length - shown.length;

  const number = (
    <span
      aria-hidden="true"
      className={dayNumberVariant({
        density,
        tone: isToday ? "today" : outside ? "outside" : "default",
      })}
    >
      {Number(date.slice(8))}
    </span>
  );
  // A narrow cell keeps its total and dots lines even when empty, so every row is as tall as the fullest.
  const totalClass = cn(dayTotalVariant({ density }), compact && "tracking-tighter");
  const totalText =
    total > 0 ? (
      <span aria-hidden="true" className={totalClass}>
        {ctx.formatHours(total)}
      </span>
    ) : compact ? (
      <span aria-hidden="true" className={totalClass}>
        {"\u00a0"}
      </span>
    ) : null;

  return (
    <div
      role="gridcell"
      data-date={date}
      data-today={isToday ? "" : undefined}
      data-outside={outside ? "" : undefined}
      tabIndex={tabStop ? 0 : -1}
      aria-current={isToday ? "date" : undefined}
      aria-selected={compact ? selected : undefined}
      aria-label={label}
      className={cn(
        monthCellVariant({
          surface: compact && selected ? "selected" : outside ? "outside" : "default",
          compact,
        }),
        !compact && !ctx.onDayClick && "cursor-default",
      )}
      onFocus={() => onFocusDate(date)}
      onKeyDown={(event) => onKeyDown(event, date)}
      onClick={(event) => {
        // Entries and "+N more" are buttons with their own jobs; portal content bubbles here too.
        if (!(event.target instanceof Element) || !event.currentTarget.contains(event.target)) {
          return;
        }
        if (event.target.closest("button")) return;
        onActivate(date);
      }}
    >
      {compact ? (
        <>
          {number}
          {totalText}
          <CompactDots density={ctx.density} events={events} />
        </>
      ) : (
        <>
          <div aria-hidden="true" className={monthCellHeaderVariant()}>
            {number}
            {totalText}
          </div>
          {shown.map((event) => (
            <EventChip key={event.id} event={event} ctx={ctx} tabStop={tabStop} />
          ))}
          {hidden > 0 ? (
            <MoreEntries
              ctx={ctx}
              date={date}
              dayLabel={dayLabel}
              events={events}
              hidden={hidden}
              total={total}
              tabStop={tabStop}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function CompactDots({
  density,
  events,
}: {
  density: CalendarViewContext["density"];
  events: readonly TimeCalendarEvent[];
}) {
  const colors = [...new Set(events.map((event): CalendarColor => event.color ?? "slate"))].slice(
    0,
    MAX_DOTS,
  );
  return (
    <span aria-hidden="true" className={eventDotsVariant()}>
      {colors.length > 0 ? (
        colors.map((color) => <span key={color} className={eventDotVariant({ density, color })} />)
      ) : (
        <span className={cn(eventDotVariant({ density }), "invisible")} />
      )}
    </span>
  );
}

interface MoreEntriesProps {
  ctx: CalendarViewContext;
  date: string;
  dayLabel: string;
  events: readonly TimeCalendarEvent[];
  hidden: number;
  total: number;
  tabStop: boolean;
}

/** The "+N more" line of a full cell, and the popover that lists the whole day. */
function MoreEntries({ ctx, date, dayLabel, events, hidden, total, tabStop }: MoreEntriesProps) {
  const [open, setOpen] = React.useState(false);
  const { labels, density, locale } = ctx;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          tabIndex={tabStop ? 0 : -1}
          aria-label={`${labels.more(hidden)}, ${dayLabel}`}
          className={moreButtonVariant({ density })}
        >
          {labels.more(hidden)}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        aria-label={dayLabel}
        // Popper hands the popover the room the window has left; a long day scrolls inside it, under
        // a heading that stays put, instead of running off the screen where nothing can reach it.
        className="flex max-h-(--radix-popover-content-available-height) w-72 max-w-[calc(100vw-2rem)] flex-col gap-2 p-2"
      >
        <p className="m-0 shrink-0 px-1 text-sm font-semibold">
          {formatDayHeading(date, locale)}
          <span className="font-normal text-muted-foreground tabular-nums">
            {" · "}
            {ctx.formatHours(total)}
          </span>
        </p>
        <div
          data-slot="time-calendar-more-list"
          className={cn(eventListVariant(), "min-h-0 overflow-y-auto overscroll-contain")}
        >
          {events.map((event) => (
            <EventRow key={event.id} event={event} ctx={ctx} onActivate={() => setOpen(false)} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
