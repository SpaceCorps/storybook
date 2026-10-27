import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { DataTableRowAction, DataTableRowActionEvent } from "./types";
import { getRenderableActions } from "./utils";

export interface DataTableRowActionsProps<TRow> {
  actions: DataTableRowAction<TRow>[];
  row: TRow;
  /** `getRowId(row, index)` — passed straight through to `onRowAction`. */
  rowId: string;
  onRowAction?: (event: DataTableRowActionEvent<TRow>) => void;
  className?: string;
}

/**
 * `text-destructive` is a fill colour: #ef4444 is 3.8:1 on white and the dark theme's #7f1d1d is 2.0:1
 * on the page, both under the 4.5:1 text needs. These are the steps that field errors and the
 * destructive badge use, picked per theme.
 */
const DESTRUCTIVE_TEXT = "text-[var(--destructive-800)] dark:text-[var(--destructive-200)]";

function withTooltip(trigger: React.ReactElement, tooltip: string | undefined): React.ReactElement {
  if (!tooltip) return trigger;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

interface RowActionMenuProps<TRow> {
  action: DataTableRowAction<TRow>;
  items: DataTableRowAction<TRow>[];
  destructive: boolean;
  invoke: (action: DataTableRowAction<TRow>) => void;
}

/**
 * One dropdown action. It owns the "did an item run" flag because that decides where focus goes
 * when the menu closes, and a flag per menu cannot live in the row's `map`.
 */
function RowActionMenu<TRow>({ action, items, destructive, invoke }: RowActionMenuProps<TRow>) {
  const ranRef = React.useRef(false);

  return (
    <DropdownMenu>
      {withTooltip(
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size={action.icon ? "icon" : "sm"}
            aria-label={action.label}
            disabled={action.disabled}
            className={cn(destructive && DESTRUCTIVE_TEXT)}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {action.icon ?? action.label}
          </Button>
        </DropdownMenuTrigger>,
        action.tooltip,
      )}
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => {
          // Escape or a click outside: Radix puts focus back on the trigger, which is where a
          // keyboard user expects to be. After an item ran, the action may have opened a dialog that
          // already took focus, and pulling it back to the trigger would fight it; only when focus
          // has landed on nothing is the trigger the right place for it.
          if (!ranRef.current) return;
          const active = document.activeElement;
          const container = event.target instanceof Node ? event.target : null;
          if (active && active !== document.body && !container?.contains(active)) {
            event.preventDefault();
          }
        }}
      >
        {items.map((child) => (
          <DropdownMenuItem
            key={child.tag}
            disabled={child.disabled}
            className={cn(child.variant === "destructive" && DESTRUCTIVE_TEXT)}
            onClick={(event) => {
              event.stopPropagation();
              ranRef.current = true;
              invoke(child);
            }}
          >
            {child.icon}
            {child.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The trailing actions cell for one row. Resolution mirrors the legacy `ActionRenderer`: separator
 * entries are skipped, an action with children becomes a dropdown, and one without becomes a plain
 * button. Every handler stops propagation first so a row action never triggers row activation or
 * selection.
 */
function DataTableRowActionsInner<TRow>(
  { actions, row, rowId, onRowAction, className }: DataTableRowActionsProps<TRow>,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const renderable = getRenderableActions(actions);
  if (renderable.length === 0) {
    return null;
  }

  const invoke = (action: DataTableRowAction<TRow>) => {
    onRowAction?.({ id: rowId, tag: action.tag, row });
  };

  const hasTooltip = renderable.some(
    (action) => action.tooltip || getRenderableActions(action.children).some((c) => c.tooltip),
  );

  const content = (
    <div ref={ref} className={cn("flex items-center justify-end gap-1", className)}>
      {renderable.map((action) => {
        const children = getRenderableActions(action.children);
        const destructive = action.variant === "destructive";

        if (children.length > 0) {
          return (
            <RowActionMenu
              key={action.tag}
              action={action}
              items={children}
              destructive={destructive}
              invoke={invoke}
            />
          );
        }

        return (
          <React.Fragment key={action.tag}>
            {withTooltip(
              <Button
                type="button"
                variant="ghost"
                size={action.icon ? "icon" : "sm"}
                aria-label={action.label}
                disabled={action.disabled}
                className={cn(destructive && DESTRUCTIVE_TEXT)}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  invoke(action);
                }}
              >
                {action.icon ?? action.label}
              </Button>,
              action.tooltip,
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  return hasTooltip ? <TooltipProvider>{content}</TooltipProvider> : content;
}

/** `forwardRef` erases the generic, so the row type is restored by the callable cast below. */
export interface DataTableRowActionsComponent {
  <TRow>(
    props: DataTableRowActionsProps<TRow> & { ref?: React.Ref<HTMLDivElement> },
  ): React.ReactElement | null;
  displayName?: string;
}

const DataTableRowActions = React.forwardRef(
  DataTableRowActionsInner,
) as DataTableRowActionsComponent;
DataTableRowActions.displayName = "DataTableRowActions";

export { DataTableRowActions };
