import type { Meta, StoryObj } from "@storybook/react";
import { MoreHorizontal, Pencil } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/ui/data-table";
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
          defaultPageSize={15}
        />
      </div>
      <div className="w-[48rem] max-w-full">
        <DataTable
          columns={postingColumns}
          rows={manyPostings}
          getRowId={(row) => row.id}
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
