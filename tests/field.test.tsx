import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { NumberInput } from "../src/components/NumberInput";
import { Checkbox } from "../src/components/ui/checkbox";
import { DatePicker, DateRangePicker } from "../src/components/ui/date-picker";
import { Field, FieldReset, useFieldControl } from "../src/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../src/components/ui/dialog";
import { Input } from "../src/components/ui/input";
import { Label } from "../src/components/ui/label";
import { MultipleSelector } from "../src/components/ui/multiselect";
import { RadioGroup, RadioGroupItem } from "../src/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../src/components/ui/select";
import { selectItemVariant } from "../src/components/ui/select/variant";
import { Switch } from "../src/components/ui/switch";
import { Textarea } from "../src/components/ui/textarea";
import { TimeInput } from "../src/components/ui/time-input";

const attributesOf = (element: Element) =>
  Object.fromEntries(Array.from(element.attributes).map((a) => [a.name, a.value]));

describe("Field", () => {
  it("names the control through the label", async () => {
    render(
      <Field label="Username">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Username");
    expect(input.tagName).toBe("INPUT");
    await userEvent.setup().click(screen.getByText("Username"));
    expect(input).toHaveFocus();
  });

  it("generates an id per field, stable across renders", () => {
    const { rerender } = render(
      <>
        <Field label="One">
          <Input />
        </Field>
        <Field label="Two">
          <Input />
        </Field>
      </>,
    );
    const first = screen.getByLabelText("One").id;
    const second = screen.getByLabelText("Two").id;
    expect(first).toBeTruthy();
    expect(first).not.toBe(second);

    rerender(
      <>
        <Field label="One">
          <Input />
        </Field>
        <Field label="Two">
          <Input />
        </Field>
      </>,
    );
    expect(screen.getByLabelText("One").id).toBe(first);
  });

  it("uses the id prop when given", () => {
    render(
      <Field label="Name" id="customer-name">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Name").id).toBe("customer-name");
  });

  it("describes the control with the hint", () => {
    render(
      <Field label="Name" hint="As on the invoice.">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAccessibleDescription("As on the invoice.");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("marks the control invalid and describes it with hint then error, as an alert", () => {
    const { rerender } = render(
      <Field label="Name" hint="As on the invoice." error="Required.">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("As on the invoice. Required.");
    const ids = input.getAttribute("aria-describedby")!.split(" ");
    expect(document.getElementById(ids[0])).toHaveTextContent("As on the invoice.");
    expect(document.getElementById(ids[1])).toHaveAttribute("role", "alert");

    rerender(
      <Field label="Name" hint="As on the invoice.">
        <Input />
      </Field>,
    );
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input.getAttribute("aria-describedby")).toBe(ids[0]);
    expect(document.getElementById(ids[1])).toBeNull();
  });

  it("never lists an id that is not on the page", () => {
    render(
      <Field label="Name">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-describedby");
  });

  it("lets invalid be set without a message", () => {
    render(
      <Field label="Name" invalid>
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
  });

  it("joins a describedby the caller passed instead of replacing it", () => {
    render(
      <>
        <p id="extra">Extra</p>
        <Field label="Name" hint="Hint">
          <Input aria-describedby="extra" />
        </Field>
      </>,
    );
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Extra Hint");
  });

  it("lets explicit props on the control win", () => {
    render(
      <Field label="Name" name="from-field">
        <Input id="mine" name="mine" aria-label="Mine" />
      </Field>,
    );
    const input = screen.getByLabelText("Mine");
    expect(input.id).toBe("mine");
    expect(input).toHaveAttribute("name", "mine");
  });

  it("sets aria-required, not the native attribute, and hides the asterisk from assistive technology", () => {
    render(
      <Field label="Name" required>
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText(/Name/);
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).not.toHaveAttribute("required");
    const asterisk = screen.getByText("*");
    expect(asterisk).toHaveAttribute("aria-hidden", "true");
  });

  it("disables the control and gives it the field's name", () => {
    render(
      <Field label="Name" disabled name="customer">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Name");
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("name", "customer");
  });

  it("hides the label visually but keeps it for assistive technology", () => {
    render(
      <Field label="Search" hideLabel>
        <Input />
      </Field>,
    );
    expect(screen.getByText("Search")).toHaveClass("sr-only");
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });

  it("puts the control before the label when horizontal", () => {
    render(
      <Field label="Accept" orientation="horizontal">
        <Checkbox />
      </Field>,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Accept" });
    const label = screen.getByText("Accept");
    expect(checkbox.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("gives no id or description to a control inside FieldReset", () => {
    render(
      <Field label="Outer" hint="Outer hint" error="Outer error">
        <Input />
        <FieldReset>
          <Input aria-label="Inner" />
        </FieldReset>
      </Field>,
    );
    const inner = screen.getByLabelText("Inner");
    expect(inner).not.toHaveAttribute("id");
    expect(inner).not.toHaveAttribute("aria-describedby");
    expect(inner).not.toHaveAttribute("aria-invalid");
  });

  it("has no duplicate ids with several controls in one field", () => {
    render(
      <Field label="Date" hint="Hint" error="Error">
        <DatePicker />
      </Field>,
    );
    const ids = Array.from(document.querySelectorAll("[id]")).map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("useFieldControl", () => {
  it("returns the props untouched outside a field", () => {
    const Probe = () => {
      const resolved = useFieldControl({ id: "x", "aria-describedby": "y" });
      return <output data-testid="out">{JSON.stringify(resolved)}</output>;
    };
    render(<Probe />);
    expect(JSON.parse(screen.getByTestId("out").textContent!)).toEqual({
      id: "x",
      "aria-describedby": "y",
    });
  });
});

describe("Field wiring per control", () => {
  it("Textarea", () => {
    render(
      <Field label="Notes" hint="Shown on the invoice." error="Too long.">
        <Textarea />
      </Field>,
    );
    const textarea = screen.getByLabelText("Notes");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAccessibleDescription("Shown on the invoice. Too long.");
  });

  it("Checkbox, with name and required reaching the button and the form", () => {
    render(
      <form>
        <Field label="Accept terms" name="terms" required error="You must accept.">
          <Checkbox />
        </Field>
      </form>,
    );
    const checkbox = screen.getByRole("checkbox", { name: /Accept terms/ });
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(checkbox).toHaveAttribute("aria-required", "true");
    expect(checkbox).toHaveAccessibleDescription("You must accept.");
    expect(document.querySelector('input[name="terms"]')).not.toBeNull();
  });

  it("Checkbox accepts name, required and value props", () => {
    render(
      <form>
        <Checkbox aria-label="Plain" name="plain" value="yes" required />
      </form>,
    );
    const bubble = document.querySelector('input[name="plain"]');
    expect(bubble).toHaveAttribute("value", "yes");
    expect(bubble).toBeRequired();
  });

  it("Switch", () => {
    render(
      <Field label="Reminders" hint="Three days before." orientation="horizontal">
        <Switch />
      </Field>,
    );
    const toggle = screen.getByRole("switch", { name: "Reminders" });
    expect(toggle).toHaveAccessibleDescription("Three days before.");
  });

  it("Select puts the id on the trigger and the name on the form", () => {
    render(
      <form>
        <Field label="Currency" hint="For new invoices." name="currency" error="Pick one.">
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sek">SEK</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </form>,
    );
    const trigger = screen.getByRole("combobox", { name: "Currency" });
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAccessibleDescription("For new invoices. Pick one.");
    expect(document.querySelector('[name="currency"]')).not.toBeNull();
  });

  it("Select gives the form one element for the name, not the trigger and the select both", () => {
    const { container } = render(
      <form>
        <Field label="Currency" name="currency">
          <Select defaultValue="sek">
            <SelectTrigger>
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sek">SEK</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </form>,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    const trigger = screen.getByRole("combobox", { name: "Currency" });
    expect(trigger).not.toHaveAttribute("name");
    expect(form.querySelectorAll('[name="currency"]')).toHaveLength(1);
    expect(form.elements.namedItem("currency")).toBeInstanceOf(HTMLSelectElement);
    expect((form.elements.namedItem("currency") as HTMLSelectElement).value).toBe("sek");
  });

  it("Select works as before outside a field", () => {
    render(
      <Select>
        <SelectTrigger aria-label="Plain">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = screen.getByRole("combobox", { name: "Plain" });
    expect(trigger).not.toHaveAttribute("aria-invalid");
    expect(trigger).not.toHaveAttribute("aria-describedby");
  });

  it("NumberInput", () => {
    render(
      <Field label="Amount" hint="Excluding VAT." error="Required.">
        <NumberInput value={null} />
      </Field>,
    );
    const input = screen.getByLabelText("Amount");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Excluding VAT. Required.");
  });

  it("NumberInput accepts id, name, required and aria props directly", () => {
    render(
      <NumberInput
        value={3}
        id="qty"
        name="quantity"
        required
        aria-describedby="qty-help"
        aria-label="Quantity"
      />,
    );
    const input = screen.getByLabelText("Quantity");
    expect(input.id).toBe("qty");
    // The name is on a hidden input holding the number, not on the formatted text being edited.
    expect(input).not.toHaveAttribute("name");
    expect(document.querySelector('input[type="hidden"][name="quantity"]')).toHaveAttribute(
      "value",
      "3",
    );
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-describedby", "qty-help");
  });

  it("NumberInput submits the number under the field's name, not its formatted text", () => {
    const { container } = render(
      <form>
        <Field label="Amount" name="amount">
          <NumberInput value={1234567.5} />
        </Field>
        <Field label="Size" name="size">
          <NumberInput value={1536} isBytesFormat />
        </Field>
      </form>,
    );
    expect(screen.getByLabelText("Amount")).toHaveValue("1,234,567.5");
    expect(screen.getByLabelText("Size")).toHaveValue("1.50 KB");
    const form = container.querySelector("form") as HTMLFormElement;
    expect(Array.from(new FormData(form).entries())).toEqual([
      ["amount", "1234567.5"],
      ["size", "1536"],
    ]);
    // One element per name, and the field's id and description stay on the visible input.
    expect(form.querySelectorAll('[name="amount"]')).toHaveLength(1);
  });

  it("NumberInput submits an empty number as an empty string", () => {
    const { container } = render(
      <form>
        <Field label="Amount" name="amount">
          <NumberInput value={null} />
        </Field>
      </form>,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    expect(new FormData(form).get("amount")).toBe("");
  });

  it("DatePicker puts the id on the text field and the name on a hidden input", () => {
    render(
      <Field label="Invoice date" name="invoice-date" hint="ISO format." error="Pick a date.">
        <DatePicker defaultValue="2026-10-23" />
      </Field>,
    );
    const input = screen.getByLabelText("Invoice date");
    expect(input).toHaveValue("2026-10-23");
    expect(input).not.toHaveAttribute("name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("ISO format. Pick a date.");
    const hidden = document.querySelector('input[type="hidden"][name="invoice-date"]');
    expect(hidden).toHaveAttribute("value", "2026-10-23");
  });

  it("DateRangePicker is a named group whose inputs carry the state, and submits two hidden values", () => {
    render(
      <Field label="Period" name="period" hint="Both included." error="Pick a period.">
        <DateRangePicker defaultValue={{ from: "2026-10-01", to: "2026-10-31" }} />
      </Field>,
    );
    const group = screen.getByRole("group", { name: "Period" });
    expect(group).toHaveAccessibleDescription("Both included. Pick a period.");
    expect(group).not.toHaveAttribute("aria-invalid");
    const from = within(group).getByLabelText("From date");
    const to = within(group).getByLabelText("To date");
    for (const input of [from, to]) {
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).not.toHaveAttribute("name");
    }
    expect(document.querySelector('input[name="period-from"]')).toHaveAttribute(
      "value",
      "2026-10-01",
    );
    expect(document.querySelector('input[name="period-to"]')).toHaveAttribute(
      "value",
      "2026-10-31",
    );
    // The label focuses the first input.
    expect(document.querySelector('label[for="' + from.id + '"]')).not.toBeNull();
  });

  it("DateRangePicker puts the field's id on the first input only, and a click on the label focuses it", async () => {
    render(
      <Field label="Period">
        <DateRangePicker defaultValue={{ from: "2026-10-01", to: "2026-10-31" }} />
      </Field>,
    );
    const from = screen.getByLabelText("From date");
    const ids = Array.from(document.querySelectorAll("[id]")).map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(screen.getByRole("group", { name: "Period" })).not.toHaveAttribute("id", from.id);

    const label = screen.getByText("Period", { selector: "label" }) as HTMLLabelElement;
    expect(label.control).toBe(from);
    await userEvent.setup().click(label);
    expect(from).toHaveFocus();
  });

  it("DateRangePicker keeps one element per explicit id, on the first input", () => {
    render(
      <>
        <label htmlFor="period">Period</label>
        <DateRangePicker id="period" />
      </>,
    );
    const matches = document.querySelectorAll("#period");
    expect(matches).toHaveLength(1);
    expect(matches[0]).toBe(screen.getByLabelText("From date"));
    expect((screen.getByText("Period", { selector: "label" }) as HTMLLabelElement).control).toBe(
      matches[0],
    );
  });

  it("DateRangePicker draws its invalid frame from the inputs, which carry aria-invalid", () => {
    render(
      <Field label="Period" error="Pick a period.">
        <DateRangePicker />
      </Field>,
    );
    const group = screen.getByRole("group", { name: "Period" });
    expect(group).not.toHaveAttribute("aria-invalid");
    expect(within(group).getByLabelText("From date")).toHaveAttribute("aria-invalid", "true");
    expect(group.classList.contains("has-[input[aria-invalid=true]]:border-destructive")).toBe(
      true,
    );
    expect(
      group.classList.contains("dark:has-[input[aria-invalid=true]]:focus-within:ring-red"),
    ).toBe(true);
  });

  it("MultipleSelector is named by the field, described by it, and its label points at the input", () => {
    render(
      <Field label="Reports" name="reports" hint="Pick some." error="At least one.">
        <MultipleSelector
          defaultOptions={[
            { value: "a", label: "A" },
            { value: "b", label: "B" },
          ]}
          value={[{ value: "a", label: "A" }]}
        />
      </Field>,
    );
    const combobox = screen.getByRole("combobox", { name: "Reports" });
    expect(combobox).toHaveAttribute("aria-invalid", "true");
    expect(combobox).toHaveAccessibleDescription("Pick some. At least one.");
    expect(document.querySelector('input[type="hidden"][name="reports"]')).toHaveAttribute(
      "value",
      "a",
    );
    const label = screen.getByText("Reports", { selector: "label[id]:not([cmdk-label])" });
    expect(label).toHaveAttribute("for", combobox.id);
  });

  it("MultipleSelector is named by a label that is not a plain string", async () => {
    render(
      <Field
        label={
          <span>
            Reports <em>(optional)</em>
          </span>
        }
      >
        <MultipleSelector defaultOptions={[{ value: "a", label: "A" }]} value={[]} />
      </Field>,
    );
    const combobox = screen.getByRole("combobox", { name: "Reports (optional)" });
    // The visible label names it by reference, and the sr-only cmdk label does not repeat it.
    expect(combobox.getAttribute("aria-labelledby")).toMatch(/-label$/);
    await userEvent.setup().click(screen.getByText("Reports"));
    expect(combobox).toHaveFocus();
  });

  it("MultipleSelector keeps an aria-label the caller gave it over the field's label", () => {
    render(
      <Field label="Reports">
        <MultipleSelector aria-label="Report types" defaultOptions={[]} value={[]} />
      </Field>,
    );
    expect(screen.getByRole("combobox", { name: "Report types" })).toBeInTheDocument();
  });

  it("RadioGroup is named by the field's label", () => {
    render(
      <Field label="Delivery" hint="For new customers.">
        <RadioGroup name="delivery">
          <Label>
            <RadioGroupItem value="email" /> E-invoice
          </Label>
        </RadioGroup>
      </Field>,
    );
    const group = screen.getByRole("radiogroup", { name: "Delivery" });
    expect(group).toHaveAccessibleDescription("For new customers.");
  });

  it("RadioGroup keeps an aria-label the caller gave it", () => {
    render(
      <Field label="Delivery">
        <RadioGroup aria-label="How to deliver">
          <RadioGroupItem value="email" aria-label="E-invoice" />
        </RadioGroup>
      </Field>,
    );
    expect(screen.getByRole("radiogroup", { name: "How to deliver" })).toBeInTheDocument();
  });
});

describe("controls outside a Field", () => {
  it("render exactly the attributes they always did", () => {
    const { container } = render(
      <>
        <Input data-testid="input" />
        <Textarea data-testid="textarea" />
        <Checkbox data-testid="checkbox" />
        <Switch data-testid="switch" />
      </>,
    );
    expect(attributesOf(screen.getByTestId("input"))).toEqual({
      "data-testid": "input",
      "data-1p-ignore": "true",
      autocomplete: "off",
      class: expect.any(String),
    });
    for (const id of ["textarea", "checkbox", "switch"]) {
      const attributes = attributesOf(screen.getByTestId(id));
      expect(attributes).not.toHaveProperty("id");
      expect(attributes).not.toHaveProperty("aria-describedby");
      expect(attributes).not.toHaveProperty("aria-invalid");
      expect(attributes).not.toHaveProperty("aria-required");
    }
    expect(container.querySelector("[id]")).toBeNull();
  });
});

describe("Field and overlays", () => {
  it("does not hand the surrounding field to a form inside a Dialog or Popover", async () => {
    const user = userEvent.setup();
    render(
      <Field label="Project" hint="Pick one" error="Required">
        <Input aria-label="outer" />
        <Dialog>
          <DialogTrigger>Add project</DialogTrigger>
          <DialogContent>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Create it</DialogDescription>
            <Input aria-label="inner" />
          </DialogContent>
        </Dialog>
      </Field>,
    );

    await user.click(screen.getByRole("button", { name: "Add project" }));

    const outer = screen.getByLabelText("outer");
    const inner = screen.getByLabelText("inner");
    expect(outer).toHaveAttribute("aria-invalid", "true");
    expect(inner).not.toHaveAttribute("id");
    expect(inner).not.toHaveAttribute("aria-invalid");
    expect(inner).not.toHaveAttribute("aria-describedby");
  });
});

describe("Field and TimeInput", () => {
  it("labels the time field and carries the hint and error", () => {
    render(
      <Field label="From" hint="24-hour" error="Too early">
        <TimeInput />
      </Field>,
    );
    const input = screen.getByLabelText("From");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("24-hour Too early");
  });

  it("submits one entry under the field's name, from the hidden input and not the visible one", () => {
    const { container } = render(
      <form>
        <Field label="From" name="from">
          <TimeInput defaultValue="09:30" />
        </Field>
      </form>,
    );
    const form = container.querySelector("form") as HTMLFormElement;

    // The visible input holds whatever is being typed; only the committed HH:MM may be submitted.
    expect(Array.from(new FormData(form).entries())).toEqual([["from", "09:30"]]);
    expect(form.querySelectorAll('[name="from"]')).toHaveLength(1);
    expect(screen.getByLabelText("From")).not.toHaveAttribute("name");
    expect(container.querySelector('input[name="from"]')).toHaveAttribute("type", "hidden");
  });

  it("does not let the field's id, hint or error reach anything but the visible input", () => {
    render(
      <Field label="From" hint="24-hour" error="Too early" name="from">
        <TimeInput defaultValue="09:30" />
      </Field>,
    );
    const input = screen.getByLabelText("From");
    expect(document.querySelectorAll(`#${CSS.escape(input.id)}`)).toHaveLength(1);
    expect(document.querySelectorAll("[aria-describedby]")).toHaveLength(1);
    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(1);
  });

  it("disables the input, the clock button and the hidden input together", () => {
    const { container } = render(
      <form>
        <Field label="From" name="from" disabled>
          <TimeInput defaultValue="09:30" />
        </Field>
      </form>,
    );
    const form = container.querySelector("form") as HTMLFormElement;

    expect(screen.getByLabelText("From")).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Choose time/ })).toBeDisabled();
    expect(container.querySelector('input[type="hidden"]')).toBeDisabled();
    expect(new FormData(form).has("from")).toBe(false);
  });

  it("marks the input required for assistive technology only", () => {
    render(
      <Field label="From" required>
        <TimeInput />
      </Field>,
    );
    // The label reads "From *", and the clock button's name contains "From" too.
    const input = screen.getByRole("textbox", { name: /From/ });
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).not.toHaveAttribute("required");
  });

  it("names the clock button and the list after the field's label", async () => {
    render(
      <>
        <Field label="From">
          <TimeInput />
        </Field>
        <Field label="To">
          <TimeInput />
        </Field>
      </>,
    );
    expect(screen.getByRole("button", { name: "Choose time From" })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Choose time To" }));
    expect(screen.getByRole("listbox", { name: "Suggested times To" })).toBeInTheDocument();
  });

  it("keeps the field's wiring off the list that opens from it", async () => {
    render(
      <Field label="From" hint="24-hour" error="Too early" name="from">
        <TimeInput defaultValue="09:30" />
      </Field>,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /^Choose time/ }));

    const list = screen.getByRole("listbox");
    expect(list).not.toHaveAttribute("aria-describedby");
    expect(list).not.toHaveAttribute("aria-invalid");
    for (const option of within(list).getAllByRole("option")) {
      expect(option).not.toHaveAttribute("id");
      expect(option).not.toHaveAttribute("name");
    }
  });
});

/** WCAG relative luminance and contrast ratio for a `#rrggbb` colour. */
function contrast(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((start) => {
      const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("invalid controls in the dark theme", () => {
  const tokens = readFileSync(resolve(import.meta.dirname, "../src/styles/tokens.css"), "utf-8");
  /** The declarations of the token block that starts at `selector` in the first column. */
  const block = (selector: ":root" | ".dark") => {
    const start = tokens.indexOf(`\n${selector} {`);
    return tokens.slice(start, tokens.indexOf("\n}", start));
  };
  const token = (scope: string, name: string) =>
    new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(scope)![1];

  it("draws the border and focus ring in a colour that is 3:1 on the dark page", () => {
    const dark = block(".dark");
    // The `destructive` fill is a dark red that is only 2:1 on the page; the named `red` step is not.
    expect(contrast(token(dark, "destructive"), token(dark, "background"))).toBeLessThan(3);
    expect(contrast(token(dark, "red"), token(dark, "background"))).toBeGreaterThanOrEqual(3);
  });

  it("keeps the light theme's destructive border and ring at 3:1", () => {
    const light = block(":root");
    expect(
      contrast(token(light, "destructive"), token(light, "background")),
    ).toBeGreaterThanOrEqual(3);
  });

  it("puts the dark red on the border and the focus ring of every kind of invalid control", () => {
    render(
      <>
        <Input aria-label="input" aria-invalid />
        <Textarea aria-label="textarea" aria-invalid />
        <Checkbox aria-label="checkbox" aria-invalid />
        <Switch aria-label="switch" aria-invalid />
        <Select>
          <SelectTrigger aria-label="select" aria-invalid>
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
        <RadioGroup aria-label="radio" aria-invalid>
          <RadioGroupItem value="a" aria-label="a" />
        </RadioGroup>
      </>,
    );
    const has = (element: HTMLElement, ...classes: string[]) =>
      classes.every((name) => element.classList.contains(name));

    expect(
      has(
        screen.getByLabelText("input"),
        "dark:aria-invalid:border-red",
        "dark:aria-invalid:focus-visible:ring-red",
      ),
    ).toBe(true);
    expect(
      has(
        screen.getByLabelText("textarea"),
        "dark:aria-invalid:border-red",
        "dark:aria-invalid:focus-visible:ring-red",
      ),
    ).toBe(true);
    expect(
      has(
        screen.getByRole("checkbox", { name: "checkbox" }),
        "dark:aria-invalid:border-red",
        "dark:aria-invalid:focus-visible:ring-red",
      ),
    ).toBe(true);
    expect(
      has(
        screen.getByRole("switch", { name: "switch" }),
        "dark:aria-invalid:ring-red",
        "dark:aria-invalid:focus-visible:ring-red",
      ),
    ).toBe(true);
    expect(
      has(
        screen.getByRole("combobox", { name: "select" }),
        "dark:aria-invalid:border-red",
        "dark:aria-invalid:focus:ring-red",
      ),
    ).toBe(true);
    expect(
      has(
        screen.getByRole("radio", { name: "a" }),
        "dark:group-aria-invalid/radiogroup:border-red",
        "dark:group-aria-invalid/radiogroup:focus-visible:ring-red",
      ),
    ).toBe(true);
  });

  it("keeps an invalid switch's focus ring as wide as a valid one's", () => {
    render(
      <>
        <Switch aria-label="valid" />
        <Switch aria-label="invalid" aria-invalid />
      </>,
    );
    const valid = screen.getByRole("switch", { name: "valid" });
    const invalid = screen.getByRole("switch", { name: "invalid" });
    expect(valid.classList.contains("focus-visible:ring-2")).toBe(true);
    // `aria-invalid:ring-1` outranked `focus-visible:ring-2`, so it only applies while not focused.
    expect(invalid.classList.contains("aria-invalid:ring-1")).toBe(false);
    expect(invalid.classList.contains("aria-invalid:not-focus-visible:ring-1")).toBe(true);
  });
});

describe("Select item", () => {
  it("draws its focus ring for the keyboard, and not for a pointer that is only hovering", () => {
    // Radix focuses an item as the pointer moves over it, so `focus:` alone paints a ring on hover.
    const classes = selectItemVariant().split(" ");
    expect(classes).toContain("focus:ring-1");
    expect(classes).toContain("hover:focus:ring-0");
  });
});
