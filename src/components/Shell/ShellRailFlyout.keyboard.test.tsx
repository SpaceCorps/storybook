import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { ShellRailFlyout } from "./ShellRailFlyout";
import type { ShellSectionItemDto } from "./types";

const items: ShellSectionItemDto[] = [
  { id: "p1", title: "Task One" },
  { id: "p2", title: "Task Two" },
];

function renderFlyout(onSelect = vi.fn(), selectedId?: string) {
  render(
    <>
      <button type="button">Before</button>
      <ShellRailFlyout title="Plans" items={items} selectedId={selectedId} onSelect={onSelect}>
        {(trigger) => (
          <button
            ref={trigger.ref}
            type="button"
            aria-expanded={trigger.open}
            onClick={trigger.onClick}
            onPointerEnter={trigger.onPointerEnter}
            onPointerLeave={trigger.onPointerLeave}
          >
            Plans
          </button>
        )}
      </ShellRailFlyout>
      <button type="button">After</button>
    </>,
  );
  return { onSelect };
}

const railButton = () => screen.getByRole("button", { name: "Plans" });

describe("ShellRailFlyout keyboard", () => {
  it("moves focus into the menu when it is pinned open from the rail button", async () => {
    const user = userEvent.setup();
    renderFlyout();
    railButton().focus();
    await user.keyboard("{Enter}");

    const menu = document.querySelector<HTMLElement>(".tsh-rail-menu");
    expect(menu).not.toBeNull();
    expect(menu).toContainElement(document.activeElement as HTMLElement);
  });

  it("reaches the rows with Tab and selects one with Enter", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderFlyout();
    railButton().focus();
    await user.keyboard("{Enter}");
    // Previous and Next are disabled with nothing selected only at the ends; here the first
    // enabled control comes first, then the rows.
    for (let i = 0; i < 6; i++) {
      if (document.activeElement === screen.getByRole("button", { name: "Task Two" })) break;
      await user.tab();
    }
    expect(screen.getByRole("button", { name: "Task Two" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("p2");
  });

  it("wraps Tab inside the pinned menu instead of leaving it", async () => {
    const user = userEvent.setup();
    renderFlyout();
    railButton().focus();
    await user.keyboard("{Enter}");
    const menu = document.querySelector<HTMLElement>(".tsh-rail-menu") as HTMLElement;

    for (let i = 0; i < 12; i++) {
      await user.tab();
      expect(menu).toContainElement(document.activeElement as HTMLElement);
    }
    await user.tab({ shift: true });
    expect(menu).toContainElement(document.activeElement as HTMLElement);
  });

  it("closes on Escape and returns focus to the rail button", async () => {
    const user = userEvent.setup();
    renderFlyout();
    railButton().focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");
    expect(document.querySelector(".tsh-rail-menu")).toBeNull();
    expect(railButton()).toHaveFocus();
  });

  it("does not take focus back on Escape when it was elsewhere", async () => {
    const user = userEvent.setup();
    renderFlyout();
    railButton().focus();
    await user.keyboard("{Enter}");
    screen.getByRole("button", { name: "After" }).focus();
    await user.keyboard("{Escape}");
    expect(document.querySelector(".tsh-rail-menu")).toBeNull();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });
});
