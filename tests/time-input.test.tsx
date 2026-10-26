import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { DensityProvider } from "../src/contexts/density-context";
import { menuItemRing } from "../src/components/ui/overlay-variant";
import { TimeInput, timeOptionVariant, type TimeInputProps } from "../src/components/ui/time-input";
import { Densities } from "../src/types/density";

/** A parent that owns the value, as every real caller does. */
function Harness({
  initial = "",
  onChange,
  ...props
}: { initial?: string } & Omit<TimeInputProps, "value">) {
  const [value, setValue] = React.useState(initial);
  return (
    <TimeInput
      aria-label="Time"
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const field = () => screen.getByLabelText("Time") as HTMLInputElement;
// The button is named after the field it belongs to ("Choose time Time"), so a bare "Choose time"
// matches nothing; the prefix is what tells the clock button from any other button.
const CLOCK_BUTTON = { name: /^Choose time/ };
const clockButton = () => screen.getByRole("button", CLOCK_BUTTON) as HTMLButtonElement;
const queryClockButton = () => screen.queryByRole("button", CLOCK_BUTTON);
const options = () => screen.getAllByRole("option");
const optionTexts = () => options().map((option) => option.textContent);
const activeText = () => document.activeElement?.textContent;

/** What the field's polite live region currently says. */
const announced = () => field().parentElement?.querySelector('[role="status"]')?.textContent;

async function expectFocusOn(element: Element) {
  await waitFor(() => expect(document.activeElement).toBe(element));
}

describe("TimeInput display and wiring", () => {
  it("shows the value as 24-hour HH:MM and says so in its placeholder", () => {
    render(<TimeInput aria-label="Time" value="09:30" onChange={vi.fn()} />);
    expect(field().value).toBe("09:30");

    render(<TimeInput aria-label="Empty" value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Empty").getAttribute("placeholder")).toBe("hh:mm");
  });

  it("shows nothing for a null value and shows afternoon times as 24-hour", () => {
    render(<TimeInput aria-label="Nothing" value={null} onChange={vi.fn()} />);
    expect((screen.getByLabelText("Nothing") as HTMLInputElement).value).toBe("");

    render(<TimeInput aria-label="Late" value="17:45" onChange={vi.fn()} />);
    expect((screen.getByLabelText("Late") as HTMLInputElement).value).toBe("17:45");
  });

  it("lets a caller replace the placeholder", () => {
    render(<TimeInput aria-label="Time" placeholder="from" />);
    expect(field().getAttribute("placeholder")).toBe("from");
  });

  it("gives the visible field the attributes that make it a text box for times", () => {
    render(<TimeInput aria-label="Time" />);
    const input = field();
    expect(input.type).toBe("text");
    expect(input.getAttribute("inputmode")).toBe("numeric");
    expect(input.getAttribute("autocomplete")).toBe("off");
    expect(input.getAttribute("spellcheck")).toBe("false");
    // No `maxlength`: the browser would cut a pasted "1:30 PM" to "1:30 " and it would read as 01:30.
    expect(input.hasAttribute("maxlength")).toBe(false);
  });

  it("forwards id, aria-*, required and a ref to the visible field, and className to the wrapper", () => {
    const ref = React.createRef<HTMLInputElement>();
    const { container } = render(
      <>
        <label htmlFor="start">Start</label>
        <TimeInput
          ref={ref}
          id="start"
          required
          aria-describedby="start-hint"
          aria-invalid="true"
          className="w-28"
        />
        <p id="start-hint">Hint</p>
      </>,
    );
    const input = screen.getByLabelText("Start") as HTMLInputElement;
    expect(ref.current).toBe(input);
    expect(input.id).toBe("start");
    expect(input.required).toBe(true);
    expect(input.getAttribute("aria-describedby")).toBe("start-hint");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.className).not.toContain("w-28");
    expect(input.parentElement?.className).toContain("w-28");
    expect(container.querySelector("input[type=hidden]")).toBeNull();
  });

  it("submits the HH:MM value under `name` through a hidden field", () => {
    const { container } = render(
      <TimeInput aria-label="Time" name="from" value="09:30" onChange={vi.fn()} />,
    );
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.name).toBe("from");
    expect(hidden.value).toBe("09:30");
    expect(field().name).toBe("");
  });

  it("leaves a disabled field out of the form, as a native control would be", () => {
    const { container } = render(
      <form>
        <TimeInput aria-label="Time" name="from" defaultValue="09:30" disabled />
      </form>,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    expect(new FormData(form).has("from")).toBe(false);
  });

  it("puts the hidden field in the form named by `form`", () => {
    const { container } = render(<TimeInput aria-label="Time" name="from" form="elsewhere" />);
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.getAttribute("form")).toBe("elsewhere");
  });

  it("keeps the hidden field in step with the value", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness name="from" initial="09:00" />);
    await user.clear(field());
    await user.type(field(), "1415");
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toBe("14:15");
    expect(container.querySelectorAll('[name="from"]')).toHaveLength(1);
  });

  it("selects the text when it takes focus, so typing replaces the time", async () => {
    const user = userEvent.setup();
    render(<TimeInput aria-label="Time" defaultValue="09:30" />);
    await user.tab();
    expect(document.activeElement).toBe(field());
    expect([field().selectionStart, field().selectionEnd]).toEqual([0, 5]);
  });

  it("disables the field and the clock button together", async () => {
    const user = userEvent.setup();
    render(<TimeInput aria-label="Time" defaultValue="09:30" disabled />);
    expect(field().disabled).toBe(true);
    expect(clockButton().disabled).toBe(true);

    await user.click(clockButton());
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not step or open the list when read only", async () => {
    const user = userEvent.setup();
    render(<TimeInput aria-label="Time" defaultValue="09:30" readOnly />);
    expect(clockButton().disabled).toBe(true);

    field().focus();
    await user.keyboard("{ArrowUp}{PageUp}{Alt>}{ArrowDown}{/Alt}");
    expect(field().value).toBe("09:30");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("leaves out the clock button when suggestionStep is 0", () => {
    render(<TimeInput aria-label="Time" suggestionStep={0} />);
    expect(queryClockButton()).toBeNull();
    expect(field().getAttribute("aria-keyshortcuts")).toBeNull();
  });

  it("works uncontrolled from defaultValue", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeInput aria-label="Time" defaultValue="09:30" onChange={onChange} />);
    expect(field().value).toBe("09:30");

    await user.clear(field());
    await user.type(field(), "1105");
    expect(field().value).toBe("11:05");
    expect(onChange).toHaveBeenLastCalledWith("11:05");
  });
});

describe("TimeInput typing and commit rules", () => {
  it("commits 9:30 once, when it is complete rather than at 9:3", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(field(), "9:3");
    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe("9:3");

    await user.type(field(), "0");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("09:30");
    expect(field().value).toBe("09:30");
  });

  it("commits 0930 once and shows it as 09:30", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(field(), "0930");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("09:30");
    expect(field().value).toBe("09:30");
  });

  it("does not flash 01:23 on the way to 12:30", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(field(), "123");
    expect(field().value).toBe("123");
    expect(onChange).not.toHaveBeenCalled();

    await user.type(field(), "0");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("12:30");
  });

  it.each([
    ["9.30", "09:30"],
    ["9,30", "09:30"],
    ["9 30", "09:30"],
    ["09:05", "09:05"],
  ])("accepts %j as %s", async (typed, expected) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(field(), typed);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expected);
  });

  it("commits 930 only when the field is left", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(field(), "930");
    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe("930");

    await user.tab();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("09:30");
    expect(field().value).toBe("09:30");
  });

  it("completes a bare hour on blur: 9 becomes 09:00", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(field(), "9");
    expect(onChange).not.toHaveBeenCalled();
    await user.tab();

    expect(onChange).toHaveBeenCalledWith("09:00");
  });

  it.each(["2575", "24:00", "2400", "9:60", "9pm", "abc"])(
    "reverts %j to the committed value on blur and reports nothing",
    async (typed) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness initial="08:15" onChange={onChange} />);

      await user.clear(field());
      onChange.mockClear();
      await user.type(field(), typed);
      expect(onChange).not.toHaveBeenCalled();
      await user.tab();

      expect(onChange).not.toHaveBeenCalled();
      // `clear()` committed "", so that is what the field reverts to.
      expect(field().value).toBe("");
    },
  );

  it("refuses a fifth digit: 1234 has already committed 12:34 and the field holds five characters", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(field(), "12345");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("12:34");
    expect(field().value).toBe("12:34");
  });

  it("keeps the old value when the typed text is not a time and nothing was cleared", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeInput aria-label="Time" value="08:15" onChange={onChange} />);

    field().focus();
    await user.keyboard("9pm");
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe("08:15");
  });

  it("reports an empty string as soon as the field is emptied", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="09:30" onChange={onChange} />);

    await user.clear(field());

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("does not report a time that is already the value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="09:30" onChange={onChange} />);

    field().focus();
    await user.keyboard("0930");
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe("09:30");
  });

  it("ignores typed times outside min and max, then reverts them on blur", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="09:00" min="08:00" max="18:00" onChange={onChange} />);

    field().focus();
    await user.keyboard("0700");
    expect(onChange).not.toHaveBeenCalled();
    await user.tab();
    expect(field().value).toBe("09:00");

    field().focus();
    await user.keyboard("1830");
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe("09:00");

    field().focus();
    await user.keyboard("1800");
    expect(onChange).toHaveBeenLastCalledWith("18:00");
  });

  it("replaces a half-typed draft when the parent sends a new value", () => {
    const { rerender } = render(<TimeInput aria-label="Time" value="09:30" onChange={vi.fn()} />);
    fireEvent.change(field(), { target: { value: "1" } });
    expect(field().value).toBe("1");

    rerender(<TimeInput aria-label="Time" value="11:00" onChange={vi.fn()} />);

    expect(field().value).toBe("11:00");
  });
});

describe("TimeInput arrow keys", () => {
  it("steps a minute at a time by default", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="09:00" onChange={onChange} />);

    field().focus();
    await user.keyboard("{ArrowUp}");
    expect(field().value).toBe("09:01");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(field().value).toBe("08:59");
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("snaps to the step grid", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:10" step={15} />);

    field().focus();
    await user.keyboard("{ArrowUp}");
    expect(field().value).toBe("09:15");
    await user.keyboard("{ArrowDown}");
    expect(field().value).toBe("09:00");
  });

  it("moves an hour with PageUp and PageDown", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:10" step={15} />);

    field().focus();
    await user.keyboard("{PageUp}");
    expect(field().value).toBe("10:10");
    await user.keyboard("{PageDown}{PageDown}");
    expect(field().value).toBe("08:10");
  });

  it("stops at the ends of the day instead of wrapping", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="23:59" onChange={onChange} />);

    field().focus();
    await user.keyboard("{ArrowUp}{PageUp}");
    expect(field().value).toBe("23:59");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("stops at min and max", async () => {
    const user = userEvent.setup();
    render(<Harness initial="08:10" min="08:00" max="08:30" step={15} />);

    field().focus();
    await user.keyboard("{ArrowDown}");
    expect(field().value).toBe("08:00");
    await user.keyboard("{ArrowDown}{PageDown}");
    expect(field().value).toBe("08:00");
    await user.keyboard("{PageUp}");
    expect(field().value).toBe("08:30");
    await user.keyboard("{ArrowUp}");
    expect(field().value).toBe("08:30");
  });

  it("starts an empty field at 09:00, or at min", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    field().focus();
    await user.keyboard("{ArrowUp}");
    expect(field().value).toBe("09:00");

    render(<Harness min="07:30" aria-label="Bounded" />);
    const bounded = screen.getByLabelText("Bounded") as HTMLInputElement;
    bounded.focus();
    await user.keyboard("{PageUp}");
    expect(bounded.value).toBe("07:30");
  });

  it("steps from the committed time when the text is not a time", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" />);

    await user.clear(field());
    await user.type(field(), "1415");
    expect(field().value).toBe("14:15");

    await user.keyboard("{Backspace}{Backspace}");
    expect(field().value).toBe("14:");
    await user.keyboard("{ArrowUp}");
    // "14:" is not a time, so the arrow steps from the committed 14:15 instead.
    expect(field().value).toBe("14:16");
  });

  it("leaves arrow keys with a modifier to the browser", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" />);

    field().focus();
    await user.keyboard("{Shift>}{ArrowUp}{/Shift}{Control>}{ArrowUp}{/Control}");

    expect(field().value).toBe("09:00");
  });
});

describe("TimeInput and a surrounding form", () => {
  it("commits the typed time inside the Enter keydown without cancelling the key", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    field().focus();
    await user.keyboard("930");
    expect(onChange).not.toHaveBeenCalled();

    // `fireEvent` reports whether the event was left uncancelled; a cancelled Enter would not submit.
    const uncancelled = fireEvent.keyDown(field(), { key: "Enter" });

    expect(uncancelled).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("09:30");
    expect(field().value).toBe("09:30");
  });

  it("has the new value in the form's onSubmit after Enter", async () => {
    const user = userEvent.setup();
    const submitted: Array<{ state: string; named: FormDataEntryValue | null }> = [];

    function Form() {
      const [from, setFrom] = React.useState("09:00");
      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitted.push({
              state: from,
              named: new FormData(event.currentTarget).get("from"),
            });
          }}
        >
          <TimeInput aria-label="From" name="from" value={from} onChange={setFrom} />
          <button type="submit">Log time</button>
        </form>
      );
    }
    render(<Form />);

    const input = screen.getByLabelText("From") as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "930");
    await user.keyboard("{Enter}");

    expect(submitted).toEqual([{ state: "09:30", named: "09:30" }]);
  });

  it("submits the committed value when Enter finds text that is not a time", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Harness initial="08:15" name="from" />
        <button type="submit">Go</button>
      </form>,
    );

    field().focus();
    await user.keyboard("99{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(field().value).toBe("08:15");
  });
});

describe("TimeInput suggestion list", () => {
  it("opens from the clock button as a listbox of options with the value selected", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" />);

    expect(clockButton().getAttribute("aria-haspopup")).toBe("listbox");
    expect(clockButton().getAttribute("aria-expanded")).toBe("false");
    await user.click(clockButton());

    expect(screen.getByRole("listbox", { name: "Suggested times Time" })).toBeDefined();
    expect(clockButton().getAttribute("aria-expanded")).toBe("true");
    expect(options()).toHaveLength(48);
    expect(optionTexts().slice(0, 3)).toEqual(["00:00", "00:30", "01:00"]);
    expect(optionTexts().at(-1)).toBe("23:30");
    const selected = options().filter((option) => option.getAttribute("aria-selected") === "true");
    expect(selected.map((option) => option.textContent)).toEqual(["09:00"]);
    expect(document.activeElement).toBe(selected[0]);
  });

  it("opens with Alt+ArrowDown from the field", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" />);

    field().focus();
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");

    expect(screen.getByRole("listbox")).toBeDefined();
    expect(activeText()).toBe("09:00");
    expect(field().value).toBe("09:00");
  });

  it("opens with ArrowDown only while the field is empty", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:10" />);

    field().focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(field().value).toBe("09:09");

    await user.clear(field());
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeDefined();
  });

  it("starts on the option nearest 09:00 when there is no value", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(clockButton());

    expect(activeText()).toBe("09:00");
    expect(options().some((option) => option.getAttribute("aria-selected") === "true")).toBe(false);
  });

  it("starts on the option nearest a value that is not on the list", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:20" />);

    await user.click(clockButton());

    expect(activeText()).toBe("09:30");
    expect(options().some((option) => option.getAttribute("aria-selected") === "true")).toBe(false);
  });

  it("commits a half-typed time first, then opens on it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="09:00" onChange={onChange} />);

    await user.clear(field());
    onChange.mockClear();
    await user.type(field(), "14");
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");

    expect(onChange).toHaveBeenCalledWith("14:00");
    expect(activeText()).toBe("14:00");
  });

  it("moves with the arrow keys, Home, End, PageUp and PageDown, without wrapping", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" />);
    await user.click(clockButton());

    await user.keyboard("{ArrowDown}");
    expect(activeText()).toBe("09:30");
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(activeText()).toBe("08:30");
    await user.keyboard("{End}");
    expect(activeText()).toBe("23:30");
    await user.keyboard("{ArrowDown}");
    expect(activeText()).toBe("23:30");
    await user.keyboard("{Home}");
    expect(activeText()).toBe("00:00");
    await user.keyboard("{ArrowUp}");
    expect(activeText()).toBe("00:00");
    await user.keyboard("{PageDown}");
    // jsdom cannot measure rows, so a page is the fallback of 8 rows, less one.
    expect(activeText()).toBe("03:30");
    await user.keyboard("{PageUp}");
    expect(activeText()).toBe("00:00");
    await user.keyboard("{PageUp}");
    expect(activeText()).toBe("00:00");
  });

  it("keeps exactly one option in the tab order", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" />);
    await user.click(clockButton());
    await user.keyboard("{ArrowDown}");

    const tabbable = options().filter((option) => option.getAttribute("tabindex") === "0");
    expect(tabbable.map((option) => option.textContent)).toEqual(["09:30"]);
  });

  it("commits with Enter, closes, and returns focus to the field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="09:00" onChange={onChange} />);
    await user.click(clockButton());

    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("09:30");
    expect(field().value).toBe("09:30");
    expect(screen.queryByRole("listbox")).toBeNull();
    await expectFocusOn(field());
  });

  it("commits with Space as well", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" />);
    await user.click(clockButton());

    await user.keyboard("{End}[Space]");

    expect(field().value).toBe("23:30");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("commits a clicked option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="09:00" onChange={onChange} />);
    await user.click(clockButton());

    await user.click(screen.getByRole("option", { name: "14:00" }));

    expect(onChange).toHaveBeenCalledWith("14:00");
    expect(screen.queryByRole("listbox")).toBeNull();
    await expectFocusOn(field());
  });

  it("closes on Escape without changing the value and returns focus to the field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="09:00" onChange={onChange} />);
    await user.click(clockButton());
    await user.keyboard("{ArrowDown}");

    await user.keyboard("{Escape}");

    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe("09:00");
    expect(screen.queryByRole("listbox")).toBeNull();
    await expectFocusOn(field());
  });

  it("closes when the clock button is pressed again", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" />);
    await user.click(clockButton());
    expect(screen.getByRole("listbox")).toBeDefined();

    await user.click(clockButton());

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("leaves focus where the person clicked when they click away", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness initial="09:00" />
        <button type="button">Elsewhere</button>
      </>,
    );
    await user.click(clockButton());

    await user.click(screen.getByRole("button", { name: "Elsewhere" }));

    expect(screen.queryByRole("listbox")).toBeNull();
    // Radix hands focus back on a timer after the list unmounts; give it the chance to misbehave.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Elsewhere" }));
  });

  it("closes on Tab and lets the browser continue from the clock button", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness initial="09:00" />
        <button type="button">Next</button>
      </>,
    );
    await user.click(clockButton());

    await user.keyboard("{Tab}");

    expect(screen.queryByRole("listbox")).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 50));
    // The list is portalled to the end of the page, so Tab continues from the clock button.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next" }));
  });

  it("returns to the field on Shift+Tab", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness initial="09:00" />
        <button type="button">Next</button>
      </>,
    );
    await user.click(clockButton());

    await user.keyboard("{Shift>}{Tab}{/Shift}");

    expect(screen.queryByRole("listbox")).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.activeElement).toBe(field());
  });

  it("keeps wheel and touch moves off the document, where a dialog's scroll lock would eat them", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" />);
    await user.click(clockButton());
    const seen = vi.fn();
    document.addEventListener("wheel", seen);
    document.addEventListener("touchmove", seen);

    // Control: the same events on the field do reach the document, so the spy can see them.
    fireEvent.wheel(field());
    fireEvent.touchMove(field());
    expect(seen).toHaveBeenCalledTimes(2);

    seen.mockClear();
    fireEvent.wheel(screen.getByRole("listbox"));
    fireEvent.touchMove(screen.getByRole("listbox"));
    fireEvent.wheel(options()[3]);
    document.removeEventListener("wheel", seen);
    document.removeEventListener("touchmove", seen);

    expect(seen).not.toHaveBeenCalled();
  });

  it("honours min and max", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" min="08:00" max="10:00" />);
    await user.click(clockButton());

    expect(optionTexts()).toEqual(["08:00", "08:30", "09:00", "09:30", "10:00"]);
  });

  it("uses suggestionStep for the spacing", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" min="08:00" max="10:00" suggestionStep={15} />);
    await user.click(clockButton());

    expect(options()).toHaveLength(9);
    expect(optionTexts().slice(0, 3)).toEqual(["08:00", "08:15", "08:30"]);
  });

  it("uses an explicit list instead, dropping what is not a time or is out of bounds", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial="09:00"
        suggestions={["08:00", "08:00", "09:00", "17:00", "25:00", "noon", "23:00"]}
        max="18:00"
      />,
    );
    await user.click(clockButton());

    expect(optionTexts()).toEqual(["08:00", "09:00", "17:00"]);
  });

  it("leaves out the button when an explicit list is empty", () => {
    render(<TimeInput aria-label="Time" suggestions={[]} />);
    expect(queryClockButton()).toBeNull();
  });

  it("marks the selected option with a check that screen readers skip", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" />);
    await user.click(clockButton());

    const selected = screen.getByRole("option", { selected: true });
    expect(selected.textContent).toBe("09:00");
    expect(selected.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("TimeInput density", () => {
  it("uses the field height and the room for the clock button of its density", () => {
    const { rerender } = render(
      <TimeInput aria-label="Time" density={Densities.Small} defaultValue="09:00" />,
    );
    expect(field().className).toContain("h-7");
    expect(field().className).toContain("pr-7");
    expect(clockButton().className).toContain("[&_svg]:size-3");

    rerender(<TimeInput aria-label="Time" density={Densities.Large} defaultValue="09:00" />);
    expect(field().className).toContain("h-11");
    expect(field().className).toContain("pr-11");
    expect(clockButton().className).toContain("[&_svg]:size-5");
  });

  it("follows the density context, and a prop wins over it", () => {
    render(
      <DensityProvider density={Densities.Large}>
        <TimeInput aria-label="Time" defaultValue="09:00" />
        <TimeInput aria-label="Small" density={Densities.Small} defaultValue="09:00" />
      </DensityProvider>,
    );
    expect(field().className).toContain("h-11");
    expect(screen.getByLabelText("Small").className).toContain("h-7");
  });

  it("sizes the list rows by density", async () => {
    const user = userEvent.setup();
    render(<TimeInput aria-label="Time" density={Densities.Small} defaultValue="09:00" />);
    await user.click(clockButton());

    expect(screen.getByRole("listbox").className).toContain("text-xs");
    expect(options()[0].className).toContain("py-1");
  });
});

describe("TimeInput pasting", () => {
  it.each(["1:30 PM", "9:45 PM", "9:45 pm", "09:30 AM"])(
    "keeps a pasted %j whole, flags it, and discards it on blur instead of reading it as a 24-hour time",
    async (pasted) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness initial="08:15" onChange={onChange} />);

      field().focus();
      await user.paste(pasted);

      // A maxlength of 5 used to cut "1:30 PM" to "1:30 ", which parsed as 01:30 and was committed.
      expect(field().value).toBe(pasted);
      expect(field().getAttribute("aria-invalid")).toBe("true");
      expect(onChange).not.toHaveBeenCalled();

      await user.tab();
      expect(onChange).not.toHaveBeenCalled();
      expect(field().value).toBe("08:15");
      expect(announced()).toBe("Not a valid time, kept 08:15");
    },
  );

  it.each([
    ["09:30", "09:30"],
    [" 09:30 ", "09:30"],
    ["9.30", "09:30"],
    ["930", "09:30"],
    ["0930", "09:30"],
  ])("commits a pasted %j as %s at once, without waiting for blur", async (pasted, expected) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="08:15" onChange={onChange} />);

    field().focus();
    await user.paste(pasted);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expected);
    expect(field().value).toBe(expected);
  });

  it("replaces the whole field even when the caret is not selecting anything", async () => {
    const user = userEvent.setup();
    render(<Harness initial="10:00" />);

    field().focus();
    field().setSelectionRange(5, 5);
    await user.paste("09:30");

    expect(field().value).toBe("09:30");
  });

  it("lets a pasted time outside min and max land as text to be discarded", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="09:00" min="08:00" onChange={onChange} />);

    field().focus();
    await user.paste("07:00");
    expect(field().value).toBe("07:00");
    expect(field().getAttribute("aria-invalid")).toBe("true");

    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe("09:00");
  });

  it("tells the caller's onPaste first and lets it cancel the paste", async () => {
    const user = userEvent.setup();
    const onPaste = vi.fn((event: React.ClipboardEvent) => event.preventDefault());
    const onChange = vi.fn();
    render(<Harness initial="08:15" onPaste={onPaste} onChange={onChange} />);

    field().focus();
    await user.paste("09:30");

    expect(onPaste).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe("08:15");
  });

  it("does not paste into a read-only field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="08:15" readOnly onChange={onChange} />);

    field().focus();
    await user.paste("09:30");

    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe("08:15");
  });
});

describe("TimeInput typing past what a time needs", () => {
  it("still refuses a sixth typed character now that the field has no maxlength", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:30" />);

    field().focus();
    field().setSelectionRange(5, 5);
    await user.keyboard("1");

    expect(field().value).toBe("09:30");
  });
});

describe("TimeInput and a value with seconds", () => {
  it("shows and submits 09:30:00 as 09:30", () => {
    const { container } = render(
      <TimeInput aria-label="Time" name="from" value="09:30:00" onChange={vi.fn()} />,
    );
    expect(field().value).toBe("09:30");
    expect((container.querySelector('input[type="hidden"]') as HTMLInputElement).value).toBe(
      "09:30",
    );
  });

  it("steps from 09:30, not from the start of the day", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeInput aria-label="Time" value="09:30:00" onChange={onChange} />);

    field().focus();
    await user.keyboard("{ArrowUp}");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("09:31");
  });

  it("opens the list on the row of that time, selected", async () => {
    const user = userEvent.setup();
    render(<TimeInput aria-label="Time" value="09:30:00" onChange={vi.fn()} />);

    await user.click(clockButton());

    const selected = options().filter((option) => option.getAttribute("aria-selected") === "true");
    expect(selected.map((option) => option.textContent)).toEqual(["09:30"]);
  });

  it("does not call typing the same time a change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeInput aria-label="Time" value="09:30:15.250" onChange={onChange} />);

    field().focus();
    await user.keyboard("0930");
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe("09:30");
  });

  it("reads a default value with seconds the same way", () => {
    render(<TimeInput aria-label="Time" defaultValue="14:05:00" />);
    expect(field().value).toBe("14:05");
  });

  it("shows a value that is not a time as it is", () => {
    render(<TimeInput aria-label="Time" value="9:30:00" onChange={vi.fn()} />);
    expect(field().value).toBe("9:30:00");
  });
});

describe("TimeInput when the parent turns a time down", () => {
  it("reports a typed time once, not again when the field is left", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeInput aria-label="Time" value="09:00" onChange={onChange} />);

    field().focus();
    await user.keyboard("1005");
    expect(onChange.mock.calls).toEqual([["10:05"]]);
    expect(field().value).toBe("1005");

    await user.tab();
    expect(onChange.mock.calls).toEqual([["10:05"]]);
    expect(field().value).toBe("09:00");
  });

  it("does not report it again on Enter either", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeInput aria-label="Time" value="09:00" onChange={onChange} />);

    field().focus();
    await user.keyboard("1005{Enter}");

    expect(onChange.mock.calls).toEqual([["10:05"]]);
    expect(field().value).toBe("09:00");
  });

  it("reports the same time again when the person types it again", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeInput aria-label="Time" value="09:00" onChange={onChange} />);

    field().focus();
    await user.keyboard("1005");
    await user.keyboard("{Backspace}5");

    expect(onChange.mock.calls).toEqual([["10:05"], ["10:05"]]);
    await user.tab();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("reports a time at blur that typing had not reported, even if it equals one it did", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeInput aria-label="Time" value="08:00" onChange={onChange} />);

    field().focus();
    await user.keyboard("9:30");
    expect(onChange.mock.calls).toEqual([["09:30"]]);

    // 930 is only a time once the field is left, so nothing has reported this draft yet.
    await user.keyboard("{Control>}a{/Control}930");
    expect(onChange.mock.calls).toEqual([["09:30"]]);
    await user.tab();

    expect(onChange.mock.calls).toEqual([["09:30"], ["09:30"]]);
  });

  it("opens the list on the time the field holds, not on the one it turned down", async () => {
    const user = userEvent.setup();
    render(<TimeInput aria-label="Time" value="09:00" onChange={vi.fn()} />);

    field().focus();
    await user.keyboard("1005{Alt>}{ArrowDown}{/Alt}");

    expect(activeText()).toBe("09:00");
  });

  it("still takes a time the parent accepts, and reports it once", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="09:00" onChange={onChange} />);

    field().focus();
    await user.keyboard("1005");
    await user.tab();

    expect(onChange.mock.calls).toEqual([["10:05"]]);
    expect(field().value).toBe("10:05");
  });
});

describe("TimeInput when the parent maps an empty time to undefined", () => {
  function ClearsToUndefined() {
    const [time, setTime] = React.useState<string | undefined>(undefined);
    return (
      <TimeInput
        aria-label="Time"
        name="from"
        value={time}
        onChange={(next) => setTime(next || undefined)}
      />
    );
  }

  it("stays empty after the time is cleared and the field is left", async () => {
    const user = userEvent.setup();
    const { container } = render(<ClearsToUndefined />);
    const hidden = () => container.querySelector('input[type="hidden"]') as HTMLInputElement;

    field().focus();
    await user.keyboard("0930");
    expect(hidden().value).toBe("09:30");

    await user.clear(field());
    await user.tab();

    // It used to flip to uncontrolled and bring back the time it had been given before.
    expect(field().value).toBe("");
    expect(hidden().value).toBe("");
  });

  it("is still uncontrolled while the parent has never passed a value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TimeInput aria-label="Time" value={undefined} defaultValue="09:30" onChange={onChange} />,
    );
    expect(field().value).toBe("09:30");

    await user.clear(field());
    await user.type(field(), "1105");
    expect(field().value).toBe("11:05");
  });
});

describe("TimeInput and the props of a password field", () => {
  it("leaves them out of its type", () => {
    // These are checked by `tsc`, which `vp check` runs: if the omission goes, a directive below
    // stops matching an error and the check fails. Each prop gets a statement of its own because
    // TypeScript reports only the first excess property of an object literal.
    // @ts-expect-error a time field has no show/hide button
    const toggle: TimeInputProps = { passwordToggle: true };
    // @ts-expect-error nor a label for one
    const toggleLabel: TimeInputProps = { passwordToggleLabel: "Show" };
    // @ts-expect-error nor a reveal state
    const revealed: TimeInputProps = { revealed: true };
    // @ts-expect-error nor a wrapper that holds one
    const container: TimeInputProps = { containerClassName: "x" };
    // @ts-expect-error nor a verbatim mode for secrets
    const verbatim: TimeInputProps = { verbatim: true };
    expect([toggle, toggleLabel, revealed, container, verbatim]).toHaveLength(5);
  });
});

describe("TimeInput stepping and then typing", () => {
  it.each(["{ArrowUp}", "{ArrowDown}", "{PageUp}", "{PageDown}"])(
    "selects the time again after %s so the next digits replace it",
    async (key) => {
      const user = userEvent.setup();
      render(<Harness initial="09:10" />);

      field().focus();
      await user.keyboard(key);
      expect([field().selectionStart, field().selectionEnd]).toEqual([0, 5]);

      await user.keyboard("1030");
      expect(field().value).toBe("10:30");
    },
  );

  it("selects the time again when the step went nowhere, at the end of the day", async () => {
    const user = userEvent.setup();
    render(<Harness initial="23:59" />);

    field().focus();
    await user.keyboard("{ArrowUp}");
    expect([field().selectionStart, field().selectionEnd]).toEqual([0, 5]);

    await user.keyboard("0815");
    expect(field().value).toBe("08:15");
  });

  it("leaves a field alone that lost focus before the step was written", async () => {
    render(<Harness initial="09:10" />);

    field().focus();
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    // A parent that moves focus on (to the next field, say) does it inside onChange, before the
    // reselection runs; selecting then would pull focus back in browsers whose select() focuses.
    field().blur();
    await Promise.resolve();

    expect(field().value).toBe("09:11");
    expect([field().selectionStart, field().selectionEnd]).toEqual([5, 5]);
  });
});

describe("TimeInput and text that is not a time", () => {
  it("flags text that cannot be a time while it is in the field", async () => {
    const user = userEvent.setup();
    render(<Harness initial="08:15" />);

    field().focus();
    await user.keyboard("9");
    expect(field().getAttribute("aria-invalid")).toBeNull();
    await user.keyboard("9");
    expect(field().value).toBe("99");
    expect(field().getAttribute("aria-invalid")).toBe("true");

    await user.keyboard("{Backspace}");
    expect(field().getAttribute("aria-invalid")).toBeNull();
  });

  it("flags letters straight away", async () => {
    const user = userEvent.setup();
    render(<Harness initial="08:15" />);

    field().focus();
    await user.keyboard("9p");

    expect(field().getAttribute("aria-invalid")).toBe("true");
  });

  it("leaves an hour and its separator alone: 9: is a time half typed", async () => {
    const user = userEvent.setup();
    render(<Harness initial="08:15" />);

    field().focus();
    await user.keyboard("9:");
    expect(field().value).toBe("9:");
    expect(field().getAttribute("aria-invalid")).toBeNull();

    await user.keyboard("3");
    expect(field().getAttribute("aria-invalid")).toBeNull();
  });

  it("does not flag a time that is waiting for blur, such as 930", async () => {
    const user = userEvent.setup();
    render(<Harness initial="08:15" />);

    field().focus();
    await user.keyboard("930");

    expect(field().value).toBe("930");
    expect(field().getAttribute("aria-invalid")).toBeNull();
  });

  it("flags a time outside min and max", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" min="08:00" max="18:00" />);

    field().focus();
    await user.keyboard("0700");

    expect(field().getAttribute("aria-invalid")).toBe("true");
  });

  it("keeps the invalid state the caller gave it", async () => {
    const user = userEvent.setup();
    render(<Harness initial="08:15" aria-invalid="true" />);

    field().focus();
    await user.keyboard("930");

    expect(field().getAttribute("aria-invalid")).toBe("true");
  });

  it("announces that text was discarded, and what the field went back to, when it is left", async () => {
    const user = userEvent.setup();
    render(<Harness initial="08:15" min="08:00" />);

    field().focus();
    await user.keyboard("0700");
    expect(announced()).toBe("");
    await user.tab();

    expect(field().value).toBe("08:15");
    expect(field().getAttribute("aria-invalid")).toBeNull();
    expect(announced()).toBe("Not a valid time, kept 08:15");
  });

  it("announces it on Enter as well, with the field still focused", async () => {
    const user = userEvent.setup();
    render(<Harness initial="08:15" />);

    field().focus();
    await user.keyboard("2500{Enter}");

    expect(document.activeElement).toBe(field());
    expect(field().value).toBe("08:15");
    expect(announced()).toBe("Not a valid time, kept 08:15");
  });

  it("says only that it was not a time when the field was empty", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    field().focus();
    await user.keyboard("abc");
    await user.tab();

    expect(field().value).toBe("");
    expect(announced()).toBe("Not a valid time");
  });

  it("stays quiet for a time that was accepted, and for an emptied field", async () => {
    const user = userEvent.setup();
    render(<Harness initial="08:15" />);

    field().focus();
    await user.keyboard("930");
    await user.tab();
    expect(announced()).toBe("");

    field().focus();
    await user.clear(field());
    await user.tab();
    expect(announced()).toBe("");
  });

  it("stays quiet when text typed into an empty field is deleted again", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    field().focus();
    await user.keyboard("9{Backspace}");
    expect(field().value).toBe("");
    await user.tab();

    expect(announced()).toBe("");
  });

  it("clears the message when the person comes back to the field", async () => {
    const user = userEvent.setup();
    render(<Harness initial="08:15" />);

    field().focus();
    await user.keyboard("99");
    await user.tab();
    expect(announced()).not.toBe("");

    await user.click(field());
    expect(announced()).toBe("");
  });

  it("lets the caller word the message", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial="08:15"
        discardedMessage={(kept) => (kept ? `Ogiltig tid, behåller ${kept}` : "Ogiltig tid")}
      />,
    );

    field().focus();
    await user.keyboard("99");
    await user.tab();

    expect(announced()).toBe("Ogiltig tid, behåller 08:15");
  });

  it("keeps the message in a polite live region", () => {
    render(<Harness />);
    const region = field().parentElement?.querySelector('[role="status"]');
    expect(region).not.toBeNull();
    expect(region?.className).toContain("sr-only");
  });
});

describe("TimeInput names", () => {
  it("names the clock button and the list after the field's aria-label", async () => {
    const user = userEvent.setup();
    render(<TimeInput aria-label="Start" />);
    expect(screen.getByRole("button", { name: "Choose time Start" })).toBeDefined();

    await user.click(clockButton());
    expect(screen.getByRole("listbox", { name: "Suggested times Start" })).toBeDefined();
  });

  it("tells two fields on a page apart", () => {
    render(
      <>
        <TimeInput aria-label="From" />
        <TimeInput aria-label="To" />
      </>,
    );
    expect(screen.getByRole("button", { name: "Choose time From" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Choose time To" })).toBeDefined();
  });

  it("does not become a second match for the label of the field", () => {
    render(
      <>
        <label htmlFor="start">Start</label>
        <TimeInput id="start" aria-label="Start" />
      </>,
    );
    // An aria-labelledby on the button would make `getByLabelText("Start")` find two elements.
    expect(screen.getAllByLabelText("Start")).toHaveLength(1);
    expect(clockButton().hasAttribute("aria-labelledby")).toBe(false);
  });

  it("does not take the value of the field for its name", () => {
    render(<TimeInput aria-label="Start" defaultValue="09:00" />);
    expect(clockButton().getAttribute("aria-label")).toBe("Choose time Start");
    expect(screen.queryByRole("button", { name: /09:00/ })).toBeNull();
  });

  it("adds nothing when the field is named some way that is not text", async () => {
    const user = userEvent.setup();
    render(
      <>
        <span id="start-label">Start</span>
        <label htmlFor="bare">Bare</label>
        <TimeInput aria-labelledby="start-label" />
        <TimeInput id="bare" />
      </>,
    );
    expect(screen.getAllByRole("button", { name: "Choose time" })).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "Choose time" })[0]);
    expect(screen.getByRole("listbox", { name: "Suggested times" })).toBeDefined();
  });

  it("follows aria-labelledby over aria-label, as the field itself does", () => {
    render(
      <>
        <span id="start-label">Start</span>
        <TimeInput aria-labelledby="start-label" aria-label="Ignored" />
      </>,
    );
    expect(screen.getByRole("button", { name: "Choose time" })).toBeDefined();
  });

  it("lets pickerLabel and listLabel put the words in another language", async () => {
    const user = userEvent.setup();
    render(<TimeInput aria-label="Från" pickerLabel="Välj tid" listLabel="Föreslagna tider" />);
    expect(screen.getByRole("button", { name: "Välj tid Från" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Välj tid Från" }));
    expect(screen.getByRole("listbox", { name: "Föreslagna tider Från" })).toBeDefined();
  });

  it("lets pickerLabel carry the whole name where the field's cannot be read", () => {
    render(
      <>
        <label htmlFor="start">Start</label>
        <TimeInput id="start" pickerLabel="Choose start time" />
      </>,
    );
    expect(screen.getByRole("button", { name: "Choose start time" })).toBeDefined();
  });

  it("still points the clock button at the list it opens", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" />);
    await user.click(clockButton());

    const list = screen.getByRole("listbox");
    expect(list.id).not.toBe("");
    expect(clockButton().getAttribute("aria-controls")).toBe(list.id);
  });

  it("leaves the id of the field alone", () => {
    const { rerender } = render(<TimeInput aria-label="Time" />);
    expect(field().id).toBe("");

    rerender(<TimeInput aria-label="Time" id="mine" />);
    expect(field().id).toBe("mine");
  });
});

describe("TimeInput keyboard shortcut hint", () => {
  it("advertises Alt+ArrowDown only while the shortcut works", () => {
    const { rerender } = render(<TimeInput aria-label="Time" />);
    expect(field().getAttribute("aria-keyshortcuts")).toBe("Alt+ArrowDown");

    rerender(<TimeInput aria-label="Time" readOnly />);
    expect(field().getAttribute("aria-keyshortcuts")).toBeNull();

    rerender(<TimeInput aria-label="Time" disabled />);
    expect(field().getAttribute("aria-keyshortcuts")).toBeNull();

    rerender(<TimeInput aria-label="Time" suggestionStep={0} />);
    expect(field().getAttribute("aria-keyshortcuts")).toBeNull();
  });
});

describe("TimeInput ref", () => {
  it("attaches a stable callback ref once, however often the field renders", async () => {
    const user = userEvent.setup();
    const ref = vi.fn();
    const { rerender } = render(<TimeInput aria-label="Time" ref={ref} defaultValue="09:00" />);
    rerender(<TimeInput aria-label="Time" ref={ref} defaultValue="09:00" />);

    field().focus();
    await user.keyboard("{ArrowUp}{ArrowUp}");

    // useImperativeHandle without dependencies detached and re-attached it on every render.
    expect(ref).toHaveBeenCalledTimes(1);
    expect(ref).toHaveBeenCalledWith(field());
  });

  it("fills an object ref and empties it again on unmount", () => {
    const ref = React.createRef<HTMLInputElement>();
    const { unmount } = render(<TimeInput aria-label="Time" ref={ref} />);
    expect(ref.current).toBe(field());

    unmount();
    expect(ref.current).toBeNull();
  });
});

describe("TimeInput passes events on to the caller", () => {
  it("calls onFocus, onMouseDown, onMouseUp, onKeyDown and onBlur", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const onKeyDown = vi.fn();
    const onMouseDown = vi.fn();
    const onMouseUp = vi.fn();
    render(
      <TimeInput
        aria-label="Time"
        defaultValue="09:00"
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
      />,
    );

    await user.click(field());
    expect(onMouseDown).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onMouseUp).toHaveBeenCalledTimes(1);

    await user.keyboard("{ArrowUp}");
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect((onKeyDown.mock.calls[0][0] as React.KeyboardEvent).key).toBe("ArrowUp");

    await user.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("lets onKeyDown cancel an arrow step with preventDefault", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Harness
        initial="09:00"
        onChange={onChange}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") event.preventDefault();
        }}
      />,
    );

    field().focus();
    await user.keyboard("{ArrowUp}");
    expect(field().value).toBe("09:00");
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard("{ArrowDown}");
    expect(field().value).toBe("08:59");
  });

  it("leaves the arrow keys to the input method while text is being composed", () => {
    render(<Harness initial="09:00" />);
    field().focus();

    fireEvent.keyDown(field(), { key: "ArrowUp", isComposing: true });
    expect(field().value).toBe("09:00");

    // Control: the same key outside a composition steps.
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(field().value).toBe("09:01");
  });

  it("starts an empty field at 09:00 on ArrowDown when there is no list to open", async () => {
    const user = userEvent.setup();
    render(<Harness suggestionStep={0} />);

    field().focus();
    await user.keyboard("{ArrowDown}");

    expect(field().value).toBe("09:00");
  });

  it("keeps the selection a click focused the field with, and only that click's mouseup", () => {
    render(<TimeInput aria-label="Time" defaultValue="09:00" />);

    fireEvent.mouseDown(field());
    // Cancelled: a mouseup that is let through would collapse the selection the focus made.
    expect(fireEvent.mouseUp(field())).toBe(false);

    field().focus();
    fireEvent.mouseDown(field());
    expect(fireEvent.mouseUp(field())).toBe(true);
  });
});

describe("TimeInput suggestion rows", () => {
  it.each([Densities.Small, Densities.Medium, Densities.Large])(
    "gives the row the keyboard is on the shared inset ring at %s density",
    (density) => {
      expect(timeOptionVariant({ density })).toContain(menuItemRing);
    },
  );

  it("puts the ring on the rows of the list", async () => {
    const user = userEvent.setup();
    render(<Harness initial="09:00" />);
    await user.click(clockButton());

    for (const option of options()) expect(option.className).toContain(menuItemRing);
  });

  it.each([
    [Densities.Small, "[&_svg]:size-3"],
    [Densities.Medium, "[&_svg]:size-4"],
    [Densities.Large, "[&_svg]:size-5"],
  ])(
    "sizes the check mark with the row at %s density, not with a fixed size",
    async (density, size) => {
      const user = userEvent.setup();
      render(<TimeInput aria-label="Time" density={density} defaultValue="09:00" />);
      await user.click(clockButton());

      const selected = screen.getByRole("option", { selected: true });
      expect(selected.className).toContain(size);
      expect(selected.querySelector("svg")?.getAttribute("class") ?? "").not.toMatch(/\bsize-\d/);
    },
  );
});

describe("TimeInput width", () => {
  it.each([
    [Densities.Small, "min-w-20"],
    [Densities.Medium, "min-w-24"],
    [Densities.Large, "min-w-28"],
  ])("keeps %s density wide enough for the time beside the clock button", (density, minWidth) => {
    render(<TimeInput aria-label="Time" density={density} defaultValue="09:00" />);
    expect(field().parentElement?.className).toContain(minWidth);
  });

  it("asks for no room for a button that is not there", () => {
    render(<TimeInput aria-label="Time" defaultValue="09:00" suggestionStep={0} />);
    expect(field().parentElement?.className).not.toMatch(/min-w-/);
  });

  it("lets the caller's width win", () => {
    render(<TimeInput aria-label="Time" defaultValue="09:00" className="w-40" />);
    expect(field().parentElement?.className).toContain("w-40");
    expect(field().parentElement?.className).not.toContain("w-full");
  });
});
