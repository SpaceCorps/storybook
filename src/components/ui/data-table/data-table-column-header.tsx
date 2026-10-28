import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { TableHead, type TableHeadProps } from "@/components/ui/table";
import type { DataTableColumn, DataTableSortDirection } from "./types";
import { ariaSortValue, nextSortDirection } from "./utils";
import {
  dataTableCellAlignVariant,
  dataTableCellTruncates,
  dataTableHeaderWrapClass,
} from "./variant";

export interface DataTableColumnHeaderProps<TRow> extends Omit<
  TableHeadProps,
  "children" | "onClick"
> {
  column: DataTableColumn<TRow>;
  /** Whether this header is an activatable sort control (global gate ∧ `column.sortable`). */
  sortable?: boolean;
  /** The active sort direction for this column, or `null` when it is not the sorted column. */
  direction?: DataTableSortDirection | null;
  onToggleSort?: (name: string) => void;
}

function sortActionLabel(label: string, direction: DataTableSortDirection | null): string {
  const next = nextSortDirection(direction);
  if (next === "Ascending") return `Sort by ${label} ascending`;
  if (next === "Descending") return `Sort by ${label} descending`;
  return `Clear sort on ${label}`;
}

/**
 * A single `<th>`. Sortable headers wrap their label in a real `<button>` so Enter and Space
 * activate natively and the header joins the tab order; non-sortable headers render plain text and
 * carry no `aria-sort` at all.
 *
 * The header of a column whose cells truncate truncates too, at the same cap, so a long label never
 * makes the column wider than its cells: the label gives way and the sort icon stays. It stays
 * readable in full: the sort button is named by the whole label, a screen reader reads the text that
 * is in the DOM, and a pointer rested on the header shows it as a tooltip while it is cut off. A column
 * whose cells are kept whole or wrap keeps its whole header, and the column is as wide as it needs.
 */
function DataTableColumnHeaderInner<TRow>(
  {
    column,
    sortable = false,
    direction = null,
    onToggleSort,
    className,
    style,
    onMouseEnter,
    onMouseLeave,
    ...props
  }: DataTableColumnHeaderProps<TRow>,
  ref: React.ForwardedRef<HTMLTableCellElement>,
) {
  const label = column.header ?? column.name;
  const truncates = dataTableCellTruncates(column);

  // Whether the label was cut off when the pointer came in, for as long as it stays. Not a permanent
  // title: a short label would grow a tooltip that repeats it, and assistive tech would read it out as
  // a description. The browser shows a title only after the pointer has rested, so setting it on enter
  // is early enough, and it goes again on leave, so a table resized in the meantime does not keep a
  // title for a label that is no longer cut off.
  const labelRef = React.useRef<HTMLSpanElement | null>(null);
  const [cutOff, setCutOff] = React.useState(false);
  const title = cutOff ? (column.help ? `${label}: ${column.help}` : label) : column.help;

  const indicator =
    direction === "Ascending" ? (
      <ArrowUp aria-hidden="true" className="size-3.5 shrink-0" />
    ) : direction === "Descending" ? (
      <ArrowDown aria-hidden="true" className="size-3.5 shrink-0" />
    ) : (
      // Not dimmer than 3:1 against the header (WCAG 1.4.11): at 60% the muted grey was 2.5:1 in light.
      <ChevronsUpDown aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground/80" />
    );

  return (
    <TableHead
      ref={ref}
      aria-sort={ariaSortValue(sortable, direction)}
      title={title}
      style={{ ...style, width: column.width ?? style?.width }}
      className={cn(
        dataTableCellAlignVariant({ align: column.align ?? "Left" }),
        dataTableHeaderWrapClass(column),
        className,
      )}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        const text = labelRef.current;
        if (truncates && text) setCutOff(text.scrollWidth > text.clientWidth);
      }}
      onMouseLeave={(event) => {
        onMouseLeave?.(event);
        setCutOff(false);
      }}
      {...props}
    >
      {sortable ? (
        <button
          type="button"
          aria-label={sortActionLabel(label, direction)}
          onClick={() => onToggleSort?.(column.name)}
          className="inline-flex max-w-full items-center gap-1 rounded-field font-medium transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span ref={labelRef} className="truncate">
            {label}
          </span>
          {indicator}
        </button>
      ) : (
        // A block, unlike the label in the button (a flex item, which is blockified): `truncate` does
        // nothing to an inline box, and the label would run on past the capped cell.
        <span ref={labelRef} className="block truncate">
          {label}
        </span>
      )}
    </TableHead>
  );
}

/** `forwardRef` erases the generic, so the row type is restored by the callable cast below. */
export interface DataTableColumnHeaderComponent {
  <TRow>(
    props: DataTableColumnHeaderProps<TRow> & { ref?: React.Ref<HTMLTableCellElement> },
  ): React.ReactElement;
  displayName?: string;
}

const DataTableColumnHeader = React.forwardRef(
  DataTableColumnHeaderInner,
) as DataTableColumnHeaderComponent;
DataTableColumnHeader.displayName = "DataTableColumnHeader";

export { DataTableColumnHeader };
