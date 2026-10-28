import * as React from "react";
import { Settings2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { densityToIconButtonSize } from "@/components/ui/density-scale";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCardContentLayout } from "@/components/ui/card-flush-context";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDensity } from "@/contexts/density-context";
import type { Densities } from "@/types/density";

import { DataTableCellEditor } from "./data-table-cell-editor";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableColumnOptions } from "./data-table-column-options";
import { DataTablePagination, DEFAULT_PAGE_SIZE_OPTIONS } from "./data-table-pagination";
import { DataTableRowActions } from "./data-table-row-actions";
import {
  DataTableFooterDetail,
  DataTableRowDetail,
  DataTableRowExpander,
  getDetailItems,
} from "./data-table-row-detail";
import { DataTableToolbar } from "./data-table-toolbar";
import type {
  DataTableCellCommitEvent,
  DataTableColumn,
  DataTableColumnVisibility,
  DataTableRowAction,
  DataTableRowActionEvent,
  DataTableSort,
  DataTableToolbarSlots,
  DataTableVariant,
  DataTableVirtualized,
} from "./types";
import {
  estimateActionsColumnWidth,
  estimateStartColumnWidth,
  isResponsiveColumn,
  type HeaderWidthMetrics,
} from "./responsive-columns";
import { useResponsiveFit } from "./use-columns-hidden-by-width";
import { ACTIONS_WIDTH_VAR, usePinnedMetrics } from "./use-pinned-metrics";
import { useColumnVisibility } from "./use-column-visibility";
import { useDataTablePagination } from "./use-data-table-pagination";
import { INTERACTIVE_WITHIN_ROW, useDataTableRowFocus } from "./use-data-table-row-focus";
import { useDataTableSort } from "./use-data-table-sort";
import {
  DATA_TABLE_MAX_BODY_HEIGHT,
  DATA_TABLE_OVERSCAN,
  DATA_TABLE_ROW_HEIGHT_ESTIMATES,
  DATA_TABLE_VIRTUALIZATION_THRESHOLD,
  isDataTableWindowed,
  useDataTableVirtualization,
} from "./use-data-table-virtualization";
import { useRevealFocus } from "./use-focus-reveal";
import { useInlineCellEdit } from "./use-inline-cell-edit";
import { useScrollEdges } from "./use-scroll-edges";
import { getCellValue, getRenderableActions, revealTruncatedText, toDisplayString } from "./utils";
import {
  DATA_TABLE_FOOTER_ROW,
  dataTableCellAlignVariant,
  dataTableCellTruncates,
  dataTableCellWrapClass,
  dataTablePinClass,
  dataTableRowVariant,
} from "./variant";

export interface DataTableProps<TRow> extends Omit<
  React.HTMLAttributes<HTMLTableElement>,
  "children" | "className"
> {
  /**
   * `hideBelow` and `priority` on a column hide it while the table's container is too narrow for it.
   * The values of the hidden columns are listed in a details row, opened by a button that sits next to
   * the selection checkbox and is there only while a column is hidden. Sorting, paging, the totals row
   * and the column options keep working over all of the columns: the options list every one and mark
   * those the width has hidden, which is separate from the ones the person switched off.
   */
  columns: DataTableColumn<TRow>[];
  /** The full row set, unless `manualPagination` — then the current page only. */
  rows: TRow[];
  /**
   * Row key, selection key, and the id handed to callbacks. `index` is the row's position among the
   * rows currently rendered (i.e. within the page under client-side pagination).
   */
  getRowId: (row: TRow, index: number) => string;
  /**
   * What a screen reader hears for a row's selection checkbox: "Select row <label>". Defaults to the
   * row id, which is often opaque (a UUID); give it the row's name when it has one.
   */
  getRowLabel?: (row: TRow, index: number) => string;

  /** Controlled sort; `null` means unsorted. */
  sort?: DataTableSort | null;
  defaultSort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort | null) => void;
  /** Global sort gate, matching the legacy `config.AllowSorting`. Defaults to true. */
  allowSorting?: boolean;
  /** When true `rows` is assumed pre-sorted; the header still cycles and reports. */
  manualSorting?: boolean;

  /** Controlled 1-based page. */
  page?: number;
  defaultPage?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  defaultPageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  /** `false` hides the pagination footer and renders every row. Defaults to true. */
  paginated?: boolean;
  /** Server-side paging: `rows` is the current page and `rowCount` the total. */
  manualPagination?: boolean;
  rowCount?: number;

  columnVisibility?: DataTableColumnVisibility;
  defaultColumnVisibility?: DataTableColumnVisibility;
  onColumnVisibilityChange?: (visibility: DataTableColumnVisibility) => void;
  /** Renders the column-options trigger in the toolbar. Defaults to false. */
  showColumnOptions?: boolean;

  /** Row selection with a header select-all checkbox. Defaults to false. */
  selectable?: boolean;
  selectedRowIds?: string[];
  defaultSelectedRowIds?: string[];
  onSelectedRowIdsChange?: (ids: string[]) => void;

  /** The function form covers the legacy widget's `rowActions` *and* `perRowActions`. */
  rowActions?: DataTableRowAction<TRow>[] | ((row: TRow) => DataTableRowAction<TRow>[]);
  /**
   * An action may remove its own row. The button that had focus goes with it, so the table moves
   * focus to the row now at that position (the last one, if it was the last) rather than letting it
   * fall to `<body>`. Focus that has gone to a dialog the action opened, or anywhere else, is left
   * where it is.
   */
  onRowAction?: (event: DataTableRowActionEvent<TRow>) => void;
  /**
   * Fold every row's actions into one "..." menu button while the table's own container is narrower
   * than this many px, as `hideBelow` hides a column. The menu holds the same actions (an action with
   * `children` becomes a labelled group) and its button is named "Actions for <row label>". It frees
   * the room of the extra buttons for the data columns, which matters on a phone: two icon buttons
   * take about 100px, the menu button about 57px.
   *
   * Absent or not a finite number: the actions are buttons at every width. Folding applies only to a
   * table in which some row on the page has more than one action, and only to those rows; a row with
   * one action keeps its button. Before the container is measured (a server render, a test without
   * layout) the actions are folded, so a phone never paints a row of buttons that then folds. Once
   * folded the actions come back at this width plus a margin, so a scrollbar that comes and goes
   * does not make them flip.
   *
   * The room freed is spent on the `hideBelow` and `priority` columns, so a table that is widened
   * across this width can lose a `priority` column to the buttons that came back.
   */
  collapseRowActionsBelow?: number;

  /**
   * Inline editing gate. A cell is editable only when `editable && column.editable`. An editable cell
   * is a focusable button: Enter, Space or F2 (or a double-click) opens the editor, Enter commits,
   * Escape discards, and Tab or Shift+Tab commit and move focus to the next or previous editable cell
   * (focus only: the next editor is not opened for you). A screen reader hears the cell as
   * "Edit <header>: <value>". The cell is itself a button, so a `column.cell` that renders a link or
   * button of its own makes it a button inside a button: leave editable columns to plain content.
   */
  editable?: boolean;
  /**
   * Called when an inline edit is committed with a changed value. The table never mutates `rows` —
   * update your own data here and pass the new rows back in.
   */
  onCellCommit?: (event: DataTableCellCommitEvent<TRow>) => void | Promise<void>;

  /**
   * Optional row activation, by click or by Enter/Space on the focused row. Row actions, selection,
   * the inline editor and any button, link or input inside a cell never trigger it.
   *
   * Tab stops: the body is one stop (the active row, moved with the arrow keys, Home/End and
   * PageUp/PageDown), and each row adds its checkbox, its details button (while a column is hidden by
   * width), editable cells and row actions as stops of their own. A page of 25 rows with an inline
   * action each is therefore 26 stops before the footer.
   */
  onRowClick?: (row: TRow, id: string) => void;

  /**
   * Row windowing. `"auto"` (the default) engages only above `virtualizationThreshold` rendered
   * rows, so a default `paginated` call site renders every one of its 10 rows exactly as before.
   *
   * While windowing is active:
   * - Only the visible slice plus `overscan` is in the DOM, padded by two `aria-hidden` spacer rows
   *   so the scrollbar reports the true height. `aria-rowcount`/`aria-rowindex` keep reporting the
   *   real row count and each row's absolute position regardless.
   * - **Text selection cannot extend past the rendered rows.** Rendered rows stay in `<tbody>`
   *   document order so selection across them works normally, but a row that is not mounted cannot
   *   be selected. This is inherent to windowing.
   * - The table switches to `table-layout: fixed`, so column widths stay put instead of twitching
   *   as longer content scrolls in. Zero-width selection and row-action columns get real widths;
   *   override the latter with the `--ivy-data-table-actions-width` custom property.
   */
  virtualized?: DataTableVirtualized;
  /** Rendered-row count above which `virtualized="auto"` engages. Defaults to 50. */
  virtualizationThreshold?: number;
  /**
   * `max-height` of the table's scroll container while windowing is active (a number is px).
   * Defaults to 480. Windowing needs a bounded viewport — without one every row is "visible".
   */
  maxBodyHeight?: number | string;
  /** First-paint row-height estimate in px. Defaults per density (Small 36, Medium 44, Large 52). */
  estimateRowHeight?: number;
  /** Rows rendered beyond the visible range while windowing. Defaults to 8. */
  overscan?: number;

  /** Skeleton body. Defaults to false. */
  loading?: boolean;
  /** Replaces the default muted "No results." row. */
  emptyState?: React.ReactNode;
  /** Header slot above the table for filters and toolbar content. */
  toolbar?: DataTableToolbarSlots;
  /**
   * The table's accessible name/description, always present as the `<caption>` and visually hidden.
   * Plain text: with `showCaption` a second, `aria-hidden` copy is drawn, so it must not hold
   * anything focusable.
   */
  caption?: React.ReactNode;
  /**
   * Also draw `caption` as a visible line at the top of the table. It sits outside the scrolling
   * area, so it stays put while a wide table scrolls. Inside a titled card the card title already
   * names the table; leave this off there. Defaults to false.
   */
  showCaption?: boolean;
  /**
   * `"bordered"` draws the table's own rounded border; `"embedded"` draws no box, for a host that
   * already supplies one. Defaults to `"embedded"` inside a `CardContent` (so a table in a card never
   * shows a second border inside the card's) and `"bordered"` everywhere else. Inside
   * `<CardContent flush>` the embedded table also runs edge to edge, with its first and last column
   * inset by the card padding. An embedded table paints its pinned columns with
   * `--ivy-data-table-surface` (the page background if unset); set it when the host is not the page
   * colour.
   */
  variant?: DataTableVariant;
  density?: Densities;
  /** Applied to the wrapper around the toolbar, table and pagination footer. */
  className?: string;
  "data-testid"?: string;
}

const LOADING_ROW_CAP = 5;

function defaultCellContent(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  return toDisplayString(value);
}

/**
 * The editable cell before or after `from`, in document order (row by row), or `null` at either end.
 * Only one cell is ever being edited, so every other marked element is a focusable cell button.
 */
function adjacentEditableCell(
  from: HTMLElement,
  direction: "next" | "previous",
): HTMLElement | null {
  const current = from.closest<HTMLElement>("[data-editable-cell]");
  const scope = from.closest<HTMLElement>("table");
  if (!current || !scope) return null;
  const cells = Array.from(scope.querySelectorAll<HTMLElement>("[data-editable-cell]"));
  const index = cells.indexOf(current);
  return cells[direction === "next" ? index + 1 : index - 1] ?? null;
}

function DataTableInner<TRow>(
  {
    columns,
    rows,
    getRowId,
    getRowLabel,
    sort,
    defaultSort = null,
    onSortChange,
    allowSorting = true,
    manualSorting = false,
    page,
    defaultPage = 1,
    onPageChange,
    pageSize,
    defaultPageSize = 10,
    onPageSizeChange,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    paginated = true,
    manualPagination = false,
    rowCount,
    columnVisibility,
    defaultColumnVisibility,
    onColumnVisibilityChange,
    showColumnOptions = false,
    selectable = false,
    selectedRowIds,
    defaultSelectedRowIds,
    onSelectedRowIdsChange,
    rowActions,
    onRowAction,
    collapseRowActionsBelow,
    editable = false,
    onCellCommit,
    onRowClick,
    virtualized = "auto",
    virtualizationThreshold = DATA_TABLE_VIRTUALIZATION_THRESHOLD,
    maxBodyHeight = DATA_TABLE_MAX_BODY_HEIGHT,
    estimateRowHeight,
    overscan = DATA_TABLE_OVERSCAN,
    loading = false,
    emptyState,
    toolbar,
    caption,
    showCaption = false,
    variant,
    density: propDensity,
    className,
    onKeyDown,
    onFocus,
    onBlur,
    ...tableProps
  }: DataTableProps<TRow>,
  ref: React.ForwardedRef<HTMLTableElement>,
) {
  const contextDensity = useDensity();
  const density = propDensity ?? contextDensity;
  const iconButtonSize = densityToIconButtonSize(density);
  const selectionIdPrefix = React.useId();

  // A card is the one host that is known to supply a border and a surface of its own, so inside one
  // the table steps back. An explicit `variant` always wins.
  const cardLayout = useCardContentLayout();
  const resolvedVariant: DataTableVariant = variant ?? (cardLayout ? "embedded" : "bordered");
  const embedded = resolvedVariant === "embedded";
  // Flush content has no padding of its own, so the table supplies the card's inset itself.
  const inset = embedded && cardLayout === "flush";

  const { resolvedVisibility, visibleColumns, setColumnVisible } = useColumnVisibility({
    columns,
    columnVisibility,
    defaultColumnVisibility,
    onColumnVisibilityChange,
  });

  const { sortedRows, isSortable, directionFor, toggleSort } = useDataTableSort({
    columns,
    rows,
    sort,
    defaultSort,
    onSortChange,
    allowSorting,
    manualSorting,
  });

  const total = manualPagination ? (rowCount ?? rows.length) : sortedRows.length;
  const pagination = useDataTablePagination({
    total,
    page,
    defaultPage,
    onPageChange,
    pageSize,
    defaultPageSize,
    onPageSizeChange,
  });

  const pageRows = React.useMemo(() => {
    if (!paginated || manualPagination) return sortedRows;
    const start = (pagination.page - 1) * pagination.pageSize;
    return sortedRows.slice(start, start + pagination.pageSize);
  }, [manualPagination, pagination.page, pagination.pageSize, paginated, sortedRows]);

  const pageRowIds = React.useMemo(
    () => pageRows.map((row, index) => getRowId(row, index)),
    [getRowId, pageRows],
  );

  const isSelectionControlled = selectedRowIds !== undefined;
  const [internalSelected, setInternalSelected] = React.useState<string[]>(
    defaultSelectedRowIds ?? [],
  );
  const selectedIds = isSelectionControlled ? selectedRowIds : internalSelected;
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  const commitSelection = (next: string[]) => {
    if (!isSelectionControlled) {
      setInternalSelected(next);
    }
    onSelectedRowIdsChange?.(next);
  };

  const allPageSelected = pageRowIds.length > 0 && pageRowIds.every((id) => selectedSet.has(id));
  // Some but not all: the select-all box reports "mixed" rather than an unchecked state that hides it.
  const somePageSelected = !allPageSelected && pageRowIds.some((id) => selectedSet.has(id));

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const next = [...selectedIds];
      for (const id of pageRowIds) {
        if (!selectedSet.has(id)) next.push(id);
      }
      commitSelection(next);
      return;
    }
    const pageSet = new Set(pageRowIds);
    commitSelection(selectedIds.filter((id) => !pageSet.has(id)));
  };

  const toggleRowSelected = (id: string, checked: boolean) => {
    commitSelection(checked ? [...selectedIds, id] : selectedIds.filter((other) => other !== id));
  };

  const { isEditing, beginEdit, endEdit, redirectFocus, registerCell } = useInlineCellEdit({
    editable,
  });

  const resolveActions = React.useCallback(
    (row: TRow): DataTableRowAction<TRow>[] =>
      typeof rowActions === "function" ? rowActions(row) : (rowActions ?? []),
    [rowActions],
  );

  // The most actions any row on the page has: a column exists if one has any, and it is as wide as
  // the widest row needs.
  const maxActionCount = React.useMemo(() => {
    if (!rowActions) return 0;
    if (typeof rowActions !== "function") return getRenderableActions(rowActions).length;
    return pageRows.reduce(
      (most, row) => Math.max(most, getRenderableActions(rowActions(row)).length),
      0,
    );
  }, [pageRows, rowActions]);
  const hasActionsColumn = maxActionCount > 0;

  // The scroller: declared here because what the pinned cells measure is read from it, before the
  // fit below decides what to render.
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);

  // Columns the container is too narrow for, and whether the row actions fold into a menu button.
  // Measured on the wrapper below, whose width is the room the host gives the table and not what the
  // columns want, so hiding one cannot move the number that hid it. Only tables that ask for it
  // (`hideBelow`, `priority`, `collapseRowActionsBelow`) observe anything.
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const foldRowActions =
    typeof collapseRowActionsBelow === "number" && Number.isFinite(collapseRowActionsBelow);
  // What the pinned cells take. Their model is exact for icon buttons; the page is asked about the
  // rest (see `usePinnedMetrics`). Counted with the details button whether or not it is showing yet,
  // so the amount reserved does not change when the fit puts it there.
  const collapsedRef = React.useRef(false);
  // A windowed table is laid out with fixed widths, so its pinned cells are sized from these numbers
  // whether or not anything else asks for them. Its rows scroll in and out of the DOM, and the widest
  // actions cell seen stays reserved for as long as these are the rows (and the actions) on offer.
  const windowedLayout = isDataTableWindowed({
    enabled: !loading,
    count: pageRowIds.length,
    virtualized,
    virtualizationThreshold,
  });
  const actionsScope = React.useMemo(
    () => ({}),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the scope is these, not its own contents
    [pageRows, density, typeof rowActions === "function" ? undefined : rowActions],
  );
  const pinned = usePinnedMetrics({
    containerRef: scrollContainerRef,
    enabled: visibleColumns.some(isResponsiveColumn) || foldRowActions || windowedLayout,
    collapsedRef,
    scope: windowedLayout ? actionsScope : undefined,
  });
  const pinnedMetrics = { density, inset, unitPx: pinned.unitPx } as const;
  // What a header takes is part of what its column takes, unless the column truncates it (then the
  // header gives way at the cap, as the cells do, and the column counts as it did). The columns that
  // carry the sort icon are named because it widens the header. A windowed table is laid out with fixed
  // widths, where a header cannot push its column wider than `width`, so it counts none.
  const sortableNames = React.useMemo(
    () => new Set(visibleColumns.filter(isSortable).map((column) => column.name)),
    [isSortable, visibleColumns],
  );
  const headerMetrics: HeaderWidthMetrics | undefined = windowedLayout
    ? undefined
    : { ...pinnedMetrics, sortable: sortableNames };
  const reservedStart = estimateStartColumnWidth({
    selectable,
    checkboxPx: pinned.checkboxPx,
    ...pinnedMetrics,
  });
  const reservedActions = (measured: number | null, count: number) =>
    hasActionsColumn
      ? Math.max(
          estimateActionsColumnWidth({ actionCount: count, ...pinnedMetrics }),
          measured ?? 0,
          // The custom property sets the width of a windowed table's cell and nothing else's.
          windowedLayout ? (pinned.configuredActionsPx ?? 0) : 0,
        )
      : 0;
  // The bordered table draws a border on each side that the wrapper's width includes.
  const borderWidth = resolvedVariant === "bordered" ? 2 : 0;
  const reservedUnfolded =
    reservedStart + reservedActions(pinned.unfoldedActionsPx, maxActionCount) + borderWidth;
  const reservedFolded = reservedStart + reservedActions(pinned.foldedActionsPx, 1) + borderWidth;
  const { hidden: hiddenByWidth, rowActionsCollapsed } = useResponsiveFit({
    containerRef: rootRef,
    columns: visibleColumns,
    reservedWidth: reservedUnfolded,
    reservedFoldedWidth: reservedFolded,
    collapseBelow: foldRowActions ? collapseRowActionsBelow : undefined,
    collapseApplies: maxActionCount > 1,
    remPx: pinned.remPx,
    header: headerMetrics,
    enabled: visibleColumns.some(isResponsiveColumn) || foldRowActions,
  });
  collapsedRef.current = rowActionsCollapsed;
  const { renderedColumns, detailColumns } = React.useMemo(() => {
    const narrowed = visibleColumns.filter((column) => hiddenByWidth.has(column.name));
    // The width logic keeps one column, but it is computed after the render that changed the columns;
    // a table with none for that one pass would only be a flash of nothing.
    if (narrowed.length === 0 || narrowed.length === visibleColumns.length) {
      return { renderedColumns: visibleColumns, detailColumns: [] };
    }
    return {
      renderedColumns: visibleColumns.filter((column) => !hiddenByWidth.has(column.name)),
      detailColumns: narrowed,
    };
  }, [hiddenByWidth, visibleColumns]);
  const hasDetail = detailColumns.length > 0;
  // One pinned cell at the start holds the selection checkbox and the details button, whichever the
  // table has: a second pinned column would need its own offset from the first.
  const hasStartColumn = selectable || hasDetail;

  const [expandedRowIds, setExpandedRowIds] = React.useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  // Open rows are remembered by id and not forgotten when the last hidden column comes back, so a
  // table nudged across a breakpoint and back shows the same rows open.
  const toggleRowExpanded = (id: string) => {
    setExpandedRowIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };

  const tableName = typeof caption === "string" ? caption : tableProps["aria-label"];
  const paginationLabel = tableName ? `${tableName} pagination` : "Table pagination";

  const hasFooter = visibleColumns.some((column) => column.footer !== undefined);
  const hasFooterRow = renderedColumns.some((column) => column.footer !== undefined);
  const detailFooterColumns = detailColumns.filter((column) => column.footer !== undefined);
  const columnCount =
    renderedColumns.length + (hasStartColumn ? 1 : 0) + (hasActionsColumn ? 1 : 0);
  const showToolbar = Boolean(toolbar?.left || toolbar?.right || showColumnOptions);

  // Windowing and roving row focus are mutually dependent — the virtualizer pins the focused row
  // into its rendered range, and moving focus scrolls through the virtualizer — so `scrollToIndex`
  // is reached through a ref rather than a closure.
  const scrollToIndexRef = React.useRef<(index: number) => void>(() => undefined);
  const scrollToIndex = React.useCallback((index: number) => {
    scrollToIndexRef.current(index);
  }, []);

  useScrollEdges(scrollContainerRef);
  useRevealFocus(scrollContainerRef);

  // The row whose details button has focus. When the container widens enough for the last hidden
  // column to return, the buttons go and take focus with them; it belongs on the row they were in,
  // not on whichever row the roving focus last visited (which is where the generic rescue would put
  // it), and a blur never says so, because React is not listening while it commits.
  const expanderFocus = React.useRef<string | null>(null);
  React.useLayoutEffect(() => {
    const rowId = expanderFocus.current;
    if (hasDetail || rowId === null) return;
    expanderFocus.current = null;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const rows = scrollContainerRef.current?.querySelectorAll<HTMLElement>("tr[data-row-id]");
    Array.from(rows ?? [])
      .find((row) => row.dataset.rowId === rowId)
      ?.focus();
  }, [hasDetail]);

  // The row whose actions have focus. When the container crosses `collapseRowActionsBelow` the
  // buttons are swapped for the menu button or back, and focus goes with whichever unmounted; it
  // belongs on the same row's actions, not on the page (a keyboard user would start over from the top).
  const actionsFocus = React.useRef<string | null>(null);
  React.useLayoutEffect(() => {
    const rowId = actionsFocus.current;
    if (rowId === null) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    actionsFocus.current = null;
    const rows = scrollContainerRef.current?.querySelectorAll<HTMLElement>("tr[data-row-id]");
    Array.from(rows ?? [])
      .find((row) => row.dataset.rowId === rowId)
      ?.querySelector<HTMLElement>("[data-pin='end'] button:not(:disabled)")
      ?.focus();
  }, [rowActionsCollapsed]);

  const rowFocus = useDataTableRowFocus({
    count: pageRows.length,
    containerRef: scrollContainerRef,
    scrollToIndex,
    estimatedRowHeight: estimateRowHeight ?? DATA_TABLE_ROW_HEIGHT_ESTIMATES[density],
    onActivate: onRowClick
      ? (index) => {
          const row = pageRows[index];
          if (row !== undefined) onRowClick(row, pageRowIds[index]);
        }
      : undefined,
  });

  const virtualization = useDataTableVirtualization({
    containerRef: scrollContainerRef,
    rowIds: pageRowIds,
    virtualized,
    virtualizationThreshold,
    maxBodyHeight,
    estimateRowHeight,
    overscan,
    density,
    pinnedIndex: rowFocus.pinnedIndex,
    enabled: !loading,
  });
  scrollToIndexRef.current = virtualization.scrollToIndex;

  // The body is one tab stop: the active row. A windowed table only pins that row into the DOM once a
  // row has been focused, so scrolling with the mouse first can leave it unmounted and the body with
  // no stop at all; the first row on screen stands in until one is focused.
  const tabStopIndex = (() => {
    const windowed = virtualization.virtualItems;
    if (!windowed?.length || windowed.some((item) => item.index === rowFocus.activeIndex)) {
      return rowFocus.activeIndex;
    }
    const visible = virtualization.firstVisibleIndex;
    return windowed.some((item) => item.index === visible) ? visible : windowed[0].index;
  })();

  /**
   * Under `table-layout: fixed` a `w-0` utility is taken literally, collapsing the selection and
   * row-action columns and painting their controls over the neighbouring cell. Windowed tables get
   * the width the fit reserves for them instead (the same numbers, so what the fit counts is what the
   * layout gives); auto layout keeps `w-0`'s shrink-to-fit behaviour. The actions width is the
   * `--ivy-data-table-actions-width` custom property when a consumer sets it, else what the cell needs.
   */
  const fitColumn = (
    kind: "select" | "actions",
  ): { className: string; style?: React.CSSProperties } => {
    if (!virtualization.active) return { className: "w-0" };
    if (kind === "actions") {
      const needed = rowActionsCollapsed
        ? reservedActions(pinned.foldedActionsPx, 1)
        : reservedActions(pinned.unfoldedActionsPx, maxActionCount);
      return { className: "", style: { width: `var(${ACTIONS_WIDTH_VAR}, ${needed}px)` } };
    }
    return {
      className: "",
      style: {
        width: estimateStartColumnWidth({
          selectable,
          withDetails: hasDetail,
          checkboxPx: pinned.checkboxPx,
          ...pinnedMetrics,
        }),
      },
    };
  };

  /**
   * 1-based absolute position, so paging and windowing both report true `aria-rowindex` values. A
   * manually paginated table is offset by its page too: its `rows` are only the current page, though
   * `aria-rowcount` reports the full total.
   */
  const absoluteRowIndex = (rowIndex: number) =>
    paginated ? (pagination.page - 1) * pagination.pageSize + rowIndex + 1 : rowIndex + 1;

  const spacerRow = (key: string, height: number) => (
    <tr key={key} aria-hidden="true" data-slot="data-table-spacer" className="border-0">
      <td colSpan={Math.max(1, columnCount)} style={{ height, padding: 0, border: 0 }} />
    </tr>
  );

  const columnOptionsControl = showColumnOptions ? (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size={iconButtonSize} aria-label="Column options">
          <Settings2 aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56" aria-label="Column options">
        <DataTableColumnOptions
          columns={columns}
          visibility={resolvedVisibility}
          hiddenByWidth={detailColumns.map((column) => column.name)}
          onToggle={setColumnVisible}
        />
      </PopoverContent>
    </Popover>
  ) : null;

  const renderCellContent = (
    column: DataTableColumn<TRow>,
    row: TRow,
    rowId: string,
    rowIndex: number,
  ): React.ReactNode => {
    const value = getCellValue(column, row);
    const rendered = column.cell ? column.cell(value, row, rowIndex) : defaultCellContent(value);
    const label = column.header ?? column.name;
    const cellEditable = editable && (column.editable ?? false);

    if (!cellEditable) {
      return rendered;
    }

    const previous = toDisplayString(value);

    if (isEditing(rowId, column.name)) {
      return (
        <div
          data-editable-cell=""
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <DataTableCellEditor
            aria-label={`Edit ${label}`}
            value={previous}
            onCommit={(next, blurEvent) => {
              // Focus leaving the editor for another control (a click on a button or a field) is
              // where the user is going: handing it back to this cell would cancel that move. It
              // only comes back when focus went nowhere in particular.
              endEdit({ restoreFocus: !blurEvent || blurEvent.relatedTarget === null });
              if (next === previous) return;
              void onCellCommit?.({
                id: rowId,
                row,
                column: column.name,
                value: next,
                previousValue: value,
              });
            }}
            onCancel={() => endEdit()}
            onNavigate={(direction, event) => {
              // Spreadsheet-style: the edit is already committed, so carry on to the neighbouring
              // editable cell. At either end there is none, and the browser's own Tab takes over
              // from the cell this editor was opened from.
              const target = adjacentEditableCell(event.currentTarget, direction);
              if (!target) return;
              event.preventDefault();
              redirectFocus(target);
            }}
          />
        </div>
      );
    }

    return (
      <div
        ref={registerCell(rowId, column.name)}
        data-editable-cell=""
        role="button"
        tabIndex={0}
        // The name replaces the cell's content for a screen reader, so it carries the value too.
        aria-label={previous ? `Edit ${label}: ${previous}` : `Edit ${label}`}
        // `outline-hidden` only while focused: unconditionally it is a real 2px outline in forced
        // colors mode, which boxes every editable cell and makes the focused one hard to tell apart.
        className="w-full rounded-field focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => {
          event.stopPropagation();
          beginEdit(rowId, column.name);
        }}
        onKeyDown={(event) => {
          // A button answers to Enter and Space; F2 is the spreadsheet convention for "edit this".
          if (event.key !== "Enter" && event.key !== " " && event.key !== "F2") return;
          // Something focusable inside a custom cell keeps its own keys.
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          event.stopPropagation();
          beginEdit(rowId, column.name);
        }}
      >
        {rendered}
      </div>
    );
  };

  const body = (() => {
    if (loading) {
      const skeletonRows = Math.max(1, Math.min(pagination.pageSize, LOADING_ROW_CAP));
      return Array.from({ length: skeletonRows }, (_, rowIndex) => (
        <TableRow key={`skeleton-${rowIndex}`}>
          {Array.from({ length: Math.max(1, columnCount) }, (__, cellIndex) => (
            <TableCell key={`skeleton-cell-${cellIndex}`}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ));
    }

    if (pageRows.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={Math.max(1, columnCount)} className="text-center">
            {emptyState ?? <span className="text-muted-foreground">No results.</span>}
          </TableCell>
        </TableRow>
      );
    }

    const renderRow = (rowIndex: number) => {
      const row = pageRows[rowIndex];
      const rowId = pageRowIds[rowIndex];
      const rowSelected = selectedSet.has(rowId);
      const actions = hasActionsColumn ? resolveActions(row) : [];
      const label = getRowLabel ? getRowLabel(row, rowIndex) : rowId;
      const detailOpen = hasDetail && expandedRowIds.has(rowId);
      // Not the row id: `aria-controls` is a list of ids split at whitespace, and a row id can hold any.
      const detailId = `${selectionIdPrefix}-detail-${rowIndex}`;

      const mainRow = (
        <TableRow
          // `data-index` is not decoration: virtual-core reads it back off the measured element and
          // warns if it is missing. `data-row-id` is the focus/query handle.
          data-index={rowIndex}
          data-row-id={rowId}
          ref={virtualization.active ? virtualization.measureRowElement : undefined}
          aria-rowindex={absoluteRowIndex(rowIndex)}
          tabIndex={rowIndex === tabStopIndex ? 0 : -1}
          onFocus={() => rowFocus.handleRowFocus(rowIndex)}
          data-state={rowSelected ? "selected" : undefined}
          data-expanded={detailOpen ? "" : undefined}
          className={cn(
            dataTableRowVariant({ interactive: Boolean(onRowClick), selected: rowSelected }),
            // The details under it carry the divider, so the two read as one row.
            "data-[expanded]:border-b-0",
            // An outline, not a ring: a box-shadow on a `<tr>` is not painted in a collapsed-border
            // table, so the ring never showed. Inset so the scroll container cannot clip it.
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
          )}
          onClick={
            onRowClick
              ? (event) => {
                  const target = event.target as Element;
                  // React bubbles a click out of a portal to the row that owns it: a row action's
                  // menu, a dialog or popover a cell opened. That is not a click on the row.
                  if (!event.currentTarget.contains(target)) return;
                  // A button, link or input in a custom cell is its own target.
                  const inner = target.closest(INTERACTIVE_WITHIN_ROW);
                  if (inner && event.currentTarget.contains(inner)) return;
                  onRowClick(row, rowId);
                }
              : undefined
          }
        >
          {hasStartColumn ? (
            <TableCell
              data-pin="start"
              className={cn(
                fitColumn("select").className,
                dataTablePinClass("start", "cell"),
                "[&:has([role=checkbox])]:pr-2",
              )}
              style={fitColumn("select").style}
            >
              <div
                className="flex items-center gap-1"
                onClick={(event) => event.stopPropagation()}
                role="presentation"
              >
                {selectable ? (
                  <>
                    <Checkbox
                      id={`${selectionIdPrefix}-row-${rowId}`}
                      checked={rowSelected}
                      onCheckedChange={(checked) => toggleRowSelected(rowId, checked === true)}
                    />
                    <Label htmlFor={`${selectionIdPrefix}-row-${rowId}`} className="sr-only">
                      Select row {label}
                    </Label>
                  </>
                ) : null}
                {hasDetail ? (
                  <DataTableRowExpander
                    rowLabel={label}
                    expanded={detailOpen}
                    detailId={detailId}
                    onClick={() => toggleRowExpanded(rowId)}
                    // Focus on the button is what has to be found again if the last hidden column
                    // comes back and takes the button with it, see `expanderFocus`.
                    onFocus={() => {
                      expanderFocus.current = rowId;
                    }}
                    onBlur={() => {
                      expanderFocus.current = null;
                    }}
                  />
                ) : null}
              </div>
            </TableCell>
          ) : null}

          {renderedColumns.map((column) => (
            <TableCell
              key={column.name}
              className={cn(
                dataTableCellAlignVariant({ align: column.align ?? "Left" }),
                dataTableCellWrapClass(column),
              )}
              style={column.width ? { width: column.width } : undefined}
              data-truncate={dataTableCellTruncates(column) ? "" : undefined}
              onMouseEnter={
                dataTableCellTruncates(column)
                  ? (event) => revealTruncatedText(event.currentTarget)
                  : undefined
              }
            >
              {renderCellContent(column, row, rowId, rowIndex)}
            </TableCell>
          ))}

          {hasActionsColumn ? (
            <TableCell
              data-pin="end"
              className={cn(fitColumn("actions").className, dataTablePinClass("end", "cell"))}
              style={fitColumn("actions").style}
              // Focus inside the cell is what has to be found again if the actions fold or unfold
              // under it and take the button with them, see `actionsFocus`.
              onFocus={() => {
                actionsFocus.current = rowId;
              }}
              onBlur={() => {
                actionsFocus.current = null;
              }}
            >
              <DataTableRowActions
                actions={actions}
                row={row}
                rowId={rowId}
                onRowAction={onRowAction}
                collapsed={rowActionsCollapsed}
                menuLabel={`Actions for ${label}`}
              />
            </TableCell>
          ) : null}
        </TableRow>
      );

      // The column's own renderer, and its inline editor if it has one: what the row would show.
      const items = detailOpen
        ? getDetailItems(detailColumns, (column) => renderCellContent(column, row, rowId, rowIndex))
        : [];

      // Always a fragment, so opening the details keeps the row (and the button that has focus) in
      // place instead of mounting a new one under a different parent.
      return (
        <React.Fragment key={rowId}>
          {mainRow}
          {detailOpen ? (
            <DataTableRowDetail
              ref={virtualization.active ? virtualization.measureDetailElement : undefined}
              rowId={rowId}
              rowLabel={label}
              cellId={detailId}
              items={items}
              colSpan={Math.max(1, columnCount)}
              inset={inset}
            />
          ) : null}
        </React.Fragment>
      );
    };

    const { virtualItems } = virtualization;
    if (!virtualItems) {
      return pageRows.map((_, rowIndex) => renderRow(rowIndex));
    }

    // Real `<tr>`/`<td>` in document order, padded by spacer rows rather than absolutely positioned:
    // absolute positioning would need `display: block` on table/tbody/tr, which destroys column
    // alignment, the sticky `<thead>` and cross-row text selection.
    const rendered: React.ReactNode[] = [];
    if (virtualization.padStart > 0) {
      rendered.push(spacerRow("virtual-pad-start", virtualization.padStart));
    }
    virtualItems.forEach((item, position) => {
      rendered.push(renderRow(item.index));
      // Non-zero only when the focused row is pinned in from outside the contiguous window, which
      // keeps padStart + rendered + gaps + padEnd equal to the true total height even then.
      const gap = virtualization.gapAfter(position);
      if (gap > 0) {
        rendered.push(spacerRow(`virtual-gap-${item.index}`, gap));
      }
    });
    if (virtualization.padEnd > 0) {
      rendered.push(spacerRow("virtual-pad-end", virtualization.padEnd));
    }
    return rendered;
  })();

  return (
    <div
      ref={rootRef}
      data-slot="data-table"
      data-variant={resolvedVariant}
      // `min-w-0 max-w-full` so the table can be a flex or grid item without its content width
      // deciding the track: the scroll container below absorbs the overflow instead.
      className={cn("flex w-full min-w-0 max-w-full flex-col gap-2", className)}
    >
      {showToolbar ? (
        <DataTableToolbar
          density={density}
          // Flush content clips its overflow and has no padding above the toolbar, so the first
          // control's focus ring (ring plus offset, 4px) would be cut off along the top.
          className={inset ? "px-6 pt-1.5" : undefined}
          left={toolbar?.left}
          right={
            <>
              {toolbar?.right}
              {columnOptionsControl}
            </>
          }
        />
      ) : null}

      <div
        data-slot="data-table-surface"
        className={cn(
          "min-w-0",
          embedded
            ? // The card's own border frames the table; the divider only separates it from the
              // card header above.
              cardLayout === "flush" && "border-t border-border"
            : "rounded-box border border-border bg-background [--ivy-data-table-surface:var(--background)]",
        )}
      >
        {caption && showCaption ? (
          // Outside the scroller so it stays put while a wide table scrolls. The `<caption>` below
          // already names the table for assistive tech, so this copy is hidden from it.
          <div
            data-slot="data-table-caption"
            aria-hidden="true"
            className={cn(
              "border-b border-border py-2 text-left text-sm text-muted-foreground",
              inset ? "px-6" : "px-2",
            )}
          >
            {caption}
          </div>
        ) : null}

        <Table
          ref={ref}
          density={density}
          aria-busy={loading || undefined}
          // Counts data rows only, and the header row carries no `aria-rowindex`. A stricter ARIA
          // reading would include the header (N + 1); N is the convention here, applied whether or
          // not windowing is active so a screen reader always hears the true row count.
          aria-rowcount={total}
          // The consumer's handlers run first, and neither replaces the table's own: `{...tableProps}`
          // below used to overwrite `onKeyDown`, which silently switched the whole row keymap off.
          onKeyDown={(event) => {
            onKeyDown?.(event);
            rowFocus.handleKeyDown(event);
          }}
          onFocus={(event) => {
            onFocus?.(event);
            rowFocus.handleFocusWithin(event);
          }}
          onBlur={(event) => {
            onBlur?.(event);
            rowFocus.handleBlurWithin(event);
          }}
          className={cn(
            "ivy-data-table",
            // Sticky header: survives the scroll container `Table` wraps every table in. The
            // background is opaque so windowed rows do not scroll visibly through it, and it sits
            // above the pinned body cells (z-1) with the pinned header corners above it. Utilities
            // rather than a stylesheet, so they reach apps that only scan the compiled JS.
            "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-[2] [&_thead_th]:bg-[color:var(--ivy-data-table-surface,var(--background))] [&_thead_th[data-pin]]:z-[3]",
            // Flush: the first and last column carry the card's padding, so text lines up with the
            // card header and the pinned columns keep it while scrolled.
            inset && "[&_tr>:first-child]:ps-6 [&_tr>:last-child]:pe-6",
            // Windowed: fixed layout takes widths from `column.width` (or an equal split) and holds
            // them, so columns do not twitch as longer content scrolls into the window.
            virtualization.active && "ivy-data-table-virtualized table-fixed",
          )}
          // The scroller: wide content scrolls here instead of overflowing the card, and a scroll
          // that hits an end does not chain to the page. The scrollbar takes its colours from the
          // tokens: a native one stays light in the dark theme and glares against the card. The
          // `scroll-p*` utilities read the size of the pinned columns and the sticky header that
          // `useRevealFocus` measures, so a focused control is scrolled out from under them.
          containerClassName="min-w-0 max-w-full overscroll-x-contain scroll-pl-[var(--ivy-data-table-pin-start,0px)] scroll-pr-[var(--ivy-data-table-pin-end,0px)] scroll-pt-[var(--ivy-data-table-head-height,0px)] [scrollbar-color:var(--muted-foreground)_transparent] [scrollbar-width:thin]"
          containerRef={scrollContainerRef}
          containerStyle={virtualization.containerStyle}
          {...tableProps}
        >
          {caption ? <TableCaption className="sr-only">{caption}</TableCaption> : null}
          <TableHeader>
            <TableRow>
              {hasStartColumn ? (
                <TableHead
                  data-pin="start"
                  className={cn(
                    fitColumn("select").className,
                    dataTablePinClass("start", "head"),
                    "[&:has([role=checkbox])]:pr-2",
                  )}
                  style={fitColumn("select").style}
                >
                  {selectable ? (
                    <div className="flex items-center">
                      <Checkbox
                        id={`${selectionIdPrefix}-all`}
                        // `nullable` is what lets the box show the mixed state, and it also makes an
                        // unchecked box cycle through it, so it is only switched on while mixed.
                        nullable={somePageSelected}
                        checked={somePageSelected ? null : allPageSelected}
                        onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                      />
                      <Label htmlFor={`${selectionIdPrefix}-all`} className="sr-only">
                        Select all rows
                      </Label>
                    </div>
                  ) : (
                    // The column of details buttons: a header cell needs a name of its own.
                    <span className="sr-only">Row details</span>
                  )}
                </TableHead>
              ) : null}

              {renderedColumns.map((column) => (
                <DataTableColumnHeader
                  key={column.name}
                  column={column}
                  sortable={isSortable(column)}
                  direction={directionFor(column)}
                  onToggleSort={toggleSort}
                />
              ))}

              {hasActionsColumn ? (
                <TableHead
                  aria-label="Row actions"
                  data-pin="end"
                  className={cn(fitColumn("actions").className, dataTablePinClass("end", "head"))}
                  style={fitColumn("actions").style}
                >
                  <span className="sr-only">Row actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>

          <TableBody>{body}</TableBody>

          {hasFooter ? (
            <TableFooter>
              {hasFooterRow ? (
                <TableRow className={DATA_TABLE_FOOTER_ROW}>
                  {hasStartColumn ? (
                    <TableCell data-pin="start" className={dataTablePinClass("start", "cell")} />
                  ) : null}
                  {renderedColumns.map((column) => (
                    <TableCell
                      key={column.name}
                      className={cn(
                        dataTableCellAlignVariant({ align: column.align ?? "Left" }),
                        dataTableCellWrapClass(column),
                      )}
                    >
                      {column.footer}
                    </TableCell>
                  ))}
                  {hasActionsColumn ? (
                    <TableCell data-pin="end" className={dataTablePinClass("end", "cell")} />
                  ) : null}
                </TableRow>
              ) : null}
              {detailFooterColumns.length > 0 ? (
                <DataTableFooterDetail
                  className={DATA_TABLE_FOOTER_ROW}
                  colSpan={Math.max(1, columnCount)}
                  inset={inset}
                  items={getDetailItems(detailFooterColumns, (column) => column.footer)}
                />
              ) : null}
            </TableFooter>
          ) : null}
        </Table>

        {paginated ? (
          <DataTablePagination
            density={density}
            // Named after the table: several tables on a page would otherwise each expose an
            // identical "Table pagination" landmark and a screen reader could not tell them apart.
            aria-label={paginationLabel}
            className={inset ? "px-6" : undefined}
            page={pagination.page}
            pageCount={pagination.pageCount}
            pageSize={pagination.pageSize}
            pageSizeOptions={pageSizeOptions}
            total={total}
            rangeStart={pagination.rangeStart}
            rangeEnd={pagination.rangeEnd}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * `React.forwardRef` erases the generic parameter, so the component is cast once through this
 * callable interface to keep row-type inference at the call site. Keep the cast in this one place.
 */
export interface DataTableComponent {
  <TRow>(
    props: DataTableProps<TRow> & { ref?: React.Ref<HTMLTableElement> },
  ): React.ReactElement | null;
  displayName?: string;
}

const DataTable = React.forwardRef(DataTableInner) as DataTableComponent;
DataTable.displayName = "DataTable";

export { DataTable };
