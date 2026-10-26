import { useState } from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { BadgeSelect, type BadgeSelectOption } from "./BadgeSelect";

const options: BadgeSelectOption[] = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "enhancement", label: "Enhancement" },
  { value: "urgent", label: "Urgent", removable: false },
];

const actions: BadgeSelectOption[] = [
  { value: "__add__", label: "Add tag", icon: "Plus" },
  { value: "__manage__", label: "Manage tags" },
];

interface HarnessProps {
  initial?: string[];
  multiple?: boolean;
  withActions?: boolean;
  onAction?: (value: string) => void;
  onChange?: (value: string[]) => void;
}

function Harness({
  initial = [],
  multiple = true,
  withActions = false,
  onAction,
  onChange,
}: HarnessProps) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <>
      <button type="button">Before</button>
      <BadgeSelect
        id="bs"
        options={options}
        actions={withActions ? actions : undefined}
        value={value}
        multiple={multiple}
        placeholder="Tags"
        events={["OnChange", "OnAction"]}
        eventHandler={(event, _id, args) => {
          if (event === "OnChange") {
            setValue(args[0] as string[]);
            onChange?.(args[0] as string[]);
          } else {
            onAction?.(args[0] as string);
          }
        }}
      />
      <button type="button">After</button>
    </>
  );
}

const combobox = () => screen.getByRole("combobox", { name: "Tags" });
const activeOption = () => {
  const id = combobox().getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
};

describe("BadgeSelect as a select-only combobox", () => {
  it("is one persistent combobox whether or not anything is selected", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const empty = combobox();
    expect(empty.tagName).toBe("BUTTON");

    await user.click(empty);
    await user.click(await screen.findByRole("option", { name: "Bug" }));

    // The same element, so focus survives the first pick.
    expect(combobox()).toBe(empty);
    expect(empty).toHaveFocus();
    expect(empty).toHaveTextContent("Bug");
  });

  it("keeps remove buttons out of the combobox element", () => {
    render(<Harness initial={["bug", "feature"]} />);
    const remove = screen.getByRole("button", { name: "Remove Bug" });
    expect(combobox().contains(remove)).toBe(false);
    expect(combobox().querySelector("button, [role='button']")).toBeNull();
  });

  it("exposes the selected labels as the combobox value, once", () => {
    render(<Harness initial={["bug", "feature"]} />);
    expect(combobox()).toHaveTextContent("Bug, Feature");
  });

  it("is a single tab stop followed by the remove buttons", async () => {
    const user = userEvent.setup();
    // jsdom measures every box as 0 wide, so only the first badge is laid out as visible.
    render(<Harness initial={["bug", "feature"]} />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
    await user.tab();
    expect(combobox()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Remove Bug" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
    ["ArrowDown", "{ArrowDown}"],
    ["ArrowUp", "{ArrowUp}"],
  ])("opens with %s and highlights the first option", async (_name, key) => {
    const user = userEvent.setup();
    render(<Harness />);
    combobox().focus();
    await user.keyboard(key);

    expect(combobox()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(activeOption()).toHaveTextContent("Bug");
    // Focus never left the combobox.
    expect(combobox()).toHaveFocus();
  });

  it("points aria-controls at the listbox only while it is open", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(combobox()).not.toHaveAttribute("aria-controls");
    combobox().focus();
    await user.keyboard("{Enter}");
    expect(combobox().getAttribute("aria-controls")).toContain(
      screen.getByRole("listbox").getAttribute("id"),
    );
  });

  it("opens on the first selected option", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["enhancement"]} />);
    combobox().focus();
    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toHaveTextContent("Enhancement");
  });

  it("moves the highlight with the arrow keys and stops at the ends", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    combobox().focus();
    await user.keyboard("{Enter}");
    expect(activeOption()).toHaveTextContent("Bug");

    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toHaveTextContent("Feature");
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(activeOption()).toHaveTextContent("Urgent");
    await user.keyboard("{ArrowUp}");
    expect(activeOption()).toHaveTextContent("Enhancement");
  });

  it("jumps with Home and End", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    combobox().focus();
    await user.keyboard("{Enter}{End}");
    expect(activeOption()).toHaveTextContent("Urgent");
    await user.keyboard("{Home}");
    expect(activeOption()).toHaveTextContent("Bug");
  });

  it("opens on the last option with End from the closed state", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    combobox().focus();
    await user.keyboard("{End}");
    expect(activeOption()).toHaveTextContent("Urgent");
  });

  it("selects by typing the start of a label, and cycles repeated letters", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    combobox().focus();
    await user.keyboard("e");
    expect(combobox()).toHaveAttribute("aria-expanded", "true");
    expect(activeOption()).toHaveTextContent("Enhancement");

    await user.keyboard("{Escape}");
    await user.keyboard("f");
    expect(activeOption()).toHaveTextContent("Feature");
  });

  it("narrows a typed run to the first label that starts with all of it", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    combobox().focus();
    await user.keyboard("{Enter}");
    await user.keyboard("ur");
    expect(activeOption()).toHaveTextContent("Urgent");
  });

  it("toggles the highlighted option with Enter and keeps a multi-select open", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    combobox().focus();
    await user.keyboard("{Enter}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["bug"]);
    expect(combobox()).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["bug", "feature"]);

    // Enter on a selected option takes it off again.
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["bug"]);
    expect(screen.getByRole("option", { name: "Bug" })).toHaveAttribute("aria-selected", "true");
  });

  it("selects with Space too", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    combobox().focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith(["bug"]);
  });

  it("refuses to deselect a non-removable option from the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={["urgent"]} onChange={onChange} />);
    combobox().focus();
    await user.keyboard("{Enter}");
    expect(activeOption()).toHaveTextContent("Urgent");
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes a single-select after choosing and keeps focus on the combobox", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness multiple={false} onChange={onChange} />);
    combobox().focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["feature"]);
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(combobox()).toHaveFocus();
  });

  it("closes on Escape without changing anything and keeps focus on the combobox", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    combobox().focus();
    await user.keyboard("{Enter}{ArrowDown}{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
    expect(combobox()).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes on Tab and moves on; a single-select commits the highlighted row", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness multiple={false} onChange={onChange} />);
    combobox().focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(["feature"]);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("closes on Tab without selecting anything in a multi-select", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    combobox().focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("closes when focus moves elsewhere", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(combobox());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "After" }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("reaches the action rows with the arrow keys and runs one with Enter", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Harness withActions onAction={onAction} />);
    combobox().focus();
    await user.keyboard("{End}");
    expect(activeOption()).toHaveTextContent("Manage tags");
    await user.keyboard("{ArrowUp}");
    expect(activeOption()).toHaveTextContent("Add tag");
    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledWith("__add__");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(combobox()).toHaveFocus();
  });

  it("keeps action rows out of the option list and out of the tab order", async () => {
    const user = userEvent.setup();
    render(<Harness withActions />);
    combobox().focus();
    await user.keyboard("{Enter}");
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(options.length);
    expect(screen.getByRole("button", { name: "Add tag" })).toHaveAttribute("tabindex", "-1");
  });

  it("does not take focus off the combobox when an option is pressed with the pointer", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(combobox());
    await user.click(screen.getByRole("option", { name: "Feature" }));
    expect(combobox()).toHaveFocus();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("returns focus to the combobox when a badge is removed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={["bug", "feature"]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Remove Bug" }));
    expect(onChange).toHaveBeenLastCalledWith(["feature"]);
    await waitFor(() => expect(combobox()).toHaveFocus());
  });

  it("removes a badge with the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={["bug", "feature"]} onChange={onChange} />);
    screen.getByRole("button", { name: "Remove Bug" }).focus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["feature"]);
    expect(combobox()).toHaveFocus();
  });

  it("gives non-removable and single-select values no remove button", () => {
    const { unmount } = render(<Harness initial={["urgent"]} />);
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    unmount();
    render(<Harness initial={["bug"]} multiple={false} />);
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });
});

describe("BadgeSelect leaving the list with Tab or Alt+ArrowUp", () => {
  it("does not run an action row when Tab leaves a single-select", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onChange = vi.fn();
    render(<Harness multiple={false} withActions onAction={onAction} onChange={onChange} />);
    combobox().focus();
    await user.keyboard("{End}");
    expect(activeOption()).toHaveTextContent("Manage tags");
    await user.tab();

    expect(onAction).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("does not run an action row on Alt+ArrowUp, it only closes", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Harness multiple={false} withActions onAction={onAction} />);
    combobox().focus();
    await user.keyboard("{End}");
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");

    expect(onAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(combobox()).toHaveFocus();
  });

  it("does not toggle the highlighted option on Alt+ArrowUp in a multi-select", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={["bug"]} onChange={onChange} />);
    combobox().focus();
    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toHaveTextContent("Bug");
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Remove Bug" })).toBeInTheDocument();
  });

  it("commits the highlighted option on Alt+ArrowUp in a single-select", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness multiple={false} onChange={onChange} />);
    combobox().focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(["feature"]);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not report a change when Tab leaves a single-select on the value it already has", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={["feature"]} multiple={false} onChange={onChange} />);
    combobox().focus();
    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toHaveTextContent("Feature");
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("BadgeSelect popup pointer handling", () => {
  it("keeps focus on the combobox when the press lands on the popup's own padding or separator", async () => {
    const user = userEvent.setup();
    render(<Harness withActions />);
    await user.click(combobox());
    const menu = screen.getByRole("listbox").parentElement as HTMLElement;
    const separator = screen.getByRole("separator");

    // fireEvent returns false when a handler cancelled the event: the default action of a press
    // is to move focus, so a cancelled one leaves the combobox focused and the list open.
    expect(fireEvent.mouseDown(menu)).toBe(false);
    expect(fireEvent.mouseDown(separator)).toBe(false);
    expect(combobox()).toHaveFocus();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
});

describe("BadgeSelect scrolling a long list", () => {
  // jsdom has no layout and no scrollIntoView at all, so the calls are counted.
  const original = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
  const scrollIntoView = vi.fn();

  afterEach(() => {
    if (original) Object.defineProperty(Element.prototype, "scrollIntoView", original);
    else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
    scrollIntoView.mockReset();
  });

  function stage() {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
  }

  it("scrolls the highlighted row into view when the keyboard moves it", async () => {
    stage();
    const user = userEvent.setup();
    render(<Harness />);
    combobox().focus();
    await user.keyboard("{ArrowDown}");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest" });
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(activeOption());

    await user.keyboard("{ArrowDown}");
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(activeOption());
  });

  it("leaves the list where the person scrolled it, however many scroll events arrive", async () => {
    stage();
    const user = userEvent.setup();
    render(<Harness />);
    combobox().focus();
    await user.keyboard("{ArrowDown}");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    const listbox = screen.getByRole("listbox");
    fireEvent.scroll(listbox);
    fireEvent.scroll(listbox);
    fireEvent.scroll(window);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("does not scroll when the pointer, not the keyboard, moves the highlight", async () => {
    stage();
    const user = userEvent.setup();
    render(<Harness />);
    combobox().focus();
    await user.keyboard("{ArrowDown}");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    await user.hover(screen.getByRole("option", { name: "Enhancement" }));
    expect(activeOption()).toHaveTextContent("Enhancement");
    await user.hover(screen.getByRole("option", { name: "Urgent" }));
    expect(activeOption()).toHaveTextContent("Urgent");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("scrolls on the next key press after the pointer moved the highlight", async () => {
    stage();
    const user = userEvent.setup();
    render(<Harness />);
    combobox().focus();
    await user.keyboard("{ArrowDown}");
    await user.hover(screen.getByRole("option", { name: "Feature" }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toHaveTextContent("Enhancement");
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it("does not scroll to a row the pointer opened the list on", async () => {
    stage();
    const user = userEvent.setup();
    render(<Harness initial={["urgent"]} />);
    await user.click(combobox());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.hover(screen.getByRole("option", { name: "Feature" }));
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

describe("BadgeSelect inside a Dialog", () => {
  /** A dialog driven by state, as an app's form dialog is, around the usual harness. */
  function InDialog({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
    const [open, setOpen] = useState(true);
    return (
      <Dialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange?.(next);
          setOpen(next);
        }}
      >
        <DialogContent>
          <DialogTitle>Edit tags</DialogTitle>
          <DialogDescription>Pick the tags for this plan.</DialogDescription>
          <Harness />
        </DialogContent>
      </Dialog>
    );
  }

  it("closes only the list on Escape: the dialog stays open and focus stays on the combobox", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<InDialog onOpenChange={onOpenChange} />);
    combobox().focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(combobox()).toHaveFocus();
  });

  it("leaves the next Escape to the dialog once the list is closed", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<InDialog onOpenChange={onOpenChange} />);
    combobox().focus();
    await user.keyboard("{ArrowDown}{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("does not leave an Escape claim behind once the list is closed", async () => {
    const user = userEvent.setup();
    const outside = vi.fn();
    render(<Harness />);
    combobox().focus();
    await user.keyboard("{ArrowDown}{Escape}");

    // With the list shut, an Escape belongs to whoever is listening for it on the page.
    document.addEventListener("keydown", outside, true);
    try {
      await user.keyboard("{Escape}");
    } finally {
      document.removeEventListener("keydown", outside, true);
    }
    expect(outside).toHaveBeenCalledTimes(1);
  });
});

describe("BadgeSelect leaves the Alt chords to the browser", () => {
  it.each(["Home", "End", "PageDown", "PageUp", "Enter", " ", "Escape"])(
    "does not act on Alt+%s with the list closed",
    (key) => {
      render(<Harness />);
      expect(fireEvent.keyDown(combobox(), { key, altKey: true })).toBe(true);
      expect(combobox()).toHaveAttribute("aria-expanded", "false");
    },
  );

  it.each(["Home", "End", "PageDown", "PageUp"])(
    "does not move the highlight on Alt+%s with the list open",
    async (key) => {
      const user = userEvent.setup();
      render(<Harness />);
      combobox().focus();
      await user.keyboard("{ArrowDown}");
      const before = combobox().getAttribute("aria-activedescendant");
      expect(fireEvent.keyDown(combobox(), { key, altKey: true })).toBe(true);
      expect(combobox().getAttribute("aria-activedescendant")).toBe(before);
    },
  );

  it("still opens with Alt+ArrowDown and closes with Alt+ArrowUp", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    combobox().focus();
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(combobox()).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("BadgeSelect selected option cue", () => {
  it("marks a selected option that cannot be removed with a check, not only a tint", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["urgent", "bug"]} />);
    await user.click(combobox());
    const urgent = screen.getByRole("option", { name: "Urgent" });
    expect(urgent.querySelector(".lucide-check")).not.toBeNull();
    expect(urgent.querySelector(".lucide-x")).toBeNull();
  });

  it("keeps the X on a selected option that can be removed, and marks nothing else", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["urgent", "bug"]} />);
    await user.click(combobox());
    const bug = screen.getByRole("option", { name: "Bug" });
    expect(bug.querySelector(".lucide-x")).not.toBeNull();
    expect(bug.querySelector(".lucide-check")).toBeNull();
    const feature = screen.getByRole("option", { name: "Feature" });
    expect(feature.querySelector("svg")).toBeNull();
  });
});
