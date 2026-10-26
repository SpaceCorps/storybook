import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { sv } from "date-fns/locale";
import { describe, expect, it } from "vite-plus/test";
import { Calendar } from "../src/components/ui/calendar";

/**
 * The two boxes in the Calendar caption were named "Month" and "Year" in the source, so a calendar
 * in another language (`locale` translates the month and weekday names, nothing else) read two
 * English words to a screen reader. `monthLabel` and `yearLabel` replace them.
 */
const october = new Date(2026, 9, 1);

describe("Calendar caption box names", () => {
  it("names the boxes Month and Year by default", () => {
    render(<Calendar defaultMonth={october} />);
    expect(screen.getByRole("textbox", { name: "Month" })).toHaveValue("10");
    expect(screen.getByRole("textbox", { name: "Year" })).toHaveValue("2026");
  });

  it("takes the names from monthLabel and yearLabel", () => {
    render(<Calendar defaultMonth={october} locale={sv} monthLabel="Månad" yearLabel="År" />);
    expect(screen.getByRole("textbox", { name: "Månad" })).toHaveValue("10");
    expect(screen.getByRole("textbox", { name: "År" })).toHaveValue("2026");
    expect(screen.queryByRole("textbox", { name: "Month" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Year" })).not.toBeInTheDocument();
  });

  it("changes one name and leaves the other at its default", () => {
    render(<Calendar defaultMonth={october} monthLabel="Mes" />);
    expect(screen.getByRole("textbox", { name: "Mes" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Year" })).toBeInTheDocument();
  });

  it("names the boxes of every month a calendar shows", () => {
    render(
      <Calendar
        numberOfMonths={2}
        defaultMonth={october}
        locale={sv}
        monthLabel="Månad"
        yearLabel="År"
      />,
    );
    expect(screen.getAllByRole("textbox", { name: "Månad" })).toHaveLength(2);
    expect(screen.getAllByRole("textbox", { name: "År" })).toHaveLength(2);
  });

  it("follows a change of the labels", () => {
    const { rerender } = render(<Calendar defaultMonth={october} monthLabel="Month" />);
    expect(screen.getByRole("textbox", { name: "Month" })).toBeInTheDocument();

    rerender(<Calendar defaultMonth={october} monthLabel="Månad" yearLabel="År" />);

    expect(screen.getByRole("textbox", { name: "Månad" })).toHaveValue("10");
    expect(screen.getByRole("textbox", { name: "År" })).toHaveValue("2026");
    expect(screen.queryByRole("textbox", { name: "Month" })).not.toBeInTheDocument();
  });

  it("does not pass the labels on to the DOM", () => {
    const { container } = render(
      <Calendar defaultMonth={october} monthLabel="Månad" yearLabel="År" />,
    );
    expect(container.querySelector("[monthlabel], [yearlabel]")).toBeNull();
  });
});
