import * as React from "react";

import { cn } from "@/lib/utils";
import type { CalendarViewContext } from "./calendar-shared";
import { eventHours, fromMinutes, toMinutes, type PositionedSegment } from "./event-layout";
import {
  chipTimeVariant,
  eventChipVariant,
  eventRowVariant,
  runningDotVariant,
  weekBlockBackingVariant,
  weekBlockVariant,
} from "./time-calendar-variant";
import type { TimeCalendarEvent } from "./types";

const EN_DASH = "–";

/** `H:MM` written as `HH:MM`, or `undefined` when the text is not a time. */
function normalisedTime(time: string | undefined): string | undefined {
  const minutes = toMinutes(time);
  return minutes === undefined ? undefined : fromMinutes(minutes);
}

/** `08:30–12:00`, `since 13:45` for a timer with no end, or `undefined` for an entry without a time. */
export function eventTimeRange(
  event: TimeCalendarEvent,
  labels: CalendarViewContext["labels"],
): string | undefined {
  const start = normalisedTime(event.start);
  if (!start) return undefined;
  const end = normalisedTime(event.end);
  if (end) return `${start}${EN_DASH}${end}`;
  return event.running ? labels.since(start) : start;
}

interface SegmentFlags {
  continued: boolean;
  continues: boolean;
}

/**
 * The accessible name of an entry, which a button carries instead of its (truncated) text: title,
 * time, duration, whether it is running, then the description. A piece of a night shift says so.
 */
export function eventAriaLabel(
  event: TimeCalendarEvent,
  ctx: CalendarViewContext,
  segment?: SegmentFlags,
): string {
  const { labels } = ctx;
  const start = normalisedTime(event.start);
  const end = normalisedTime(event.end);
  const parts = [event.title];
  if (start) {
    parts.push(end ? labels.timeRange(start, end) : event.running ? labels.since(start) : start);
  }
  parts.push(ctx.formatHours(eventHours(event, ctx.clock)));
  if (event.running) parts.push(labels.running);
  if (event.description) parts.push(event.description);

  const notes: string[] = [];
  if (segment?.continued) notes.push(labels.continuesFromPreviousDay);
  else if (start && end && (toMinutes(end) ?? 0) <= (toMinutes(start) ?? 0)) {
    notes.push(labels.endsNextDay(end));
  }
  const label = parts.join(", ");
  return notes.length > 0 ? `${label} (${notes.join(", ")})` : label;
}

interface EventButtonProps {
  event: TimeCalendarEvent;
  ctx: CalendarViewContext;
  /** In the active cell the button is a tab stop; elsewhere it is reached by pointer or from its cell. */
  tabStop?: boolean;
  /** Called after `onEventClick`, so a popover can close itself. */
  onActivate?: () => void;
}

function eventClickHandler({ event, ctx, onActivate }: EventButtonProps) {
  return (clickEvent: React.MouseEvent) => {
    // The cell around a chip opens the day; a chip must never also do that.
    clickEvent.stopPropagation();
    ctx.onEventClick?.(event);
    onActivate?.();
  };
}

/** One entry on one line: the month cell and the week's strip of entries without a time. */
export function EventChip(props: EventButtonProps) {
  const { event, ctx, tabStop = false } = props;
  const label = eventAriaLabel(event, ctx);
  const onClick = eventClickHandler(props);
  const prefix = normalisedTime(event.start) ?? ctx.formatHours(eventHours(event, ctx.clock));
  return (
    <button
      type="button"
      data-event-id={event.id}
      tabIndex={tabStop ? 0 : -1}
      aria-label={label}
      title={label}
      className={eventChipVariant({ density: ctx.density, color: event.color })}
      onClick={onClick}
    >
      {event.running ? <span aria-hidden="true" className={runningDotVariant()} /> : null}
      <span className={chipTimeVariant()}>{prefix}</span>
      <span className="min-w-0 truncate font-medium">{event.title}</span>
    </button>
  );
}

/** An entry with room for a second line: the narrow layout's agenda and the "+N more" popover. */
export function EventRow(props: EventButtonProps) {
  const { event, ctx, tabStop = true } = props;
  const label = eventAriaLabel(event, ctx);
  const onClick = eventClickHandler(props);
  const detail = [eventTimeRange(event, ctx.labels), event.description].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      data-event-id={event.id}
      tabIndex={tabStop ? 0 : -1}
      aria-label={label}
      title={label}
      className={eventRowVariant({ density: ctx.density, color: event.color })}
      onClick={onClick}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            {event.running ? <span aria-hidden="true" className={runningDotVariant()} /> : null}
            <span className="min-w-0 truncate font-medium">{event.title}</span>
          </span>
          <span className="shrink-0 tabular-nums">
            {ctx.formatHours(eventHours(event, ctx.clock))}
          </span>
        </span>
        {detail ? <span className="line-clamp-2 break-words">{detail}</span> : null}
      </span>
    </button>
  );
}

/** Rem per hour of the week grid at each density; mirrors `--sc-hour` in the root variant. */
export const HOUR_REM = { Small: 2.5, Medium: 3, Large: 3.5 } as const;

/**
 * The least height a block is drawn at, in rem: five of this theme's 0.27rem spacing units, which
 * keeps a short entry big enough to read and to click. It is set inline (`blockStyle`) and not by a
 * class so that the layout, which has to know how tall a block really is, reads the same number.
 */
export const MIN_BLOCK_REM = 1.35;

/** That least height as minutes of the grid at `density`: how long an entry has to be to need no more. */
export function minBlockMinutes(density: keyof typeof HOUR_REM): number {
  return (MIN_BLOCK_REM / HOUR_REM[density]) * 60;
}

/** Rem per line of text in a block at each density: the line height of its text size. */
const LINE_REM = { Small: 0.9375, Medium: 1, Large: 1.25 } as const;

/** Room a block spends on its own padding and left border, in rem. */
const BLOCK_PADDING_REM = 0.3;

/** How many whole lines of text fit in a block that spans `minutes`. */
export function blockLines(minutes: number, density: keyof typeof HOUR_REM): number {
  const room = (Math.max(minutes, 0) / 60) * HOUR_REM[density] - BLOCK_PADDING_REM;
  return Math.max(1, Math.floor(room / LINE_REM[density]));
}

const round = (value: number) => Number(value.toFixed(4));

/**
 * The inline position of a block: vertical in hours of the grid, horizontal in the share of its
 * column, and never shorter than `MIN_BLOCK_REM`.
 */
export function blockStyle(segment: PositionedSegment, firstHour: number): React.CSSProperties {
  const lengthMin = Math.max(segment.endMin, segment.startMin + 1) - segment.startMin;
  return {
    top: `calc(var(--sc-hour) * ${round((segment.startMin - firstHour * 60) / 60)})`,
    height: `calc(var(--sc-hour) * ${round(lengthMin / 60)})`,
    minHeight: `${MIN_BLOCK_REM}rem`,
    left: `calc(${round((segment.col / segment.cols) * 100)}% + 1px)`,
    width: `calc(${round((segment.span / segment.cols) * 100)}% - 2px)`,
  };
}

interface EventBlockProps {
  event: TimeCalendarEvent;
  segment: PositionedSegment;
  firstHour: number;
  ctx: CalendarViewContext;
  tabStop?: boolean;
}

/**
 * An entry's block in a day column. A night shift's two pieces square off the edge they continue
 * from. The corner utilities are important: `rounded-selector` is a custom shorthand that sorts after
 * the generated side utilities, so a plain `rounded-b-none` loses to it and the edge stays round.
 */
export function EventBlock({ event, segment, firstHour, ctx, tabStop = false }: EventBlockProps) {
  const label = eventAriaLabel(event, ctx, segment);
  const style = blockStyle(segment, firstHour);
  const lines = blockLines(
    Math.max(segment.endMin, segment.startMin + 1) - segment.startMin,
    ctx.density as keyof typeof HOUR_REM,
  );
  const range = eventTimeRange(event, ctx.labels);
  const corners = cn(
    segment.continues && "rounded-b-none!",
    segment.continued && "rounded-t-none!",
  );
  return (
    <>
      <span aria-hidden="true" className={cn(weekBlockBackingVariant(), corners)} style={style} />
      <button
        type="button"
        data-event-id={event.id}
        tabIndex={tabStop ? 0 : -1}
        aria-label={label}
        title={label}
        className={cn(
          weekBlockVariant({
            density: ctx.density,
            color: event.color,
            running: event.running === true,
          }),
          corners,
        )}
        style={style}
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();
          ctx.onEventClick?.(event);
        }}
      >
        <span className="block w-full truncate font-medium">{event.title}</span>
        {lines >= 2 && range ? (
          <span className="block w-full truncate tabular-nums">{range}</span>
        ) : null}
        {lines >= 3 && event.description ? (
          <span className={cn("block w-full", lines >= 4 ? "line-clamp-2" : "truncate")}>
            {event.description}
          </span>
        ) : null}
      </button>
    </>
  );
}
