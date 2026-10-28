import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "@storybook/test";
import { Download, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
  type DataTableRowActionEvent,
  estimateActionsColumnWidth,
} from "@/components/ui/data-table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { DensityProvider } from "@/contexts/density-context";
import { Densities } from "@/types/density";

const meta: Meta = {
  title: "UI/DataTable",
};

export default meta;

interface Deployment {
  id: string;
  service: string;
  environment: string;
  status: "Healthy" | "Degraded" | "Failed";
  requests: number;
  owner: string;
}

const services = [
  "auth-api",
  "billing-api",
  "search-api",
  "notifier",
  "scheduler",
  "gateway",
  "reporting",
  "webhooks",
];
const environments = ["production", "staging", "preview"];
const statuses: Deployment["status"][] = ["Healthy", "Degraded", "Failed"];
const owners = ["Platform", "Payments", "Growth", "Data"];

const deployments: Deployment[] = Array.from({ length: 40 }, (_, index) => ({
  id: `d${index + 1}`,
  service: `${services[index % services.length]}-${index + 1}`,
  environment: environments[index % environments.length],
  status: statuses[index % statuses.length],
  requests: (index + 1) * 137 + (index % 7) * 29,
  owner: owners[index % owners.length],
}));

const statusVariant: Record<Deployment["status"], "success" | "warning" | "destructive"> = {
  Healthy: "success",
  Degraded: "warning",
  Failed: "destructive",
};

const rowActions: DataTableRowAction<Deployment>[] = [
  { tag: "edit", label: "Edit owner", icon: <Pencil aria-hidden="true" />, tooltip: "Edit owner" },
  {
    tag: "more",
    label: "More actions",
    icon: <MoreHorizontal aria-hidden="true" />,
    children: [
      { tag: "redeploy", label: "Redeploy" },
      { tag: "logs", label: "View logs" },
      { tag: "sep", label: "—", variant: "separator" },
      { tag: "delete", label: "Delete", variant: "destructive" },
    ],
  },
];

const FullFeaturedDemo = () => {
  // The table never mutates its rows: committed edits are applied here and passed back in.
  const [rows, setRows] = React.useState(deployments);
  const [filter, setFilter] = React.useState("");
  const [lastAction, setLastAction] = React.useState<string>("none");

  const columns: DataTableColumn<Deployment>[] = [
    { name: "service", header: "Service", width: "200px" },
    { name: "environment", header: "Environment", help: "Deployment target" },
    {
      name: "status",
      header: "Status",
      cell: (value) => (
        <Badge variant={statusVariant[value as Deployment["status"]]}>
          {value as Deployment["status"]}
        </Badge>
      ),
    },
    {
      name: "requests",
      header: "Requests",
      align: "Right",
      cell: (value) => (value as number).toLocaleString(),
      footer: rows.reduce((total, row) => total + row.requests, 0).toLocaleString(),
    },
    { name: "owner", header: "Owner", editable: true, help: "Double-click to edit" },
  ];

  const needle = filter.trim().toLowerCase();
  const visibleRows = needle
    ? rows.filter((row) => row.service.toLowerCase().includes(needle))
    : rows;

  return (
    <div className="flex w-[900px] flex-col gap-2">
      <DataTable
        columns={columns}
        rows={visibleRows}
        getRowId={(row) => row.id}
        caption="Recent deployments"
        selectable
        editable
        showColumnOptions
        defaultPageSize={10}
        rowActions={rowActions}
        onRowAction={({ tag, id }) => setLastAction(`${tag} on ${id}`)}
        onCellCommit={({ id, value }) => {
          setRows((current) =>
            current.map((row) => (row.id === id ? { ...row, owner: value } : row)),
          );
        }}
        toolbar={{
          left: (
            <Input
              aria-label="Filter services"
              className="w-64"
              placeholder="Filter services..."
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          ),
        }}
      />
      <p className="text-sm text-muted-foreground">Last row action: {lastAction}</p>
    </div>
  );
};

export const FullFeatured: StoryObj = {
  render: () => <FullFeaturedDemo />,
};

const simpleColumns: DataTableColumn<Deployment>[] = [
  { name: "service", header: "Service" },
  { name: "environment", header: "Environment" },
  { name: "requests", header: "Requests", align: "Right" },
];

export const Empty: StoryObj = {
  render: () => (
    <div className="w-[700px]">
      <DataTable columns={simpleColumns} rows={[]} getRowId={(row) => row.id} />
    </div>
  ),
};

export const Loading: StoryObj = {
  render: () => (
    <div className="w-[700px]">
      <DataTable
        columns={simpleColumns}
        rows={deployments.slice(0, 5)}
        getRowId={(row) => row.id}
        loading
      />
    </div>
  ),
};

const manyDeployments: Deployment[] = Array.from({ length: 1000 }, (_, index) => ({
  id: `v${index + 1}`,
  service: `${services[index % services.length]}-${index + 1}`,
  environment: environments[index % environments.length],
  status: statuses[index % statuses.length],
  requests: (index + 1) * 137 + (index % 7) * 29,
  owner: owners[index % owners.length],
}));

const virtualizedColumns: DataTableColumn<Deployment>[] = [
  { name: "service", header: "Service", width: "220px" },
  { name: "environment", header: "Environment" },
  {
    name: "status",
    header: "Status",
    cell: (value) => (
      <Badge variant={statusVariant[value as Deployment["status"]]}>
        {value as Deployment["status"]}
      </Badge>
    ),
  },
  { name: "requests", header: "Requests", align: "Right" },
  { name: "owner", header: "Owner" },
];

/**
 * 1,000 unpaginated rows. `virtualized="auto"` engages past the 50-row threshold, so only the visible
 * slice plus overscan is in the DOM while the scrollbar and `aria-rowcount` still report all 1,000.
 * Sorting, selection, roving row focus and the sticky header keep working through the window.
 */
export const Virtualized: StoryObj = {
  render: () => (
    <div className="w-[900px]">
      <DataTable
        columns={virtualizedColumns}
        rows={manyDeployments}
        getRowId={(row) => row.id}
        caption="1,000 deployments, windowed"
        paginated={false}
        selectable
        rowActions={rowActions}
      />
    </div>
  ),
};

interface Posting {
  id: string;
  date: string;
  description: string;
  amount: string;
}

const postings: Posting[] = Array.from({ length: 8 }, (_, index) => ({
  id: `p${index + 1}`,
  date: `2026-10-${String(23 - index).padStart(2, "0")}`,
  description: [
    "Consulting, October — Kvarnby Elektriska AB",
    "Office rent, Q4",
    "Cloud hosting and bandwidth, September",
    "Travel: Stockholm–Göteborg, train",
    "Software subscriptions",
    "Accounting services",
    "Insurance, annual premium",
    "Team lunch",
  ][index],
  amount: `${(4025 - index * 311.5).toFixed(2)} SEK`,
}));

const postingColumns: DataTableColumn<Posting>[] = [
  { name: "date", header: "Date", accessor: (row) => row.date, nowrap: true },
  {
    name: "description",
    header: "Description",
    accessor: (row) => row.description,
    wrapText: true,
  },
  // Right-aligned columns are nowrap without being asked.
  { name: "amount", header: "Amount", accessor: (row) => row.amount, align: "Right" },
];

/** A half-width card: dates and amounts stay whole while the description wraps. */
export const NarrowCard: StoryObj = {
  render: () => (
    <div className="w-[26rem] rounded-box border border-border p-3">
      <h3 className="mb-2 text-sm font-semibold">Latest postings</h3>
      <DataTable columns={postingColumns} rows={postings} getRowId={(row) => row.id} />
    </div>
  ),
};

const manyPostings: Posting[] = Array.from({ length: 40 }, (_, index) => ({
  ...postings[index % postings.length],
  id: `m${index + 1}`,
}));

/**
 * A page size of 15 is not in the default 10/25/50/100 options. The select lists it and shows it
 * selected, and "Showing 1–15 of 40" agrees. The footer is narrow here too: a count and the page-size
 * select share a row, with the buttons centred underneath.
 */
export const PageSizeOutsideOptions: StoryObj = {
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      <div className="w-[26rem]">
        <DataTable
          columns={postingColumns}
          rows={manyPostings}
          getRowId={(row) => row.id}
          caption="Postings, narrow"
          defaultPageSize={15}
        />
      </div>
      <div className="w-[48rem] max-w-full">
        <DataTable
          columns={postingColumns}
          rows={manyPostings}
          getRowId={(row) => row.id}
          caption="Postings, wide"
          defaultPageSize={15}
        />
      </div>
    </div>
  ),
};

/** Everything fits on one page: no first/previous/next/last buttons and no "Page 1 of 1". */
export const SinglePage: StoryObj = {
  render: () => (
    <div className="w-[40rem] max-w-full">
      <DataTable columns={postingColumns} rows={postings} getRowId={(row) => row.id} />
    </div>
  ),
};

/** The caption is announced by screen readers but not drawn; `showCaption` draws it above the table. */
export const Captions: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="w-[40rem] max-w-full">
        <DataTable
          columns={postingColumns}
          rows={postings.slice(0, 3)}
          getRowId={(row) => row.id}
          caption="Postings, hidden caption (screen readers only)"
        />
      </div>
      <div className="w-[40rem] max-w-full">
        <DataTable
          columns={postingColumns}
          rows={postings.slice(0, 3)}
          getRowId={(row) => row.id}
          caption="Postings, visible caption"
          showCaption
        />
      </div>
    </div>
  ),
};

interface TimeEntry {
  id: string;
  date: string;
  start: string;
  end: string;
  hours: number;
  amount: number;
  project: string;
  activity: string;
  message: string;
}

const timeProjects = ["Kvarnby Elektriska AB", "Internal", "Nordlys Consulting", "Open Accounting"];
const timeActivities = ["meeting", "building", "strategizing", "support"];
const timeMessages = [
  "Sprint planning and backlog refinement with the product team",
  "Reviewed invoice export and corrected VAT codes on three vouchers",
  "Standup",
  "Customer workshop: onboarding flow, pricing page and trial limits",
  "Fix bug in the payroll report rounding for part-time employees",
  "Write docs",
  "Quarterly VAT filing preparation and reconciliation of the bank statements",
  "1:1",
];

const timeEntries: TimeEntry[] = Array.from({ length: 27 }, (_, index) => ({
  id: `t${index + 1}`,
  date: `2026-10-${String(24 - (index % 20)).padStart(2, "0")}`,
  start: "09:00",
  end: `10:${String(15 + (index % 4) * 10)}`,
  hours: 1.25 + (index % 5) * 0.5,
  amount: 1250 + index * 125.5,
  project: timeProjects[index % timeProjects.length],
  activity: timeActivities[index % timeActivities.length],
  message: timeMessages[index % timeMessages.length],
}));

const money = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NBSP = "\u00a0";

const timeColumns: DataTableColumn<TimeEntry>[] = [
  { name: "date", header: "Date", width: "120px", nowrap: true, footer: "Total" },
  { name: "start", header: "Start", width: "80px" },
  { name: "end", header: "End", width: "80px" },
  {
    name: "hours",
    header: "Hours",
    align: "Right",
    cell: (value) => `${money.format(value as number)}${NBSP}h`,
    footer: `${money.format(timeEntries.reduce((sum, entry) => sum + entry.hours, 0))}${NBSP}h`,
  },
  {
    name: "amount",
    header: "Amount",
    align: "Right",
    cell: (value) => `${money.format(value as number)}${NBSP}kr`,
  },
  { name: "project", header: "Project" },
  {
    name: "activity",
    header: "Activity",
    cell: (value) => <Badge variant="secondary">{value as string}</Badge>,
  },
  { name: "message", header: "Message" },
];

const timeRowActions: DataTableRowAction<TimeEntry>[] = [
  { tag: "edit", label: "Edit entry", icon: <Pencil aria-hidden="true" />, tooltip: "Edit entry" },
];

function TimeEntriesTable({ selectable = false }: { selectable?: boolean }) {
  return (
    <DataTable
      columns={timeColumns}
      rows={timeEntries}
      getRowId={(entry) => entry.id}
      caption="Time entries"
      selectable={selectable}
      rowActions={timeRowActions}
      defaultPageSize={25}
    />
  );
}

interface TimeCardArgs {
  /** Any CSS width; the card is `max-w-full` so it never outgrows the story canvas. */
  width: string;
  selectable: boolean;
  /** Edge-to-edge table in the card (`CardContent flush`) instead of inside the card padding. */
  flush: boolean;
}

function TimeEntriesCard({ width, selectable, flush }: TimeCardArgs) {
  return (
    <Card className="max-w-full" style={{ width }}>
      <CardHeader>
        <CardTitle>Entries</CardTitle>
        <CardDescription>Time tracked this month.</CardDescription>
      </CardHeader>
      <CardContent flush={flush}>
        <TimeEntriesTable selectable={selectable} />
      </CardContent>
    </Card>
  );
}

/** Looks up an element the checks below depend on, failing with its selector rather than a null. */
function pick<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Expected an element matching ${selector}`);
  return element;
}

/** Two frames: the table corrects an obscured focus on the next one, before it is painted. */
const nextFrames = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

/**
 * The focused control is what a person sees at its own centre: a pinned column or the sticky header
 * that lay over it would be what `elementFromPoint` finds instead (WCAG 2.4.11, focus not obscured).
 */
async function expectFocusNotObscured(element: Element | null) {
  await nextFrames();
  if (!(element instanceof HTMLElement)) return;
  const box = element.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  await expect(hit !== null && element.contains(hit)).toBe(true);
}

/**
 * Layout checks that need a real browser (jsdom lays nothing out): the table adds no border of its
 * own inside the card, stays inside the card, scrolls internally with the edit button reachable at
 * both ends, truncates long text, and shows an outline on a focused row.
 */
async function expectTableFitsCard(canvasElement: HTMLElement) {
  await document.fonts.ready;
  const card = pick<HTMLElement>(canvasElement, "[data-slot='card']");
  const surface = pick<HTMLElement>(canvasElement, "[data-slot='data-table-surface']");
  const scroller = pick<HTMLElement>(canvasElement, "[data-slot='table-container']");

  // No second frame: only the divider on top may remain, and nothing is rounded.
  const frame = getComputedStyle(surface);
  await expect(parseFloat(frame.borderLeftWidth)).toBe(0);
  await expect(parseFloat(frame.borderRightWidth)).toBe(0);
  await expect(parseFloat(frame.borderBottomWidth)).toBe(0);
  await expect(parseFloat(frame.borderTopLeftRadius)).toBe(0);

  const cardBox = card.getBoundingClientRect();
  await expect(scroller.getBoundingClientRect().right).toBeLessThanOrEqual(cardBox.right + 0.5);

  const edit = pick<HTMLElement>(scroller, "tbody tr button[aria-label='Edit entry']");
  const insideScroller = () => {
    const button = edit.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    return button.left >= box.left - 0.5 && button.right <= box.right + 0.5;
  };
  scroller.scrollLeft = 0;
  await expect(insideScroller()).toBe(true);
  scroller.scrollLeft = scroller.scrollWidth;
  await expect(insideScroller()).toBe(true);
  scroller.scrollLeft = 0;

  const truncated = Array.from(scroller.querySelectorAll<HTMLElement>("tbody td.text-ellipsis"));
  await expect(truncated.some((cell) => cell.scrollWidth > cell.clientWidth)).toBe(true);

  // Roving focus gives the body a single row tab stop; its outline must actually paint. Every stop on
  // the way there is a header sort button, and none may be left under a pinned column.
  let focused: Element | null = null;
  for (let step = 0; step < 40 && focused?.tagName !== "TR"; step++) {
    await userEvent.tab();
    focused = document.activeElement;
    await expectFocusNotObscured(focused);
  }
  await expect(focused?.tagName).toBe("TR");
  const outline = getComputedStyle(focused as Element);
  await expect(outline.outlineStyle).not.toBe("none");
  await expect(parseFloat(outline.outlineWidth)).toBeGreaterThanOrEqual(2);

  (focused as HTMLElement).blur();
}

const timeCardArgs: TimeCardArgs = { width: "56rem", selectable: false, flush: true };

// Seeded dates, and visual baselines are produced in a Linux container, so these stories have none yet.
const noVisualBaseline = { visual: { disable: true } };

const timeCardStory = {
  args: timeCardArgs,
  argTypes: { width: { control: "text" } },
  render: (args: TimeCardArgs) => <TimeEntriesCard {...args} />,
} satisfies StoryObj<TimeCardArgs>;

/**
 * A table in a card. `CardContent flush` lets it run edge to edge so the card's own border is its
 * frame: no second rounded box. Wide content scrolls inside the table, with the edit column pinned.
 */
export const InsideCard: StoryObj<TimeCardArgs> = {
  ...timeCardStory,
  parameters: noVisualBaseline,
  play: async ({ canvasElement }) => expectTableFitsCard(canvasElement),
};

/** Narrower than the table can ever be, with a selection column: both pinned columns in play. */
export const InsideCardNarrow: StoryObj<TimeCardArgs> = {
  ...timeCardStory,
  args: { ...timeCardArgs, width: "22rem", selectable: true },
  parameters: noVisualBaseline,
  play: async ({ canvasElement }) => expectTableFitsCard(canvasElement),
};

/** The default padded `CardContent`: the table still draws no border of its own, inside the padding. */
export const InsideCardPadded: StoryObj<TimeCardArgs> = {
  ...timeCardStory,
  args: { ...timeCardArgs, flush: false },
  parameters: noVisualBaseline,
};

/** Pins the dark tokens on a subtree, whatever the toolbar theme is. */
function Dark({ children }: { children: React.ReactNode }) {
  return <div className="dark bg-background p-6 text-foreground">{children}</div>;
}

export const InsideCardDark: StoryObj<TimeCardArgs> = {
  ...timeCardStory,
  parameters: noVisualBaseline,
  render: (args) => (
    <Dark>
      <TimeEntriesCard {...args} />
    </Dark>
  ),
  play: async ({ canvasElement }) => expectTableFitsCard(canvasElement),
};

export const InsideCardNarrowDark: StoryObj<TimeCardArgs> = {
  ...timeCardStory,
  args: { ...timeCardArgs, width: "22rem", selectable: true },
  parameters: noVisualBaseline,
  render: (args) => (
    <Dark>
      <TimeEntriesCard {...args} />
    </Dark>
  ),
  play: async ({ canvasElement }) => expectTableFitsCard(canvasElement),
};

/**
 * Two cards sharing a row. `Card` can shrink below its content, so the wide table scrolls inside its
 * card instead of stretching it and squeezing its neighbour.
 */
export const InsideCardFlexRow: StoryObj = {
  parameters: noVisualBaseline,
  render: () => (
    <div className="flex w-[56rem] max-w-full gap-4" data-testid="row">
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent flush>
          <TimeEntriesTable />
        </CardContent>
      </Card>
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>Stays as wide as its track.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Total tracked: 25,50 h</p>
        </CardContent>
      </Card>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await document.fonts.ready;
    const row = pick<HTMLElement>(canvasElement, "[data-testid='row']");
    const cards = Array.from(canvasElement.querySelectorAll<HTMLElement>("[data-slot='card']"));
    await expect(cards).toHaveLength(2);
    const [first, second] = cards.map((card) => card.getBoundingClientRect());
    await expect(first.right).toBeLessThanOrEqual(row.getBoundingClientRect().right + 0.5);
    await expect(Math.abs(first.width - second.width)).toBeLessThan(2);
  },
};

/** No card around it: the default `bordered` variant draws its own box. */
export const Bordered: StoryObj = {
  parameters: noVisualBaseline,
  render: () => (
    <div className="w-[56rem] max-w-full">
      <TimeEntriesTable />
    </div>
  ),
};

/** `variant="embedded"` for a host that already has a frame; here a dashed one stands in for it. */
export const Embedded: StoryObj = {
  parameters: noVisualBaseline,
  render: () => (
    <div className="w-[56rem] max-w-full rounded-box border border-dashed border-border p-3">
      <DataTable
        variant="embedded"
        columns={timeColumns}
        rows={timeEntries}
        getRowId={(entry) => entry.id}
        caption="Time entries"
        showCaption
        rowActions={timeRowActions}
        defaultPageSize={10}
      />
    </div>
  ),
};

const ClickableRows = () => {
  const [opened, setOpened] = React.useState("nothing yet");
  return (
    <div className="flex w-[40rem] max-w-full flex-col gap-3">
      <DataTable
        columns={postingColumns}
        rows={postings}
        getRowId={(row) => row.id}
        caption="Postings, rows open on click, Enter or Space"
        showCaption
        onRowClick={(row, id) => setOpened(`${id}: ${row.description}`)}
      />
      <p className="text-sm text-muted-foreground" data-testid="opened">
        Opened: {opened}
      </p>
    </div>
  );
};

/**
 * `onRowClick` rows open on a click and from the keyboard: Tab into the table, arrow to a row, then
 * Enter or Space. Buttons, links and the checkbox inside a row never trigger it.
 */
export const RowClick: StoryObj = {
  parameters: noVisualBaseline,
  render: () => <ClickableRows />,
  play: async ({ canvasElement }) => {
    const status = pick<HTMLElement>(canvasElement, "[data-testid='opened']");
    let focused: Element | null = null;
    for (let step = 0; step < 20 && focused?.tagName !== "TR"; step++) {
      await userEvent.tab();
      focused = document.activeElement;
    }
    await expect(focused?.tagName).toBe("TR");

    await userEvent.keyboard("{Enter}");
    await expect(status.textContent).toContain("p1:");

    await userEvent.keyboard("{ArrowDown}{ }");
    await expect(status.textContent).toContain("p2:");

    (document.activeElement as HTMLElement | null)?.blur();
  },
};

interface Voucher {
  id: string;
  account: string;
  debit: string;
  credit: string;
}

const voucherLines: Voucher[] = [
  { id: "l1", account: "1930 Företagskonto", debit: "", credit: "1 250,00" },
  { id: "l2", account: "2641 Ingående moms", debit: "250,00", credit: "" },
  { id: "l3", account: "5410 Förbrukningsinventarier", debit: "1 000,00", credit: "" },
];

const voucherColumns: DataTableColumn<Voucher>[] = [
  { name: "account", header: "Account", editable: true },
  { name: "debit", header: "Debit", align: "Right" },
  { name: "credit", header: "Credit", align: "Right" },
];

/**
 * A dialog opened from inside `CardContent`. React context crosses the portal, so a table in the
 * dialog used to believe it sat on the card and dropped its own border; the overlay content now cuts
 * the link, and the voucher lines keep their frame. The table on the card behind it stays embedded.
 * The lines are editable too: Escape cancels the edit in progress and leaves the dialog open, and
 * only the next Escape closes it.
 */
export const DialogOpenedFromCard: StoryObj = {
  parameters: {
    // A portaled, animated overlay: the dialog is not in the canvas the baseline is taken from.
    visual: { disable: true },
  },
  render: () => (
    <Card className="w-[36rem] max-w-full">
      <CardHeader>
        <CardTitle>Vouchers</CardTitle>
        <CardDescription>Open one to see its lines.</CardDescription>
      </CardHeader>
      <CardContent flush>
        <DataTable
          columns={voucherColumns}
          rows={voucherLines}
          getRowId={(row) => row.id}
          caption="Vouchers"
          paginated={false}
        />
      </CardContent>
      <CardContent>
        <Dialog defaultOpen>
          <DialogTrigger asChild>
            <Button variant="outline">Show lines</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Voucher lines</DialogTitle>
              <DialogDescription>Debit and credit per account.</DialogDescription>
            </DialogHeader>
            <DialogBody data-testid="lines">
              <DataTable
                columns={voucherColumns}
                rows={voucherLines}
                getRowId={(row) => row.id}
                caption="Voucher lines"
                paginated={false}
                editable
              />
            </DialogBody>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const onCard = pick<HTMLElement>(canvasElement, "[data-slot='data-table']");
    await expect(onCard.dataset.variant).toBe("embedded");

    await waitFor(() => expect(document.querySelector("[data-testid='lines']")).not.toBeNull());
    const inDialog = pick<HTMLElement>(
      document.body,
      "[data-testid='lines'] [data-slot='data-table']",
    );
    await expect(inDialog.dataset.variant).toBe("bordered");
    const surface = pick<HTMLElement>(inDialog, "[data-slot='data-table-surface']");
    await expect(parseFloat(getComputedStyle(surface).borderTopWidth)).toBe(1);
  },
};

const RemovableRowsDemo = () => {
  const [rows, setRows] = React.useState(() => deployments.slice(0, 6));
  const removable: DataTableRowAction<Deployment>[] = [
    { tag: "ignore", label: "Ignore", tooltip: "Ignore this deployment" },
    {
      tag: "more",
      label: "More actions",
      icon: <MoreHorizontal aria-hidden="true" />,
      children: [{ tag: "delete", label: "Delete", variant: "destructive" }],
    },
  ];
  return (
    <div className="w-[48rem] max-w-full">
      <DataTable
        columns={simpleColumns}
        rows={rows}
        getRowId={(row) => row.id}
        caption="Deployments, rows go away when acted on"
        paginated={false}
        rowActions={removable}
        onRowAction={({ id }) => setRows((current) => current.filter((row) => row.id !== id))}
      />
    </div>
  );
};

/**
 * An action that removes its own row. The button that had focus goes with the row, so focus moves to
 * the row now in its place instead of falling to the top of the page. Tab to a row's Ignore button
 * and press Enter.
 */
export const RemovableRows: StoryObj = {
  parameters: noVisualBaseline,
  render: () => <RemovableRowsDemo />,
  play: async ({ canvasElement }) => {
    const ignore = Array.from(
      canvasElement.querySelectorAll<HTMLElement>("button[aria-label='Ignore']"),
    )[1];
    ignore.focus();
    const removed = ignore.closest("tr")!.dataset.rowId;
    await userEvent.keyboard("{Enter}");

    await waitFor(() =>
      expect(canvasElement.querySelector(`tr[data-row-id='${removed}']`)).toBeNull(),
    );
    await waitFor(() => expect(document.activeElement?.tagName).toBe("TR"));
    await expect(canvasElement.contains(document.activeElement)).toBe(true);

    (document.activeElement as HTMLElement | null)?.blur();
  },
};

// ---------------------------------------------------------------------------------------------
// Columns that give way to the container: `hideBelow`, `priority`, and the row details.
// ---------------------------------------------------------------------------------------------

/** The headers of the data columns, in order: the pinned selection/details and action cells left out. */
function dataHeaders(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>("thead th:not([data-pin])")).map(
    (th) => th.textContent?.trim() ?? "",
  );
}

function detailButtons(root: ParentNode): HTMLButtonElement[] {
  return Array.from(
    root.querySelectorAll<HTMLButtonElement>("button[aria-label^='Show details for']"),
  );
}

/**
 * Wide, medium and narrow, as `hideBelow` and `priority` see them: the width of the table's own box.
 * `FrameScroller` holds a frame at its width whatever the canvas, so the play functions can name the
 * columns each one shows.
 */
const FRAME_WIDTHS = { wide: 1040, medium: 680, narrow: 380 } as const;
const FRAME_NAMES = { wide: "Wide", medium: "Medium", narrow: "Narrow" } as const;

/**
 * Where each time column gives way. Date and Hours never do. The widths are of the table's container,
 * not the window: the same table in a narrow card behaves as it does at the foot of a phone.
 */
const hideBelowByColumn: Record<string, number> = {
  start: 600,
  end: 600,
  amount: 460,
  project: 780,
  activity: 900,
  message: 1000,
};

const responsiveTimeColumns: DataTableColumn<TimeEntry>[] = timeColumns.map((column) => ({
  ...column,
  hideBelow: hideBelowByColumn[column.name],
}));

/**
 * The same ranking without naming a width. 1 is the first to keep; the table drops the highest number
 * until what is left fits, judging each column by its `width` (so these say what they need).
 */
const priorityTimeColumns: DataTableColumn<TimeEntry>[] = timeColumns.map((column) => {
  const ranked: Record<string, { priority: number; width?: string }> = {
    date: { priority: 1, width: "100px" },
    hours: { priority: 2, width: "84px" },
    amount: { priority: 3, width: "104px" },
    start: { priority: 4, width: "64px" },
    end: { priority: 4, width: "64px" },
    project: { priority: 5, width: "130px" },
    activity: { priority: 6, width: "92px" },
    message: { priority: 7, width: "200px" },
  };
  return { ...column, ...ranked[column.name] };
});

/**
 * A raised cap on the truncating columns' width, so the full set of columns is about as wide as the
 * widest frame instead of 20rem of message text pushing it past.
 */
const compactTruncation = "[--ivy-data-table-truncate-width:14rem]";

interface FrameProps {
  label: string;
  width: number;
  columns: DataTableColumn<TimeEntry>[];
  selectable?: boolean;
  showColumnOptions?: boolean;
  defaultColumnVisibility?: Record<string, boolean>;
}

/**
 * Holds a frame at exactly the width it is named for. A frame squeezed to fit the canvas (`max-w-full`)
 * would be measured at the squeezed width and show the columns of a narrower table than its label
 * says, and what a story asserts would then depend on how wide the iframe happens to be. A canvas
 * narrower than the frame scrolls it sideways here, inside the story: the page does not overflow, and
 * the scroll area is a named tab stop for as long as it does.
 */
function FrameScroller({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <ScrollArea aria-label={`${label} frame`}>
      <div className="pb-3">{children}</div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

function TimeFrame({
  label,
  width,
  columns,
  selectable = false,
  showColumnOptions = false,
  defaultColumnVisibility,
}: FrameProps) {
  return (
    <section data-testid={label} style={{ width }}>
      <h3 className="mb-2 text-sm font-medium">
        {label}, {width}px
      </h3>
      <DataTable
        className={compactTruncation}
        columns={columns}
        rows={timeEntries.slice(0, 4)}
        getRowId={(entry) => entry.id}
        getRowLabel={(entry) => `${entry.date} ${entry.project}`}
        caption={`Time entries, ${label.toLowerCase()}`}
        paginated={false}
        selectable={selectable}
        showColumnOptions={showColumnOptions}
        defaultColumnVisibility={defaultColumnVisibility}
        rowActions={timeRowActions}
      />
    </section>
  );
}

function WidthShowcase({ columns }: { columns: DataTableColumn<TimeEntry>[] }) {
  return (
    <div className="flex flex-col gap-8">
      {(["wide", "medium", "narrow"] as const).map((size) => (
        <FrameScroller key={size} label={FRAME_NAMES[size]}>
          <TimeFrame label={FRAME_NAMES[size]} width={FRAME_WIDTHS[size]} columns={columns} />
        </FrameScroller>
      ))}
    </div>
  );
}

const ALL_TIME_HEADERS = [
  "Date",
  "Start",
  "End",
  "Hours",
  "Amount",
  "Project",
  "Activity",
  "Message",
];

/** `hideBelow` measured against what the table's own box allows, with nothing left to scroll. */
async function expectFramesRespond(canvasElement: HTMLElement) {
  await document.fonts.ready;
  const frame = (name: string) => pick<HTMLElement>(canvasElement, `[data-testid='${name}']`);

  await expect(dataHeaders(frame("Wide"))).toEqual(ALL_TIME_HEADERS);
  await expect(dataHeaders(frame("Medium"))).toEqual(["Date", "Start", "End", "Hours", "Amount"]);
  await expect(dataHeaders(frame("Narrow"))).toEqual(["Date", "Hours"]);

  // A details button in every row, but only where something is hidden.
  await expect(detailButtons(frame("Wide"))).toHaveLength(0);
  await expect(detailButtons(frame("Medium"))).toHaveLength(4);
  await expect(detailButtons(frame("Narrow"))).toHaveLength(4);

  // The point of it: nothing scrolls sideways at any of the three widths.
  for (const name of ["Wide", "Medium", "Narrow"]) {
    const scroller = pick<HTMLElement>(frame(name), "[data-slot='table-container']");
    await expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth + 1);
  }
}

/**
 * One table, three container widths. Under `hideBelow` a column gives way when its container is
 * narrower than the number, so the narrow frame keeps Date and Hours and the rest move into the row
 * details (the chevron in each row), where the wide one shows everything and has no button at all.
 * The frames keep their stated widths on any canvas: where the canvas is narrower, the frame scrolls
 * sideways inside the story instead of being squeezed into showing different columns.
 */
export const ResponsiveColumns: StoryObj = {
  parameters: noVisualBaseline,
  render: () => <WidthShowcase columns={responsiveTimeColumns} />,
  play: async ({ canvasElement }) => expectFramesRespond(canvasElement),
};

const assertDarkTheme = async () => {
  await expect(document.documentElement.classList.contains("dark")).toBe(true);
};

/** The same in the dark theme, a story-level global because Storybook ignores `parameters.globals`. */
export const ResponsiveColumnsDark: StoryObj = {
  globals: { theme: "dark" },
  parameters: noVisualBaseline,
  render: () => <WidthShowcase columns={responsiveTimeColumns} />,
  play: async ({ canvasElement }) => {
    await assertDarkTheme();
    await expectFramesRespond(canvasElement);
  },
};

/**
 * `priority` ranks the columns and leaves the widths to the table: it drops the least important ones
 * until what is left fits, so the same ranking gives a different set at each width.
 */
export const PriorityColumns: StoryObj = {
  parameters: noVisualBaseline,
  render: () => <WidthShowcase columns={priorityTimeColumns} />,
  play: async ({ canvasElement }) => {
    await document.fonts.ready;
    const frame = (name: string) => pick<HTMLElement>(canvasElement, `[data-testid='${name}']`);
    await expect(dataHeaders(frame("Wide"))).toEqual(ALL_TIME_HEADERS);
    // Message, then Activity, are the least important and the first to go.
    await expect(dataHeaders(frame("Medium"))).toEqual([
      "Date",
      "Start",
      "End",
      "Hours",
      "Amount",
      "Project",
    ]);
    // Down to the two most important.
    await expect(dataHeaders(frame("Narrow"))).toEqual(["Date", "Hours"]);
    await expect(detailButtons(frame("Wide"))).toHaveLength(0);
    await expect(detailButtons(frame("Narrow"))).toHaveLength(4);
  },
};

function DetailTable({ selectable = true }: { selectable?: boolean }) {
  return (
    <div className="w-[22rem] max-w-full">
      <DataTable
        className={compactTruncation}
        columns={responsiveTimeColumns}
        rows={timeEntries.slice(0, 5)}
        getRowId={(entry) => entry.id}
        getRowLabel={(entry) => `${entry.date} ${entry.project}`}
        caption="Time entries, in a narrow panel"
        paginated={false}
        selectable={selectable}
        rowActions={timeRowActions}
      />
    </div>
  );
}

/** The detail panel of a row, or null while it is closed. */
function detailOf(root: ParentNode, rowId: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`tr[data-detail-for='${rowId}']`);
}

async function expectDetailOperable(canvasElement: HTMLElement) {
  await document.fonts.ready;
  const [first, second] = detailButtons(canvasElement);
  await expect(first.getAttribute("aria-expanded")).toBe("false");
  await expect(detailOf(canvasElement, "t1")).toBeNull();
  // Not in the document, so nothing for the button to point at.
  await expect(first.hasAttribute("aria-controls")).toBe(false);

  // Tab reaches it straight after the row's checkbox: the button is one stop per row, in reading order.
  const checkbox = pick<HTMLElement>(first.closest("td")!, "[role='checkbox']");
  checkbox.focus();
  await userEvent.tab();
  await expect(document.activeElement).toBe(first);

  // By keyboard: Enter opens, Space closes, and focus stays on the button throughout.
  await userEvent.keyboard("{Enter}");
  await expect(first.getAttribute("aria-expanded")).toBe("true");
  await expect(document.activeElement).toBe(first);
  const open = detailOf(canvasElement, "t1");
  await expect(open).not.toBeNull();
  await expect(first.getAttribute("aria-controls")).toBe(open!.querySelector("td")!.id);

  await userEvent.keyboard(" ");
  await expect(first.getAttribute("aria-expanded")).toBe("false");
  await expect(detailOf(canvasElement, "t1")).toBeNull();
  await expect(document.activeElement).toBe(first);

  // The panel lists exactly what the row lacks, formatted by each column's own renderer.
  await userEvent.click(first);
  const panel = pick<HTMLElement>(canvasElement, "tr[data-detail-for='t1']");
  const pairs = Array.from(panel.querySelectorAll("dt")).map((dt) => [
    dt.textContent,
    dt.nextElementSibling?.textContent,
  ]);
  // The formatted amount holds no-break spaces, whichever of them the browser's ICU data prefers.
  const plain = pairs.map(([label, value]) => [label, value?.replace(/\s/g, " ")]);
  await expect(plain).toEqual([
    ["Start", "09:00"],
    ["End", "10:15"],
    ["Amount", "1 250,00 kr"],
    ["Project", "Kvarnby Elektriska AB"],
    ["Activity", "meeting"],
    ["Message", "Sprint planning and backlog refinement with the product team"],
  ]);

  // More than one row can be open, and the roving focus of the table does not stop on the panel.
  await userEvent.click(second);
  await expect(detailOf(canvasElement, "t2")).not.toBeNull();
  await expect(canvasElement.querySelectorAll("tr[data-detail-for]")).toHaveLength(2);
}

/**
 * A narrow panel. Each row has a chevron that opens its details: the values of the columns the panel
 * had no room for, as "header: value", formatted like the row. Tab to a chevron and press Enter or
 * Space; the button keeps its name ("Show details for ...") and reports the state with
 * `aria-expanded`. Two rows are left open here.
 */
export const HideBelowDetail: StoryObj = {
  parameters: { ...noVisualBaseline, keyboard: { sweep: true, maxStops: 40 } },
  render: () => <DetailTable />,
  play: async ({ canvasElement }) => expectDetailOperable(canvasElement),
};

export const HideBelowDetailDark: StoryObj = {
  globals: { theme: "dark" },
  parameters: { ...noVisualBaseline, keyboard: { sweep: true, maxStops: 40 } },
  render: () => <DetailTable />,
  play: async ({ canvasElement }) => {
    await assertDarkTheme();
    await expectDetailOperable(canvasElement);
  },
};

function LiveResizeDemo() {
  const [width, setWidth] = React.useState<number>(FRAME_WIDTHS.wide);
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Table width" className="flex flex-wrap gap-2">
        {(Object.keys(FRAME_WIDTHS) as (keyof typeof FRAME_WIDTHS)[]).map((size) => (
          <Button
            key={size}
            type="button"
            size="sm"
            variant={FRAME_WIDTHS[size] === width ? "default" : "outline"}
            aria-pressed={FRAME_WIDTHS[size] === width}
            onClick={() => setWidth(FRAME_WIDTHS[size])}
          >
            {FRAME_NAMES[size]} ({FRAME_WIDTHS[size]}px)
          </Button>
        ))}
      </div>
      <FrameScroller label="Resizable">
        <div data-testid="frame" style={{ width }}>
          <DataTable
            className={compactTruncation}
            columns={responsiveTimeColumns}
            rows={timeEntries.slice(0, 4)}
            getRowId={(entry) => entry.id}
            getRowLabel={(entry) => `${entry.date} ${entry.project}`}
            caption="Time entries, resizable"
            paginated={false}
            rowActions={timeRowActions}
          />
        </div>
      </FrameScroller>
    </div>
  );
}

/**
 * The container, not the window, is what is measured, and it is measured as it changes. The buttons
 * resize the box the table sits in; the play function changes the box behind React's back, the way a
 * collapsing sidebar does, to check that the table follows and that keyboard focus stays put while
 * columns come and go.
 */
export const ResizesLive: StoryObj = {
  parameters: noVisualBaseline,
  render: () => <LiveResizeDemo />,
  play: async ({ canvasElement }) => {
    await document.fonts.ready;
    const frame = pick<HTMLElement>(canvasElement, "[data-testid='frame']");
    const table = pick<HTMLElement>(canvasElement, "[data-slot='data-table']");
    const resizeTo = (px: number) => {
      frame.style.width = `${px}px`;
    };

    await expect(dataHeaders(table)).toEqual(ALL_TIME_HEADERS);

    // A header's sort button keeps focus while columns beside it disappear and return.
    const sortHours = pick<HTMLButtonElement>(table, "button[aria-label^='Sort by Hours']");
    sortHours.focus();
    resizeTo(FRAME_WIDTHS.narrow);
    await waitFor(() => expect(dataHeaders(table)).toEqual(["Date", "Hours"]));
    await expect(document.activeElement).toBe(sortHours);
    resizeTo(FRAME_WIDTHS.wide);
    await waitFor(() => expect(dataHeaders(table)).toEqual(ALL_TIME_HEADERS));
    await expect(document.activeElement).toBe(sortHours);

    // A focused row stays focused too.
    const row = pick<HTMLElement>(table, "tr[data-row-id='t3']");
    row.focus();
    resizeTo(FRAME_WIDTHS.medium);
    await waitFor(() =>
      expect(dataHeaders(table)).toEqual(["Date", "Start", "End", "Hours", "Amount"]),
    );
    await expect(document.activeElement).toBe(row);

    // The details button goes when the last hidden column returns; focus goes to its row.
    resizeTo(FRAME_WIDTHS.narrow);
    await waitFor(() => expect(detailButtons(table)).toHaveLength(4));
    detailButtons(table)[2].focus();
    resizeTo(FRAME_WIDTHS.wide);
    await waitFor(() => expect(detailButtons(table)).toHaveLength(0));
    await waitFor(() => expect((document.activeElement as HTMLElement).dataset.rowId).toBe("t3"));

    // The buttons resize through React state; the table follows that the same way.
    const widthButton = (name: string) =>
      Array.from(canvasElement.querySelectorAll<HTMLElement>("button[aria-pressed]")).find(
        (button) => button.textContent?.startsWith(name),
      )!;
    await userEvent.click(widthButton("Medium"));
    await waitFor(() =>
      expect(dataHeaders(table)).toEqual(["Date", "Start", "End", "Hours", "Amount"]),
    );

    // Left narrow, with the third row open.
    await userEvent.click(widthButton("Narrow"));
    await waitFor(() => expect(dataHeaders(table)).toEqual(["Date", "Hours"]));
    await userEvent.click(detailButtons(table)[2]);
    await expect(detailOf(table, "t3")).not.toBeNull();
    (document.activeElement as HTMLElement | null)?.blur();
  },
};

/**
 * The column options still list every column. One the width has taken away stays ticked (the person
 * did not switch it off) and says where it went; Project, which was switched off, is unticked and
 * does not appear in any row's details.
 */
export const ColumnOptionsAtNarrowWidth: StoryObj = {
  parameters: noVisualBaseline,
  render: () => (
    <div className="w-[22rem] max-w-full">
      <DataTable
        className={compactTruncation}
        columns={responsiveTimeColumns}
        rows={timeEntries.slice(0, 3)}
        getRowId={(entry) => entry.id}
        getRowLabel={(entry) => `${entry.date} ${entry.project}`}
        caption="Time entries, with column options"
        paginated={false}
        showColumnOptions
        defaultColumnVisibility={{ project: false }}
        rowActions={timeRowActions}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await document.fonts.ready;
    await userEvent.click(pick<HTMLElement>(canvasElement, "button[aria-label='Column options']"));
    const menu = await waitFor(() => pick<HTMLElement>(document.body, "[role='dialog']"));

    await expect(menu.querySelectorAll("[role='checkbox']")).toHaveLength(8);
    // Each box sits on the middle of its label's line, with or without a note under the label. The
    // box's height follows the density and the label's line does not, so this is measured, not styled.
    for (const checkbox of Array.from(menu.querySelectorAll<HTMLElement>("[role='checkbox']"))) {
      const text = pick<HTMLElement>(menu, `label[for='${checkbox.id}']`).getBoundingClientRect();
      const box = checkbox.getBoundingClientRect();
      await expect(
        Math.abs(box.top + box.height / 2 - (text.top + text.height / 2)),
      ).toBeLessThanOrEqual(1);
    }
    const box = (name: string) => pick<HTMLElement>(menu, `[role='checkbox'][id$='-${name}']`);
    await expect(box("project").getAttribute("aria-checked")).toBe("false");
    await expect(box("project").hasAttribute("aria-describedby")).toBe(false);
    await expect(box("message").getAttribute("aria-checked")).toBe("true");
    const note = document.getElementById(box("message").getAttribute("aria-describedby") ?? "");
    await expect(note?.textContent).toContain("Hidden at this width");
    // A column the width does not touch carries no note.
    await expect(box("hours").hasAttribute("aria-describedby")).toBe(false);

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(document.querySelector("[role='dialog']")).toBeNull());

    // And the user-hidden column is not offered in the details.
    await userEvent.click(detailButtons(canvasElement)[0]);
    const labels = Array.from(
      pick<HTMLElement>(canvasElement, "tr[data-detail-for]").querySelectorAll("dt"),
    ).map((dt) => dt.textContent);
    await expect(labels).toEqual(["Start", "End", "Amount", "Activity", "Message"]);
  },
};

const virtualizedBelow: Record<string, number> = { environment: 520, status: 560, owner: 640 };
const virtualizedResponsiveColumns: DataTableColumn<Deployment>[] = virtualizedColumns.map(
  (column) => ({
    ...column,
    // Windowed tables lay out with fixed widths, so the one that stays shares the rest equally.
    width: undefined,
    hideBelow: virtualizedBelow[column.name],
  }),
);

/**
 * Windowed rows with details. The row and its details are one item as far as the window is
 * concerned, so opening one moves the rows below it by exactly its height and the scrollbar grows
 * with it; the last of the 1,000 rows is still reachable.
 */
export const HideBelowDetailVirtualized: StoryObj = {
  parameters: noVisualBaseline,
  render: () => (
    <div className="w-[22rem] max-w-full">
      <DataTable
        columns={virtualizedResponsiveColumns}
        rows={manyDeployments}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.service}
        caption="1,000 deployments, windowed, narrow"
        paginated={false}
        selectable
        rowActions={rowActions.slice(0, 1)}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await document.fonts.ready;
    const scroller = pick<HTMLElement>(canvasElement, "[data-slot='table-container']");
    await waitFor(() => expect(detailButtons(canvasElement).length).toBeGreaterThan(0));
    const before = scroller.scrollHeight;

    await userEvent.click(detailButtons(canvasElement)[0]);
    const panel = pick<HTMLElement>(canvasElement, "tr[data-detail-for]");
    // The window learns the new height from the panel, one observer tick later.
    await waitFor(() => expect(scroller.scrollHeight).toBeGreaterThanOrEqual(before));
    await expect(Array.from(panel.querySelectorAll("dt")).map((dt) => dt.textContent)).toEqual([
      "Environment",
      "Status",
      "Owner",
    ]);

    scroller.scrollTop = scroller.scrollHeight;
    await waitFor(() =>
      expect(canvasElement.querySelector("tr[aria-rowindex='1000']")).not.toBeNull(),
    );
    scroller.scrollTop = 0;
  },
};

/** The details button at each density: never smaller than the 24px WCAG 2.5.8 asks of a target. */
export const HideBelowDetailDensities: StoryObj = {
  parameters: noVisualBaseline,
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      {[Densities.Small, Densities.Medium, Densities.Large].map((density) => (
        <div key={density} className="w-[20rem] max-w-full">
          <DataTable
            density={density}
            className={compactTruncation}
            columns={responsiveTimeColumns}
            rows={timeEntries.slice(0, 3)}
            getRowId={(entry) => entry.id}
            getRowLabel={(entry) => `${entry.date} ${entry.project}`}
            caption={`Time entries, ${density.toLowerCase()} density`}
            paginated={false}
            selectable
          />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await document.fonts.ready;
    const buttons = detailButtons(canvasElement);
    await expect(buttons).toHaveLength(9);
    for (const button of buttons) {
      const box = button.getBoundingClientRect();
      await expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24);
    }
    for (const first of [0, 3, 6]) await userEvent.click(buttons[first]);
    await expect(canvasElement.querySelectorAll("tr[data-detail-for]")).toHaveLength(3);
  },
};

// ---------------------------------------------------------------------------------------------
// The pinned columns: counted at their real width, and row actions that fold into a menu.
// ---------------------------------------------------------------------------------------------

const pinnedRowActions: DataTableRowAction<TimeEntry>[] = [
  { tag: "edit", label: "Edit entry", icon: <Pencil aria-hidden="true" />, tooltip: "Edit entry" },
  {
    tag: "delete",
    label: "Delete entry",
    icon: <Trash2 aria-hidden="true" />,
    tooltip: "Delete entry",
    variant: "destructive",
  },
];

/**
 * Ranked columns with widths that are true: each is at least as wide as its widest cell, which is what
 * the fit needs to be right (it can only count what it is told). Amount outranks Hours here so that
 * the room a folded menu button frees is spent on a column you can see (Date and Amount).
 */
const pinnedFitColumns: DataTableColumn<TimeEntry>[] = timeColumns.map((column) => {
  const ranked: Record<string, { priority: number; width: string }> = {
    date: { priority: 1, width: "100px" },
    amount: { priority: 2, width: "104px" },
    hours: { priority: 3, width: "84px" },
    start: { priority: 4, width: "64px" },
    end: { priority: 4, width: "64px" },
    project: { priority: 5, width: "130px" },
    activity: { priority: 6, width: "92px" },
    message: { priority: 7, width: "200px" },
  };
  return { ...column, ...ranked[column.name] };
});

/**
 * The library cannot know that a truncating column is wider than its `width`: a cell that is cut off
 * with an ellipsis is as wide as its text up to `--ivy-data-table-truncate-width` (20rem), whatever
 * `width` says. So the cap is set to what the widths above claim (Project says 130px, Message 200px,
 * the cap is 128px), and the truth is then the same as the declaration. A table that leaves the cap
 * at 20rem and declares 130px for a column of long names is the one that overflows.
 */
const honestTruncation = "[--ivy-data-table-truncate-width:8rem]";

const pinnedRowLabel = (entry: TimeEntry) => `${entry.date} ${entry.project}`;

/** The labels the first four rows are named by (`Actions for <label>`). */
const pinnedRowLabels = timeEntries.slice(0, 4).map(pinnedRowLabel);

interface PinnedFrameProps {
  label: string;
  width: number;
  columns?: DataTableColumn<TimeEntry>[];
  actions?: DataTableRowAction<TimeEntry>[];
  /** `collapseRowActionsBelow`: absent, the actions are buttons at every width. */
  collapseBelow?: number;
  density?: Densities;
  selectable?: boolean;
  /** Windowed rows (all 27 entries) instead of the first four. */
  virtualized?: boolean;
  /** The table's `className`, which is where `--ivy-data-table-truncate-width` is set. */
  className?: string;
  onRowAction?: (event: DataTableRowActionEvent<TimeEntry>) => void;
}

function PinnedFrame({
  label,
  width,
  columns = pinnedFitColumns,
  actions = pinnedRowActions,
  collapseBelow,
  density,
  selectable = false,
  virtualized = false,
  className = honestTruncation,
  onRowAction,
}: PinnedFrameProps) {
  const table = (
    <section data-testid={label} style={{ width }}>
      <h3 className="mb-2 text-sm font-medium">
        {label}, {width}px
      </h3>
      <DataTable
        className={className}
        density={density}
        columns={columns}
        rows={virtualized ? timeEntries : timeEntries.slice(0, 4)}
        getRowId={(entry) => entry.id}
        getRowLabel={pinnedRowLabel}
        caption={`Time entries, ${label.toLowerCase()}`}
        paginated={false}
        virtualized={virtualized}
        selectable={selectable}
        rowActions={actions}
        onRowAction={onRowAction}
        collapseRowActionsBelow={collapseBelow}
      />
    </section>
  );
  return (
    <FrameScroller label={label}>
      {/* The selection checkbox follows the density context and not the table's `density` prop, so a
          frame at another density sets both, as an app that is built at that density does. */}
      {density ? <DensityProvider density={density}>{table}</DensityProvider> : table}
    </FrameScroller>
  );
}

const pinnedFrame = (root: ParentNode, label: string) =>
  pick<HTMLElement>(root, `[data-testid='${label}']`);

/** The accessible names of the buttons in the actions cells, row by row. */
function actionButtonNames(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>("tbody td[data-pin='end'] button")).map(
    (button) => button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "",
  );
}

/**
 * What the pinned columns exist to guarantee, in every row that is rendered: the table does not
 * scroll sideways, no data cell lies under a pinned one (the last data cell ends before the actions
 * cell starts, the first begins after the selection/details cell), and the controls stay inside the
 * cell that holds them instead of spilling into a neighbour.
 */
async function expectPinnedCellsClear(frame: HTMLElement) {
  const scroller = pick<HTMLElement>(frame, "[data-slot='table-container']");
  await expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth + 1);

  const rows = Array.from(scroller.querySelectorAll<HTMLElement>("tbody tr[data-row-id]"));
  await expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    const data = Array.from(row.querySelectorAll<HTMLElement>("td:not([data-pin])"));
    const start = row.querySelector<HTMLElement>("td[data-pin='start']");
    const end = row.querySelector<HTMLElement>("td[data-pin='end']");
    if (start) {
      const edge = start.getBoundingClientRect().right;
      await expect(data[0].getBoundingClientRect().left).toBeGreaterThanOrEqual(edge - 1);
    }
    if (end) {
      const box = end.getBoundingClientRect();
      await expect(data[data.length - 1].getBoundingClientRect().right).toBeLessThanOrEqual(
        box.left + 1,
      );
      for (const button of Array.from(end.querySelectorAll("button"))) {
        const inner = button.getBoundingClientRect();
        await expect(inner.left).toBeGreaterThanOrEqual(box.left - 0.5);
        await expect(inner.right).toBeLessThanOrEqual(box.right + 0.5);
      }
    }
  }
}

/**
 * The columns the table keeps at four widths, with two icon actions and no fold. The pinned cells (the
 * details chevron, the pair of buttons) are counted at the width they take, about 30px less than the
 * 0.2.1 estimate: a column that count kept on a phone, and that then lay under the buttons, is hidden
 * instead. At 330 the room is for Date alone.
 */
export const PinnedColumnsFit: StoryObj = {
  parameters: noVisualBaseline,
  render: () => (
    <div className="flex flex-col gap-8">
      <PinnedFrame label="Small phone" width={330} />
      <PinnedFrame label="Phone" width={390} />
      <PinnedFrame label="Phone, selectable" width={390} selectable />
      <PinnedFrame label="Tablet" width={600} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await document.fonts.ready;
    const frame = (label: string) => pinnedFrame(canvasElement, label);
    await expect(dataHeaders(frame("Small phone"))).toEqual(["Date"]);
    await expect(dataHeaders(frame("Phone"))).toEqual(["Date", "Amount"]);
    // The checkbox beside the chevron takes 22px more (70px against 48px) and 390 still has room for it.
    await expect(dataHeaders(frame("Phone, selectable"))).toEqual(["Date", "Amount"]);
    await expect(dataHeaders(frame("Tablet"))).toEqual(["Date", "Start", "End", "Hours", "Amount"]);

    // Something is hidden at every width here, so each row has the chevron.
    for (const label of ["Small phone", "Phone", "Phone, selectable", "Tablet"]) {
      await expect(detailButtons(frame(label))).toHaveLength(4);
      await expectPinnedCellsClear(frame(label));
    }
  },
};

interface RowActionArgs {
  onRowAction: (event: DataTableRowActionEvent<TimeEntry>) => void;
}

/** Below this the two buttons become one menu button; the frames below sit on either side of it. */
const FOLD_BELOW = 480;

function RowActionsCollapsedFrames({ onRowAction }: RowActionArgs) {
  return (
    <div className="flex flex-col gap-8">
      <PinnedFrame
        label="Small phone"
        width={330}
        collapseBelow={FOLD_BELOW}
        onRowAction={onRowAction}
      />
      {/* 10px over the threshold, inside the 24px margin: mounted here it has no history of being
          folded, so it shows the buttons. */}
      <PinnedFrame label="At the threshold" width={490} collapseBelow={FOLD_BELOW} />
      <PinnedFrame label="Tablet" width={600} collapseBelow={FOLD_BELOW} />
    </div>
  );
}

/** The menu is in a portal on the body, outside the canvas, so it is looked up there. */
const page = () => within(document.body);

const editAndDelete = ["Edit entry", "Delete entry"];
const bothButtons = pinnedRowLabels.flatMap(() => editAndDelete);

async function expectRowActionsCollapsed(canvasElement: HTMLElement, args: RowActionArgs) {
  await document.fonts.ready;
  const narrow = pinnedFrame(canvasElement, "Small phone");
  const band = pinnedFrame(canvasElement, "At the threshold");
  const wide = pinnedFrame(canvasElement, "Tablet");

  // Folded: one button per row, named for its row. The room of the second button goes to Amount, which
  // the same phone shows only Date in without the fold (PinnedColumnsFit).
  await expect(actionButtonNames(narrow)).toEqual(
    pinnedRowLabels.map((label) => `Actions for ${label}`),
  );
  await expect(dataHeaders(narrow)).toEqual(["Date", "Amount"]);
  await expectPinnedCellsClear(narrow);

  // The fold is a narrow-width thing: 600 has the two buttons in every row, and the columns of a table
  // that does not fold.
  await expect(actionButtonNames(wide)).toEqual(bothButtons);
  await expect(dataHeaders(wide)).toEqual(["Date", "Start", "End", "Hours", "Amount"]);
  await expectPinnedCellsClear(wide);

  // Inside the band, and with the two buttons back, the columns are those of the unfolded table.
  await expect(actionButtonNames(band)).toEqual(bothButtons);
  await expect(dataHeaders(band)).toEqual(["Date", "Hours", "Amount"]);
  await expectPinnedCellsClear(band);

  // The menu holds the same actions, and pressing one reports it as the button would have.
  const trigger = within(narrow).getByRole("button", {
    name: `Actions for ${pinnedRowLabels[0]}`,
  });
  await userEvent.click(trigger);
  const menu = await page().findByRole("menu");
  await expect(
    within(menu)
      .getAllByRole("menuitem")
      .map((item) => item.textContent),
  ).toEqual(editAndDelete);
  await userEvent.click(within(menu).getByRole("menuitem", { name: "Delete entry" }));
  await expect(args.onRowAction).toHaveBeenCalledTimes(1);
  await expect(args.onRowAction).toHaveBeenCalledWith(
    expect.objectContaining({ id: "t1", tag: "delete", row: timeEntries[0] }),
  );
  // The action opened nothing that took focus, so the menu hands it back to its button.
  await waitFor(() => expect(page().queryByRole("menu")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));

  // Escape closes it as well, and runs nothing.
  await userEvent.click(trigger);
  await page().findByRole("menu");
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(page().queryByRole("menu")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  await expect(args.onRowAction).toHaveBeenCalledTimes(1);
  trigger.blur();
}

/**
 * `collapseRowActionsBelow={480}`: while the table's own box is narrower than that, each row's two
 * buttons are one "..." menu button named for the row. It frees about 43px, which here is the room
 * Amount needs next to Date. Inside the 24px band above the threshold a table that starts there shows
 * the buttons; one that was narrower keeps the menu until it is out of the band (the hysteresis is
 * pinned by `tests/data-table-row-actions-fold.test.tsx`; drag a frame's width here to see it).
 */
export const RowActionsCollapsed: StoryObj<RowActionArgs> = {
  args: { onRowAction: fn() },
  parameters: noVisualBaseline,
  render: (args) => <RowActionsCollapsedFrames {...args} />,
  play: async ({ canvasElement, args }) => expectRowActionsCollapsed(canvasElement, args),
};

export const RowActionsCollapsedDark: StoryObj<RowActionArgs> = {
  args: { onRowAction: fn() },
  globals: { theme: "dark" },
  parameters: noVisualBaseline,
  render: (args) => <RowActionsCollapsedFrames {...args} />,
  play: async ({ canvasElement, args }) => {
    await assertDarkTheme();
    await expectRowActionsCollapsed(canvasElement, args);
  },
};

const groupedRowActions: DataTableRowAction<TimeEntry>[] = [
  { tag: "edit", label: "Edit entry", icon: <Pencil aria-hidden="true" /> },
  {
    tag: "export",
    label: "Export",
    icon: <Download aria-hidden="true" />,
    children: [
      { tag: "export-csv", label: "As CSV" },
      { tag: "export-pdf", label: "As PDF" },
    ],
  },
  {
    tag: "delete",
    label: "Delete entry",
    icon: <Trash2 aria-hidden="true" />,
    variant: "destructive",
  },
];

/**
 * An action with `children` is a dropdown of its own among the buttons. Folded into the row's menu it
 * is a labelled group of items instead: a sub-menu is a second tap-and-hover level on a phone.
 */
export const RowActionsCollapsedGroups: StoryObj<RowActionArgs> = {
  args: { onRowAction: fn() },
  parameters: noVisualBaseline,
  render: (args) => (
    <div className="flex flex-col gap-8">
      <PinnedFrame
        label="Small phone"
        width={330}
        actions={groupedRowActions}
        collapseBelow={FOLD_BELOW}
        onRowAction={args.onRowAction}
      />
      <PinnedFrame
        label="Tablet"
        width={600}
        actions={groupedRowActions}
        collapseBelow={FOLD_BELOW}
      />
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    await document.fonts.ready;
    const narrow = pinnedFrame(canvasElement, "Small phone");
    const wide = pinnedFrame(canvasElement, "Tablet");
    await expect(actionButtonNames(narrow)).toEqual(
      pinnedRowLabels.map((label) => `Actions for ${label}`),
    );
    await expectPinnedCellsClear(narrow);
    // Unfolded, the group is a button of its own that opens a menu: three controls a row.
    await expect(actionButtonNames(wide)).toEqual(
      pinnedRowLabels.flatMap(() => ["Edit entry", "Export", "Delete entry"]),
    );
    await expectPinnedCellsClear(wide);

    const trigger = within(narrow).getByRole("button", {
      name: `Actions for ${pinnedRowLabels[0]}`,
    });
    await userEvent.click(trigger);
    const menu = await page().findByRole("menu");
    const group = within(menu).getByRole("group", { name: "Export" });
    await expect(
      within(group)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["As CSV", "As PDF"]);
    // One flat level: no item opens a sub-menu.
    await expect(menu.querySelector("[aria-haspopup]")).toBeNull();
    await expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Edit entry", "As CSV", "As PDF", "Delete entry"]);

    await userEvent.click(within(group).getByRole("menuitem", { name: "As PDF" }));
    await expect(args.onRowAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1", tag: "export-pdf" }),
    );
    await waitFor(() => expect(page().queryByRole("menu")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    trigger.blur();
  },
};

const textRowActions: DataTableRowAction<TimeEntry>[] = [
  { tag: "approve", label: "Approve" },
  { tag: "reject", label: "Reject" },
];

/**
 * Buttons with a text label are as wide as their text, which no model of the table can know. The
 * table reads where the buttons actually sit in the rendered cell and reserves that, so the columns it
 * keeps still leave the labels room: the table does not scroll and nothing lies under them.
 */
export const TextLabelledActions: StoryObj = {
  parameters: noVisualBaseline,
  render: () => <PinnedFrame label="Phone" width={360} actions={textRowActions} />,
  play: async ({ canvasElement }) => {
    await document.fonts.ready;
    const frame = pinnedFrame(canvasElement, "Phone");
    await expect(actionButtonNames(frame)).toEqual(
      pinnedRowLabels.flatMap(() => ["Approve", "Reject"]),
    );
    await waitFor(() => expectPinnedCellsClear(frame));

    // Text buttons really are wider than the two icon buttons the model assumes, so this is the
    // measurement doing the work and not the estimate happening to be enough.
    const cell = pick<HTMLElement>(frame, "tbody td[data-pin='end']");
    const buttons = Array.from(cell.querySelectorAll("button")).map((button) =>
      button.getBoundingClientRect(),
    );
    const style = getComputedStyle(cell);
    const needed =
      buttons[buttons.length - 1].right -
      buttons[0].left +
      parseFloat(style.paddingLeft) +
      parseFloat(style.paddingRight);
    await expect(needed).toBeGreaterThan(estimateActionsColumnWidth({ actionCount: 2 }));
  },
};

/**
 * Windowed rows lay out with `table-layout: fixed`, where the pinned columns get their width from the
 * table instead of from their content. The buttons stay inside their cell whether they are two or
 * one menu button, and nothing is pushed into the neighbouring column.
 */
export const WindowedRowActions: StoryObj = {
  parameters: noVisualBaseline,
  render: () => (
    <div className="flex flex-col gap-8">
      <PinnedFrame label="Windowed" width={390} virtualized />
      <PinnedFrame label="Windowed, folded" width={390} virtualized collapseBelow={FOLD_BELOW} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await document.fonts.ready;
    const unfolded = pinnedFrame(canvasElement, "Windowed");
    const folded = pinnedFrame(canvasElement, "Windowed, folded");
    for (const frame of [unfolded, folded]) {
      await waitFor(() =>
        expect(frame.querySelectorAll("tbody tr[data-row-id]").length).toBeGreaterThan(0),
      );
      const table = pick<HTMLElement>(frame, "table");
      await expect(getComputedStyle(table).tableLayout).toBe("fixed");
      // Windowed: not every one of the 27 entries is in the DOM.
      await expect(frame.querySelectorAll("tbody tr[data-row-id]").length).toBeLessThan(
        timeEntries.length,
      );
      await expectPinnedCellsClear(frame);
    }
    await expect(new Set(actionButtonNames(unfolded))).toEqual(new Set(editAndDelete));
    await expect(actionButtonNames(folded).every((name) => name.startsWith("Actions for "))).toBe(
      true,
    );
  },
};

/**
 * Small and Large density at a phone width, with the selection checkbox: each is laid out at its own
 * size and counted at it. Small's pinned cells take 152px against Medium's 170, which leaves Date and
 * Amount room by 2px (358 of 360px); Large's are wider and keep Date alone.
 */
export const PinnedColumnsDensities: StoryObj = {
  parameters: noVisualBaseline,
  render: () => (
    <div className="flex flex-col gap-8">
      <PinnedFrame label="Small density" width={360} density={Densities.Small} selectable />
      <PinnedFrame label="Large density" width={360} density={Densities.Large} selectable />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await document.fonts.ready;
    const small = pinnedFrame(canvasElement, "Small density");
    const large = pinnedFrame(canvasElement, "Large density");
    await expect(dataHeaders(small)).toEqual(["Date", "Amount"]);
    await expect(dataHeaders(large)).toEqual(["Date"]);
    await expectPinnedCellsClear(small);
    await expectPinnedCellsClear(large);
  },
};

// ---------------------------------------------------------------------------------------------
// Headers: a long label is part of its column's width unless the column lets it truncate.
// ---------------------------------------------------------------------------------------------

/** The cap a phone-sized table puts on its truncating cells, as the accounting app does. */
const phoneTruncation = "[--ivy-data-table-truncate-width:5rem]";

/**
 * Labels longer than their cells need. Counterparty and Description truncate (their cells are cut off
 * at 5rem), so their headers have to as well. Booking date and Amount are kept whole (a date, an
 * amount), so their headers cannot: each column is as wide as its label and sort icon, and the fit has
 * to count that, or the column it keeps is wider than the room it was counted into.
 */
const longHeaders: Record<string, Partial<DataTableColumn<TimeEntry>>> = {
  date: { header: "Booking date", width: "100px" },
  amount: { header: "Amount incl. VAT", width: "104px" },
  project: { header: "Counterparty", width: "5rem" },
  message: { header: "Description of the transaction", width: "5rem" },
};

/** The four columns, ranked by `priority` (1 is kept longest) in the order each frame names. */
const longHeaderColumns = (ranking: string[]): DataTableColumn<TimeEntry>[] =>
  timeColumns.flatMap((column) =>
    longHeaders[column.name]
      ? [
          {
            ...column,
            ...longHeaders[column.name],
            footer: undefined,
            priority: ranking.indexOf(column.name) + 1,
          },
        ]
      : [],
  );

const dateFirst = longHeaderColumns(["date", "amount", "project", "message"]);
const textFirst = longHeaderColumns(["project", "message", "date", "amount"]);
/**
 * The same columns with sorting off: their headers are plain labels, with no button around them. With
 * no sort icon to share the cell, "Counterparty" is only a few px wider than it, so the label is a
 * longer one: whether it is cut off must not hang on how a font rounds.
 */
const textFirstUnsorted = textFirst.map((column) => ({
  ...column,
  sortable: false,
  ...(column.name === "project" && { header: "Counterparty of the booking" }),
}));
const unsortedHeaders = ["Counterparty of the booking", "Description of the transaction"];

const headerCell = (frame: HTMLElement, label: string): HTMLElement => {
  const cell = Array.from(frame.querySelectorAll<HTMLElement>("thead th:not([data-pin])")).find(
    (th) => th.textContent?.trim() === label,
  );
  if (!cell) throw new Error(`Expected a header named ${label}`);
  return cell;
};

const headerLabel = (cell: HTMLElement) => pick<HTMLElement>(cell, "span.truncate");
const labelIsCutOff = (cell: HTMLElement) =>
  headerLabel(cell).scrollWidth > headerLabel(cell).clientWidth;

/**
 * Every header cell lies clear of its neighbours, and what it holds stays inside it: the sort button
 * and its icon are not pushed out of the cell by a long label, which is what truncating the label is for.
 */
async function expectHeadersClear(frame: HTMLElement) {
  const cells = Array.from(frame.querySelectorAll<HTMLElement>("thead th"));
  let previous = -Infinity;
  for (const cell of cells) {
    const box = cell.getBoundingClientRect();
    await expect(box.left).toBeGreaterThanOrEqual(previous - 1);
    previous = box.right;
    for (const part of Array.from(cell.querySelectorAll("button, svg"))) {
      const inner = part.getBoundingClientRect();
      await expect(inner.width).toBeGreaterThan(0);
      await expect(inner.left).toBeGreaterThanOrEqual(box.left - 0.5);
      await expect(inner.right).toBeLessThanOrEqual(box.right + 0.5);
    }
  }
}

interface LongHeaderFrame {
  label: string;
  width: number;
  columns: DataTableColumn<TimeEntry>[];
  /** The headers the table is expected to keep. */
  headers: string[];
}

const longHeaderFrames: LongHeaderFrame[] = [
  { label: "Small phone", width: 330, columns: dateFirst, headers: ["Booking date"] },
  // Amount's header (about 150px) is wider than the 104px it declares, so 390 has no room for it.
  { label: "Phone", width: 390, columns: dateFirst, headers: ["Booking date"] },
  {
    label: "Phone, text first",
    width: 390,
    columns: textFirst,
    headers: ["Counterparty", "Description of the transaction"],
  },
  {
    label: "Phone, not sortable",
    width: 390,
    columns: textFirstUnsorted,
    headers: unsortedHeaders,
  },
  {
    label: "Tablet",
    width: 600,
    columns: dateFirst,
    headers: ["Booking date", "Amount incl. VAT", "Counterparty", "Description of the transaction"],
  },
];

function LongHeaderFrames() {
  return (
    <div className="flex flex-col gap-8">
      {longHeaderFrames.map(({ label, width, columns }) => (
        <PinnedFrame
          key={label}
          label={label}
          width={width}
          columns={columns}
          className={phoneTruncation}
        />
      ))}
    </div>
  );
}

async function playLongHeaders({ canvasElement }: { canvasElement: HTMLElement }) {
  await document.fonts.ready;
  for (const { label, headers } of longHeaderFrames) {
    const frame = pinnedFrame(canvasElement, label);
    await waitFor(() => expect(dataHeaders(frame)).toEqual(headers));
    await expectPinnedCellsClear(frame);
    await expectHeadersClear(frame);
  }

  // Kept whole: the label is not cut off at any width.
  for (const label of ["Small phone", "Phone", "Tablet"]) {
    await expect(labelIsCutOff(headerCell(pinnedFrame(canvasElement, label), "Booking date"))).toBe(
      false,
    );
  }
  await expect(
    labelIsCutOff(headerCell(pinnedFrame(canvasElement, "Tablet"), "Amount incl. VAT")),
  ).toBe(false);

  // Truncating: cut off, and still there in full for a pointer, a screen reader and the keyboard.
  const phone = pinnedFrame(canvasElement, "Phone, text first");
  for (const label of ["Counterparty", "Description of the transaction"]) {
    const cell = headerCell(phone, label);
    await expect(labelIsCutOff(cell)).toBe(true);
    await expect(cell.hasAttribute("title")).toBe(false);
    await userEvent.hover(cell);
    await expect(cell).toHaveAttribute("title", label);
    await userEvent.unhover(cell);
  }

  // Not sortable: a plain label, which is cut at its cell's edge like the one in a sort button and
  // does not run on over the next header.
  const unsorted = pinnedFrame(canvasElement, "Phone, not sortable");
  for (const label of unsortedHeaders) {
    const cell = headerCell(unsorted, label);
    await expect(within(cell).queryByRole("button")).toBeNull();
    await expect(labelIsCutOff(cell)).toBe(true);
    await expect(headerLabel(cell).getBoundingClientRect().right).toBeLessThanOrEqual(
      cell.getBoundingClientRect().right + 0.5,
    );
    await userEvent.hover(cell);
    await expect(cell).toHaveAttribute("title", label);
    await userEvent.unhover(cell);
    await expect(cell.hasAttribute("title")).toBe(false);
  }

  const counterparty = headerCell(phone, "Counterparty");
  const sort = within(counterparty).getByRole("button", {
    name: "Sort by Counterparty ascending",
  });
  await expect(counterparty).toHaveAttribute("aria-sort", "none");
  sort.focus();
  await userEvent.keyboard("{Enter}");
  await expect(counterparty).toHaveAttribute("aria-sort", "ascending");
  await expect(
    within(counterparty).getByRole("button", { name: "Sort by Counterparty descending" }),
  ).toBeInTheDocument();
  await userEvent.keyboard("{Enter}");
  await expect(counterparty).toHaveAttribute("aria-sort", "descending");
  // Back to unsorted, so the story leaves the table as it found it.
  await userEvent.keyboard("{Enter}");
  await expect(counterparty).toHaveAttribute("aria-sort", "none");
  sort.blur();
}

/**
 * Long header labels in tables that cannot give them the room: no column lies under a neighbour or
 * under the pinned actions, and the page does not scroll sideways.
 *
 * - A header over a column whose cells truncate (Counterparty, Description) truncates with them,
 *   with its sort icon in view, its full text as a tooltip while it is cut off and as the name of its
 *   sort button, and it still sorts from the keyboard. A column that cannot be sorted
 *   (`sortable: false`) has a plain label that is cut at its cell's edge in the same way.
 * - A header over a column that is kept whole (Booking date, Amount) is shown in full, and the fit
 *   counts it at that width: Amount, which declares 104px and needs about 150, is dropped at 390.
 */
export const LongHeaders: StoryObj = {
  parameters: noVisualBaseline,
  render: () => <LongHeaderFrames />,
  play: playLongHeaders,
};

/** The same in the dark theme, where the truncated label and the sort icon have to stay readable. */
export const LongHeadersDark: StoryObj = {
  globals: { theme: "dark" },
  parameters: noVisualBaseline,
  render: () => <LongHeaderFrames />,
  play: async (context) => {
    await assertDarkTheme();
    await playLongHeaders(context);
  },
};
