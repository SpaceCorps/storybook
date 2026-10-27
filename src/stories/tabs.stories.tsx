import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const meta: Meta<typeof Tabs> = {
  title: "UI/Tabs",
  component: Tabs,
};

export default meta;

export const Default: StoryObj<typeof Tabs> = {
  render: () => (
    <Tabs defaultValue="account" className="w-[400px]">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <p className="p-4 text-sm text-muted-foreground">Manage your account settings here.</p>
      </TabsContent>
      <TabsContent value="password">
        <p className="p-4 text-sm text-muted-foreground">Change your password here.</p>
      </TabsContent>
    </Tabs>
  ),
};

/**
 * One Tab stop for the whole tab list, then arrow keys: Left/Right move focus and select (they wrap),
 * Home and End jump to the ends. Tab again goes to the panel, which is focusable.
 */
export const KeyboardNavigation: StoryObj<typeof Tabs> = {
  parameters: {
    // An interaction story: the tabs look the same as in Default, which has the baseline.
    visual: { disable: true },
    keyboard: { sweep: true, forcedColors: true },
  },
  render: () => (
    <div className="flex flex-col gap-3">
      <button type="button" className="w-fit rounded-field border px-3 py-1 text-sm">
        Before
      </button>
      <Tabs defaultValue="open" className="w-[480px]">
        <TabsList aria-label="Invoices">
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="draft" disabled>
            Draft
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value="open">
          <p className="p-4 text-sm text-muted-foreground">Invoices waiting for payment.</p>
        </TabsContent>
        <TabsContent value="paid">
          <p className="p-4 text-sm text-muted-foreground">Invoices that have been paid.</p>
        </TabsContent>
        <TabsContent value="draft">
          <p className="p-4 text-sm text-muted-foreground">Invoices not sent yet.</p>
        </TabsContent>
        <TabsContent value="all">
          <p className="p-4 text-sm text-muted-foreground">Every invoice.</p>
        </TabsContent>
      </Tabs>
      <button type="button" className="w-fit rounded-field border px-3 py-1 text-sm">
        After
      </button>
    </div>
  ),
};

const ControlledTabs = () => {
  const [value, setValue] = React.useState("a");
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={value} onValueChange={setValue} className="w-[400px]">
        <TabsList aria-label="Sections">
          <TabsTrigger value="a">First</TabsTrigger>
          <TabsTrigger value="b">Second</TabsTrigger>
        </TabsList>
        <TabsContent value="a">
          <p className="p-4 text-sm text-muted-foreground">First panel.</p>
        </TabsContent>
        <TabsContent value="b">
          <p className="p-4 text-sm text-muted-foreground">Second panel.</p>
        </TabsContent>
      </Tabs>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Selected: {value}
      </p>
    </div>
  );
};

/** Controlled: the parent owns the value and hears every change, by mouse, touch or keyboard. */
export const Controlled: StoryObj<typeof Tabs> = {
  // An interaction story: the tabs look the same as in Default, which has the baseline.
  parameters: { visual: { disable: true } },
  render: () => <ControlledTabs />,
};
