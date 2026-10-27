import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vite-plus/test";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../src/components/ui/form";
import { DateRangePicker } from "../src/components/ui/date-picker";
import { Input } from "../src/components/ui/input";
import { MultipleSelector } from "../src/components/ui/multiselect";
import { RadioGroup, RadioGroupItem } from "../src/components/ui/radio-group";

interface Values {
  email: string;
}

function Harness({
  describe: withDescription = true,
  required = false,
  rawInput = false,
}: {
  describe?: boolean;
  required?: boolean;
  rawInput?: boolean;
}) {
  const form = useForm<Values>({ defaultValues: { email: "" } });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => {})}>
        <FormField
          control={form.control}
          name="email"
          rules={{ required: "Enter an email address." }}
          render={({ field }) => (
            <FormItem required={required}>
              <FormLabel>Email</FormLabel>
              <FormControl>{rawInput ? <input {...field} /> : <Input {...field} />}</FormControl>
              {withDescription ? <FormDescription>We never share it.</FormDescription> : null}
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Save</button>
      </form>
    </Form>
  );
}

describe("react-hook-form Form on the Field context", () => {
  it("wires the label to the control", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Email");
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("name", "email");
  });

  it("lists the description, and only the description, while valid", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAccessibleDescription("We never share it.");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("does not list a description that is not rendered", () => {
    render(<Harness describe={false} />);
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-describedby");
  });

  it("marks the control invalid, with the message as an alert in its description", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Enter an email address.");
    await waitFor(() => {
      const input = screen.getByLabelText("Email");
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAccessibleDescription("We never share it. Enter an email address.");
    });
  });

  it("does the same for a plain element in FormControl", async () => {
    const user = userEvent.setup();
    render(<Harness rawInput />);
    const input = screen.getByLabelText("Email");
    expect(input).not.toHaveAttribute("aria-invalid");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
    expect(input.getAttribute("aria-describedby")!.split(" ")).toHaveLength(2);
  });

  it("has no repeated ids in aria-describedby", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid"));
    const ids = screen.getByLabelText("Email").getAttribute("aria-describedby")!.split(" ");
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(document.getElementById(id)).not.toBeNull();
  });

  it("sets aria-required and an aria-hidden asterisk for a required item", () => {
    render(<Harness required />);
    expect(screen.getByLabelText(/Email/)).toHaveAttribute("aria-required", "true");
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("drops a removed description from the control's description", () => {
    const Toggle = () => {
      const [show, setShow] = React.useState(true);
      return (
        <>
          <button type="button" onClick={() => setShow(false)}>
            Hide
          </button>
          <Form {...useForm<Values>({ defaultValues: { email: "" } })}>
            <FormField
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  {show ? <FormDescription>Hint</FormDescription> : null}
                </FormItem>
              )}
            />
          </Form>
        </>
      );
    };
    render(<Toggle />);
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Hint");
    return userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Hide" }))
      .then(() => {
        expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-describedby");
      });
  });
});

interface ControlValues {
  tags: string[];
  period: { from: string; to: string };
  delivery: string;
}

function ControlsHarness({ label = true }: { label?: boolean }) {
  const form = useForm<ControlValues>({
    defaultValues: { tags: [], period: { from: "", to: "" }, delivery: "" },
  });
  return (
    <Form {...form}>
      <form>
        <FormField
          control={form.control}
          name="tags"
          render={() => (
            <FormItem>
              {label ? <FormLabel>Tags</FormLabel> : null}
              <FormControl>
                <MultipleSelector
                  defaultOptions={[
                    { value: "a", label: "A" },
                    { value: "b", label: "B" },
                  ]}
                  value={[]}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="period"
          render={() => (
            <FormItem>
              {label ? <FormLabel>Period</FormLabel> : null}
              <FormControl>
                <DateRangePicker />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="delivery"
          render={() => (
            <FormItem>
              {label ? <FormLabel>Delivery</FormLabel> : null}
              <FormControl>
                <RadioGroup>
                  <RadioGroupItem value="email" aria-label="E-invoice" />
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

describe("Form controls that name themselves", () => {
  it("names a MultipleSelector after the FormLabel, and a click on the label focuses it", async () => {
    render(<ControlsHarness />);
    const combobox = screen.getByRole("combobox", { name: "Tags" });

    await userEvent.setup().click(screen.getByText("Tags", { selector: "label" }));
    expect(combobox).toHaveFocus();
    expect((screen.getByText("Tags", { selector: "label" }) as HTMLLabelElement).control).toBe(
      combobox,
    );
  });

  it("puts the id on a DateRangePicker's first input only, so its FormLabel focuses it", async () => {
    render(<ControlsHarness />);
    const ids = Array.from(document.querySelectorAll("[id]")).map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);

    const label = screen.getByText("Period", { selector: "label" }) as HTMLLabelElement;
    expect(label.control).toBe(screen.getByLabelText("From date"));
    await userEvent.setup().click(label);
    expect(screen.getByLabelText("From date")).toHaveFocus();
  });

  it("names a RadioGroup after the FormLabel", () => {
    render(<ControlsHarness />);
    expect(screen.getByRole("radiogroup", { name: "Delivery" })).toBeInTheDocument();
  });

  it("does not point a RadioGroup, a DateRangePicker or a MultipleSelector at a label that is not there", () => {
    render(<ControlsHarness label={false} />);
    for (const element of [
      screen.getByRole("radiogroup"),
      screen.getByRole("group"),
      screen.getByRole("combobox"),
    ]) {
      const labelledBy = element.getAttribute("aria-labelledby");
      for (const id of (labelledBy ?? "").split(/\s+/).filter(Boolean)) {
        expect(document.getElementById(id), `${element.tagName} -> #${id}`).not.toBeNull();
      }
    }
    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-labelledby");
  });
});

describe("Form item spacing", () => {
  it("lays its label, control and message out as a grid with a gap, as a Field does", () => {
    render(<Harness />);
    const item = screen.getByText("Email", { selector: "label" }).parentElement as HTMLElement;
    // `gap-*` on a block `div` is a dead class: it left the label flush on the control.
    expect(item).toHaveClass("grid", "gap-1.5");
  });

  it("never carries a gap class without a grid or flex to apply it", () => {
    const { container } = render(<Harness />);
    for (const element of container.querySelectorAll<HTMLElement>("[class*='gap-']")) {
      expect(element.className, element.outerHTML).toMatch(/\b(grid|flex|inline-flex)\b/);
    }
  });
});
