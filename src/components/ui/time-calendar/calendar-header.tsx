import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { densityToButtonSize, densityToIconButtonSize } from "@/components/ui/density-scale";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle";
import type { CalendarViewContext, HeadingLevel } from "./calendar-shared";
import {
  calendarActionsVariant,
  calendarHeaderVariant,
  calendarNavVariant,
  calendarTitleVariant,
} from "./time-calendar-variant";
import type { CalendarView } from "./types";

interface CalendarHeaderProps {
  ctx: CalendarViewContext;
  view: CalendarView;
  /** The views the switch offers; with one entry there is no switch. */
  views: readonly CalendarView[];
  /** The period, for example "October 2026". */
  title: string;
  /** What follows the title in a lighter weight: the week number, then the period's total hours. */
  summary: string;
  headingLevel: HeadingLevel;
  toolbar?: React.ReactNode;
  onStep: (direction: -1 | 1) => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
}

/**
 * Previous, today and next; the period's title with its total; the Month/Week switch; the toolbar.
 *
 * Only the title is a live region. The total follows the clock while a timer runs (and reads 0m
 * while a new period loads), so announcing it would repeat the heading every minute; a screen
 * reader still reads it as part of the heading when the heading is visited.
 */
export function CalendarHeader({
  ctx,
  view,
  views,
  title,
  summary,
  headingLevel,
  toolbar,
  onStep,
  onToday,
  onViewChange,
}: CalendarHeaderProps) {
  const { density, labels } = ctx;
  const Heading = `h${headingLevel}` as const;
  const iconSize = densityToIconButtonSize(density);
  return (
    <div className={calendarHeaderVariant({ density })}>
      <div className={calendarNavVariant()}>
        <Button
          type="button"
          variant="outline"
          size={iconSize}
          aria-label={view === "month" ? labels.previousMonth : labels.previousWeek}
          onClick={() => onStep(-1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          type="button"
          variant="outline"
          size={densityToButtonSize(density)}
          onClick={onToday}
        >
          {labels.today}
        </Button>
        <Button
          type="button"
          variant="outline"
          size={iconSize}
          aria-label={view === "month" ? labels.nextMonth : labels.nextWeek}
          onClick={() => onStep(1)}
        >
          <ChevronRight />
        </Button>
      </div>
      <Heading className={calendarTitleVariant({ density })}>
        <span aria-live="polite" aria-atomic="true">
          {title}
        </span>
        <span className="font-normal text-muted-foreground">
          {" · "}
          {summary}
        </span>
      </Heading>
      {views.length > 1 || toolbar ? (
        <div className={calendarActionsVariant()}>
          {views.length > 1 ? (
            <ToggleGroup
              type="single"
              variant="outline"
              density={density}
              value={view}
              aria-label={labels.view}
              // Pressing the active item again reports an empty value; a calendar always has a view.
              onValueChange={(next) => {
                if (next) onViewChange(next as CalendarView);
              }}
            >
              {views.map((item) => (
                <ToggleGroupItem key={item} value={item}>
                  {item === "month" ? labels.month : labels.week}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
          {toolbar}
        </div>
      ) : null}
    </div>
  );
}
