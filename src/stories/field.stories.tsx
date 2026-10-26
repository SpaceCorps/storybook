import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import * as React from "react";

import { NumberInput } from "@/components/NumberInput";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker, DateRangePicker } from "@/components/ui/date-picker";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MultipleSelector, type Option } from "@/components/ui/multiselect";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

/**
 * A `Field` generates the control's id and wires the label, hint and error to it, so none of that has
 * to be threaded by hand. The control (`Input`, `Textarea`, `Select`, `Checkbox`, `Switch`,
 * `RadioGroup`, `NumberInput`, `DatePicker`, `DateRangePicker`, `MultipleSelector`) reads it from
 * context. Outside a Field a control takes its own `id`, `name` and `aria-*` props, as it always did.
 */
const meta: Meta<typeof Field> = {
  title: "UI/Field",
  component: Field,
  parameters: {
    layout: "centered",
    // New stories: no baseline images yet (they can only be rendered in the Linux container).
    visual: { disable: true },
  },
};

export default meta;

const COLUMN = "flex w-[360px] flex-col gap-5";

export const Default: StoryObj<typeof Field> = {
  render: () => (
    <div className={COLUMN}>
      <Field label="Organisation name" hint="As registered with Bolagsverket.">
        <Input name="organisation" />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Organisation name");
    await expect(input).toHaveAccessibleDescription("As registered with Bolagsverket.");
    await userEvent.click(canvas.getByText("Organisation name"));
    await expect(input).toHaveFocus();
  },
};

export const WithError: StoryObj<typeof Field> = {
  render: () => (
    <div className={COLUMN}>
      <Field
        label="Organisation number"
        hint="Ten digits."
        error="The check digit is wrong."
        required
      >
        <Input name="orgnr" defaultValue="556000-0167" />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAttribute("aria-required", "true");
    await expect(input).toHaveAccessibleDescription("Ten digits. The check digit is wrong.");
  },
};

const OPTIONS: Option[] = [
  { value: "ledger", label: "General ledger" },
  { value: "vat", label: "VAT" },
  { value: "payroll", label: "Payroll" },
];

const ControlsDemo = () => {
  const [accepted, setAccepted] = React.useState(true);
  const [amount, setAmount] = React.useState<number | null>(1250);
  const [reports, setReports] = React.useState<Option[]>([OPTIONS[0]]);
  return (
    <form className={COLUMN} onSubmit={(event) => event.preventDefault()}>
      <Field label="Notes" hint="Shown on the invoice.">
        <Textarea name="notes" />
      </Field>
      <Field label="Currency" hint="Used for new invoices.">
        <Select name="currency" defaultValue="sek">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sek">SEK</SelectItem>
            <SelectItem value="eur">EUR</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field
        label="Amount"
        hint="Excluding VAT."
        error={amount === null ? "Enter an amount." : undefined}
      >
        <NumberInput name="amount" value={amount} onChange={setAmount} />
      </Field>
      <Field label="Invoice date">
        <DatePicker name="invoice-date" defaultValue="2026-10-23" />
      </Field>
      <Field label="Period" hint="Both dates are included.">
        <DateRangePicker name="period" defaultValue={{ from: "2026-10-01", to: "2026-10-31" }} />
      </Field>
      <Field label="Reports" hint="Pick at least one.">
        <MultipleSelector
          name="reports"
          defaultOptions={OPTIONS}
          value={reports}
          onValueChange={setReports}
        />
      </Field>
      <Field label="Delivery" hint="Applies to new customers.">
        <RadioGroup name="delivery" defaultValue="email">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="email" id="field-delivery-email" />
            <Label htmlFor="field-delivery-email">E-invoice</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="post" id="field-delivery-post" />
            <Label htmlFor="field-delivery-post">Post</Label>
          </div>
        </RadioGroup>
      </Field>
      <Field label="Send reminders" hint="Three days before the due date." orientation="horizontal">
        <Switch name="reminders" defaultChecked />
      </Field>
      <Field label="I accept the terms" orientation="horizontal" required>
        <Checkbox
          name="terms"
          checked={accepted}
          onCheckedChange={(next) => setAccepted(next === true)}
        />
      </Field>
    </form>
  );
};

/**
 * The same wiring for every control. Click a label and the control gets focus; a radio group is not
 * something a label can focus, so the label names the group instead.
 */
export const Controls: StoryObj<typeof Field> = {
  render: () => <ControlsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("textbox", { name: "Notes" })).toHaveAccessibleDescription(
      "Shown on the invoice.",
    );
    await expect(canvas.getByRole("combobox", { name: "Currency" })).toBeInTheDocument();
    await expect(canvas.getByRole("switch", { name: "Send reminders" })).toBeInTheDocument();
    await expect(canvas.getByRole("radiogroup", { name: "Delivery" })).toBeInTheDocument();
    await expect(canvas.getByRole("group", { name: "Period" })).toBeInTheDocument();
  },
};

const InvalidControlsDemo = () => (
  <form className={COLUMN} onSubmit={(event) => event.preventDefault()}>
    <Field label="Notes" error="Add a note.">
      <Textarea name="notes" />
    </Field>
    <Field label="Currency" error="Choose a currency.">
      <Select name="currency">
        <SelectTrigger>
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sek">SEK</SelectItem>
        </SelectContent>
      </Select>
    </Field>
    <Field label="Amount" error="Enter an amount.">
      <NumberInput name="amount" value={null} />
    </Field>
    <Field label="Invoice date" error="Pick a date.">
      <DatePicker name="invoice-date" defaultValue="" />
    </Field>
    <Field label="Period" error="Pick a period.">
      <DateRangePicker name="period" defaultValue={{ from: "", to: "" }} />
    </Field>
    <Field label="Reports" error="Pick at least one.">
      <MultipleSelector name="reports" defaultOptions={OPTIONS} value={[]} />
    </Field>
    <Field label="Delivery" error="Choose a delivery method.">
      <RadioGroup name="delivery">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="email" id="invalid-delivery-email" />
          <Label htmlFor="invalid-delivery-email">E-invoice</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="post" id="invalid-delivery-post" />
          <Label htmlFor="invalid-delivery-post">Post</Label>
        </div>
      </RadioGroup>
    </Field>
    <Field label="Send reminders" error="Required." orientation="horizontal">
      <Switch name="reminders" />
    </Field>
    <Field label="I accept the terms" error="You must accept." orientation="horizontal">
      <Checkbox name="terms" />
    </Field>
  </form>
);

/** An error on the Field marks every kind of control invalid: red border, red focus ring. */
export const InvalidControls: StoryObj<typeof Field> = {
  render: () => <InvalidControlsDemo />,
};

export const Disabled: StoryObj<typeof Field> = {
  render: () => (
    <div className={COLUMN}>
      <Field label="Locked reference" hint="Set by the bank." disabled>
        <Input name="reference" defaultValue="OCR 1234567890" />
      </Field>
    </div>
  ),
};

export const HiddenLabel: StoryObj<typeof Field> = {
  render: () => (
    <div className={COLUMN}>
      <Field label="Search invoices" hideLabel>
        <Input name="q" type="search" placeholder="Search invoices" />
      </Field>
    </div>
  ),
};

/**
 * A label can hold markup. Controls that cannot be labelled by `for` (a multiple selector, a radio
 * group, a range) name themselves by reference to the label element, so the whole label is their
 * name and not just its text when it happens to be a string.
 */
export const RichLabel: StoryObj<typeof Field> = {
  render: () => (
    <div className={COLUMN}>
      <Field
        label={
          <span>
            Reports <em>(optional)</em>
          </span>
        }
        hint="Pick any number."
      >
        <MultipleSelector name="reports" defaultOptions={OPTIONS} value={[]} />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const combobox = canvas.getByRole("combobox", { name: "Reports (optional)" });
    await userEvent.click(canvas.getByText("Reports"));
    await expect(combobox).toHaveFocus();
  },
};
