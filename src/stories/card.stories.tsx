import type { Meta, StoryObj } from "@storybook/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
};

export default meta;

export const Default: StoryObj<typeof Card> = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Create project</CardTitle>
        <CardDescription>Deploy your new project in one-click.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Project details and config go here.</p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">Cancel</Button>
        <Button>Deploy</Button>
      </CardFooter>
    </Card>
  ),
};

interface Invoice {
  id: string;
  number: string;
  customer: string;
  amount: string;
}

const invoices: Invoice[] = [
  { id: "1", number: "INV-1001", customer: "Kvarnby Elektriska AB", amount: "12 450,00 kr" },
  { id: "2", number: "INV-1002", customer: "Nordlys Consulting", amount: "3 200,00 kr" },
  { id: "3", number: "INV-1003", customer: "Open Accounting", amount: "980,50 kr" },
];

const invoiceColumns: DataTableColumn<Invoice>[] = [
  { name: "number", header: "Invoice" },
  { name: "customer", header: "Customer" },
  { name: "amount", header: "Amount", align: "Right" },
];

/**
 * `flush` removes the content padding so a table runs edge to edge and the card's own border is its
 * frame. The table draws no box of its own; its first and last column keep the card's inset.
 */
export const WithFlushTable: StoryObj<typeof Card> = {
  // Visual baselines are produced in a Linux container, so this story has none yet.
  parameters: { visual: { disable: true } },
  render: () => (
    <Card className="w-[36rem] max-w-full">
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
        <CardDescription>Issued this month.</CardDescription>
      </CardHeader>
      <CardContent flush>
        <DataTable
          columns={invoiceColumns}
          rows={invoices}
          getRowId={(invoice) => invoice.id}
          caption="Invoices"
        />
      </CardContent>
    </Card>
  ),
};

/**
 * A card with no header: the flush content is the card's first section, so it rounds its own top
 * corners to the card radius and the table's opaque header row cannot square them off. The toolbar
 * keeps room above its controls, so their focus rings are not clipped by the content.
 */
export const FlushTableWithoutHeader: StoryObj<typeof Card> = {
  parameters: { visual: { disable: true } },
  render: () => (
    <Card className="w-[36rem] max-w-full">
      <CardContent flush>
        <DataTable
          columns={invoiceColumns}
          rows={invoices}
          getRowId={(invoice) => invoice.id}
          caption="Invoices"
          showColumnOptions
          toolbar={{
            left: <Input aria-label="Filter invoices" className="w-56" placeholder="Filter..." />,
          }}
        />
      </CardContent>
    </Card>
  ),
};
