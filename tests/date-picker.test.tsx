import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  DatePicker,
  DateRangePicker,
  compareIsoDates,
  formatIsoDate,
  isIsoDate,
  parseIsoDate,
  type DateRangeValue,
} from "../src/components/ui/date-picker";
import { formatTypedDate } from "../src/components/ui/date-picker/iso-date";

describe("iso-date helpers", () => {
  it("round-trips a local date without a UTC shift", () => {
    const date = parseIsoDate("2026-10-23")!;
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 23]);
    expect(formatIsoDate(date)).toBe("2026-10-23");
    // Midnight local time: `toISOString()` would have rolled this back a day east of Greenwich.
    expect(formatIsoDate(new Date(2026, 0, 1, 0, 0, 0))).toBe("2026-01-01");
  });

  it("rejects strings that are not real calendar dates", () => {
    for (const bad of ["", "2026-13-01", "2026-02-30", "2026-1-5", "26-10-23", "2026/10/23", "x"]) {
      expect(parseIsoDate(bad), bad).toBeUndefined();
    }
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(parseIsoDate(null)).toBeUndefined();
  });

  it("keeps years below 100 as written rather than mapping them to 19xx", () => {
    expect(formatIsoDate(parseIsoDate("0025-01-01")!)).toBe("0025-01-01");
  });

  it("formats keystrokes into a partial ISO date", () => {
    expect(formatTypedDate("2")).toBe("2");
    expect(formatTypedDate("2026")).toBe("2026");
    expect(formatTypedDate("20261")).toBe("2026-1");
    expect(formatTypedDate("202610")).toBe("2026-10");
    expect(formatTypedDate("2026102")).toBe("2026-10-2");
    expect(formatTypedDate("20261023")).toBe("2026-10-23");
    expect(formatTypedDate("2026/10/23")).toBe("2026-10-23");
    expect(formatTypedDate("2026-10-23-99")).toBe("2026-10-23");
    // A dash with nothing after it is dropped, so Backspace can walk back over it.
    expect(formatTypedDate("2026-")).toBe("2026");
    expect(formatTypedDate("abc")).toBe("");
  });

  it("orders ISO strings", () => {
    expect(compareIsoDates("2026-10-01", "2026-10-02")).toBe(-1);
    expect(compareIsoDates("2026-10-02", "2026-10-02")).toBe(0);
    expect(compareIsoDates("2027-01-01", "2026-12-31")).toBe(1);
  });
});

/** The weekday labels of the first open month, in column order. */
function weekdayHeaders(): string[] {
  const first = screen.getAllByRole("grid")[0];
  return Array.from(first.querySelectorAll(".rdp-weekday")).map((cell) => cell.textContent ?? "");
}

describe("DatePicker", () => {
  it("shows the value as yyyy-mm-dd and says so in its placeholder", () => {
    render(<DatePicker aria-label="Date" value="2026-10-23" onChange={vi.fn()} />);
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe("2026-10-23");

    render(<DatePicker aria-label="Empty" value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Empty").getAttribute("placeholder")).toBe("yyyy-mm-dd");
  });

  it("commits digits typed as a date, adding the dashes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker aria-label="Date" value="" onChange={onChange} />);

    await user.type(screen.getByLabelText("Date"), "20261023");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("2026-10-23");
  });

  it("does not report half-typed or impossible dates, and drops them on blur", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker aria-label="Date" value="2026-10-23" onChange={onChange} />);
    const input = screen.getByLabelText("Date") as HTMLInputElement;

    await user.clear(input);
    onChange.mockClear();
    await user.type(input, "20261345");
    expect(input.value).toBe("2026-13-45");
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(input);
    // `clear()` reported "" and the parent here is a fixed prop, so the committed value is the prop.
    expect(input.value).toBe("2026-10-23");
  });

  it("reports an empty string when the field is emptied", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker aria-label="Date" value="2026-10-23" onChange={onChange} />);

    await user.clear(screen.getByLabelText("Date"));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("ignores typed dates outside min and max", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePicker
        aria-label="Date"
        value=""
        onChange={onChange}
        min="2026-10-01"
        max="2026-10-31"
      />,
    );

    await user.type(screen.getByLabelText("Date"), "20260930");
    expect(onChange).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Date"));
    await user.type(screen.getByLabelText("Date"), "20261015");
    expect(onChange).toHaveBeenLastCalledWith("2026-10-15");
  });

  it("works uncontrolled from defaultValue", async () => {
    const user = userEvent.setup();
    render(<DatePicker aria-label="Date" defaultValue="2026-10-23" />);
    const input = screen.getByLabelText("Date") as HTMLInputElement;
    expect(input.value).toBe("2026-10-23");

    await user.clear(input);
    await user.type(input, "20261105");
    expect(input.value).toBe("2026-11-05");
  });

  it("submits the ISO value under `name`", () => {
    const { container } = render(
      <DatePicker aria-label="Date" name="invoiceDate" value="2026-10-23" onChange={vi.fn()} />,
    );
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.name).toBe("invoiceDate");
    expect(hidden.value).toBe("2026-10-23");
  });

  it("opens a calendar that starts its weeks on Monday and picks a day", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker aria-label="Date" value="2026-10-23" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Choose date" }));

    expect(weekdayHeaders()).toEqual(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);

    await user.click(screen.getByRole("button", { name: /October 27th, 2026/ }));

    expect(onChange).toHaveBeenCalledWith("2026-10-27");
    expect(screen.queryByRole("grid")).toBeNull();
  }, 20_000);

  it("can be told to start the week on Sunday", async () => {
    const user = userEvent.setup();
    render(<DatePicker aria-label="Date" value="2026-10-23" weekStartsOn={0} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Choose date" }));

    expect(weekdayHeaders()[0]).toBe("Su");
  });

  it("opens the calendar with ArrowDown from the text field", async () => {
    const user = userEvent.setup();
    render(<DatePicker aria-label="Date" value="2026-10-23" onChange={vi.fn()} />);

    screen.getByLabelText("Date").focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("grid")).toBeDefined();
  });

  it("disables the days outside min and max in the calendar", async () => {
    const user = userEvent.setup();
    render(
      <DatePicker
        aria-label="Date"
        value="2026-10-15"
        min="2026-10-10"
        max="2026-10-20"
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Choose date" }));

    const day = (name: RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement;
    expect(day(/October 9th, 2026/).disabled).toBe(true);
    expect(day(/October 21st, 2026/).disabled).toBe(true);
    expect(day(/October 12th, 2026/).disabled).toBe(false);
  });

  it("disables both the field and the calendar button", () => {
    render(<DatePicker aria-label="Date" value="2026-10-23" disabled onChange={vi.fn()} />);
    expect((screen.getByLabelText("Date") as HTMLInputElement).disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Choose date" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe("DateRangePicker", () => {
  function Harness({ initial }: { initial: DateRangeValue }) {
    const [range, setRange] = React.useState(initial);
    return (
      <>
        <DateRangePicker value={range} onChange={setRange} />
        <output data-testid="range">{JSON.stringify(range)}</output>
      </>
    );
  }

  const readRange = (): DateRangeValue => JSON.parse(screen.getByTestId("range").textContent!);

  it("shows both ends as yyyy-mm-dd", () => {
    render(<Harness initial={{ from: "2026-10-01", to: "2026-10-31" }} />);
    expect((screen.getByLabelText("From date") as HTMLInputElement).value).toBe("2026-10-01");
    expect((screen.getByLabelText("To date") as HTMLInputElement).value).toBe("2026-10-31");
  });

  it("types each end on its own, and refuses an end before the start", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ from: "2026-10-10", to: "" }} />);

    await user.type(screen.getByLabelText("To date"), "20261001");
    expect(readRange()).toEqual({ from: "2026-10-10", to: "" });

    await user.clear(screen.getByLabelText("To date"));
    await user.type(screen.getByLabelText("To date"), "20261020");
    expect(readRange()).toEqual({ from: "2026-10-10", to: "2026-10-20" });
  });

  it("picks a range in the calendar: first click starts, second ends, a third starts over", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ from: "", to: "" }} />);

    await user.click(screen.getByRole("button", { name: "Choose date range" }));
    const grid = () => within(screen.getAllByRole("grid")[0]);

    await user.click(grid().getByRole("button", { name: /October 20th, 2026/ }));
    expect(readRange()).toEqual({ from: "2026-10-20", to: "" });
    expect(screen.getAllByRole("grid")).toHaveLength(2);

    // Ending before the start swaps the two.
    await user.click(grid().getByRole("button", { name: /October 12th, 2026/ }));
    expect(readRange()).toEqual({ from: "2026-10-12", to: "2026-10-20" });
    expect(screen.queryByRole("grid")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Choose date range" }));
    await user.click(grid().getByRole("button", { name: /October 14th, 2026/ }));
    expect(readRange()).toEqual({ from: "2026-10-14", to: "" });
  }, 20_000);
});
