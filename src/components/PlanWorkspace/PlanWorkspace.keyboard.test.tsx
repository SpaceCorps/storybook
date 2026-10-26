import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { PlanWorkspace } from "./PlanWorkspace";
import { CHAT_WIDTH_STORAGE_KEY, MIN_CHAT_WIDTH } from "./chatWidth";

const actions = [{ tag: "Edit", label: "Edit", icon: "Pencil" }];
const menuItems = [
  { tag: "Archive", label: "Archive", icon: "Trash" },
  { tag: "Duplicate", label: "Duplicate", icon: "Trash" },
  { tag: "Delete", label: "Delete", icon: "Trash", danger: true },
  { tag: "Disabled", label: "Dormant", icon: "Trash", disabled: true },
];
const tabs = [
  { id: "plan", label: "Plan" },
  { id: "details", label: "Details", badge: "3" },
  { id: "history", label: "History" },
];

function renderWorkspace(handler = vi.fn(), extra: Record<string, unknown> = {}) {
  return render(
    <PlanWorkspace
      id="w"
      planId="#59"
      title="Revamp"
      actions={actions}
      menuItems={menuItems}
      tabs={tabs}
      selectedTab="details"
      events={["OnAction", "OnTabSelect"]}
      eventHandler={handler}
      slots={{ Content: [<div key="c">plan body</div>] }}
      {...extra}
    />,
  );
}

const tab = (name: string | RegExp) => screen.getByRole("tab", { name });

beforeEach(() => {
  window.localStorage.removeItem(CHAT_WIDTH_STORAGE_KEY);
});

afterEach(() => {
  window.localStorage.removeItem(CHAT_WIDTH_STORAGE_KEY);
});

describe("PlanWorkspace tab strip", () => {
  it("is a named tablist whose selected tab is linked to the panel it controls", () => {
    renderWorkspace();
    expect(screen.getByRole("tablist", { name: "Views" })).toBeInTheDocument();
    const panel = screen.getByRole("tabpanel");
    expect(tab(/Details/)).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab(/Details/).id);
    expect(tab(/Plan/)).not.toHaveAttribute("aria-controls");
  });

  it("leaves the content region unlabelled when there are no tabs", () => {
    renderWorkspace(vi.fn(), { tabs: [], selectedTab: undefined });
    expect(screen.queryByRole("tabpanel")).toBeNull();
  });

  it("makes the selected tab the only tab stop", () => {
    renderWorkspace();
    expect(tab(/Details/)).toHaveAttribute("tabindex", "0");
    expect(tab(/Plan/)).toHaveAttribute("tabindex", "-1");
    expect(tab(/History/)).toHaveAttribute("tabindex", "-1");
  });

  it("falls back to the first tab when none is selected", () => {
    renderWorkspace(vi.fn(), { selectedTab: undefined });
    expect(tab(/Plan/)).toHaveAttribute("tabindex", "0");
    expect(tab(/Details/)).toHaveAttribute("tabindex", "-1");
  });

  it("is entered at the selected tab with Tab and left with the next Tab", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    // Topbar actions come first: the Edit button and the overflow button.
    await user.tab();
    await user.tab();
    await user.tab();
    expect(tab(/Details/)).toHaveFocus();
    await user.tab();
    expect(tab(/Details/)).not.toHaveFocus();
    expect(screen.getByRole("tablist")).not.toContainElement(document.activeElement as HTMLElement);
  });

  it("moves focus with the arrow keys, wrapping, without selecting", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    renderWorkspace(handler);
    tab(/Details/).focus();

    await user.keyboard("{ArrowRight}");
    expect(tab(/History/)).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tab(/Plan/)).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(tab(/History/)).toHaveFocus();
    expect(handler).not.toHaveBeenCalledWith("OnTabSelect", "w", expect.anything());
  });

  it("jumps with Home and End", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    tab(/Details/).focus();
    await user.keyboard("{End}");
    expect(tab(/History/)).toHaveFocus();
    await user.keyboard("{Home}");
    expect(tab(/Plan/)).toHaveFocus();
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("selects the focused tab with %s", async (_name, key) => {
    const user = userEvent.setup();
    const handler = vi.fn();
    renderWorkspace(handler);
    tab(/Details/).focus();
    await user.keyboard("{ArrowRight}");
    await user.keyboard(key);
    expect(handler).toHaveBeenCalledWith("OnTabSelect", "w", ["history"]);
  });

  it("keeps the arrow keys away from the document's shortcuts", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    renderWorkspace(handler, {
      shortcuts: [{ tag: "NextPlan", label: "Next plan", shortcut: "ArrowRight" }],
    });
    tab(/Details/).focus();
    await user.keyboard("{ArrowRight}");
    expect(handler).not.toHaveBeenCalledWith("OnAction", "w", ["NextPlan"]);
  });
});

describe("PlanWorkspace overflow menu", () => {
  const trigger = () => screen.getByRole("button", { name: "More actions" });
  const item = (name: string | RegExp) => screen.getByRole("menuitem", { name });

  it("opens with ArrowDown onto the first item and ArrowUp onto the last enabled one", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    trigger().focus();
    await user.keyboard("{ArrowDown}");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(item("Archive")).toHaveFocus();

    await user.keyboard("{Escape}");
    await user.keyboard("{ArrowUp}");
    expect(item("Delete")).toHaveFocus();
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("opens with %s onto the first item", async (_name, key) => {
    const user = userEvent.setup();
    renderWorkspace();
    trigger().focus();
    await user.keyboard(key);
    expect(item("Archive")).toHaveFocus();
  });

  it("opens with a click onto the menu itself, so the arrows still work", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(trigger());
    expect(screen.getByRole("menu")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(item("Archive")).toHaveFocus();
  });

  it("links the trigger to the menu while it is open", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    expect(trigger()).not.toHaveAttribute("aria-controls");
    trigger().focus();
    await user.keyboard("{Enter}");
    expect(trigger()).toHaveAttribute("aria-controls", screen.getByRole("menu").id);
  });

  it("keeps the items out of the tab order", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    trigger().focus();
    await user.keyboard("{Enter}");
    for (const menuItem of screen.getAllByRole("menuitem")) {
      expect(menuItem).toHaveAttribute("tabindex", "-1");
    }
  });

  it("walks the enabled items with the arrows, wrapping, and skips the disabled one", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    trigger().focus();
    await user.keyboard("{Enter}");
    expect(item("Archive")).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(item("Duplicate")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(item("Delete")).toHaveFocus();
    // The disabled item is passed over on the way round.
    await user.keyboard("{ArrowDown}");
    expect(item("Archive")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(item("Delete")).toHaveFocus();
  });

  it("jumps with Home and End", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    trigger().focus();
    await user.keyboard("{Enter}{End}");
    expect(item("Delete")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(item("Archive")).toHaveFocus();
  });

  it("jumps to the item starting with a typed letter", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    trigger().focus();
    await user.keyboard("{Enter}");
    await user.keyboard("d");
    expect(item("Duplicate")).toHaveFocus();
    await user.keyboard("d");
    expect(item("Delete")).toHaveFocus();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    trigger().focus();
    await user.keyboard("{Enter}{ArrowDown}");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it("fires the item with Enter, closes, and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    renderWorkspace(handler);
    trigger().focus();
    await user.keyboard("{Enter}{ArrowDown}{Enter}");
    expect(handler).toHaveBeenCalledWith("OnAction", "w", ["Duplicate"]);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it("closes on Tab and carries on past the menu", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    trigger().focus();
    await user.keyboard("{Enter}");
    await user.tab();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
  });

  it("does not steal focus back with a later Escape once it has closed", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    trigger().focus();
    await user.keyboard("{Enter}{Escape}");
    expect(trigger()).toHaveFocus();

    // Focus moves on; a menu that left an Escape handler behind would pull it back to the trigger.
    screen.getByRole("button", { name: "Edit" }).focus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();
  });
});

describe("PlanWorkspace tab strip modifier keys", () => {
  it.each([
    ["Alt", { altKey: true }],
    ["Ctrl", { ctrlKey: true }],
    ["Meta", { metaKey: true }],
  ])("leaves %s with the arrow keys to the browser", (_name, modifier) => {
    renderWorkspace();
    tab(/Details/).focus();

    // fireEvent returns false when a handler called preventDefault, which would swallow the
    // browser's Back/Forward shortcut.
    expect(fireEvent.keyDown(tab(/Details/), { key: "ArrowLeft", ...modifier })).toBe(true);
    expect(fireEvent.keyDown(tab(/Details/), { key: "ArrowRight", ...modifier })).toBe(true);
    expect(tab(/Details/)).toHaveFocus();
  });

  it("still moves with the plain arrow keys", () => {
    renderWorkspace();
    tab(/Details/).focus();
    expect(fireEvent.keyDown(tab(/Details/), { key: "ArrowRight" })).toBe(false);
    expect(tab(/History/)).toHaveFocus();
  });
});

describe("PlanWorkspace overflow menu with nothing to choose", () => {
  const disabledOnly = [
    { tag: "Archive", label: "Archive", icon: "Trash", disabled: true },
    { tag: "Delete", label: "Delete", icon: "Trash", disabled: true },
  ];

  it("takes focus itself when it opens by keyboard, so Escape closes it", async () => {
    const user = userEvent.setup();
    renderWorkspace(vi.fn(), { menuItems: disabledOnly });
    const trigger = screen.getByRole("button", { name: "More actions" });
    trigger.focus();
    await user.keyboard("{Enter}");

    const menu = screen.getByRole("menu");
    expect(menu).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("takes focus itself when it opens with ArrowUp, and closes on Escape", async () => {
    const user = userEvent.setup();
    renderWorkspace(vi.fn(), { menuItems: disabledOnly });
    const trigger = screen.getByRole("button", { name: "More actions" });
    trigger.focus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menu")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});

describe("PlanWorkspace tab tool dropdowns", () => {
  const slots = {
    Content: [<div key="c">plan body</div>],
    Verifications: [
      <button key="v" type="button">
        Re-run checks
      </button>,
    ],
  };

  it("returns focus to its button when Escape closes it from inside the panel", async () => {
    const user = userEvent.setup();
    renderWorkspace(vi.fn(), { slots });
    const tool = screen.getByRole("button", { name: "Verifications" });
    tool.focus();
    await user.keyboard("{Enter}");
    expect(tool).toHaveAttribute("aria-expanded", "true");

    await user.tab();
    expect(screen.getByRole("button", { name: "Re-run checks" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(tool).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Re-run checks" })).toBeNull();
    expect(tool).toHaveFocus();
  });

  it("keeps focus on its button when Escape closes it from the button", async () => {
    const user = userEvent.setup();
    renderWorkspace(vi.fn(), { slots });
    const tool = screen.getByRole("button", { name: "Verifications" });
    tool.focus();
    await user.keyboard("{Enter}{Escape}");
    expect(tool).toHaveAttribute("aria-expanded", "false");
    expect(tool).toHaveFocus();
  });

  it("does not pull focus back when Escape closes a hover-opened panel from elsewhere", async () => {
    const user = userEvent.setup();
    renderWorkspace(vi.fn(), { slots });
    const tool = screen.getByRole("button", { name: "Verifications" });
    await user.click(tool);
    expect(tool).toHaveAttribute("aria-expanded", "true");

    // Focus is somewhere else on the page, as it is when the pointer opened the panel. A tab, not
    // an icon button: focusing an icon button shows its tooltip, and that tooltip is a layer of its
    // own that takes the first Escape.
    tab(/Details/).focus();
    await user.keyboard("{Escape}");
    expect(tool).toHaveAttribute("aria-expanded", "false");
    expect(tab(/Details/)).toHaveFocus();
  });

  it("lets a tooltip take the Escape first, then closes on the next one", async () => {
    const user = userEvent.setup();
    renderWorkspace(vi.fn(), { slots });
    const tool = screen.getByRole("button", { name: "Verifications" });
    await user.click(tool);

    const edit = screen.getByRole("button", { name: "Edit" });
    edit.focus();
    await user.keyboard("{Escape}");
    expect(tool).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(tool).toHaveAttribute("aria-expanded", "false");
    expect(edit).toHaveFocus();
  });
});

describe("PlanWorkspace tab tool panel hosting a nested popover", () => {
  const nested = {
    Content: [<div key="c">plan body</div>],
    Verifications: [
      <Popover key="p">
        <PopoverTrigger asChild>
          <button type="button">Explain</button>
        </PopoverTrigger>
        <PopoverContent>
          <button type="button">Inner action</button>
        </PopoverContent>
      </Popover>,
    ],
  };

  async function openNested() {
    const user = userEvent.setup();
    renderWorkspace(vi.fn(), { slots: nested });
    const tool = screen.getByRole("button", { name: "Verifications" });
    tool.focus();
    await user.keyboard("{Enter}");
    await user.tab();
    const explain = screen.getByRole("button", { name: "Explain" });
    expect(explain).toHaveFocus();
    await user.keyboard("{Enter}");
    await screen.findByRole("button", { name: "Inner action" });
    return { user, tool, explain };
  }

  it("lets Escape close the nested popover without closing the panel", async () => {
    const { user, tool, explain } = await openNested();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("button", { name: "Inner action" })).toBeNull());
    expect(tool).toHaveAttribute("aria-expanded", "true");
    expect(explain).toHaveFocus();
  });

  it("closes the panel with the next Escape and puts focus on its button", async () => {
    const { user, tool } = await openNested();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Inner action" })).toBeNull());

    await user.keyboard("{Escape}");
    expect(tool).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Explain" })).toBeNull();
    expect(tool).toHaveFocus();
  });

  it("keeps the panel open when the press lands inside the nested popover", async () => {
    const { user, tool } = await openNested();
    await user.click(screen.getByRole("button", { name: "Inner action" }));
    expect(tool).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Explain" })).toBeDefined();
  });

  it("still closes on a press outside the panel and its nested popover", async () => {
    const { user, tool } = await openNested();
    await user.click(document.body);
    expect(tool).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on an outside press after the tool button itself was pressed to open it", async () => {
    const user = userEvent.setup();
    renderWorkspace(vi.fn(), { slots: nested });
    const tool = screen.getByRole("button", { name: "Verifications" });
    await user.click(tool);
    expect(tool).toHaveAttribute("aria-expanded", "true");
    await user.click(document.body);
    expect(tool).toHaveAttribute("aria-expanded", "false");
  });
});

describe("PlanWorkspace tab tool ARIA", () => {
  const slots = {
    Content: [<div key="c">plan body</div>],
    Verifications: [
      <button key="v" type="button">
        Re-run checks
      </button>,
    ],
  };

  it("is a disclosure that points at its panel, not a popup that names a dialog", async () => {
    const user = userEvent.setup();
    renderWorkspace(vi.fn(), { slots });
    const tool = screen.getByRole("button", { name: "Verifications" });
    // The panel is a labelled group and focus does not move into it, so announcing a dialog popup
    // would be untrue.
    expect(tool).not.toHaveAttribute("aria-haspopup");
    expect(tool).not.toHaveAttribute("aria-controls");

    tool.focus();
    await user.keyboard("{Enter}");
    const panel = screen.getByRole("group", { name: "Verifications" });
    expect(panel.id).not.toBe("");
    expect(tool).toHaveAttribute("aria-controls", panel.id);
  });
});

describe("PlanWorkspace overflow menu items carry their action's state", () => {
  const trigger = () => screen.getByRole("button", { name: "More actions" });

  const stateful = [
    { tag: "Pin", label: "Pin", icon: "Trash", active: true, badge: "2" },
    { tag: "Sync", label: "Sync", icon: "Trash", loading: true },
    { tag: "Plain", label: "Plain", icon: "Trash" },
  ];

  it("marks a pressed action as a checked menu item with its badge", async () => {
    const user = userEvent.setup();
    renderWorkspace(vi.fn(), { menuItems: stateful });
    trigger().focus();
    await user.keyboard("{Enter}");

    const pin = screen.getByRole("menuitemcheckbox", { name: /Pin/ });
    expect(pin).toHaveAttribute("aria-checked", "true");
    expect(pin).toHaveTextContent("2");
    expect(screen.getByRole("menuitem", { name: "Plain" })).toBeDefined();
  });

  it("shows a loading action as busy and does not let it be fired again", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    renderWorkspace(handler, { menuItems: stateful });
    trigger().focus();
    await user.keyboard("{Enter}");

    const sync = screen.getByRole("menuitem", { name: "Sync" });
    expect(sync).toHaveAttribute("aria-busy", "true");
    expect(sync).toBeDisabled();
    await user.click(sync);
    expect(handler).not.toHaveBeenCalledWith("OnAction", "w", ["Sync"]);
  });

  it("walks the checked items with the arrows like any other item", async () => {
    const user = userEvent.setup();
    renderWorkspace(vi.fn(), { menuItems: stateful });
    trigger().focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menuitemcheckbox", { name: /Pin/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Plain" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitemcheckbox", { name: /Pin/ })).toHaveFocus();
  });

  it("keeps a folded icon action's pressed state and badge at a compact width", async () => {
    // jsdom has no layout, so the workspace is measured through its bounding box.
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 500,
      bottom: 400,
      width: 500,
      height: 400,
      toJSON: () => ({}),
    });
    try {
      const user = userEvent.setup();
      renderWorkspace(vi.fn(), {
        actions: [{ tag: "Edit", label: "Edit", icon: "Pencil", active: true, badge: "2" }],
      });
      // The Edit icon button folded into the menu.
      expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
      trigger().focus();
      await user.keyboard("{Enter}");
      const edit = screen.getByRole("menuitemcheckbox", { name: /Edit/ });
      expect(edit).toHaveAttribute("aria-checked", "true");
      expect(edit).toHaveTextContent("2");
    } finally {
      rect.mockRestore();
    }
  });
});

describe("PlanWorkspace chat divider", () => {
  function renderWithChat() {
    const view = render(
      <PlanWorkspace id="w" chatWidth={420} slots={{ Chat: [<div key="chat">chat body</div>] }} />,
    );
    const root = view.container.querySelector(".pws-root") as HTMLElement;
    root.getBoundingClientRect = () =>
      ({
        left: 0,
        right: 1200,
        top: 0,
        bottom: 800,
        width: 1200,
        height: 800,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    return { root, handle: screen.getByRole("separator", { name: "Resize chat" }) };
  }
  const width = (root: HTMLElement) => root.style.getPropertyValue("--pws-chat-width");

  it("is focusable and reports its range", () => {
    const { handle } = renderWithChat();
    expect(handle).toHaveAttribute("tabindex", "0");
    expect(handle).toHaveAttribute("aria-valuenow", "420");
    expect(handle).toHaveAttribute("aria-valuemin", String(MIN_CHAT_WIDTH));
    expect(Number(handle.getAttribute("aria-valuemax"))).toBeGreaterThanOrEqual(420);
    expect(handle).toHaveAttribute("aria-valuetext", "420 pixels wide");
  });

  it("widens the chat with ArrowLeft and narrows it with ArrowRight", async () => {
    const user = userEvent.setup();
    const { root, handle } = renderWithChat();
    handle.focus();
    await user.keyboard("{ArrowLeft}");
    expect(width(root)).toBe("430px");
    expect(handle).toHaveAttribute("aria-valuenow", "430");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(width(root)).toBe("410px");
  });

  it("takes larger steps with Shift", async () => {
    const user = userEvent.setup();
    const { root, handle } = renderWithChat();
    handle.focus();
    await user.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    expect(width(root)).toBe("470px");
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(width(root)).toBe("420px");
  });

  it("goes to the narrowest with Home and the widest share with End", async () => {
    const user = userEvent.setup();
    const { root, handle } = renderWithChat();
    handle.focus();
    await user.keyboard("{Home}");
    expect(width(root)).toBe(`${MIN_CHAT_WIDTH}px`);
    await user.keyboard("{End}");
    // 60% of the 1200px workspace.
    expect(width(root)).toBe("720px");
    expect(handle).toHaveAttribute("aria-valuemax", "720");
  });

  it("never leaves its bounds", async () => {
    const user = userEvent.setup();
    const { root, handle } = renderWithChat();
    handle.focus();
    await user.keyboard("{Home}{ArrowRight}");
    expect(width(root)).toBe(`${MIN_CHAT_WIDTH}px`);
    await user.keyboard("{End}{ArrowLeft}");
    expect(width(root)).toBe("720px");
  });

  it("remembers the width it was moved to, and Enter resets it", async () => {
    const user = userEvent.setup();
    const { root, handle } = renderWithChat();
    handle.focus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(window.localStorage.getItem(CHAT_WIDTH_STORAGE_KEY)).toBe("440");

    await user.keyboard("{Enter}");
    expect(width(root)).toBe("420px");
    expect(window.localStorage.getItem(CHAT_WIDTH_STORAGE_KEY)).toBeNull();
  });

  it("keeps its arrow keys from the document's shortcuts", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(
      <PlanWorkspace
        id="w"
        events={["OnAction"]}
        eventHandler={handler}
        shortcuts={[{ tag: "NextPlan", label: "Next plan", shortcut: "ArrowRight" }]}
        slots={{ Chat: [<div key="chat">chat body</div>] }}
      />,
    );
    screen.getByRole("separator", { name: "Resize chat" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(handler).not.toHaveBeenCalled();
  });
});
