import * as React from "react";

import { useDensity } from "@/contexts/density-context";
import { useControllableValue } from "@/hooks/use-controllable-value";
import { useElementWidth } from "@/hooks/use-element-width";
import { useNow } from "@/hooks/use-now";
import { useMergedRefs } from "@/lib/merge-refs";
import { cn } from "@/lib/utils";
import { CalendarHeader } from "./calendar-header";
import {
  getPeriodRange,
  getVisibleRange,
  isValidIsoDate,
  stepPeriod,
  weekDays,
  zonedNow,
} from "./calendar-math";
import {
  subHeadingLevel,
  weekTitleParts,
  type CalendarViewContext,
  type HeadingLevel,
} from "./calendar-shared";
import { DayAgenda } from "./day-agenda";
import { dayTotals, groupByDate } from "./event-layout";
import { formatDuration, formatMonthTitle, resolveCalendarLabels } from "./format";
import { CalendarLoadingBar } from "./loading-bar";
import { MonthView } from "./month-view";
import { timeCalendarVariant } from "./time-calendar-variant";
import type { CalendarView, TimeCalendarEvent, TimeCalendarProps } from "./types";
import { useCalendarKeys } from "./use-calendar-keys";
import { WeekView } from "./week-view";

const BOTH_VIEWS: readonly CalendarView[] = ["month", "week"];
const DEFAULT_HOUR_RANGE = [6, 22] as const;

const defaultFormatHours = (hours: number) => formatDuration(hours, "hm");

/**
 * A calendar of tracked time: a month grid and a week time-grid of entries that carry a date, a
 * start and end (or only hours), a colour and a day total, with the same list of days as an agenda
 * when there is no room for a grid.
 *
 * Entries belong to the day they start; an `end` at or before the `start` runs into the next day.
 * The grid is a single tab stop (the active day): arrows, Home, End and PageUp/PageDown move
 * between days, Enter or Space acts on a day, and Tab walks the entries of the active day.
 *
 * `date` and `view` are controlled when given and uncontrolled otherwise. `onNavigate` reports the
 * visible range; `getFetchRange` turns a position into what an app fetches entries for.
 *
 * Size: the calendar fills the width it is given and lays itself out by that width (a container
 * query), so it needs a definite one: put it in a block, a stretching flex or grid item, or give it a
 * width. In a shrink-to-fit parent (`width: fit-content`, an absolutely positioned box with no width,
 * an `auto` grid column) an element that sizes itself by its container has no width of its own and
 * collapses to nothing.
 */
export function TimeCalendar<TMeta = unknown>({
  events,
  view: viewProp,
  defaultView = "month",
  onViewChange,
  views = BOTH_VIEWS,
  date: dateProp,
  defaultDate,
  onNavigate,
  onDayClick,
  onSlotClick,
  onEventClick,
  weekStartsOn = 1,
  locale,
  timeZone,
  now: nowProp,
  hourRange = DEFAULT_HOUR_RANGE,
  snapMinutes = 15,
  maxEventsPerDay = 3,
  formatHours = defaultFormatHours,
  compact: compactProp,
  compactBelow = 640,
  loading = false,
  toolbar,
  labels: labelsProp,
  density: densityProp,
  headingLevel = 2,
  maxBodyHeight,
  className,
  style,
  ref,
  ...rest
}: TimeCalendarProps<TMeta>) {
  const contextDensity = useDensity();
  const density = densityProp ?? contextDensity;
  const labels = React.useMemo(() => resolveCalendarLabels(labelsProp), [labelsProp]);

  const nowDate = useNow(nowProp);
  const clock = React.useMemo(() => zonedNow(nowDate, timeZone), [nowDate, timeZone]);

  const rootRef = React.useRef<HTMLElement>(null);
  const mergedRef = useMergedRefs<HTMLElement>(rootRef, ref);
  const width = useElementWidth(rootRef);
  // Width 0 means "not measured yet" (or nothing lays out, as in a test): show the full grid.
  const compact = compactProp ?? (width > 0 && width < compactBelow);

  const availableViews = views.length > 0 ? views : BOTH_VIEWS;
  const [viewState, setView] = useControllableValue<CalendarView>(
    viewProp,
    defaultView,
    onViewChange,
  );
  const view = availableViews.includes(viewState) ? viewState : availableViews[0];

  // A malformed `date` would make every date function throw, so it counts as not given.
  const usableDate = dateProp !== undefined && isValidIsoDate(dateProp) ? dateProp : undefined;
  const [anchor, setAnchor] = useControllableValue<string>(
    usableDate,
    defaultDate !== undefined && isValidIsoDate(defaultDate) ? defaultDate : clock.date,
    undefined,
  );

  const range = React.useMemo(
    () => getVisibleRange(anchor, view, weekStartsOn),
    [anchor, view, weekStartsOn],
  );
  const period = React.useMemo(
    () => getPeriodRange(anchor, view, weekStartsOn),
    [anchor, view, weekStartsOn],
  );

  // The roving tab stop. It starts on the anchor and follows focus; when the anchor moves (a button,
  // a click, the parent) it starts over there.
  const [focusedDate, setFocusedDate] = React.useState(anchor);
  const [syncedAnchor, setSyncedAnchor] = React.useState(anchor);
  if (syncedAnchor !== anchor) {
    setSyncedAnchor(anchor);
    setFocusedDate(anchor);
  }
  const tabStop = focusedDate >= range.from && focusedDate <= range.to ? focusedDate : anchor;

  const navigate = React.useCallback(
    (nextDate: string, nextView: CalendarView = view) => {
      if (nextDate === anchor && nextView === view) return;
      if (nextView !== view) setView(nextView);
      if (nextDate !== anchor) setAnchor(nextDate);
      onNavigate?.({
        date: nextDate,
        view: nextView,
        range: getVisibleRange(nextDate, nextView, weekStartsOn),
      });
    },
    [anchor, view, weekStartsOn, setView, setAnchor, onNavigate],
  );

  // On a narrow month a day is selected (it becomes the anchor and fills the agenda below the
  // grid); the add button of that agenda is what reports the day.
  const activateDay = React.useCallback(
    (date: string) => {
      if (compact && view === "month") navigate(date);
      else onDayClick?.(date);
    },
    [compact, view, navigate, onDayClick],
  );

  const { gridRef, onKeyDown } = useCalendarKeys({
    view,
    weekStartsOn,
    range,
    onFocusDate: setFocusedDate,
    onNavigate: navigate,
    onActivate: activateDay,
  });

  const handleEventClick = React.useCallback(
    (event: TimeCalendarEvent) => onEventClick?.(event as TimeCalendarEvent<TMeta>),
    [onEventClick],
  );

  const ctx = React.useMemo<CalendarViewContext>(
    () => ({
      density,
      labels,
      locale,
      weekStartsOn,
      clock,
      formatHours,
      onEventClick: onEventClick ? handleEventClick : undefined,
      onDayClick,
    }),
    [
      density,
      labels,
      locale,
      weekStartsOn,
      clock,
      formatHours,
      onEventClick,
      handleEventClick,
      onDayClick,
    ],
  );

  const byDate = React.useMemo(() => groupByDate(events), [events]);
  const totals = React.useMemo(() => dayTotals(events, clock), [events, clock]);
  const periodTotal = React.useMemo(() => {
    let sum = 0;
    for (const [date, hours] of totals) if (date >= period.from && date <= period.to) sum += hours;
    return sum;
  }, [totals, period.from, period.to]);

  let title: string;
  let summary = formatHours(periodTotal);
  if (view === "month") {
    title = formatMonthTitle(anchor, locale);
  } else {
    const parts = weekTitleParts(anchor, ctx);
    title = parts.range;
    summary = parts.week ? `${parts.week} · ${summary}` : summary;
  }

  const rootStyle = maxBodyHeight
    ? ({ "--sc-max-body": maxBodyHeight, ...style } as React.CSSProperties)
    : style;
  const levelBelow: HeadingLevel = subHeadingLevel(headingLevel);

  let body: React.ReactNode;
  if (view === "month") {
    body = (
      <>
        <MonthView
          ctx={ctx}
          anchor={anchor}
          tabStop={tabStop}
          compact={compact}
          byDate={byDate}
          totals={totals}
          maxEvents={Math.max(1, Math.floor(maxEventsPerDay))}
          loading={loading}
          gridRef={gridRef}
          onKeyDown={onKeyDown}
          onFocusDate={setFocusedDate}
          onActivate={activateDay}
        />
        {compact ? (
          <DayAgenda
            ctx={ctx}
            date={anchor}
            events={byDate.get(anchor) ?? []}
            total={totals.get(anchor)}
            headingLevel={levelBelow}
            live
          />
        ) : null}
      </>
    );
  } else if (compact) {
    body = (
      <div className="relative flex min-w-0 flex-col gap-4">
        {loading ? <CalendarLoadingBar /> : null}
        {weekDays(anchor, weekStartsOn).map((date) => (
          <DayAgenda
            key={date}
            ctx={ctx}
            date={date}
            events={byDate.get(date) ?? []}
            total={totals.get(date)}
            headingLevel={levelBelow}
          />
        ))}
      </div>
    );
  } else {
    body = (
      <WeekView
        ctx={ctx}
        anchor={anchor}
        tabStop={tabStop}
        events={events}
        byDate={byDate}
        totals={totals}
        hourRange={hourRange}
        snapMinutes={snapMinutes}
        loading={loading}
        gridRef={gridRef}
        onKeyDown={onKeyDown}
        onFocusDate={setFocusedDate}
        onActivate={activateDay}
        onSlotClick={onSlotClick}
      />
    );
  }

  return (
    <section
      {...rest}
      ref={mergedRef}
      data-slot="time-calendar"
      data-view={view}
      data-compact={compact ? "" : undefined}
      aria-busy={loading || undefined}
      className={cn(timeCalendarVariant({ density }), className)}
      style={rootStyle}
    >
      <CalendarHeader
        ctx={ctx}
        view={view}
        views={availableViews}
        title={title}
        summary={summary}
        headingLevel={headingLevel}
        toolbar={toolbar}
        onStep={(direction) => navigate(stepPeriod(anchor, view, direction))}
        onToday={() => navigate(clock.date)}
        onViewChange={(next) => navigate(anchor, next)}
      />
      {body}
    </section>
  );
}
