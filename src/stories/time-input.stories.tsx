import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { TimeInput } from "@/components/ui/time-input";
import { Densities as DensityScale } from "@/types/density";

const meta: Meta<typeof TimeInput> = {
  title: "UI/TimeInput",
  component: TimeInput,
  parameters: {
    // The list opens in a portal and the stories seed times, so a screenshot adds nothing.
    visual: { disable: true },
  },
};

export default meta;

/** The value is the `HH:MM` string itself, so it can go straight into a form field or an API call. */
const Readout = ({ label, value }: { label: string; value: unknown }) => (
  <p className="text-sm text-muted-foreground">
    {label}:{" "}
    <code className="rounded-selector bg-muted px-1 py-0.5 text-foreground">
      {JSON.stringify(value)}
    </code>
  </p>
);

const DefaultDemo = () => {
  const [time, setTime] = React.useState("09:00");
  return (
    <div className="flex w-48 flex-col gap-2">
      <Label htmlFor="start-time">Start</Label>
      <TimeInput id="start-time" value={time} onChange={setTime} />
      <Readout label="value" value={time} />
    </div>
  );
};

/**
 * Shown and typed as 24-hour `HH:MM` whatever the browser's language. Type digits (`930` becomes
 * `09:30`), step with the arrow keys, or open the list from the clock button or with Alt+ArrowDown.
 */
export const Default: StoryObj = {
  render: () => <DefaultDemo />,
};

const EmptyDemo = () => {
  const [time, setTime] = React.useState("");
  return (
    <div className="flex w-48 flex-col gap-2">
      <TimeInput aria-label="End" value={time} onChange={setTime} />
      <p className="text-sm text-muted-foreground">
        Try <kbd>930</kbd>, <kbd>9.30</kbd> or <kbd>0930</kbd>, then Tab or Enter.
      </p>
      <Readout label="value" value={time} />
    </div>
  );
};

/**
 * No time yet. ArrowDown opens the list and ArrowUp starts at 09:00. Emptying the field reports
 * `""`. Text that is not a time (`9pm`, or a pasted `1:30 PM`: there is no AM/PM) is marked invalid
 * while it is in the field and dropped, with an announcement for screen readers, when it is left.
 */
export const Empty: StoryObj = {
  render: () => <EmptyDemo />,
};

const StepAndBoundsDemo = () => {
  const [time, setTime] = React.useState("09:15");
  return (
    <div className="flex w-48 flex-col gap-2">
      <Label htmlFor="shift-start">Shift start (08:00 to 18:00)</Label>
      <TimeInput
        id="shift-start"
        value={time}
        onChange={setTime}
        min="08:00"
        max="18:00"
        step={15}
        suggestionStep={60}
      />
      <Readout label="value" value={time} />
    </div>
  );
};

/**
 * `step` sets what the arrows move by, snapping to the grid (09:10 goes up to 09:15). `min` and `max`
 * stop the arrows, trim the list and make the field ignore typed times outside them.
 */
export const StepAndBounds: StoryObj = {
  render: () => <StepAndBoundsDemo />,
};

/** `suggestionStep={0}` leaves out the clock button and the list, which keeps the field narrow. */
export const NoPicker: StoryObj = {
  render: () => (
    <div className="w-28">
      <TimeInput aria-label="Time" defaultValue="13:45" suggestionStep={0} />
    </div>
  ),
};

export const Disabled: StoryObj = {
  render: () => (
    <div className="w-48">
      <TimeInput aria-label="Locked time" defaultValue="09:00" disabled />
    </div>
  ),
};

export const Densities: StoryObj = {
  render: () => (
    <div className="flex w-48 flex-col gap-3">
      {[DensityScale.Small, DensityScale.Medium, DensityScale.Large].map((density) => (
        <TimeInput
          key={density}
          aria-label={`${density} time`}
          density={density}
          defaultValue="09:00"
        />
      ))}
    </div>
  ),
};

interface LoggedTime {
  state: { date: string; from: string; to: string };
  form: Record<string, FormDataEntryValue>;
}

const LogTimeDemo = () => {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState("2026-10-23");
  const [from, setFrom] = React.useState("09:00");
  const [to, setTo] = React.useState("10:00");
  const [logged, setLogged] = React.useState<LoggedTime | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-fit">
            Log time
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[34rem]">
          <DialogHeader>
            <DialogTitle>Log time</DialogTitle>
            <DialogDescription>
              Add a finished block of work. Times are 24-hour and in Europe/Stockholm.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              // Both are read here on purpose: the state a handler closes over, and what the
              // browser collects from the named fields. Pressing Enter in a time field must have
              // committed the typed text into both before this runs.
              setLogged({
                state: { date, from, to },
                form: Object.fromEntries(new FormData(event.currentTarget)),
              });
              setOpen(false);
            }}
          >
            <DialogBody>
              <div className="grid grid-cols-1 gap-3 pb-4 sm:grid-cols-3">
                <Field id="log-date" name="date" label="Date">
                  <DatePicker value={date} onChange={setDate} />
                </Field>
                {/* In a Field the clock buttons are named "Choose time From" and "Choose time To". */}
                <Field id="log-from" name="from" label="From">
                  <TimeInput value={from} onChange={setFrom} step={5} />
                </Field>
                <Field id="log-to" name="to" label="To">
                  <TimeInput value={to} onChange={setTo} step={5} />
                </Field>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Log time</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Readout label="logged" value={logged} />
    </div>
  );
};

/**
 * The accounting app's Log time dialog: a date and two 24-hour times in one form. Type `930` in
 * From and press Enter, and the form submits with `09:30` already in place.
 */
export const InLogTimeDialog: StoryObj = {
  render: () => <LogTimeDemo />,
};

/**
 * The popover is portalled out of the panel, so `.dark` has to be on the page root for the list to
 * follow the field. The toolbar theme does that for a whole session; this story does it for one.
 */
const DarkDemo = () => {
  React.useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      root.classList.toggle("dark", wasDark);
    };
  }, []);
  return (
    <div className="dark rounded-box border border-border bg-background p-4 text-foreground">
      <DefaultDemo />
    </div>
  );
};

export const Dark: StoryObj = {
  render: () => <DarkDemo />,
};
