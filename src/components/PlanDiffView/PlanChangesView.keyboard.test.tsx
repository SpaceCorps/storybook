import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { PlanChangesView, type ChangedFile } from "./PlanChangesView";

function file(path: string): ChangedFile {
  return {
    filePath: path,
    diff: [
      `diff --git a/${path} b/${path}`,
      `--- a/${path}`,
      `+++ b/${path}`,
      "@@ -1 +1 @@",
      "-a",
      "+b",
      "",
    ].join("\n"),
    additions: 1,
    deletions: 1,
  };
}

const files: ChangedFile[] = [
  file("src/App/zeta.cs"),
  file("src/App/Alpha.cs"),
  file("README.md"),
  file("docs/guide/old.md"),
  file("docs/guide/new.md"),
];

// Visible order: docs/guide, new.md, old.md, src/App, Alpha.cs, zeta.cs, README.md
const row = (name: string | RegExp) => screen.getByRole("treeitem", { name });
const rows = () => screen.getAllByRole("treeitem");

function renderTree() {
  return render(<PlanChangesView id="pcv" eventHandler={vi.fn()} files={files} />);
}

describe("PlanChangesView tree keyboard", () => {
  it("is a single tab stop, on the first row until a file is selected", () => {
    renderTree();
    const stops = rows().filter((r) => r.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(row("docs/guide"));
    expect(rows().filter((r) => r.getAttribute("tabindex") === "-1")).toHaveLength(
      rows().length - 1,
    );
  });

  it("puts the tab stop on the selected file", async () => {
    const user = userEvent.setup();
    renderTree();
    await user.click(row(/zeta\.cs/));
    expect(row(/zeta\.cs/)).toHaveAttribute("tabindex", "0");
    expect(row("docs/guide")).toHaveAttribute("tabindex", "-1");
  });

  it("enters and leaves the tree with one Tab each", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <PlanChangesView id="pcv" eventHandler={vi.fn()} files={files} />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    await user.tab();
    expect(row("docs/guide")).toHaveFocus();
    await user.tab();
    // The diffs pane follows; focus has left the tree.
    expect(screen.getByRole("tree")).not.toContainElement(document.activeElement as HTMLElement);
  });

  it("walks the visible rows with the arrow keys and stops at the ends", async () => {
    const user = userEvent.setup();
    renderTree();
    row("docs/guide").focus();

    await user.keyboard("{ArrowDown}");
    expect(row(/new\.md/)).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(row("src/App")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(row(/old\.md/)).toHaveFocus();

    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(row("docs/guide")).toHaveFocus();
    await user.keyboard("{End}{ArrowDown}");
    expect(row(/README\.md/)).toHaveFocus();
  });

  it("moves the tab stop with focus", async () => {
    const user = userEvent.setup();
    renderTree();
    row("docs/guide").focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(row(/old\.md/)).toHaveAttribute("tabindex", "0");
    expect(row("docs/guide")).toHaveAttribute("tabindex", "-1");
  });

  it("jumps with Home and End", async () => {
    const user = userEvent.setup();
    renderTree();
    row("docs/guide").focus();
    await user.keyboard("{End}");
    expect(row(/README\.md/)).toHaveFocus();
    await user.keyboard("{Home}");
    expect(row("docs/guide")).toHaveFocus();
  });

  it("closes an open folder with Left and opens it with Right", async () => {
    const user = userEvent.setup();
    renderTree();
    row("src/App").focus();

    await user.keyboard("{ArrowLeft}");
    expect(row("src/App")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("treeitem", { name: /zeta\.cs/ })).toBeNull();
    expect(row("src/App")).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(row("src/App")).toHaveAttribute("aria-expanded", "true");
    expect(row(/zeta\.cs/)).toBeInTheDocument();
    expect(row("src/App")).toHaveFocus();
  });

  it("steps into an open folder with Right, and out to the parent with Left", async () => {
    const user = userEvent.setup();
    renderTree();
    row("src/App").focus();

    await user.keyboard("{ArrowRight}");
    expect(row(/Alpha\.cs/)).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(row("src/App")).toHaveFocus();
  });

  it("does nothing on Right over a file, and Left on a closed folder goes to its parent", async () => {
    const user = userEvent.setup();
    renderTree();
    row(/Alpha\.cs/).focus();
    await user.keyboard("{ArrowRight}");
    expect(row(/Alpha\.cs/)).toHaveFocus();

    row("src/App").focus();
    await user.keyboard("{ArrowLeft}");
    expect(row("src/App")).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{ArrowLeft}");
    // A top-level folder has no parent: focus stays.
    expect(row("src/App")).toHaveFocus();
  });

  it("toggles a folder and selects a file with Enter and Space", async () => {
    const user = userEvent.setup();
    renderTree();
    row("docs/guide").focus();
    await user.keyboard("{Enter}");
    expect(row("docs/guide")).toHaveAttribute("aria-expanded", "false");
    await user.keyboard(" ");
    expect(row("docs/guide")).toHaveAttribute("aria-expanded", "true");

    row(/zeta\.cs/).focus();
    await user.keyboard("{Enter}");
    expect(row(/zeta\.cs/)).toHaveAttribute("aria-selected", "true");
    row(/Alpha\.cs/).focus();
    await user.keyboard(" ");
    expect(row(/Alpha\.cs/)).toHaveAttribute("aria-selected", "true");
    expect(row(/zeta\.cs/)).toHaveAttribute("aria-selected", "false");
  });

  it("jumps to the next row starting with a typed letter", async () => {
    const user = userEvent.setup();
    renderTree();
    row("docs/guide").focus();
    await user.keyboard("z");
    expect(row(/zeta\.cs/)).toHaveFocus();

    // Letters typed close together are one search; after a pause the next is a new one.
    await new Promise((resolve) => setTimeout(resolve, 600));
    await user.keyboard("r");
    expect(row(/README\.md/)).toHaveFocus();
  });

  it("describes position and level for assistive technology", () => {
    renderTree();
    const docs = row("docs/guide");
    expect(docs).toHaveAttribute("aria-level", "1");
    expect(docs).toHaveAttribute("aria-setsize", "3");
    expect(docs).toHaveAttribute("aria-posinset", "1");
    const newFile = row(/new\.md/);
    expect(newFile).toHaveAttribute("aria-level", "2");
    expect(newFile).toHaveAttribute("aria-setsize", "2");
    expect(newFile).toHaveAttribute("aria-posinset", "1");
    expect(row(/README\.md/)).toHaveAttribute("aria-posinset", "3");
  });

  it("falls back to the selected row when the focused row's folder closes", async () => {
    const user = userEvent.setup();
    renderTree();
    row(/zeta\.cs/).focus();
    await user.click(row("src/App"));
    // zeta.cs is gone; exactly one row is still the tab stop.
    expect(rows().filter((r) => r.getAttribute("tabindex") === "0")).toHaveLength(1);
  });
});
