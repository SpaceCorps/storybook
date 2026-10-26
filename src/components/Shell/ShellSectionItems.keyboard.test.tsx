import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { ShellSectionItems } from "./ShellSectionItems";
import type { ShellSectionItemDto } from "./types";

const items: ShellSectionItemDto[] = [
  { id: "p1", title: "Task One" },
  { id: "p2", title: "Task Two" },
];

function renderItems(extra: Partial<React.ComponentProps<typeof ShellSectionItems>> = {}) {
  const handlers = {
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onTogglePin: vi.fn(),
  };
  render(
    <>
      <button type="button">Before</button>
      <ShellSectionItems items={items} {...handlers} {...extra} />
      <button type="button">After</button>
    </>,
  );
  return handlers;
}

const optionsButton = (title = "Task One") =>
  screen.getByRole("button", { name: `${title} options` });
const menuItem = (name: string) => screen.getByRole("menuitem", { name });

describe("Shell row options menu keyboard", () => {
  it("opens with Enter onto the first item", async () => {
    const user = userEvent.setup();
    renderItems();
    optionsButton().focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menu", { name: "Task One options" })).toBeInTheDocument();
    expect(menuItem("Pin chat")).toHaveFocus();
  });

  it("walks the items with the arrows, wrapping, and jumps with Home and End", async () => {
    const user = userEvent.setup();
    renderItems();
    optionsButton().focus();
    await user.keyboard("{Enter}");

    await user.keyboard("{ArrowDown}");
    expect(menuItem("Edit name")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(menuItem("Delete")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(menuItem("Pin chat")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(menuItem("Delete")).toHaveFocus();

    await user.keyboard("{Home}");
    expect(menuItem("Pin chat")).toHaveFocus();
    await user.keyboard("{End}");
    expect(menuItem("Delete")).toHaveFocus();
  });

  it("closes on Escape and returns focus to the button", async () => {
    const user = userEvent.setup();
    renderItems();
    optionsButton().focus();
    await user.keyboard("{Enter}{ArrowDown}{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(optionsButton()).toHaveFocus();
  });

  it("closes on Tab with focus back on the button, so Tab carries on from it", async () => {
    const user = userEvent.setup();
    renderItems();
    optionsButton().focus();
    await user.keyboard("{Enter}");
    await user.tab();
    expect(screen.queryByRole("menu")).toBeNull();
    // The next control after that row's button, not the top of the page.
    expect(screen.getByRole("button", { name: "Task Two" })).toHaveFocus();
  });

  it("returns focus to the button after an item is chosen", async () => {
    const user = userEvent.setup();
    const { onTogglePin } = renderItems();
    optionsButton().focus();
    await user.keyboard("{Enter}{Enter}");
    expect(onTogglePin).toHaveBeenCalledWith("p1");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(optionsButton()).toHaveFocus();
  });

  it("moves focus into the rename field when Edit name is chosen", async () => {
    const user = userEvent.setup();
    renderItems();
    optionsButton().focus();
    await user.keyboard("{Enter}{ArrowDown}{Enter}");
    expect(screen.getByRole("textbox", { name: "Item name" })).toHaveFocus();
  });
});
