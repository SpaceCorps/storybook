import * as React from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  DayButton,
  DayPicker,
  useDayPicker,
  getDefaultClassNames,
  type MonthCaptionProps,
} from "react-day-picker";
import { parse, type Locale } from "date-fns";

import { cn } from "@/lib/utils";
import { Button, buttonVariant as buttonVariantStyles } from "@/components/ui/button";
import {
  calendarVariant,
  calendarButtonVariant,
  calendarCaptionVariant,
  calendarWeekdayVariant,
  calendarDayVariant,
} from "./calendar-variant";
import { Densities } from "@/types/density";
import { useDensityScale } from "@/contexts/density-context";

/** The month a caption belongs to: DayPicker hands its `CaptionLabel` only the formatted text. */
const CaptionMonthContext = React.createContext<Date | undefined>(undefined);

const DEFAULT_MONTH_LABEL = "Month";
const DEFAULT_YEAR_LABEL = "Year";

/**
 * The accessible names of the two caption boxes. `CaptionLabel` is a component DayPicker mounts, so
 * the names reach it through context rather than through props.
 */
const CaptionLabelsContext = React.createContext({
  month: DEFAULT_MONTH_LABEL,
  year: DEFAULT_YEAR_LABEL,
});

function MonthCaption({
  calendarMonth,
  displayIndex: _displayIndex,
  ...divProps
}: MonthCaptionProps) {
  return (
    <CaptionMonthContext.Provider value={calendarMonth.date}>
      <div {...divProps} />
    </CaptionMonthContext.Provider>
  );
}

function CaptionLabel({ children }: { children?: React.ReactNode }) {
  return <MonthYearInput displayMonth={React.useContext(CaptionMonthContext)} title={children} />;
}

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  density,
  labels,
  monthLabel = DEFAULT_MONTH_LABEL,
  yearLabel = DEFAULT_YEAR_LABEL,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
  density?: Densities;
  /**
   * Accessible name of the month box in the caption. Defaults to "Month"; pass the calendar's
   * language ("Månad") together with `locale`, which translates the month and weekday names but
   * not these two.
   */
  monthLabel?: string;
  /** Accessible name of the year box in the caption. Defaults to "Year". */
  yearLabel?: string;
}) {
  const { density: effectiveDensity } = useDensityScale(density);
  const defaultClassNames = getDefaultClassNames();
  const captionLabels = React.useMemo(
    () => ({ month: monthLabel, year: yearLabel }),
    [monthLabel, yearLabel],
  );

  return (
    <CaptionLabelsContext.Provider value={captionLabels}>
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn(
          calendarVariant({ density: effectiveDensity }),
          String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
          String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
          className,
        )}
        captionLayout={captionLayout}
        formatters={{
          formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
          ...formatters,
        }}
        labels={{
          ...(props["aria-label"] ? { labelNav: () => `${props["aria-label"]} navigation` } : {}),
          ...labels,
        }}
        classNames={{
          root: cn("w-fit", defaultClassNames.root),
          months: cn("flex gap-4 flex-col md:flex-row relative", defaultClassNames.months),
          month: cn("flex flex-col w-full gap-4", defaultClassNames.month),
          nav: cn(
            "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between pointer-events-none",
            defaultClassNames.nav,
          ),
          button_previous: cn(
            buttonVariantStyles({ variant: buttonVariant }),
            calendarButtonVariant({ density: effectiveDensity }),
            "pointer-events-auto",
            defaultClassNames.button_previous,
          ),
          button_next: cn(
            buttonVariantStyles({ variant: buttonVariant }),
            calendarButtonVariant({ density: effectiveDensity }),
            "pointer-events-auto",
            defaultClassNames.button_next,
          ),
          month_caption: cn(
            calendarCaptionVariant({ density: effectiveDensity }),
            defaultClassNames.month_caption,
          ),
          dropdowns: cn(
            "w-full flex items-center text-sm font-medium justify-center h-(--cell-size) gap-1.5",
            defaultClassNames.dropdowns,
          ),
          dropdown_root: cn(
            "relative has-focus:border-ring border border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] rounded-md",
            defaultClassNames.dropdown_root,
          ),
          dropdown: cn("absolute inset-0 opacity-0", defaultClassNames.dropdown),
          caption_label: cn(
            "select-none font-medium",
            captionLayout === "label"
              ? "text-sm"
              : "rounded-md pl-2 pr-1 flex items-center gap-1 text-sm h-8 [&>svg]:text-muted-foreground [&>svg]:size-3.5",
            defaultClassNames.caption_label,
          ),
          table: "w-full border-collapse",
          weekdays: cn("flex", defaultClassNames.weekdays),
          weekday: cn(
            calendarWeekdayVariant({ density: effectiveDensity }),
            "flex-1", // Ensure headers take equal space
            defaultClassNames.weekday,
          ),
          week: cn("flex w-full mt-2 justify-between", defaultClassNames.week),
          week_number_header: cn(
            "select-none w-(--cell-size) flex-none",
            defaultClassNames.week_number_header,
          ),
          week_number: cn(
            "text-[0.8rem] select-none text-muted-foreground w-(--cell-size) flex-none",
            defaultClassNames.week_number,
          ),
          day: cn(
            "relative flex-1 h-full p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md group/day aspect-square select-none",
            defaultClassNames.day,
          ),
          range_start: cn("rounded-l-md bg-accent", defaultClassNames.range_start),
          range_middle: cn("rounded-none", defaultClassNames.range_middle),
          range_end: cn("rounded-r-md bg-accent", defaultClassNames.range_end),
          today: cn(
            "bg-accent text-accent-foreground rounded-field data-[selected=true]:rounded-none",
            defaultClassNames.today,
          ),
          outside: cn(
            "text-muted-foreground aria-selected:text-muted-foreground",
            defaultClassNames.outside,
          ),
          disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
          hidden: cn("hidden", defaultClassNames.hidden),
          ...classNames,
        }}
        components={{
          Root: ({ className, rootRef, ...props }) => {
            return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />;
          },
          Chevron: ({ className, orientation, ...props }) => {
            if (orientation === "left") {
              return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
            }

            if (orientation === "right") {
              return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
            }

            return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
          },
          DayButton: (props) => <CalendarDayButton {...props} density={effectiveDensity} />,
          WeekNumber: ({ children, ...props }) => {
            return (
              <td {...props} className="flex-none">
                <div className="flex size-(--cell-size) items-center justify-center text-center">
                  {children}
                </div>
              </td>
            );
          },
          MonthCaption,
          CaptionLabel,
          ...components,
        }}
        {...props}
      />
    </CaptionLabelsContext.Provider>
  );
}

/** The month and year the caption boxes show, or null when neither the month nor its title says. */
function captionNumbers(displayMonth: Date | undefined, title: React.ReactNode, locale?: Locale) {
  if (displayMonth) {
    return {
      monthStr: String(displayMonth.getMonth() + 1),
      yearStr: String(displayMonth.getFullYear()),
    };
  }
  if (typeof title === "string") {
    // Only when a custom `MonthCaption` hides the month from us: the title is in the calendar's
    // language, so it has to be read in it.
    const parsed = parse(title, "LLLL yyyy", new Date(), { locale });
    if (!isNaN(parsed.getTime())) {
      return {
        monthStr: String(parsed.getMonth() + 1),
        yearStr: String(parsed.getFullYear()),
      };
    }
  }
  return null;
}

function MonthYearInput({ displayMonth, title }: { displayMonth?: Date; title?: React.ReactNode }) {
  const { goToMonth, dayPickerProps } = useDayPicker();
  const locale = dayPickerProps.locale as Locale | undefined;
  // Filled on the first render, not in an effect: the boxes are never painted blank, and a test that
  // reads them right after render sees the month.
  const [state, setState] = React.useState(
    () => captionNumbers(displayMonth, title, locale) ?? { monthStr: "", yearStr: "" },
  );
  // Set when Enter was pressed on numbers the calendar cannot show; cleared by the next keystroke.
  const [rejected, setRejected] = React.useState(false);
  const names = React.useContext(CaptionLabelsContext);

  const syncState = React.useCallback(() => {
    const numbers = captionNumbers(displayMonth, title, locale);
    if (numbers) setState(numbers);
  }, [displayMonth, title, locale]);

  React.useEffect(() => {
    syncState();
  }, [syncState]);

  /** Goes to the typed month; false, and nothing changes, when the numbers are not one. */
  const handleCommit = (): boolean => {
    const m = parseInt(state.monthStr, 10);
    const y = parseInt(state.yearStr, 10);
    if (isNaN(m) || isNaN(y) || m < 1 || m > 12 || y < 1900 || y > 2100) return false;
    goToMonth(new Date(y, m - 1, 1));
    return true;
  };

  // Leaving a box with numbers the calendar cannot show puts back the month it is showing, so the
  // boxes never disagree with the grid.
  const onBlur = () => {
    if (!handleCommit()) syncState();
    setRejected(false);
  };

  // Enter commits and stays: blurring here dropped focus to <body> while the popover stayed open.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setRejected(!handleCommit());
    }
  };

  const inputClass =
    "w-6 text-center bg-transparent border-none outline-hidden focus-visible:bg-accent focus-visible:ring-1 focus-visible:ring-ring rounded text-sm p-0 m-0";

  return (
    <div
      className="flex items-center border border-input rounded-field px-1 py-0.5 gap-0.5 bg-background pointer-events-auto mx-auto w-fit"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      role="presentation"
    >
      {/* DayPicker passes its caption label a live region; this replaces the label, so it is kept here. */}
      <span role="status" aria-live="polite" className="sr-only">
        {typeof title === "string" ? title : null}
      </span>
      <input
        value={state.monthStr}
        onChange={(e) => {
          setRejected(false);
          setState((s) => ({ ...s, monthStr: e.target.value.replace(/\D/g, "").slice(0, 2) }));
        }}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={inputClass}
        placeholder="M"
        aria-label={names.month}
        aria-invalid={rejected || undefined}
        inputMode="numeric"
        autoComplete="off"
      />
      <span className="text-muted-foreground text-xs">/</span>
      <input
        value={state.yearStr}
        onChange={(e) => {
          setRejected(false);
          setState((s) => ({ ...s, yearStr: e.target.value.replace(/\D/g, "").slice(0, 4) }));
        }}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={cn(inputClass, "w-10")}
        placeholder="YYYY"
        aria-label={names.year}
        aria-invalid={rejected || undefined}
        inputMode="numeric"
        autoComplete="off"
      />
    </div>
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  density = Densities.Medium,
  ...props
}: React.ComponentProps<typeof DayButton> & {
  density?: Densities;
}) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(calendarDayVariant({ density }), defaultClassNames.day, className)}
      {...props}
    />
  );
}
