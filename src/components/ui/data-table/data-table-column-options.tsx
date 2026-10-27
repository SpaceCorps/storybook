import * as React from "react";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { DataTableColumn, DataTableColumnVisibility } from "./types";
import { isColumnVisible } from "./utils";

export interface DataTableColumnOptionsProps {
  columns: DataTableColumn<never>[];
  /** Visibility overrides; an absent key falls back to the column's own `hidden` flag. */
  visibility: DataTableColumnVisibility;
  onToggle: (name: string, visible: boolean) => void;
  /**
   * Names of the columns the table is too narrow for right now (`hideBelow`, `priority`). They stay
   * ticked, because the person has not hidden them, and say where they went instead.
   */
  hiddenByWidth?: readonly string[];
  className?: string;
}

/**
 * The column-visibility checklist. Exported separately from the table so it can be rendered and
 * tested on its own. The last remaining visible column is disabled, so the table can never be
 * emptied of columns.
 *
 * It lists every column. What the person chose (the tick) and what the width allows are two things: a
 * column the container is too narrow for is still ticked and says it is "Hidden at this width", so it
 * is not mistaken for one that was switched off. Unticking it hides it at every width.
 */
const DataTableColumnOptions = React.forwardRef<HTMLDivElement, DataTableColumnOptionsProps>(
  ({ columns, visibility, onToggle, hiddenByWidth, className }, ref) => {
    const idPrefix = React.useId();
    const visibleCount = columns.filter((column) => isColumnVisible(column, visibility)).length;

    return (
      <div ref={ref} className={cn("flex flex-col gap-2", className)}>
        {columns.map((column) => {
          const visible = isColumnVisible(column, visibility);
          const id = `${idPrefix}-${column.name}`;
          const narrow = visible && hiddenByWidth?.includes(column.name) === true;
          const noteId = `${id}-note`;

          return (
            // The box and the label share the first grid row and are centred on each other, as they were
            // before there was a note; the note goes under the label in the second row. Aligning the box
            // to the top of the label instead sits it low against the text, because the box's height
            // follows the density and the label's line does not.
            <div
              key={column.name}
              className="grid grid-cols-[auto_auto] items-center justify-start gap-x-2"
            >
              <Checkbox
                id={id}
                checked={visible}
                disabled={visible && visibleCount <= 1}
                aria-describedby={narrow ? noteId : undefined}
                onCheckedChange={(checked) => onToggle(column.name, checked === true)}
              />
              <Label htmlFor={id} className="cursor-pointer font-normal">
                {column.header ?? column.name}
              </Label>
              {narrow ? (
                <span id={noteId} className="col-start-2 text-xs text-muted-foreground">
                  Hidden at this width
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  },
);
DataTableColumnOptions.displayName = "DataTableColumnOptions";

export { DataTableColumnOptions };
