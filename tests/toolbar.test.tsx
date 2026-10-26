import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import type { ComponentProps, MouseEvent as ReactMouseEvent } from "react";
import { Bold, Redo2, Undo2 } from "lucide-react";

import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
  ToolbarToggleButton,
} from "../src/components/ui/toolbar";

function items(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-toolbar-item]"));
}

function renderToolbar(extra?: Partial<ComponentProps<typeof Toolbar>>) {
  return render(
    <Toolbar aria-label="Plan actions" {...extra}>
      <ToolbarGroup aria-label="History">
        <ToolbarButton label="Undo" />
        <ToolbarButton label="Redo" />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarButton label="Save" />
    </Toolbar>,
  );
}

describe("Toolbar component", () => {
  it("renders the toolbar, group and separator roles", () => {
    renderToolbar();

    const toolbar = screen.getByRole("toolbar", { name: "Plan actions" });
    expect(toolbar.getAttribute("aria-orientation")).toBe("horizontal");
    expect(screen.getByRole("group", { name: "History" })).toBeDefined();

    const separator = screen.getByRole("separator");
    expect(separator.getAttribute("aria-orientation")).toBe("vertical");
  });

  it("renders a horizontal separator when the toolbar is vertical", () => {
    renderToolbar({ orientation: "vertical" });
    expect(screen.getByRole("toolbar").getAttribute("aria-orientation")).toBe("vertical");
    expect(screen.getByRole("separator").getAttribute("aria-orientation")).toBe("horizontal");
  });

  it("keeps exactly one item tabbable", () => {
    renderToolbar();
    const tabbable = items().filter((el) => el.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
    expect(items().filter((el) => el.getAttribute("tabindex") === "-1")).toHaveLength(
      items().length - 1,
    );
  });

  it("moves focus with arrow keys and wraps at both ends", () => {
    renderToolbar();
    const [undo, redo, save] = items();

    undo.focus();
    fireEvent.keyDown(undo, { key: "ArrowRight" });
    expect(document.activeElement).toBe(redo);

    fireEvent.keyDown(redo, { key: "ArrowRight" });
    expect(document.activeElement).toBe(save);

    // wraps forward
    fireEvent.keyDown(save, { key: "ArrowRight" });
    expect(document.activeElement).toBe(undo);

    // wraps backward
    fireEvent.keyDown(undo, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(save);
  });

  it("jumps to first and last with Home and End", () => {
    renderToolbar();
    const all = items();
    const first = all[0];
    const last = all[all.length - 1];

    first.focus();
    fireEvent.keyDown(first, { key: "End" });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(last, { key: "Home" });
    expect(document.activeElement).toBe(first);
  });

  it("skips disabled items and separators during navigation", () => {
    render(
      <Toolbar aria-label="Plan actions">
        <ToolbarButton label="Undo" />
        <ToolbarButton label="Redo" disabled />
        <ToolbarSeparator />
        <ToolbarButton label="Save" />
      </Toolbar>,
    );

    const undo = screen.getByRole("button", { name: "Undo" });
    const save = screen.getByRole("button", { name: "Save" });

    undo.focus();
    fireEvent.keyDown(undo, { key: "ArrowRight" });
    expect(document.activeElement).toBe(save);
  });

  it("navigates a vertical toolbar with ArrowDown and ArrowUp", () => {
    renderToolbar({ orientation: "vertical" });
    const [undo, redo] = items();

    undo.focus();
    fireEvent.keyDown(undo, { key: "ArrowDown" });
    expect(document.activeElement).toBe(redo);

    fireEvent.keyDown(redo, { key: "ArrowUp" });
    expect(document.activeElement).toBe(undo);
  });

  it("moves items past maxVisibleItems into an overflow menu", () => {
    const onThird = vi.fn();
    render(
      <Toolbar aria-label="Plan actions" overflow="menu" maxVisibleItems={2}>
        <ToolbarButton label="First" />
        <ToolbarButton label="Second" />
        <ToolbarSeparator />
        <ToolbarButton label="Third" onClick={onThird} />
        <ToolbarButton label="Fourth" />
      </Toolbar>,
    );

    expect(screen.getByRole("button", { name: "First" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Second" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Third" })).toBeNull();
    // The separator adjacent to the moved items collapses.
    expect(screen.queryByRole("separator")).toBeNull();

    const trigger = screen.getByRole("button", { name: "More actions" });
    fireEvent.keyDown(trigger, { key: "Enter" });

    const third = screen.getByRole("menuitem", { name: "Third" });
    expect(screen.getByRole("menuitem", { name: "Fourth" })).toBeDefined();

    fireEvent.click(third);
    expect(onThird).toHaveBeenCalledTimes(1);
  });

  it("marks the overflow trigger as a toolbar item so the menu stays keyboard reachable", () => {
    render(
      <Toolbar aria-label="Plan actions" overflow="menu" maxVisibleItems={1}>
        <ToolbarButton label="First" />
        <ToolbarButton label="Second" />
      </Toolbar>,
    );
    const trigger = screen.getByRole("button", { name: "More actions" });
    expect(trigger.getAttribute("data-toolbar-item")).toBe("");
  });

  it("sets aria-disabled on the root when disabled", () => {
    renderToolbar({ disabled: true });
    expect(screen.getByRole("toolbar").getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Undo" })).toHaveProperty("disabled", true);
  });

  it("names an icon-only button from its tooltip", () => {
    render(
      <Toolbar aria-label="Plan actions">
        <ToolbarButton icon={<Undo2 />} tooltip="Undo" />
        <ToolbarButton icon={<Redo2 />} tooltip="Redo" />
      </Toolbar>,
    );
    expect(screen.getByRole("button", { name: "Undo" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDefined();
  });

  it("reflects pressed state and reports changes from the toggle button", () => {
    const onPressedChange = vi.fn();
    render(
      <Toolbar aria-label="Formatting">
        <ToolbarToggleButton
          icon={<Bold />}
          tooltip="Bold"
          pressed
          onPressedChange={onPressedChange}
        />
      </Toolbar>,
    );

    const button = screen.getByRole("button", { name: "Bold" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.className).toContain("bg-accent");

    fireEvent.click(button);
    expect(onPressedChange).toHaveBeenCalledWith(false);
  });

  it("excludes leading and trailing slots from arrow-key navigation", () => {
    render(
      <Toolbar
        aria-label="Plan actions"
        leading={<ToolbarButton label="Leading" />}
        trailing={<ToolbarButton label="Trailing" />}
      >
        <ToolbarButton label="Undo" />
        <ToolbarButton label="Redo" />
      </Toolbar>,
    );

    const undo = screen.getByRole("button", { name: "Undo" });
    const redo = screen.getByRole("button", { name: "Redo" });

    undo.focus();
    fireEvent.keyDown(undo, { key: "ArrowRight" });
    expect(document.activeElement).toBe(redo);

    // wrapping returns to Undo rather than reaching the slot buttons
    fireEvent.keyDown(redo, { key: "ArrowRight" });
    expect(document.activeElement).toBe(undo);
  });
});

describe("Toolbar keys that are not the toolbar's", () => {
  function withSearch(slot: "leading" | "trailing") {
    const search = <input aria-label="Search" defaultValue="hello" />;
    return render(
      <Toolbar aria-label="Plan actions" {...{ [slot]: search }}>
        <ToolbarButton label="Undo" />
        <ToolbarButton label="Redo" />
      </Toolbar>,
    );
  }

  it.each([
    ["leading", "Home"],
    ["leading", "End"],
    ["leading", "ArrowLeft"],
    ["leading", "ArrowRight"],
    ["trailing", "Home"],
    ["trailing", "End"],
    ["trailing", "ArrowLeft"],
    ["trailing", "ArrowRight"],
  ] as const)("leaves %s-slot input %s to the caret", (slot, key) => {
    withSearch(slot);
    const input = screen.getByRole("textbox", { name: "Search" });
    input.focus();
    // fireEvent returns false when a handler called preventDefault, which would stop the caret.
    expect(fireEvent.keyDown(input, { key })).toBe(true);
    expect(document.activeElement).toBe(input);
  });

  it("lets a person type through the toolbar around a search field", async () => {
    const user = userEvent.setup();
    withSearch("leading");
    const input = screen.getByRole("textbox", { name: "Search" }) as HTMLInputElement;
    await user.click(input);
    await user.keyboard("{End} world{Home}>");
    expect(input.value).toBe(">hello world");
  });

  it("leaves the caret keys of an editable item in the toolbar itself to the field", () => {
    render(
      <Toolbar aria-label="Plan actions">
        <ToolbarButton label="Undo" />
        <input aria-label="Zoom" data-toolbar-item="" defaultValue="100" />
        <ToolbarButton label="Redo" />
      </Toolbar>,
    );
    const zoom = screen.getByRole("textbox", { name: "Zoom" });
    zoom.focus();
    for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
      expect(fireEvent.keyDown(zoom, { key })).toBe(true);
      expect(document.activeElement).toBe(zoom);
    }
    // Arriving at it from a button still works.
    const undo = screen.getByRole("button", { name: "Undo" });
    undo.focus();
    expect(fireEvent.keyDown(undo, { key: "ArrowRight" })).toBe(false);
    expect(document.activeElement).toBe(zoom);
  });

  it("does not take the keys of a button in a slot either", () => {
    render(
      <Toolbar aria-label="Plan actions" leading={<ToolbarButton label="Leading" />}>
        <ToolbarButton label="Undo" />
      </Toolbar>,
    );
    const leading = screen.getByRole("button", { name: "Leading" });
    leading.focus();
    expect(fireEvent.keyDown(leading, { key: "ArrowRight" })).toBe(true);
    expect(document.activeElement).toBe(leading);
  });

  it.each([
    ["Alt", { altKey: true }],
    ["Ctrl", { ctrlKey: true }],
    ["Meta", { metaKey: true }],
  ])("leaves %s chords to the browser", (_name, modifier) => {
    renderToolbar();
    const [undo] = items();
    undo.focus();
    for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
      expect(fireEvent.keyDown(undo, { key, ...modifier })).toBe(true);
      expect(document.activeElement).toBe(undo);
    }
  });

  it("still navigates with the bare keys, and with Shift held", () => {
    renderToolbar();
    const [undo, redo] = items();
    undo.focus();
    expect(fireEvent.keyDown(undo, { key: "ArrowRight" })).toBe(false);
    expect(document.activeElement).toBe(redo);
    expect(fireEvent.keyDown(redo, { key: "ArrowLeft", shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(undo);
  });

  it("keeps the overflow menu's keys inside the menu", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar aria-label="Formatting" overflow="menu" maxVisibleItems={1}>
        <ToolbarButton label="First" />
        <ToolbarButton label="Second" />
        <ToolbarButton label="Third" />
      </Toolbar>,
    );
    screen.getByRole("button", { name: "More actions" }).focus();
    await user.keyboard("{Enter}");
    const menu = screen.getByRole("menu");
    expect(menu.contains(document.activeElement)).toBe(true);

    await user.keyboard("{End}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Third" }));
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Second" }));
  });
});

describe("Toolbar pressed toggle cue", () => {
  it("adds a bar under a pressed toggle, in a colour forced-colors mode keeps", () => {
    render(
      <Toolbar aria-label="Formatting">
        <ToolbarToggleButton icon={<Bold />} tooltip="Bold" pressed />
        <ToolbarToggleButton icon={<Bold />} tooltip="Italic" pressed={false} />
      </Toolbar>,
    );
    const bold = screen.getByRole("button", { name: "Bold" });
    expect(bold.className).toContain("after:bg-foreground");
    expect(bold.className).toContain("forced-colors:after:bg-[Highlight]");
    // The bar sits on the button, so the button is its positioning context.
    expect(bold.className.split(/\s+/)).toContain("relative");

    const italic = screen.getByRole("button", { name: "Italic" });
    expect(italic.className).not.toContain("after:bg-foreground");
  });
});

describe("Toolbar roving tab stop", () => {
  it("returns to the last focused item on Shift+Tab, however focus got there", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Toolbar aria-label="Plan actions">
          <ToolbarButton label="Undo" />
          <ToolbarButton label="Redo" />
          <ToolbarButton label="Save" />
        </Toolbar>
        <button type="button">After</button>
      </>,
    );

    // A pointer press picks the item; the arrow keys are never involved.
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Save" }));
  });

  it("moves the tab stop with programmatic focus", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Toolbar aria-label="Plan actions">
          <ToolbarButton label="Undo" />
          <ToolbarButton label="Redo" />
          <ToolbarButton label="Save" />
        </Toolbar>
        <button type="button">After</button>
      </>,
    );

    act(() => screen.getByRole("button", { name: "Redo" }).focus());
    expect(screen.getByRole("button", { name: "Redo" }).getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("button", { name: "Undo" }).getAttribute("tabindex")).toBe("-1");

    await user.tab();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Redo" }));
  });

  it("keeps arrow navigation starting from the focused item after a click", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByRole("button", { name: "Redo" }));
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Save" }));
  });

  it("still calls the consumer's onFocus", () => {
    const onFocus = vi.fn();
    renderToolbar({ onFocus });
    screen.getByRole("button", { name: "Redo" }).focus();
    expect(onFocus).toHaveBeenCalledTimes(1);
  });
});

describe("Toolbar overflow menu", () => {
  function renderOverflowing(extra?: {
    onBold?: (pressed: boolean) => void;
    onSave?: (event: ReactMouseEvent) => void;
  }) {
    return render(
      <Toolbar aria-label="Formatting" overflow="menu" maxVisibleItems={1}>
        <ToolbarButton label="First" />
        <ToolbarToggleButton icon={<Bold />} label="Bold" pressed onPressedChange={extra?.onBold} />
        <ToolbarToggleButton icon={<Bold />} label="Italic" pressed={false} />
        <ToolbarButton label="Save" onClick={extra?.onSave} />
      </Toolbar>,
    );
  }

  function openMenu() {
    fireEvent.keyDown(screen.getByRole("button", { name: "More actions" }), { key: "Enter" });
    return screen.getByRole("menu");
  }

  it("shows a toggle's pressed state as a checked menu item", () => {
    renderOverflowing();
    const menu = openMenu();
    expect(
      within(menu).getByRole("menuitemcheckbox", { name: "Bold" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      within(menu).getByRole("menuitemcheckbox", { name: "Italic" }).getAttribute("aria-checked"),
    ).toBe("false");
    // A plain button is an ordinary item, not a checkbox.
    expect(within(menu).getByRole("menuitem", { name: "Save" })).toBeDefined();
  });

  it("reports the new pressed state when a toggle is chosen in the menu", () => {
    const onBold = vi.fn();
    renderOverflowing({ onBold });
    const menu = openMenu();
    fireEvent.click(within(menu).getByRole("menuitemcheckbox", { name: "Bold" }));
    expect(onBold).toHaveBeenCalledTimes(1);
    expect(onBold).toHaveBeenCalledWith(false);
  });

  it("hands a plain button's onClick a real event it can cancel", () => {
    const onSave = vi.fn((event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
    });
    renderOverflowing({ onSave });
    const menu = openMenu();
    expect(() =>
      fireEvent.click(within(menu).getByRole("menuitem", { name: "Save" })),
    ).not.toThrow();
    expect(onSave).toHaveBeenCalledTimes(1);
    const event = onSave.mock.calls[0][0];
    expect(typeof event.preventDefault).toBe("function");
    expect(event.type).toBe("click");
  });

  it("chooses a toggle with the keyboard alone", async () => {
    const user = userEvent.setup();
    const onBold = vi.fn();
    renderOverflowing({ onBold });
    const trigger = screen.getByRole("button", { name: "More actions" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menu")).toBeDefined();

    // Opened from the keyboard, Radix lands on the first item.
    expect(document.activeElement).toBe(screen.getByRole("menuitemcheckbox", { name: "Bold" }));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("menuitemcheckbox", { name: "Italic" }));
    await user.keyboard("{ArrowUp}{Enter}");
    expect(onBold).toHaveBeenCalledWith(false);
  });

  it("returns focus to the overflow trigger when the menu closes", async () => {
    const user = userEvent.setup();
    renderOverflowing();
    const trigger = screen.getByRole("button", { name: "More actions" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(trigger);
  });
});
