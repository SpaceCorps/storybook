/**
 * Every class the calendar uses, as Tailwind utilities with literal strings.
 *
 * There is no stylesheet on purpose: an app takes the library through `styles/index.css` plus a
 * Tailwind `@source` on `dist`, so only utilities found in the compiled components reach it and a rule
 * in a component `.css` file never did. For the same reason no class is built by interpolation:
 * `bg-${name}/15` is invisible to the scanner, which is why the colour table below spells all 23 out.
 *
 * The root sets four custom properties that the parts read, all in rem so they ignore this theme's
 * 0.27rem `--spacing` (which makes every spacing utility 8% bigger than stock):
 * - `--sc-hour`: height of one hour in the week grid, which the component multiplies by minutes.
 * - `--sc-cell-min`: minimum height of a month cell, sized to hold a full cell (day line, two entries
 *   and "+N more") so that rows do not change height from month to month.
 * - `--sc-gutter`: width of the week grid's time column.
 * - `--sc-max-body`: height cap of the week scroller, 40rem unless the component sets it from `maxBodyHeight`.
 *
 * Parts that depend on state take a variant; compose them with the component's own `className` via
 * `cn`. Focus rings are ring-based and inset, with no shadow utility next to them.
 */

import { cva } from "class-variance-authority";

import type { CalendarColor } from "./types";

/**
 * The classes that tint an entry in its colour: `surface` is a 15% wash of the token (with a 25%
 * hover) under `text-foreground`, `bar` the 3 px left edge, `dot` a solid fill for the compact
 * month. Text stays `text-foreground` and never takes the colour, because that is what keeps AA
 * contrast in both themes (worst case 15.4:1 light, 14.4:1 dark); muted text must not sit on a wash.
 */
export const EVENT_COLOR_CLASSES: Record<
  CalendarColor,
  { surface: string; bar: string; dot: string }
> = {
  "ivy-green": {
    surface: "bg-ivy-green/15 hover:bg-ivy-green/25",
    bar: "border-l-ivy-green",
    dot: "bg-ivy-green",
  },
  slate: { surface: "bg-slate/15 hover:bg-slate/25", bar: "border-l-slate", dot: "bg-slate" },
  gray: { surface: "bg-gray/15 hover:bg-gray/25", bar: "border-l-gray", dot: "bg-gray" },
  zinc: { surface: "bg-zinc/15 hover:bg-zinc/25", bar: "border-l-zinc", dot: "bg-zinc" },
  neutral: {
    surface: "bg-neutral/15 hover:bg-neutral/25",
    bar: "border-l-neutral",
    dot: "bg-neutral",
  },
  stone: { surface: "bg-stone/15 hover:bg-stone/25", bar: "border-l-stone", dot: "bg-stone" },
  red: { surface: "bg-red/15 hover:bg-red/25", bar: "border-l-red", dot: "bg-red" },
  orange: {
    surface: "bg-orange/15 hover:bg-orange/25",
    bar: "border-l-orange",
    dot: "bg-orange",
  },
  amber: { surface: "bg-amber/15 hover:bg-amber/25", bar: "border-l-amber", dot: "bg-amber" },
  yellow: {
    surface: "bg-yellow/15 hover:bg-yellow/25",
    bar: "border-l-yellow",
    dot: "bg-yellow",
  },
  lime: { surface: "bg-lime/15 hover:bg-lime/25", bar: "border-l-lime", dot: "bg-lime" },
  green: { surface: "bg-green/15 hover:bg-green/25", bar: "border-l-green", dot: "bg-green" },
  emerald: {
    surface: "bg-emerald/15 hover:bg-emerald/25",
    bar: "border-l-emerald",
    dot: "bg-emerald",
  },
  teal: { surface: "bg-teal/15 hover:bg-teal/25", bar: "border-l-teal", dot: "bg-teal" },
  cyan: { surface: "bg-cyan/15 hover:bg-cyan/25", bar: "border-l-cyan", dot: "bg-cyan" },
  sky: { surface: "bg-sky/15 hover:bg-sky/25", bar: "border-l-sky", dot: "bg-sky" },
  blue: { surface: "bg-blue/15 hover:bg-blue/25", bar: "border-l-blue", dot: "bg-blue" },
  indigo: {
    surface: "bg-indigo/15 hover:bg-indigo/25",
    bar: "border-l-indigo",
    dot: "bg-indigo",
  },
  violet: {
    surface: "bg-violet/15 hover:bg-violet/25",
    bar: "border-l-violet",
    dot: "bg-violet",
  },
  purple: {
    surface: "bg-purple/15 hover:bg-purple/25",
    bar: "border-l-purple",
    dot: "bg-purple",
  },
  fuchsia: {
    surface: "bg-fuchsia/15 hover:bg-fuchsia/25",
    bar: "border-l-fuchsia",
    dot: "bg-fuchsia",
  },
  pink: { surface: "bg-pink/15 hover:bg-pink/25", bar: "border-l-pink", dot: "bg-pink" },
  rose: { surface: "bg-rose/15 hover:bg-rose/25", bar: "border-l-rose", dot: "bg-rose" },
};

/** Composes the strings above into a cva `color` variant; nothing is built from a colour name here. */
function colorVariants(pick: (classes: { surface: string; bar: string; dot: string }) => string) {
  return Object.fromEntries(
    Object.entries(EVENT_COLOR_CLASSES).map(([name, classes]) => [name, pick(classes)]),
  ) as Record<CalendarColor, string>;
}

/**
 * The inset focus ring. `outline-hidden` sits under `focus-visible` on purpose: unscoped it is a
 * permanent 2px outline in forced-colors mode, which turns every cell, chip and block into a boxed
 * element and leaves the focused one told apart by its hue alone. Scoped, the outline exists only
 * where the box-shadow ring (which forced colors flatten away) used to be.
 */
const FOCUS_RING =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/**
 * The section that holds everything. `@container` makes the width-dependent parts (the time prefix
 * of a month chip) follow the calendar's own width and not the window's. Sets the custom properties
 * documented at the top of this file.
 */
export const timeCalendarVariant = cva(
  "@container flex w-full min-w-0 flex-col bg-transparent text-foreground [--sc-gutter:3rem] [--sc-max-body:40rem]",
  {
    variants: {
      density: {
        Small: "gap-2 [--sc-hour:2.5rem] [--sc-cell-min:6rem]",
        Medium: "gap-3 [--sc-hour:3rem] [--sc-cell-min:7.25rem]",
        Large: "gap-4 [--sc-hour:3.5rem] [--sc-cell-min:8.25rem]",
      },
    },
    defaultVariants: { density: "Medium" },
  },
);

/** The header row: navigation, title, view switch and toolbar. It wraps instead of squeezing. */
export const calendarHeaderVariant = cva("flex flex-wrap items-center", {
  variants: {
    density: {
      Small: "gap-x-1.5 gap-y-1",
      Medium: "gap-x-2 gap-y-1.5",
      Large: "gap-x-3 gap-y-2",
    },
  },
  defaultVariants: { density: "Medium" },
});

/** The previous / today / next buttons, side by side. */
export const calendarNavVariant = cva("flex items-center gap-1");

/** The view switch and the toolbar, pushed to the right edge even when the header wraps onto a new line. */
export const calendarActionsVariant = cva("ml-auto flex flex-wrap items-center justify-end gap-2");

/**
 * The heading ("October 2026 · 142h 30m"). It takes the spare room, and below 40rem it moves above
 * the buttons and takes the whole row, so the period is never cut off on a narrow calendar.
 */
export const calendarTitleVariant = cva(
  "order-first m-0 min-w-0 basis-full grow font-semibold tabular-nums @[40rem]:order-none @[40rem]:basis-auto",
  {
    variants: {
      density: { Small: "text-sm", Medium: "text-base", Large: "text-lg" },
    },
    defaultVariants: { density: "Medium" },
  },
);

/** The bordered frame around a month grid or a week grid. */
export const calendarFrameVariant = cva("overflow-hidden rounded-box border border-border");

/** A month's weekday header cell (`role=columnheader`). */
export const monthWeekdayVariant = cva(
  "select-none truncate border-b border-border px-1 py-1.5 text-center font-medium text-muted-foreground",
  {
    variants: {
      density: { Small: "text-[10px]", Medium: "text-xs", Large: "text-sm" },
    },
    defaultVariants: { density: "Medium" },
  },
);

/** One week of the month: seven equal cells. The last row drops its bottom border (the frame has one). */
export const monthRowVariant = cva("group/row grid grid-cols-7");

/**
 * A day cell (`role=gridcell`, the roving tab stop). `surface` is one of default, `outside` (a day
 * of the neighbouring month) or `selected` (the picked day of the compact layout); `compact` swaps
 * the tall cell for a short, centred one that holds only the number, the total and dots. Children are
 * laid out top to bottom: `monthCellHeaderVariant`, then chips.
 */
export const monthCellVariant = cva(
  [
    "relative flex min-w-0 cursor-pointer flex-col border-r border-b border-border select-none last:border-r-0 group-last/row:border-b-0",
    FOCUS_RING,
  ],
  {
    variants: {
      surface: {
        default: "hover:bg-muted/40",
        outside: "bg-muted/30 hover:bg-muted/50",
        // The fill alone is 1.1:1 against the cell (1.3:1 dark), so a 2px bar of the primary colour runs
        // along the top of the cell, clear of the number, the total and the dots, and of the ring a
        // focused cell draws.
        selected:
          "bg-accent after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-0.5 after:bg-primary forced-colors:after:bg-[Highlight]",
      },
      compact: {
        false: "min-h-(--sc-cell-min) gap-1 p-1",
        true: "min-h-[3.25rem] items-center gap-0.5 p-0.5",
      },
    },
    defaultVariants: { surface: "default", compact: false },
  },
);

/** The line at the top of a cell: day number on the left, total on the right. */
export const monthCellHeaderVariant = cva("flex w-full min-w-0 items-center justify-between gap-1");

/**
 * The day number. `tone` is `default`, `outside` (muted, for a neighbouring month) or `today` (a
 * filled pill, which wins over `outside`). Also used in the week header.
 */
export const dayNumberVariant = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full leading-none tabular-nums",
  {
    variants: {
      density: {
        Small: "size-5 text-[10px]",
        Medium: "size-6 text-xs",
        Large: "size-7 text-sm",
      },
      tone: {
        default: "text-foreground",
        outside: "text-muted-foreground",
        // Forced colors flatten the fill, so the pill keeps a border of its own there.
        today:
          "bg-primary font-semibold text-primary-foreground forced-colors:border-2 forced-colors:border-[CanvasText]",
      },
    },
    defaultVariants: { density: "Medium", tone: "default" },
  },
);

/** The day's total ("7h 30m"), muted. Only ever sits on the cell surface, never inside a chip. */
export const dayTotalVariant = cva("min-w-0 truncate text-muted-foreground tabular-nums", {
  variants: {
    density: { Small: "text-[10px]", Medium: "text-[11px]", Large: "text-xs" },
  },
  defaultVariants: { density: "Medium" },
});

/**
 * An entry as a one-line button: month cells and the week's hours-only strip. Pass `color`; without
 * it the chip is `slate`. Inside: an optional `chipTimeVariant` span, then a `truncate font-medium`
 * title. The height is fixed per density, so a cell's line count is predictable.
 */
export const eventChipVariant = cva(
  [
    "flex w-full min-w-0 cursor-pointer items-center gap-1 rounded-selector border-l-[3px] px-1 text-left text-foreground transition-colors",
    FOCUS_RING,
  ],
  {
    variants: {
      density: { Small: "h-4 text-[10px]", Medium: "h-5 text-xs", Large: "h-6 text-sm" },
      color: colorVariants((classes) => `${classes.surface} ${classes.bar}`),
    },
    defaultVariants: { density: "Medium", color: "slate" },
  },
);

/** A dot before the title of an entry whose timer is still running. Decorative: the name says "running". */
export const runningDotVariant = cva(
  "size-1.5 shrink-0 rounded-full bg-red forced-colors:bg-[CanvasText]",
);

/** The time before a chip's title. Hidden until the calendar is 60rem wide, where the chip has room for it. */
export const chipTimeVariant = cva("hidden shrink-0 tabular-nums @[60rem]:inline");

/** The "+N more" button of a month cell, the same height as a chip so a full cell keeps its line count. */
export const moreButtonVariant = cva(
  [
    "flex w-full min-w-0 cursor-pointer items-center rounded-selector px-1 text-left font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
    FOCUS_RING,
  ],
  {
    variants: {
      density: { Small: "h-4 text-[10px]", Medium: "h-5 text-xs", Large: "h-6 text-sm" },
    },
    defaultVariants: { density: "Medium" },
  },
);

/** The row of dots under the number in a compact month cell. */
export const eventDotsVariant = cva("flex flex-wrap items-center justify-center gap-0.5");

/** One dot in the compact month, in the entry's colour. */
export const eventDotVariant = cva("shrink-0 rounded-full forced-colors:bg-[CanvasText]", {
  variants: {
    density: { Small: "size-1", Medium: "size-1.5", Large: "size-2" },
    color: colorVariants((classes) => classes.dot),
  },
  defaultVariants: { density: "Medium", color: "slate" },
});

/**
 * A row in a list of entries: the compact layout's agenda and the "+N more" popover. Taller than a
 * chip, with room for a second line (put the description in a `text-sm` block under the title).
 */
export const eventRowVariant = cva(
  [
    "flex w-full min-w-0 cursor-pointer items-start gap-2 rounded-selector border-l-[3px] px-2 py-1.5 text-left text-foreground transition-colors",
    FOCUS_RING,
  ],
  {
    variants: {
      density: { Small: "text-xs", Medium: "text-sm", Large: "text-base" },
      color: colorVariants((classes) => `${classes.surface} ${classes.bar}`),
    },
    defaultVariants: { density: "Medium", color: "slate" },
  },
);

/** The stack that holds `eventRowVariant` buttons. */
export const eventListVariant = cva("flex min-w-0 flex-col gap-1");

/** One day in the agenda (the compact layout): heading, then rows or the empty note. */
export const dayAgendaVariant = cva("flex min-w-0 flex-col", {
  variants: {
    density: { Small: "gap-1", Medium: "gap-1.5", Large: "gap-2" },
  },
  defaultVariants: { density: "Medium" },
});

/** An agenda day's heading with its total and add button. `sticky` pins it while its day scrolls. */
export const agendaHeadingVariant = cva(
  "flex min-w-0 items-center justify-between gap-2 border-b border-border py-1.5 font-semibold",
  {
    variants: {
      density: { Small: "text-xs", Medium: "text-sm", Large: "text-base" },
      sticky: { true: "sticky top-0 z-10 bg-background", false: "" },
    },
    defaultVariants: { density: "Medium", sticky: false },
  },
);

/** "No entries" in an empty agenda day. */
export const agendaEmptyVariant = cva("px-1 py-1.5 text-sm text-muted-foreground");

/**
 * The scroll container, which is the grid itself so the header stays aligned with the columns. Its
 * height cap is `--sc-max-body` (the `maxBodyHeight` prop sets it on the root or here). It needs no
 * focus ring of its own because it contains the focusable day columns.
 */
export const weekScrollerVariant = cva(
  "relative max-h-(--sc-max-body) overflow-y-auto overscroll-contain bg-background",
);

/**
 * The rowgroup that holds the week's header row and the strip of entries without a time. It sticks to
 * the top of the scroller, opaque so the body scrolls under it, so both stay in view together.
 */
export const weekStickyVariant = cva("sticky top-0 z-20 border-b border-border bg-background");

/** The header row of the week (weekday, number and total per day), inside `weekStickyVariant`. */
export const weekHeaderRowVariant = cva(
  "grid grid-cols-[var(--sc-gutter)_repeat(7,minmax(0,1fr))]",
);

/**
 * A weekday header in the week (`role=columnheader`): the weekday name, the day number
 * (`dayNumberVariant`) and the total (`dayTotalVariant`), centred. A click opens the day.
 */
export const weekDayHeaderVariant = cva(
  "flex min-w-0 cursor-pointer flex-col items-center gap-0.5 border-l border-border px-1 py-1.5 text-center text-muted-foreground select-none hover:bg-muted/40",
  {
    variants: {
      density: { Small: "text-[10px]", Medium: "text-xs", Large: "text-sm" },
    },
    defaultVariants: { density: "Medium" },
  },
);

/** The row of entries without a time, under the header. Same grid as the week; this adds the divider. */
export const weekStripRowVariant = cva(
  "grid grid-cols-[var(--sc-gutter)_repeat(7,minmax(0,1fr))] border-t border-border",
);

/** The strip's row header ("No time"), in the gutter. Small at every density so the label stays on one line. */
export const weekStripHeaderVariant = cva(
  "flex items-center justify-end px-1 text-right text-[10px] leading-tight text-muted-foreground select-none",
);

/** One day's cell in the strip; holds `eventChipVariant` buttons. */
export const weekStripCellVariant = cva(
  "flex min-w-0 flex-col gap-0.5 border-l border-border p-0.5",
);

/**
 * The tall row that holds the hours. Give it `style={{ height: "calc(var(--sc-hour) * H)" }}` for H
 * visible hours. Children: the gutter, the lines overlay, then seven `weekDayColumnVariant` cells.
 */
export const weekBodyVariant = cva(
  "relative grid grid-cols-[var(--sc-gutter)_repeat(7,minmax(0,1fr))]",
);

/** The gutter column (`aria-hidden`) that holds the hour labels. */
export const weekGutterVariant = cva("relative select-none");

/**
 * An hour label in the gutter, placed at `top: calc(var(--sc-hour) * i)` and centred on its line;
 * `first` keeps the top label from being clipped above the grid.
 */
export const weekHourLabelVariant = cva(
  "absolute right-1 leading-none text-muted-foreground tabular-nums",
  {
    variants: {
      density: { Small: "text-[10px]", Medium: "text-[11px]", Large: "text-xs" },
      first: { true: "translate-y-1", false: "-translate-y-1/2" },
    },
    defaultVariants: { density: "Medium", first: false },
  },
);

/** Overlay (`aria-hidden`) for the hour lines: covers the day columns only, so no line runs through a label. */
export const weekLinesVariant = cva(
  "pointer-events-none absolute inset-y-0 right-0 left-(--sc-gutter)",
);

/** One hour line, placed at `top: calc(var(--sc-hour) * i)` inside the overlay. */
export const weekHourLineVariant = cva("absolute inset-x-0 border-t border-border");

/**
 * A day's column in the week (`role=gridcell`, the roving tab stop), positioned so blocks can be
 * absolute inside it. Today's column is washed lightly.
 */
export const weekDayColumnVariant = cva(
  ["relative min-w-0 cursor-pointer border-l border-border", FOCUS_RING],
  {
    variants: {
      today: { true: "bg-muted/40", false: "" },
    },
    defaultVariants: { today: false },
  },
);

/**
 * An entry's block in a day column. Position it with `blockStyle` (top, height, left, width and the
 * minimum height that keeps a short entry readable and clickable). A `running` block gets a dashed
 * bottom edge. Inside: a `truncate font-medium` title, then optional time and description lines.
 */
export const weekBlockVariant = cva(
  [
    "absolute flex min-w-0 cursor-pointer flex-col items-start overflow-hidden rounded-selector border-l-[3px] px-1 py-0.5 text-left text-foreground transition-colors focus-visible:z-10 forced-colors:border-y forced-colors:border-r",
    FOCUS_RING,
  ],
  {
    variants: {
      density: { Small: "text-[10px]", Medium: "text-xs", Large: "text-sm" },
      color: colorVariants((classes) => `${classes.surface} ${classes.bar}`),
      running: {
        true: "border-b-2 border-b-foreground/50 [border-bottom-style:dashed]",
        false: "",
      },
    },
    defaultVariants: { density: "Medium", color: "slate", running: false },
  },
);

/**
 * An opaque plate under a week block, with the same `style` and corners. The block's own wash is a
 * translucent tint, so without a plate the hour lines and a block it overdraws would show through.
 */
export const weekBlockBackingVariant = cva(
  "pointer-events-none absolute rounded-selector bg-background",
);

/** The line at the current time, in today's column only (`aria-hidden`); `top` as for a block. */
export const weekNowLineVariant = cva(
  "pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-red forced-colors:bg-[CanvasText] before:absolute before:top-1/2 before:-left-1 before:size-2 before:-translate-y-1/2 before:rounded-full before:bg-red forced-colors:before:bg-[CanvasText]",
);

/** The thin track above the grid while `loading`; it is `aria-hidden` and the grid stays visible. */
export const calendarLoadingTrackVariant = cva("relative h-0.5 w-full overflow-hidden bg-muted");

/** The sweeping bar inside the loading track. */
export const calendarLoadingBarVariant = cva(
  "absolute inset-y-0 left-0 w-1/4 animate-indeterminate bg-primary",
);
