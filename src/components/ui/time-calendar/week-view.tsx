import * as React from "react";

import { cn } from "@/lib/utils";
import { weekDays } from "./calendar-math";
import { weekTitleParts, type CalendarViewContext } from "./calendar-shared";
import { EventBlock, EventChip, minBlockMinutes, type HOUR_REM } from "./event-button";
import {
  fromMinutes,
  hourRangeFor,
  isHoursOnly,
  layoutDayEvents,
  segmentsForDay,
  slotAt,
  slotMinutes,
  type PositionedSegment,
} from "./event-layout";
import { formatDayLabel, formatWeekdayName } from "./format";
import { CalendarLoadingBar } from "./loading-bar";
import {
  calendarFrameVariant,
  dayNumberVariant,
  dayTotalVariant,
  weekBodyVariant,
  weekDayColumnVariant,
  weekDayHeaderVariant,
  weekGutterVariant,
  weekHeaderRowVariant,
  weekHourLabelVariant,
  weekHourLineVariant,
  weekLinesVariant,
  weekNowLineVariant,
  weekScrollerVariant,
  weekStickyVariant,
  weekStripCellVariant,
  weekStripHeaderVariant,
  weekStripRowVariant,
} from "./time-calendar-variant";
import type { TimeCalendarEvent } from "./types";

/** Blank space kept above the first entry when the grid scrolls to it, in minutes. */
const SCROLL_AIR_MINUTES = 30;

/** The grid scrolls to a whole hour, with this much of the hour above it so its label is not cut, in hours. */
const SCROLL_LABEL_HOURS = 0.2;

/** How far above "now" an otherwise empty current week scrolls, in minutes. */
const NOW_LEAD_MINUTES = 60;

/** Pads a scroll area by its sticky header, so that a block focus scrolls into view clears the header. */
function padForSticky(scroller: HTMLElement | null, sticky: HTMLElement | null) {
  if (scroller) scroller.style.scrollPaddingTop = `${sticky?.offsetHeight ?? 0}px`;
}

interface WeekViewProps {
  ctx: CalendarViewContext;
  /** Any day of the week to show. */
  anchor: string;
  /** The day column that is the grid's one tab stop. */
  tabStop: string;
  events: readonly TimeCalendarEvent[];
  byDate: ReadonlyMap<string, TimeCalendarEvent[]>;
  totals: ReadonlyMap<string, number>;
  /** The configured hours; the grid widens them to hold every entry of the week. */
  hourRange: readonly [number, number];
  snapMinutes: number;
  loading: boolean;
  gridRef: React.Ref<HTMLDivElement>;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>, date: string) => void;
  onFocusDate: (date: string) => void;
  /** Enter or Space on a day column, a click on a day's header, or a click on a column with no `onSlotClick`. */
  onActivate: (date: string) => void;
  onSlotClick?: (date: string, time: string) => void;
}

export function WeekView({
  ctx,
  anchor,
  tabStop,
  events,
  byDate,
  totals,
  hourRange,
  snapMinutes,
  loading,
  gridRef,
  onKeyDown,
  onFocusDate,
  onActivate,
  onSlotClick,
}: WeekViewProps) {
  const { density, labels, locale, weekStartsOn, clock } = ctx;
  const days = React.useMemo(() => weekDays(anchor, weekStartsOn), [anchor, weekStartsOn]);
  const [configuredStart, configuredEnd] = hourRange;

  const { columns, range } = React.useMemo(() => {
    const perDay = days.map((date) => segmentsForDay(events, date, clock));
    // A short block is lifted to its minimum height only into free space (never past the start of
    // the block below it, so it can end up drawn as short as its entry), and entries are put in
    // separate columns only where they truly overlap, so two entries that touch or merely sit close
    // are never drawn as if they overlapped.
    const least = minBlockMinutes(density as keyof typeof HOUR_REM);
    return {
      columns: perDay.map((segments) => layoutDayEvents(segments, least)),
      range: hourRangeFor(perDay.flat(), [configuredStart, configuredEnd]),
    };
  }, [events, days, clock, density, configuredStart, configuredEnd]);
  const [firstHour, endHour] = range;
  const hours = endHour - firstHour;
  // Where a key press creates an entry on a day that is not today: the first configured hour.
  const firstConfiguredMin = Math.min(Math.max(Math.floor(configuredStart), 0), 23) * 60;

  const eventsById = React.useMemo(() => {
    const byId = new Map<string, TimeCalendarEvent>();
    for (const event of events) if (!byId.has(event.id)) byId.set(event.id, event);
    return byId;
  }, [events]);

  const stripColumns = days.map((date) => (byDate.get(date) ?? []).filter(isHoursOnly));
  const hasStrip = stripColumns.some((column) => column.length > 0);

  // Scroll to the week's first entry, or to the present in an empty current week, whenever the
  // week changes or its first entries arrive; never because a minute passed.
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const stickyRef = React.useRef<HTMLDivElement>(null);
  // The tail of a night shift on Monday's column starts at 00:00 and must not drag the view there.
  const starts = columns.flat();
  const firstStartMin = Math.min(
    ...(starts.some((s) => !s.continued) ? starts.filter((s) => !s.continued) : starts).map(
      (s) => s.startMin,
    ),
  );
  const hasSegments = starts.length > 0;
  const scrollKey = `${days[0]}:${hasSegments}`;
  // Where to scroll to, as of the latest render: the scroll below can run a while after the render
  // that asked for it (see there), by which time the week's entries may have changed.
  const scrollTarget = React.useRef({ firstHour, hours, firstStartMin, hasSegments, days, clock });
  React.useLayoutEffect(() => {
    scrollTarget.current = { firstHour, hours, firstStartMin, hasSegments, days, clock };
  });
  React.useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const body = bodyRef.current;
    if (!scroller || !body) return;
    const scrollToFirst = (): boolean => {
      // A calendar that is mounted hidden (a tab panel, an accordion) has no height to scroll by.
      if (body.offsetHeight === 0) return false;
      const target = scrollTarget.current;
      let targetMin = target.firstHour * 60;
      if (target.hasSegments) targetMin = target.firstStartMin;
      else if (target.days.includes(target.clock.date)) {
        targetMin = target.clock.minutes - NOW_LEAD_MINUTES;
      }
      const hourPx = body.offsetHeight / target.hours;
      const topHour = Math.max(target.firstHour, Math.floor((targetMin - SCROLL_AIR_MINUTES) / 60));
      const offset = (topHour - target.firstHour - SCROLL_LABEL_HOURS) * hourPx;
      // The sticky header sits above the body, so a body offset is also a scroll offset.
      scroller.scrollTop = Math.max(0, offset);
      return true;
    };
    if (scrollToFirst() || typeof ResizeObserver === "undefined") return;
    // Not laid out yet: scroll once, when it first gets a size.
    const observer = new ResizeObserver(() => {
      if (!scrollToFirst()) return;
      // The sticky header was measured at nothing too, and nothing else renders when the size arrives.
      padForSticky(scroller, stickyRef.current);
      observer.disconnect();
    });
    observer.observe(body);
    return () => observer.disconnect();
    // Only the key decides when to scroll: reading the rest here must not re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey]);

  // Focus scrolls a block into view, which would leave it under the sticky header without this.
  React.useLayoutEffect(() => padForSticky(scrollerRef.current, stickyRef.current));

  const setScroller = React.useCallback(
    (node: HTMLDivElement | null) => {
      scrollerRef.current = node;
      if (typeof gridRef === "function") gridRef(node);
      else if (gridRef) (gridRef as React.RefObject<HTMLDivElement | null>).current = node;
    },
    [gridRef],
  );

  const { range: rangeText, week } = weekTitleParts(anchor, ctx);
  const showNow = days.includes(clock.date);
  const nowMin = clock.minutes;

  return (
    <div className={cn(calendarFrameVariant(), "relative")}>
      {loading ? <CalendarLoadingBar /> : null}
      <div
        ref={setScroller}
        role="grid"
        aria-label={week ? `${week}, ${rangeText}` : rangeText}
        aria-colcount={8}
        className={weekScrollerVariant()}
      >
        <div ref={stickyRef} role="rowgroup" className={weekStickyVariant()}>
          <div role="row" className={weekHeaderRowVariant()}>
            <div role="columnheader" aria-colindex={1}>
              <span className="sr-only">{labels.time}</span>
            </div>
            {days.map((date, index) => (
              <div
                key={date}
                role="columnheader"
                aria-colindex={index + 2}
                aria-label={formatDayLabel(date, locale)}
                className={cn(
                  weekDayHeaderVariant({ density }),
                  !ctx.onDayClick && "cursor-default hover:bg-transparent",
                )}
                onClick={() => onActivate(date)}
              >
                <span>{formatWeekdayName(date, "short", locale)}</span>
                <span
                  className={dayNumberVariant({
                    density,
                    tone: date === clock.date ? "today" : "default",
                  })}
                >
                  {Number(date.slice(8))}
                </span>
                <span className={dayTotalVariant({ density })}>
                  {(totals.get(date) ?? 0) > 0 ? ctx.formatHours(totals.get(date) ?? 0) : "\u00a0"}
                </span>
              </div>
            ))}
          </div>

          {hasStrip ? (
            <div role="row" className={weekStripRowVariant()}>
              <div role="rowheader" aria-colindex={1} className={weekStripHeaderVariant()}>
                {labels.hoursOnly}
              </div>
              {days.map((date, index) => (
                <div
                  key={date}
                  role="gridcell"
                  aria-colindex={index + 2}
                  data-strip-date={date}
                  className={weekStripCellVariant()}
                  onFocus={() => onFocusDate(date)}
                  onKeyDown={(event) => onKeyDown(event, date)}
                >
                  {stripColumns[index].map((event) => (
                    <EventChip key={event.id} event={event} ctx={ctx} tabStop={date === tabStop} />
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          ref={bodyRef}
          role="row"
          className={weekBodyVariant()}
          style={{ height: `calc(var(--sc-hour) * ${hours})` }}
        >
          <div aria-hidden="true" className={weekGutterVariant()}>
            {Array.from({ length: hours }, (_, index) => (
              <span
                key={index}
                className={weekHourLabelVariant({ density, first: index === 0 })}
                style={{ top: `calc(var(--sc-hour) * ${index})` }}
              >
                {fromMinutes((firstHour + index) * 60)}
              </span>
            ))}
          </div>
          <div aria-hidden="true" className={weekLinesVariant()}>
            {Array.from({ length: hours - 1 }, (_, index) => (
              <div
                key={index}
                className={weekHourLineVariant()}
                style={{ top: `calc(var(--sc-hour) * ${index + 1})` }}
              />
            ))}
          </div>
          {days.map((date, index) => (
            <DayColumn
              key={date}
              ctx={ctx}
              date={date}
              colIndex={index + 2}
              segments={columns[index]}
              eventsById={eventsById}
              firstHour={firstHour}
              total={totals.get(date) ?? 0}
              entryCount={(byDate.get(date) ?? []).length}
              tabStop={date === tabStop}
              range={range}
              snapMinutes={snapMinutes}
              nowMin={showNow && date === clock.date ? nowMin : undefined}
              keyboardSlot={fromMinutes(
                slotAt(date === clock.date ? nowMin : firstConfiguredMin, range, snapMinutes),
              )}
              onKeyDown={onKeyDown}
              onFocusDate={onFocusDate}
              onActivate={onActivate}
              onSlotClick={onSlotClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface DayColumnProps {
  ctx: CalendarViewContext;
  date: string;
  /** The column's place in the grid, counting the gutter as the first. */
  colIndex: number;
  segments: readonly PositionedSegment[];
  eventsById: ReadonlyMap<string, TimeCalendarEvent>;
  firstHour: number;
  total: number;
  /** Entries that start on this day, hours-only ones included. */
  entryCount: number;
  tabStop: boolean;
  range: readonly [number, number];
  snapMinutes: number;
  /** Minutes since midnight, in today's column only. */
  nowMin: number | undefined;
  /**
   * The time Enter or Space on the column reports to `onSlotClick`, when that is the only way to
   * create an entry: the present on today's column, the first configured hour on any other day.
   */
  keyboardSlot: string;
  onKeyDown: WeekViewProps["onKeyDown"];
  onFocusDate: WeekViewProps["onFocusDate"];
  onActivate: WeekViewProps["onActivate"];
  onSlotClick: WeekViewProps["onSlotClick"];
}

function DayColumn({
  ctx,
  date,
  colIndex,
  segments,
  eventsById,
  firstHour,
  total,
  entryCount,
  tabStop,
  range,
  snapMinutes,
  nowMin,
  keyboardSlot,
  onKeyDown,
  onFocusDate,
  onActivate,
  onSlotClick,
}: DayColumnProps) {
  const { labels, locale } = ctx;
  const dayLabel = formatDayLabel(date, locale);
  const label =
    entryCount > 0
      ? `${dayLabel}, ${ctx.formatHours(total)}, ${labels.entries(entryCount)}`
      : dayLabel;
  const isToday = date === ctx.clock.date;
  const clickable = Boolean(onSlotClick ?? ctx.onDayClick);
  return (
    <div
      role="gridcell"
      aria-colindex={colIndex}
      data-date={date}
      data-today={isToday ? "" : undefined}
      tabIndex={tabStop ? 0 : -1}
      aria-current={isToday ? "date" : undefined}
      aria-label={label}
      className={cn(weekDayColumnVariant({ today: isToday }), !clickable && "cursor-default")}
      onFocus={() => onFocusDate(date)}
      onKeyDown={(event) => {
        // With only `onSlotClick` to create an entry by, the keyboard needs a way to do it too:
        // Enter or Space on the column creates at `keyboardSlot`. With `onDayClick` as well, the key
        // reports the day, as it always has.
        if (
          onSlotClick &&
          !ctx.onDayClick &&
          event.target === event.currentTarget &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.metaKey &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          onSlotClick(date, keyboardSlot);
          return;
        }
        onKeyDown(event, date);
      }}
      onClick={(event) => {
        if (!(event.target instanceof Element) || !event.currentTarget.contains(event.target)) {
          return;
        }
        if (event.target.closest("button")) return;
        if (!onSlotClick) {
          onActivate(date);
          return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0;
        onSlotClick(date, fromMinutes(slotMinutes(ratio, range, snapMinutes)));
      }}
    >
      {segments.map((segment) => {
        const event = eventsById.get(segment.id);
        if (!event) return null;
        return (
          <EventBlock
            key={segment.id}
            event={event}
            segment={segment}
            firstHour={firstHour}
            ctx={ctx}
            tabStop={tabStop}
          />
        );
      })}
      {nowMin !== undefined && nowMin >= range[0] * 60 && nowMin <= range[1] * 60 ? (
        <div
          aria-hidden="true"
          data-now-line=""
          className={weekNowLineVariant()}
          style={{ top: `calc(var(--sc-hour) * ${(nowMin - range[0] * 60) / 60})` }}
        />
      ) : null}
    </div>
  );
}
