import { cn } from "@/lib/utils";
import { calendarLoadingBarVariant, calendarLoadingTrackVariant } from "./time-calendar-variant";

/**
 * The indeterminate bar along the top edge of a grid while it loads. It floats over the frame's
 * border instead of taking a row, so showing and hiding it moves nothing.
 */
export function CalendarLoadingBar() {
  return (
    <div
      aria-hidden="true"
      className={cn(calendarLoadingTrackVariant(), "absolute inset-x-0 top-0 z-30 bg-transparent")}
    >
      <div className={calendarLoadingBarVariant()} />
    </div>
  );
}
