import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { DatePicker, DateRangePicker, type DateRangeValue } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const meta: Meta<typeof DatePicker> = {
  title: "UI/DatePicker",
  component: DatePicker,
  parameters: {
    // The calendar opens in a portal and the stories seed dates, so a screenshot adds nothing.
    visual: { disable: true },
  },
};

export default meta;

/** The value is the ISO string itself, so it can go straight into a form field or an API call. */
const Readout = ({ label, value }: { label: string; value: unknown }) => (
  <p className="text-sm text-muted-foreground">
    {label}:{" "}
    <code className="rounded-selector bg-muted px-1 py-0.5 text-foreground">
      {JSON.stringify(value)}
    </code>
  </p>
);

const DefaultDemo = () => {
  const [date, setDate] = React.useState("2026-10-23");
  return (
    <div className="flex w-64 flex-col gap-2">
      <Label htmlFor="invoice-date">Invoice date</Label>
      <DatePicker id="invoice-date" value={date} onChange={setDate} />
      <Readout label="value" value={date} />
    </div>
  );
};

/**
 * Shown and typed as `yyyy-mm-dd` whatever the browser's language, weeks start on Monday. Type
 * digits (`20261023` becomes `2026-10-23`), pick a day, or press ArrowDown to open the calendar.
 */
export const Default: StoryObj = {
  render: () => <DefaultDemo />,
};

const EmptyDemo = () => {
  const [date, setDate] = React.useState("");
  return (
    <div className="flex w-64 flex-col gap-2">
      <DatePicker aria-label="Due date" value={date} onChange={setDate} />
      <Readout label="value" value={date} />
    </div>
  );
};

/** No date yet. Emptying the field reports `""`; half-typed text is dropped on blur. */
export const Empty: StoryObj = {
  render: () => <EmptyDemo />,
};

const BoundedDemo = () => {
  const [date, setDate] = React.useState("2026-10-15");
  return (
    <div className="flex w-64 flex-col gap-2">
      <Label htmlFor="booking-date">Booking date (October 2026 only)</Label>
      <DatePicker
        id="booking-date"
        value={date}
        onChange={setDate}
        min="2026-10-01"
        max="2026-10-31"
      />
      <Readout label="value" value={date} />
    </div>
  );
};

/** `min` and `max` grey out days in the calendar and are enforced on typed dates too. */
export const MinAndMax: StoryObj = {
  render: () => <BoundedDemo />,
};

export const Disabled: StoryObj = {
  render: () => (
    <div className="w-64">
      <DatePicker aria-label="Locked date" defaultValue="2026-10-23" disabled />
    </div>
  ),
};

export const Densities: StoryObj = {
  render: () => (
    <div className="flex w-64 flex-col gap-3">
      {(["Small", "Medium", "Large"] as const).map((density) => (
        <DatePicker
          key={density}
          aria-label={`${density} date`}
          density={density as never}
          defaultValue="2026-10-23"
        />
      ))}
    </div>
  ),
};

const RangeDemo = () => {
  const [range, setRange] = React.useState<DateRangeValue>({
    from: "2026-10-01",
    to: "2026-10-31",
  });
  return (
    <div className="flex w-80 flex-col gap-2">
      <Label>Period</Label>
      <DateRangePicker value={range} onChange={setRange} />
      <Readout label="value" value={range} />
    </div>
  );
};

/** Two ISO fields and one two-month calendar: click a start, click an end, or type either. */
export const Range: StoryObj = {
  render: () => <RangeDemo />,
};

const InDialogDemo = () => {
  const [date, setDate] = React.useState("2026-10-23");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Book payment</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Book payment</DialogTitle>
          <DialogDescription>Pick the date the payment cleared.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-2 pb-4">
            <Label htmlFor="payment-date">Payment date</Label>
            <DatePicker id="payment-date" value={date} onChange={setDate} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button>Book</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** The calendar stacks above a dialog and the dialog stays open behind it. */
export const InsideDialog: StoryObj = {
  render: () => <InDialogDemo />,
};

const KeyboardDemo = () => {
  const [date, setDate] = React.useState("2026-10-23");
  return (
    <div className="flex w-64 flex-col gap-2">
      <DatePicker aria-label="Keyboard date" value={date} onChange={setDate} />
      <Readout label="value" value={date} />
    </div>
  );
};

/**
 * ArrowDown in the field opens the calendar with focus already on the selected day (no tabbing past
 * the month controls). Escape, or picking a day, puts focus back in the field.
 */
export const KeyboardOpen: StoryObj = {
  render: () => <KeyboardDemo />,
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText("Keyboard date");
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}");
    const day = await within(document.body).findByRole("button", { name: /October 23rd, 2026/ });
    await waitFor(() => expect(day).toHaveFocus());
    await userEvent.keyboard("{ArrowRight}{Enter}");
    await waitFor(() => expect(input).toHaveFocus());
    await expect(input).toHaveValue("2026-10-24");
  },
};

const OutsideClickDemo = () => {
  const [date, setDate] = React.useState("2026-10-23");
  return (
    <div className="flex w-64 flex-col gap-3">
      <Label htmlFor="outside-notes">Notes</Label>
      <input
        id="outside-notes"
        className="h-9 rounded-field border border-input bg-transparent px-3 text-sm"
      />
      <DatePicker aria-label="Outside date" value={date} onChange={setDate} />
    </div>
  );
};

/**
 * Open the calendar with ArrowDown, then click another field: the click wins. Focus goes back to the
 * date field only when nothing else has taken it (Escape, or picking a day).
 */
export const OutsideClick: StoryObj = {
  render: () => <OutsideClickDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Outside date");
    const notes = canvas.getByLabelText("Notes");
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}");
    const day = await within(document.body).findByRole("button", { name: /October 23rd, 2026/ });
    await waitFor(() => expect(day).toHaveFocus());

    await userEvent.click(notes);
    await waitFor(() => expect(within(document.body).queryByRole("grid")).toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(notes).toHaveFocus();
  },
};
