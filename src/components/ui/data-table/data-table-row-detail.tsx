import * as React from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { tableCellSizeVariant } from "@/components/ui/table/table-variant";
import { useTableScale } from "@/components/ui/table/useTableSize";
import type { DataTableColumn } from "./types";

/** One column's value as the details list shows it. */
export interface DataTableDetailItem {
  /** The column's `name`: the list key. */
  name: string;
  /** The column header. */
  label: string;
  /** The cell, already run through the column's own renderer so it is formatted as in the row. */
  content: React.ReactNode;
}

/**
 * The pairs a details list shows for `columns`, in the order given: each column's header (its `name`
 * when it has none) and whatever `renderCell` makes of it. The caller supplies the renderer, so a row's
 * details run each cell through the column's own `cell` and a footer's through `footer`.
 */
export function getDetailItems<TRow>(
  columns: readonly DataTableColumn<TRow>[],
  renderCell: (column: DataTableColumn<TRow>) => React.ReactNode,
): DataTableDetailItem[] {
  return columns.map((column) => ({
    name: column.name,
    label: column.header ?? column.name,
    content: renderCell(column),
  }));
}

const isEmptyContent = (content: React.ReactNode): boolean =>
  content === null || content === undefined || content === false || content === "";

/**
 * "<header>: <value>" pairs. A definition list, so a screen reader pairs each label with its value, and
 * a two-column grid so the values line up whatever the labels' lengths (the label column stops at 45%
 * and wraps past it, which keeps a long header from squeezing the value on a phone).
 */
function DataTableDetailList({
  items,
  className,
}: {
  items: DataTableDetailItem[];
  className?: string;
}) {
  return (
    <dl
      className={cn("grid grid-cols-[fit-content(45%)_minmax(0,1fr)] gap-x-4 gap-y-1", className)}
    >
      {items.map((item) => (
        <React.Fragment key={item.name}>
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 [overflow-wrap:anywhere]">
            {isEmptyContent(item.content) ? (
              // An empty value is a dash for the eye and "no value" for the ear: bare, it would read
              // as a label with nothing after it.
              <>
                <span aria-hidden="true" className="text-muted-foreground">
                  —
                </span>
                <span className="sr-only">No value</span>
              </>
            ) : (
              item.content
            )}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

/**
 * What fills a details cell. The cell spans every column, so it is as wide as the table, and a table
 * that still scrolls sideways (a very narrow host, or more left than the estimate allowed for) would
 * carry the labels out of sight with the scrolled content. The panel is therefore pinned to the left
 * edge of what the scroller shows and is no wider than it (`--ivy-data-table-viewport`, published by
 * the table). The cell's own padding is handed to the panel, which is what stays in view.
 */
function DetailPanel({ inset, children }: { inset?: boolean; children: React.ReactNode }) {
  const density = useTableScale();
  return (
    <div
      data-slot="data-table-detail-panel"
      className={cn(
        "sticky left-0 box-border w-[var(--ivy-data-table-viewport,100%)] max-w-full",
        tableCellSizeVariant({ density }),
        // Flush in a card: the table lines its first and last column up with the card's padding.
        inset && "px-6",
      )}
    >
      {children}
    </div>
  );
}

export interface DataTableRowExpanderProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "aria-label" | "aria-expanded"
> {
  /** What follows "Show details for": the row's name, as the selection checkbox announces it. */
  rowLabel: string;
  expanded: boolean;
  /** `id` of the details cell this opens. Only referenced while it is on the page. */
  detailId: string;
}

/**
 * The disclosure button in a row. Its name stays "Show details for <row>" and `aria-expanded` carries
 * the state: a label that flipped to "Hide" as well would be announced twice over. The chevron turns,
 * unless the person asked for less motion.
 */
const DataTableRowExpander = React.forwardRef<HTMLButtonElement, DataTableRowExpanderProps>(
  ({ rowLabel, expanded, detailId, className, ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Show details for ${rowLabel}`}
      aria-expanded={expanded}
      // A reference to an element that is not there is invalid, so only while the details are.
      aria-controls={expanded ? detailId : undefined}
      data-slot="data-table-row-expander"
      className={cn("shrink-0", className)}
      {...props}
    >
      <ChevronRight
        aria-hidden="true"
        className={cn(
          "transition-transform motion-reduce:transition-none",
          expanded && "rotate-90",
        )}
      />
    </Button>
  ),
);
DataTableRowExpander.displayName = "DataTableRowExpander";

export interface DataTableRowDetailProps extends Omit<
  React.HTMLAttributes<HTMLTableRowElement>,
  "children"
> {
  /** `getRowId` of the row this belongs to. Also how a windowed table pairs it with its row. */
  rowId: string;
  rowLabel: string;
  /** The cell's `id`, which the row's expander points `aria-controls` at. */
  cellId: string;
  /** The columns the row is missing, in column order. */
  items: DataTableDetailItem[];
  /** Every column the row has, so the details run under all of them. */
  colSpan: number;
  /** The table runs edge to edge in a card, whose padding the panel keeps. */
  inset?: boolean;
}

/**
 * The row under an open row, listing the values of the columns the container was too narrow for.
 * A row of its own rather than something inside the data row, because a table cell cannot hold half a
 * row. It has no `data-row-id`, so row focus, the arrow keys and the virtualizer's item lookups all
 * skip it, and no `aria-rowindex`: it is part of the row above it, not a row of the data.
 */
const DataTableRowDetail = React.forwardRef<HTMLTableRowElement, DataTableRowDetailProps>(
  ({ rowId, rowLabel, cellId, items, colSpan, inset, className, ...props }, ref) => (
    <TableRow
      ref={ref}
      data-slot="data-table-detail"
      data-detail-for={rowId}
      className={cn("bg-muted/30 hover:bg-muted/30", className)}
      {...props}
    >
      <TableCell id={cellId} colSpan={colSpan} className="p-0!">
        <DetailPanel inset={inset}>
          <span className="sr-only">Details for {rowLabel}</span>
          <DataTableDetailList items={items} />
        </DetailPanel>
      </TableCell>
    </TableRow>
  ),
);
DataTableRowDetail.displayName = "DataTableRowDetail";

export interface DataTableFooterDetailProps extends Omit<
  React.HTMLAttributes<HTMLTableRowElement>,
  "children"
> {
  items: DataTableDetailItem[];
  colSpan: number;
  inset?: boolean;
}

/**
 * The totals of the columns that are hidden, as one more line in the footer. A total is the one
 * thing a reader should not have to open anything to see, so it is not tucked behind the row details.
 */
const DataTableFooterDetail = React.forwardRef<HTMLTableRowElement, DataTableFooterDetailProps>(
  ({ items, colSpan, inset, className, ...props }, ref) => (
    <TableRow ref={ref} data-slot="data-table-footer-detail" className={className} {...props}>
      <TableCell colSpan={colSpan} className="p-0!">
        <DetailPanel inset={inset}>
          <DataTableDetailList items={items} />
        </DetailPanel>
      </TableCell>
    </TableRow>
  ),
);
DataTableFooterDetail.displayName = "DataTableFooterDetail";

export { DataTableFooterDetail, DataTableRowDetail, DataTableRowExpander };
