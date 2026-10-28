import * as React from "react";
import { Ellipsis } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  /**
   * Fold the actions into one menu button, for a narrow table. Only a row with more than one action is
   * folded: a single button is already as small as the menu button would be, and a menu would only add
   * a tap. An action with `children` becomes a labelled group in the menu. Defaults to false.
   */
  collapsed?: boolean;
  /**
   * The accessible name of the menu button while `collapsed`. Many rows each have one, so it should
   * say which row ("Actions for 2026-10-12 Invoice"). Defaults to "More actions".
   */
  menuLabel?: string;
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

/**
 * Where focus goes when a row's menu closes. Escape or a click outside: Radix puts focus back on the
 * trigger, which is where a keyboard user expects to be. After an item ran, the action may have opened
 * a dialog that already took focus, and pulling it back to the trigger would fight it; only when focus
 * has landed on nothing is the trigger the right place for it.
 */
function keepFocusIfItemRan(ranRef: React.RefObject<boolean>) {
  return (event: Event) => {
    if (!ranRef.current) return;
    const active = document.activeElement;
    const container = event.target instanceof Node ? event.target : null;
    if (active && active !== document.body && !container?.contains(active)) {
      event.preventDefault();
    }
  };
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
      <DropdownMenuContent align="end" onCloseAutoFocus={keepFocusIfItemRan(ranRef)}>
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

interface CollapsedRowActionsProps<TRow> {
  actions: DataTableRowAction<TRow>[];
  menuLabel: string;
  invoke: (action: DataTableRowAction<TRow>) => void;
}

/**
 * What the menu shows for one action: its icon and label, and its `tooltip` as a second line when that
 * says more than the label does. A tooltip is hover-only and a phone has no hover, so the reason an
 * action is disabled, which is what a tooltip is mostly for, has to be in the item itself.
 */
function CollapsedActionItem<TRow>({
  action,
  groupDisabled = false,
  invoke,
  ranRef,
}: {
  action: DataTableRowAction<TRow>;
  /** The group this item is in is disabled, which unfolded disables the button that opens its menu. */
  groupDisabled?: boolean;
  invoke: (action: DataTableRowAction<TRow>) => void;
  ranRef: React.RefObject<boolean>;
}) {
  const disabled = groupDisabled || Boolean(action.disabled);
  return (
    <DropdownMenuItem
      disabled={disabled}
      className={cn(action.variant === "destructive" && DESTRUCTIVE_TEXT)}
      onClick={(event) => {
        event.stopPropagation();
        // A disabled item gets no click from a pointer or the keyboard; a programmatic one is not a run.
        if (disabled) return;
        ranRef.current = true;
        invoke(action);
      }}
    >
      {action.icon}
      <LabelWithNote label={action.label} tooltip={action.tooltip} />
    </DropdownMenuItem>
  );
}

/** The label, with the tooltip under it when that says more than the label does. */
function LabelWithNote({ label, tooltip }: { label: string; tooltip: string | undefined }) {
  if (!tooltip || tooltip === label) return <>{label}</>;
  return (
    <span className="flex min-w-0 flex-col">
      <span>{label}</span>
      <span className="text-xs font-normal text-muted-foreground">{tooltip}</span>
    </span>
  );
}

/**
 * Every action of one row in a single menu: a plain action is an item and one with `children` is a
 * labelled group of them (a sub-menu would be a second tap-and-hover level on a phone).
 */
function CollapsedRowActions<TRow>({ actions, menuLabel, invoke }: CollapsedRowActionsProps<TRow>) {
  const ranRef = React.useRef(false);
  const everyActionDisabled = actions.every((action) => {
    const children = getRenderableActions(action.children);
    return children.length > 0
      ? Boolean(action.disabled) || children.every((child) => child.disabled)
      : Boolean(action.disabled);
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={menuLabel}
          disabled={everyActionDisabled}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={keepFocusIfItemRan(ranRef)}>
        {actions.map((action, index) => {
          const children = getRenderableActions(action.children);
          if (children.length === 0) {
            const afterGroup =
              index > 0 && getRenderableActions(actions[index - 1].children).length > 0;
            return (
              <React.Fragment key={action.tag}>
                {afterGroup ? <DropdownMenuSeparator /> : null}
                <CollapsedActionItem action={action} invoke={invoke} ranRef={ranRef} />
              </React.Fragment>
            );
          }
          return (
            <React.Fragment key={action.tag}>
              {index > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuGroup aria-label={action.label}>
                <DropdownMenuLabel
                  className={cn(action.variant === "destructive" && DESTRUCTIVE_TEXT)}
                >
                  <LabelWithNote label={action.label} tooltip={action.tooltip} />
                </DropdownMenuLabel>
                {children.map((child) => (
                  <CollapsedActionItem
                    key={child.tag}
                    action={child}
                    groupDisabled={action.disabled}
                    invoke={invoke}
                    ranRef={ranRef}
                  />
                ))}
              </DropdownMenuGroup>
            </React.Fragment>
          );
        })}
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
  {
    actions,
    row,
    rowId,
    onRowAction,
    collapsed = false,
    menuLabel = "More actions",
    className,
  }: DataTableRowActionsProps<TRow>,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const renderable = getRenderableActions(actions);
  if (renderable.length === 0) {
    return null;
  }

  const invoke = (action: DataTableRowAction<TRow>) => {
    onRowAction?.({ id: rowId, tag: action.tag, row });
  };

  if (collapsed && renderable.length > 1) {
    return (
      <div
        ref={ref}
        data-slot="data-table-row-actions"
        data-collapsed=""
        className={cn("flex items-center justify-end gap-1", className)}
      >
        <CollapsedRowActions actions={renderable} menuLabel={menuLabel} invoke={invoke} />
      </div>
    );
  }

  const hasTooltip = renderable.some(
    (action) => action.tooltip || getRenderableActions(action.children).some((c) => c.tooltip),
  );

  const content = (
    <div
      ref={ref}
      data-slot="data-table-row-actions"
      className={cn("flex items-center justify-end gap-1", className)}
    >
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
