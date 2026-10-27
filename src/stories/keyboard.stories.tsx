import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "@storybook/test";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

/** A form field as text; a file input would give a File, which none of these forms has. */
const formText = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
};

const meta: Meta = {
  title: "UI/Keyboard",
  parameters: {
    // Opts in to the Tab sweep in the Storybook test runner: every stop must show a focus indicator.
    keyboard: { sweep: true, forcedColors: true },
    // Nothing here is worth a baseline: the readout is live and the date picker opens a portal.
    visual: { disable: true },
  },
};

export default meta;

/** Role (or tag), accessible name and whether the browser considers focus visible. */
function describeFocus(element: Element | null): string {
  if (!element || element === document.body) {
    return "Nothing focused. Press Tab.";
  }
  const tag = element.tagName.toLowerCase();
  const type = element.getAttribute("type");
  const role = element.getAttribute("role");
  const labelledBy = element
    .getAttribute("aria-labelledby")
    ?.split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");
  const label = (element as HTMLInputElement).labels?.[0]?.textContent;
  const name = (
    element.getAttribute("aria-label") ||
    labelledBy ||
    label ||
    element.textContent ||
    element.getAttribute("placeholder") ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
  const visible = element.matches(":focus-visible") ? "focus-visible" : "not focus-visible";
  return `<${tag}${type ? ` type="${type}"` : ""}${role ? ` role="${role}"` : ""}> ${name ? `"${name}"` : "(no name)"} (${visible})`;
}

/** Follows document focus so a person can see where Tab went, and what the browser thinks of it. */
function FocusReadout() {
  const [text, setText] = React.useState(() => describeFocus(null));

  React.useEffect(() => {
    const update = () => setText(describeFocus(document.activeElement));
    const leave = (event: FocusEvent) => {
      if (!event.relatedTarget) {
        setText(describeFocus(null));
      }
    };
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", leave);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", leave);
    };
  }, []);

  return (
    <div className="rounded-box border border-border bg-muted px-3 py-2 text-sm text-foreground">
      <span className="font-medium">Focused element: </span>
      <output aria-live="off" className="font-mono text-xs" data-testid="focused-element">
        {text}
      </output>
    </div>
  );
}

const KEYS: ReadonlyArray<readonly [string[], string]> = [
  [["Tab", "Shift+Tab"], "Move to the next or previous control. Every stop shows a ring."],
  [["Space"], "Press a button, tick the checkbox, flip the switch."],
  [["Enter"], "Press a button. In a text field, submit the form."],
  [["Space", "Enter", "↓"], "Open the currency list. ↑ ↓ choose, Enter picks, Esc closes."],
  [
    ["←", "↑", "↓", "→"],
    "Move between the payment terms; the choice follows focus. Tab leaves the group.",
  ],
  [["↓"], "In the date field, open the calendar. Esc closes it and keeps your place."],
  [["0-9"], "In the date field, type 20261023 and it formats itself as 2026-10-23."],
];

function CheatSheet() {
  return (
    <section aria-labelledby="keyboard-cheat-sheet" className="space-y-2">
      <h2 id="keyboard-cheat-sheet" className="text-sm font-semibold">
        What to expect
      </h2>
      <ul className="space-y-1.5 text-sm">
        {KEYS.map(([keys, effect]) => (
          <li key={effect} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="flex gap-1">
              {keys.map((key) => (
                <kbd
                  key={key}
                  className="rounded-selector border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
                >
                  {key}
                </kbd>
              ))}
            </span>
            <span className="text-muted-foreground">{effect}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SignInForm() {
  const [message, setMessage] = React.useState("");

  return (
    <form
      aria-labelledby="sign-in-title"
      className="flex flex-col gap-4 rounded-box border border-border bg-card p-4 text-card-foreground"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setMessage(
          `Signed in as ${formText(data, "username") || "(nobody)"}${data.get("remember") ? ", remembered" : ""}.`,
        );
      }}
    >
      <h2 id="sign-in-title" className="text-base font-semibold">
        Sign in
      </h2>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="keyboard-username">Username</Label>
        <Input id="keyboard-username" name="username" autoComplete="username" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="keyboard-password">Password</Label>
        <Input
          id="keyboard-password"
          name="password"
          type="password"
          autoComplete="current-password"
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="keyboard-remember" name="remember" />
        <Label htmlFor="keyboard-remember">Remember me</Label>
      </div>
      <Button type="submit">Sign in</Button>
      <p role="status" className="min-h-5 text-sm text-muted-foreground">
        {message}
      </p>
    </form>
  );
}

function InvoiceDefaultsForm() {
  const [date, setDate] = React.useState("2026-11-01");
  const [message, setMessage] = React.useState("");

  return (
    <form
      aria-labelledby="invoice-defaults-title"
      className="flex flex-col gap-4 rounded-box border border-border bg-card p-4 text-card-foreground"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setMessage(
          `Saved: ${formText(data, "currency") || "no currency"}, ${formText(data, "terms") || "no"} days, first invoice ${date}.`,
        );
      }}
    >
      <h2 id="invoice-defaults-title" className="text-base font-semibold">
        Invoice defaults
      </h2>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="keyboard-currency">Currency</Label>
        <Select name="currency" defaultValue="SEK">
          <SelectTrigger id="keyboard-currency" className="w-full">
            <SelectValue placeholder="Choose a currency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SEK">SEK, Swedish krona</SelectItem>
            <SelectItem value="EUR">EUR, Euro</SelectItem>
            <SelectItem value="NOK">NOK, Norwegian krone</SelectItem>
            <SelectItem value="USD">USD, US dollar</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="keyboard-reminders" name="reminders" defaultChecked />
        <Label htmlFor="keyboard-reminders">Send payment reminders</Label>
      </div>
      <div className="flex flex-col gap-1.5">
        <span id="keyboard-terms-label" className="text-sm font-medium leading-none">
          Payment terms
        </span>
        <RadioGroup
          name="terms"
          defaultValue="30"
          aria-labelledby="keyboard-terms-label"
          className="flex gap-4"
        >
          {["10", "30", "60"].map((days) => (
            <div key={days} className="flex items-center gap-2">
              <RadioGroupItem id={`keyboard-terms-${days}`} value={days} />
              <Label htmlFor={`keyboard-terms-${days}`}>{days} days</Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="keyboard-first-invoice">First invoice date</Label>
        <DatePicker id="keyboard-first-invoice" value={date} onChange={setDate} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="keyboard-notes">Notes</Label>
        <Textarea id="keyboard-notes" name="notes" rows={3} />
      </div>
      <Button type="submit">Save defaults</Button>
      <p role="status" className="min-h-5 text-sm text-muted-foreground">
        {message}
      </p>
    </form>
  );
}

function KeyboardPlayground() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Keyboard</h1>
        <p className="text-sm text-muted-foreground">
          Put the mouse down and Tab through both forms. The test runner does the same on this story
          and on its Dark twin, and fails any stop whose focus indicator is missing or too faint to
          see, in the light theme, the dark theme and forced-colors mode.
        </p>
      </div>
      <FocusReadout />
      <div className="grid gap-6 md:grid-cols-2">
        <SignInForm />
        <InvoiceDefaultsForm />
      </div>
      <CheatSheet />
    </div>
  );
}

/** Two realistic forms, a live read-out of where focus is, and the keys each control answers to. */
export const Default: StoryObj = {
  render: () => <KeyboardPlayground />,
};

/**
 * The same page in the dark theme, which has its own ring colours and its own way of going wrong.
 *
 * The theme is a story-level `globals` entry: Storybook ignores `parameters.globals` (and logs an
 * error for it), so a story that asked for dark that way would render light and the test runner would
 * sweep the light page twice. The play function says so out loud, because a story that silently stayed
 * light would pass the sweep and test nothing.
 */
export const Dark: StoryObj = {
  globals: { theme: "dark" },
  play: async () => {
    await expect(document.documentElement.classList.contains("dark")).toBe(true);
  },
  render: () => <KeyboardPlayground />,
};
