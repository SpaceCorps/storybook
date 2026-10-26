import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { densityToIconButtonSize } from "@/components/ui/density-scale";
import type { CalendarViewContext, HeadingLevel } from "./calendar-shared";
import { EventRow } from "./event-button";
import { formatDayHeading, formatDayLabel } from "./format";
import {
  agendaEmptyVariant,
  agendaHeadingVariant,
  dayAgendaVariant,
  eventListVariant,
} from "./time-calendar-variant";
import type { TimeCalendarEvent } from "./types";

interface DayAgendaProps {
  ctx: CalendarViewContext;
  date: string;
  /** The day's entries, already in display order. */
  events: readonly TimeCalendarEvent[];
  /** Hours for the heading; `undefined` leaves the total out. */
  total?: number;
  headingLevel: HeadingLevel;
  /**
   * Announce the day when it changes, for an agenda that follows a selected day. Only the day's name
   * is live: its total moves with the clock while a timer runs and would be read out every minute.
   */
  live?: boolean;
}

/**
 * One day as a heading with its total and an add button, then its entries as rows or a note that
 * there are none. This is what the narrow layout shows in place of the month and week grids.
 */
export function DayAgenda({
  ctx,
  date,
  events,
  total,
  headingLevel,
  live = false,
}: DayAgendaProps) {
  const { labels, density, locale, clock } = ctx;
  const headingId = React.useId();
  const Heading = `h${headingLevel}` as const;
  const isToday = date === clock.date;
  return (
    <section aria-labelledby={headingId} data-date={date} className={dayAgendaVariant({ density })}>
      <div className={agendaHeadingVariant({ density })}>
        <div className="flex min-w-0 items-center gap-2">
          <Heading
            id={headingId}
            aria-current={isToday ? "date" : undefined}
            className="m-0 min-w-0"
          >
            <span aria-live={live ? "polite" : undefined} aria-atomic={live ? "true" : undefined}>
              {formatDayHeading(date, locale)}
            </span>
            {total !== undefined && total > 0 ? (
              <span className="font-normal text-muted-foreground tabular-nums">
                {" · "}
                {ctx.formatHours(total)}
              </span>
            ) : null}
          </Heading>
          {isToday ? (
            <Badge variant="primary" aria-hidden="true">
              {labels.today}
            </Badge>
          ) : null}
        </div>
        {ctx.onDayClick ? (
          <Button
            type="button"
            variant="ghost"
            size={densityToIconButtonSize(density)}
            aria-label={`${labels.add}, ${formatDayLabel(date, locale)}`}
            title={labels.add}
            onClick={() => ctx.onDayClick?.(date)}
          >
            <Plus />
          </Button>
        ) : null}
      </div>
      {events.length > 0 ? (
        <div className={eventListVariant()}>
          {events.map((event) => (
            <EventRow key={event.id} event={event} ctx={ctx} />
          ))}
        </div>
      ) : (
        <p className={agendaEmptyVariant()}>{labels.noEntries}</p>
      )}
    </section>
  );
}
