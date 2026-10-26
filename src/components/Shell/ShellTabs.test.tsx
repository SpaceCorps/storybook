import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { ShellTabs } from "./ShellTabs.tsx";
import type { ShellTabDto } from "./types.ts";

const initialTabs: ShellTabDto[] = [
  { id: "t1", title: "Plan Execution" },
  { id: "t2", title: "Review Chat" },
  { id: "t3", title: "Scratch" },
];

/** A host that owns the tab list the way the real one does: it drops a tab when told to close it. */
function Host({
  onSelect,
  onClose,
  initialSelected = "t1",
  seed = initialTabs,
}: {
  onSelect?: (id: string) => void;
  onClose?: (id: string) => void;
  initialSelected?: string;
  seed?: ShellTabDto[];
}) {
  const [tabs, setTabs] = useState(seed);
  const [selected, setSelected] = useState(initialSelected);
  return (
    <>
      <button type="button">Before</button>
      <ShellTabs
        id="tabs"
        tabs={tabs}
        selectedId={selected}
        events={["OnSelect", "OnClose", "OnNew"]}
        eventHandler={(event, _id, args) => {
          const tabId = args[0] as string;
          if (event === "OnSelect") {
            setSelected(tabId);
            onSelect?.(tabId);
          } else if (event === "OnClose") {
            setTabs((current) => current.filter((tab) => tab.id !== tabId));
            onClose?.(tabId);
          } else if (event === "OnNew") {
            setTabs((current) => [
              ...current,
              { id: `n${current.length}`, title: "Fresh session" },
            ]);
          }
        }}
      />
      <button type="button">After</button>
    </>
  );
}

const tab = (name: string) => screen.getByRole("tab", { name });

describe("ShellTabs semantics", () => {
  it("is a named tablist of tabs with the selected one marked", () => {
    render(<Host initialSelected="t2" />);
    expect(screen.getByRole("tablist", { name: "Agent sessions" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(tab("Plan Execution")).toHaveAttribute("aria-selected", "false");
    expect(tab("Review Chat")).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the new-session button out of the tablist", () => {
    render(<Host />);
    const tablist = screen.getByRole("tablist");
    expect(tablist.contains(screen.getByRole("button", { name: "New agent session" }))).toBe(false);
  });

  it("keeps the tablist to tabs only: the close buttons are outside it", () => {
    render(<Host />);
    const tablist = screen.getByRole("tablist");
    expect(
      Array.from(tablist.children).every((child) => child.getAttribute("role") === "tab"),
    ).toBe(true);
    const close = screen.getByRole("button", { name: "Close Plan Execution" });
    expect(tablist.contains(close)).toBe(false);
    expect(tab("Plan Execution").querySelector("button, [role='button']")).toBeNull();
  });
});

describe("ShellTabs keyboard", () => {
  it("is one tab stop, on the selected tab", async () => {
    const user = userEvent.setup();
    render(<Host initialSelected="t2" />);
    expect(tab("Review Chat")).toHaveAttribute("tabindex", "0");
    expect(tab("Plan Execution")).toHaveAttribute("tabindex", "-1");
    expect(tab("Scratch")).toHaveAttribute("tabindex", "-1");

    await user.tab();
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
    await user.tab();
    expect(tab("Review Chat")).toHaveFocus();
    // The close buttons are not stops: the next Tab leaves the strip for the new-session button.
    await user.tab();
    expect(screen.getByRole("button", { name: "New agent session" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("moves focus with the arrow keys, wrapping at both ends, without selecting", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Host onSelect={onSelect} />);
    tab("Plan Execution").focus();

    await user.keyboard("{ArrowRight}");
    expect(tab("Review Chat")).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(tab("Plan Execution")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(tab("Scratch")).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
    expect(tab("Plan Execution")).toHaveAttribute("aria-selected", "true");
  });

  it("jumps with Home and End", async () => {
    const user = userEvent.setup();
    render(<Host />);
    tab("Plan Execution").focus();
    await user.keyboard("{End}");
    expect(tab("Scratch")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(tab("Plan Execution")).toHaveFocus();
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("selects the focused tab with %s", async (_name, key) => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Host onSelect={onSelect} />);
    tab("Plan Execution").focus();
    await user.keyboard("{ArrowRight}");
    await user.keyboard(key);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("t2");
    expect(tab("Review Chat")).toHaveAttribute("aria-selected", "true");
  });

  it("comes back to the selected tab after focus leaves from another one", async () => {
    const user = userEvent.setup();
    render(<Host />);
    tab("Plan Execution").focus();
    await user.keyboard("{ArrowRight}");
    expect(tab("Review Chat")).toHaveFocus();

    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(tab("Plan Execution")).toHaveFocus();
  });

  it("closes the focused tab with Delete and lands on the next one", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    tab("Plan Execution").focus();
    await user.keyboard("{Delete}");

    expect(onClose).toHaveBeenCalledWith("t1");
    expect(screen.queryByRole("tab", { name: "Plan Execution" })).toBeNull();
    await waitFor(() => expect(tab("Review Chat")).toHaveFocus());
  });

  it("lands on the previous tab when the last one is closed", async () => {
    const user = userEvent.setup();
    render(<Host />);
    tab("Scratch").focus();
    await user.keyboard("{Delete}");
    await waitFor(() => expect(tab("Review Chat")).toHaveFocus());
  });

  it("lands on the new-session button when the only tab is closed", async () => {
    const user = userEvent.setup();
    render(<Host seed={[{ id: "t1", title: "Plan Execution" }]} />);
    tab("Plan Execution").focus();
    await user.keyboard("{Delete}");

    // The strip has no tabs left to show, but focus must not fall to the page: the new-session
    // button is shown, and holds it.
    expect(screen.queryByRole("tablist")).toBeNull();
    const add = screen.getByRole("button", { name: "New agent session" });
    await waitFor(() => expect(add).toHaveFocus());
    expect(document.body).not.toHaveFocus();
  });

  it("lands on the new-session button when the only tab is closed with its X", async () => {
    const user = userEvent.setup();
    render(<Host seed={[{ id: "t1", title: "Plan Execution" }]} />);
    await user.click(screen.getByRole("button", { name: "Close Plan Execution" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "New agent session" })).toHaveFocus(),
    );
  });

  it("hides the lone new-session button again once focus has left it", async () => {
    const user = userEvent.setup();
    render(<Host seed={[{ id: "t1", title: "Plan Execution" }]} />);
    tab("Plan Execution").focus();
    await user.keyboard("{Delete}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "New agent session" })).toHaveFocus(),
    );

    await user.tab();
    expect(screen.queryByRole("button", { name: "New agent session" })).toBeNull();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("keeps focus on the new-session button when it starts the next session", async () => {
    const user = userEvent.setup();
    render(<Host seed={[{ id: "t1", title: "Plan Execution" }]} />);
    tab("Plan Execution").focus();
    await user.keyboard("{Delete}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "New agent session" })).toHaveFocus(),
    );

    const add = screen.getByRole("button", { name: "New agent session" });
    await user.keyboard("{Enter}");
    expect(screen.getByRole("tab", { name: "Fresh session" })).toBeInTheDocument();
    // The same element: it was not remounted when the strip came back around it.
    expect(screen.getByRole("button", { name: "New agent session" })).toBe(add);
    expect(add).toHaveFocus();
  });

  it("stays hidden when the strip starts empty", () => {
    const view = render(<ShellTabs id="tabs" tabs={[]} eventHandler={() => {}} />);
    expect(view.container.firstChild).toBeNull();
  });

  it("does not show the lone button when the tab went while focus was elsewhere", () => {
    render(<Host seed={[{ id: "t1", title: "Plan Execution" }]} />);
    // Focus is on a page button, not in the strip; only the pointer closes the tab.
    screen.getByRole("button", { name: "Before" }).focus();
    fireEvent.click(screen.getByRole("button", { name: "Close Plan Execution" }));
    expect(screen.queryByRole("button", { name: "New agent session" })).toBeNull();
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
  });

  it("does not move focus when the host keeps the tab open", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ShellTabs
        id="tabs"
        tabs={initialTabs}
        selectedId="t1"
        events={["OnClose"]}
        eventHandler={onClose}
      />,
    );
    tab("Plan Execution").focus();
    await user.keyboard("{Delete}");
    expect(onClose).toHaveBeenCalledWith("OnClose", "tabs", ["t1"]);
    expect(tab("Plan Execution")).toHaveFocus();
  });

  it("still closes with the pointer and keeps the click away from selection", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<Host onSelect={onSelect} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Close Review Chat" }));
    expect(onClose).toHaveBeenCalledWith("t2");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("closes on a middle click", async () => {
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    tab("Review Chat").dispatchEvent(new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("t2"));
  });

  it("selects on a click on the tab", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Host onSelect={onSelect} />);
    await user.click(tab("Scratch"));
    expect(onSelect).toHaveBeenCalledWith("t3");
  });
});

describe("ShellTabs with many sessions", () => {
  const many = Array.from({ length: 24 }, (_, i) => ({
    id: `m${i}`,
    title: `Session number ${i + 1}`,
  }));

  it("names every tab in a tooltip, since a narrow tab shows only the start of its title", () => {
    render(<Host seed={many} initialSelected="m0" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(24);
    for (const each of tabs) expect(each).toHaveAttribute("title", each.textContent ?? "");
  });

  it("brings the selected tab into view when the selection moves", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    try {
      render(<Host seed={many} initialSelected="m0" />);
      scrollIntoView.mockClear();
      await user.click(screen.getByRole("tab", { name: "Session number 20" }));
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
      expect(scrollIntoView.mock.contexts.at(-1)).toBe(
        screen.getByRole("tab", { name: "Session number 20" }),
      );
    } finally {
      scrollIntoView.mockRestore();
    }
  });

  describe("the wheel", () => {
    /** The strip, with the box jsdom does not have: 500px visible of 2000px. */
    function scrollableStrip() {
      const view = render(<Host seed={many} initialSelected="m0" />);
      const strip = view.container.querySelector<HTMLElement>(".tsh-tabstrip") as HTMLElement;
      Object.defineProperty(strip, "scrollWidth", { configurable: true, value: 2000 });
      Object.defineProperty(strip, "clientWidth", { configurable: true, value: 500 });
      strip.scrollLeft = 0;
      return strip;
    }

    it("scrolls the strip sideways and keeps the page from scrolling", () => {
      const strip = scrollableStrip();
      const event = new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true });
      strip.dispatchEvent(event);
      expect(strip.scrollLeft).toBe(120);
      expect(event.defaultPrevented).toBe(true);
    });

    it("leaves a sideways gesture, a zoom and a strip that fits to the browser", () => {
      const strip = scrollableStrip();
      const sideways = new WheelEvent("wheel", {
        deltaX: 80,
        deltaY: 10,
        bubbles: true,
        cancelable: true,
      });
      strip.dispatchEvent(sideways);
      expect(sideways.defaultPrevented).toBe(false);

      const zoom = new WheelEvent("wheel", {
        deltaY: 120,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      strip.dispatchEvent(zoom);
      expect(zoom.defaultPrevented).toBe(false);

      Object.defineProperty(strip, "scrollWidth", { configurable: true, value: 500 });
      const fits = new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true });
      strip.dispatchEvent(fits);
      expect(fits.defaultPrevented).toBe(false);
      expect(strip.scrollLeft).toBe(0);
    });
  });
});

describe("ShellTabs close button hover", () => {
  it("keeps the tab highlighted while the pointer is on its close button", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const first = tab("Plan Execution");
    expect(first).not.toHaveAttribute("data-close-hover");

    // The buttons are a layer above the tabs, so the tab under one stops being :hover. The marker
    // is what its highlight is drawn from instead.
    await user.hover(screen.getByRole("button", { name: "Close Plan Execution" }));
    expect(first).toHaveAttribute("data-close-hover", "true");
    expect(tab("Review Chat")).not.toHaveAttribute("data-close-hover");

    await user.unhover(screen.getByRole("button", { name: "Close Plan Execution" }));
    expect(first).not.toHaveAttribute("data-close-hover");
  });
});

describe("ShellTabs modifier keys", () => {
  it.each([
    ["Alt", { altKey: true }],
    ["Ctrl", { ctrlKey: true }],
    ["Meta", { metaKey: true }],
  ])("leaves %s with the arrow keys to the browser", (_name, modifier) => {
    render(<Host />);
    tab("Review Chat").focus();

    // fireEvent returns false when a handler called preventDefault, which would swallow the
    // browser's Back/Forward shortcut.
    expect(fireEvent.keyDown(tab("Review Chat"), { key: "ArrowLeft", ...modifier })).toBe(true);
    expect(fireEvent.keyDown(tab("Review Chat"), { key: "ArrowRight", ...modifier })).toBe(true);
    expect(tab("Review Chat")).toHaveFocus();
  });

  it.each([
    ["Shift", { shiftKey: true }],
    ["Ctrl", { ctrlKey: true }],
    ["Alt", { altKey: true }],
    ["Meta", { metaKey: true }],
  ])("does not close a session on %s+Delete", (_name, modifier) => {
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    tab("Review Chat").focus();

    expect(fireEvent.keyDown(tab("Review Chat"), { key: "Delete", ...modifier })).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(tab("Review Chat")).toBeInTheDocument();
  });

  it("still closes on a bare Delete", () => {
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    tab("Review Chat").focus();
    expect(fireEvent.keyDown(tab("Review Chat"), { key: "Delete" })).toBe(false);
    expect(onClose).toHaveBeenCalledWith("t2");
  });
});

describe("ShellTabs focus after a close", () => {
  const events = ["OnSelect", "OnClose", "OnNew"];
  const [t1, t2, t3] = initialTabs;

  function strip(tabs: ShellTabDto[], overrides: { events?: string[] } = {}) {
    return (
      <ShellTabs
        id="tabs"
        tabs={tabs}
        selectedId="t1"
        events={overrides.events ?? events}
        eventHandler={() => {}}
      />
    );
  }

  it("still lands on the neighbour when other updates arrive before the tab leaves", async () => {
    const user = userEvent.setup();
    const view = render(strip([t1, t2, t3]));
    tab("Plan Execution").focus();
    await user.keyboard("{Delete}");

    // The host is busy: it re-renders with a changed title first, and drops the tab later.
    view.rerender(strip([{ ...t1, title: "Plan Execution (closing)" }, t2, t3]));
    expect(screen.getByRole("tab", { name: "Plan Execution (closing)" })).toHaveFocus();
    view.rerender(strip([t2, t3]));

    await waitFor(() => expect(tab("Review Chat")).toHaveFocus());
  });

  it("does not move focus later when a refused close is followed by a click elsewhere", async () => {
    const user = userEvent.setup();
    const view = render(
      <>
        {strip([t1, t2, t3])}
        <p>Blank space</p>
      </>,
    );
    tab("Plan Execution").focus();
    await user.keyboard("{Delete}");
    // The host kept the tab (a confirm was cancelled), and the person clicked away.
    await user.click(screen.getByText("Blank space"));
    expect(document.body).toHaveFocus();

    view.rerender(
      <>
        {strip([{ ...t1, title: "Plan Execution (renamed)" }, t2, t3])}
        <p>Blank space</p>
      </>,
    );
    expect(document.body).toHaveFocus();
  });

  it("does not move focus later when the person tabbed away from a refused close", async () => {
    const user = userEvent.setup();
    const view = render(strip([t1, t2, t3]));
    tab("Plan Execution").focus();
    await user.keyboard("{Delete}");
    await user.tab();
    expect(screen.getByRole("button", { name: "New agent session" })).toHaveFocus();

    view.rerender(strip([t2, t3]));
    expect(screen.getByRole("button", { name: "New agent session" })).toHaveFocus();
  });

  it("does not arm a focus move when the host is not listening for closes", async () => {
    const user = userEvent.setup();
    const view = render(strip([t1, t2, t3], { events: ["OnSelect"] }));
    tab("Plan Execution").focus();
    await user.keyboard("{Delete}");
    expect(tab("Plan Execution")).toHaveFocus();

    // Focus leaves without a pointer or focus event reaching the document.
    act(() => (document.activeElement as HTMLElement).blur());
    expect(document.body).toHaveFocus();
    view.rerender(
      strip([{ ...t1, title: "Plan Execution (renamed)" }, t2, t3], { events: ["OnSelect"] }),
    );
    expect(document.body).toHaveFocus();
  });

  it("falls back to the nearest tab when the neighbour left too", async () => {
    const user = userEvent.setup();
    const view = render(strip([t1, t2, t3]));
    tab("Plan Execution").focus();
    await user.keyboard("{Delete}");

    // The host closed the neighbour as well as the tab.
    view.rerender(strip([t3]));
    await waitFor(() => expect(tab("Scratch")).toHaveFocus());
  });
});
