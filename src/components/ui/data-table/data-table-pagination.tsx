import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { densityToIconButtonSize } from "@/components/ui/density-scale";
import { useDensity } from "@/contexts/density-context";
import { Densities } from "@/types/density";

export interface DataTablePaginationProps extends React.HTMLAttributes<HTMLElement> {
  /** 1-based, already clamped into `[1, pageCount]`. */
  page: number;
  pageCount: number;
  pageSize: number;
  pageSizeOptions?: number[];
  /** Total row count across all pages. */
  total: number;
  /** 1-based inclusive range shown on this page; `0` for both when there are no rows. */
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  density?: Densities;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const selectDensity: Record<Densities, string> = {
  [Densities.Small]: "h-7 px-1 text-xs",
  [Densities.Medium]: "h-9 px-2 text-sm",
  [Densities.Large]: "h-11 px-3 text-base",
};

/** The configured sizes plus the active one, so the select can always show the current value. */
function withCurrentSize(options: number[], pageSize: number): number[] {
  if (options.includes(pageSize)) return options;
  return [...options, pageSize].sort((a, b) => a - b);
}

function rowCountLabel(total: number): string {
  if (total === 0) return "No rows";
  return total === 1 ? "1 row" : `${total} rows`;
}

/**
 * The page navigator, rendered below the `<table>`. Boundary controls stay in the DOM disabled so
 * the control set does not reflow between pages.
 *
 * With a single page there is nothing to navigate, so the first/previous/next/last buttons and the
 * "Page 1 of 1" text drop out and only a row count remains. The rows-per-page select stays while it
 * can still change something (more rows than the smallest size), otherwise a table switched to a
 * large page size could never be switched back.
 *
 * It is a size container: below `40rem` of its own width (a half-width card, a side panel) the
 * layout is a count and the page-size select on one row with the buttons centred underneath, and
 * from `40rem` up it is a single row. Each group is unbreakable, so nothing wraps mid-label.
 */
const DataTablePagination = React.forwardRef<HTMLElement, DataTablePaginationProps>(
  (
    {
      page,
      pageCount,
      pageSize,
      pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
      total,
      rangeStart,
      rangeEnd,
      onPageChange,
      onPageSizeChange,
      density: propDensity,
      className,
      ...props
    },
    ref,
  ) => {
    const contextDensity = useDensity();
    const density = propDensity ?? contextDensity;
    const iconSize = densityToIconButtonSize(density);
    const pageSizeId = React.useId();

    const atFirst = page <= 1;
    const atLast = page >= pageCount;

    const sizes = withCurrentSize(pageSizeOptions, pageSize);
    const hasMultiplePages = pageCount > 1;
    const canChangePageSize = total > Math.min(...sizes);

    const pageSizeControl = canChangePageSize ? (
      <label className="flex shrink-0 items-center gap-2 whitespace-nowrap" htmlFor={pageSizeId}>
        <span className="text-sm text-muted-foreground">Rows per page</span>
        {/*
          Deliberately a native <select> rather than the Radix `Select` primitive: Radix needs
          `hasPointerCapture`/`scrollIntoView` polyfills that tests/setup.ts does not install,
          and a native select is keyboard- and screen-reader-operable with no extra work. The
          token classes below mirror `SelectTrigger` so it still looks at home.
        */}
        <select
          id={pageSizeId}
          className={cn(
            "box-border cursor-pointer rounded-field border border-input bg-transparent shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10",
            selectDensity[density],
          )}
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {sizes.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    ) : null;

    return (
      <nav
        ref={ref}
        aria-label="Table pagination"
        className={cn("@container border-t border-border px-2 py-2", className)}
        {...props}
      >
        <div
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2",
            // One auto column per control that is present, so a lone control sits flush right.
            hasMultiplePages && canChangePageSize
              ? "@[40rem]:grid-cols-[minmax(0,1fr)_auto_auto]"
              : "@[40rem]:grid-cols-[minmax(0,1fr)_auto]",
          )}
        >
          <p aria-live="polite" className="min-w-0 text-sm text-muted-foreground">
            {hasMultiplePages
              ? `Showing ${rangeStart}–${rangeEnd} of ${total}`
              : rowCountLabel(total)}
          </p>

          {pageSizeControl}

          {hasMultiplePages ? (
            <div className="col-span-2 flex shrink-0 items-center justify-center gap-1 whitespace-nowrap @[40rem]:col-span-1 @[40rem]:justify-end">
              <Button
                type="button"
                variant="ghost"
                size={iconSize}
                aria-label="Go to first page"
                disabled={atFirst}
                onClick={() => onPageChange(1)}
              >
                <ChevronsLeft aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size={iconSize}
                aria-label="Go to previous page"
                disabled={atFirst}
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>

              <span className="px-1 text-sm text-muted-foreground">
                Page {page} of {pageCount}
              </span>

              <Button
                type="button"
                variant="ghost"
                size={iconSize}
                aria-label="Go to next page"
                disabled={atLast}
                onClick={() => onPageChange(page + 1)}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size={iconSize}
                aria-label="Go to last page"
                disabled={atLast}
                onClick={() => onPageChange(pageCount)}
              >
                <ChevronsRight aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </div>
      </nav>
    );
  },
);
DataTablePagination.displayName = "DataTablePagination";

export { DataTablePagination, DEFAULT_PAGE_SIZE_OPTIONS };
