import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor } from "@storybook/test";
import { MoreHorizontal, Pencil } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
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
