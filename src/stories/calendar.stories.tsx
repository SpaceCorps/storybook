import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Calendar } from "@/components/ui/calendar";
import { sv } from "date-fns/locale";
import * as React from "react";

const meta: Meta<typeof Calendar> = {
  title: "UI/Calendar",
  component: Calendar,
  parameters: {
    // Seeded with `new Date()`, so the rendered month and the "today" ring change daily.
    visual: { disable: true },
  },
};

export default meta;

const CalendarDemo = () => {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      className="rounded-md border w-fit"
    />
  );
};

export const Default: StoryObj<typeof Calendar> = {
  render: () => <CalendarDemo />,
};

/** The month and year boxes in the caption take digits; Enter jumps there and keeps focus in the box. */
export const MonthAndYear: StoryObj<typeof Calendar> = {
  render: () => (
    <Calendar
      mode="single"
      defaultMonth={new Date(2026, 9, 1)}
      className="rounded-md border w-fit"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const month = canvas.getByRole("textbox", { name: "Month" });
    await userEvent.clear(month);
    await userEvent.type(month, "3{Enter}");
    await expect(month).toHaveFocus();
    await expect(canvas.getByRole("grid")).toBeInTheDocument();
  },
};

/**
 * Month and weekday names follow `locale`; the boxes in the caption stay numbers, one pair per
 * month, so the month on show is never blank. Moving to another month is announced. `locale` does not
 * reach the two boxes' own names, so `monthLabel` and `yearLabel` translate them.
 */
export const Swedish: StoryObj<typeof Calendar> = {
  render: () => (
    <Calendar
      mode="single"
      locale={sv}
      monthLabel="Månad"
      yearLabel="År"
      numberOfMonths={2}
      weekStartsOn={1}
      defaultMonth={new Date(2026, 9, 1)}
      className="rounded-md border w-fit"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const months = canvas.getAllByRole("textbox", { name: "Månad" }) as HTMLInputElement[];
    await expect(months.map((box) => box.value)).toEqual(["10", "11"]);
    await expect(canvas.getAllByRole("textbox", { name: "År" })).toHaveLength(2);
    await expect(canvas.getAllByRole("grid")[0]).toHaveAccessibleName(/oktober 2026/i);
  },
};
