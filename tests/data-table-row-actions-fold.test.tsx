import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  DATA_TABLE_REVEAL_MARGIN,
  DataTable,
  DataTableRowActions,
  useColumnsHiddenByWidth,
  useResponsiveFit,
  type DataTableColumn,
  type DataTableRowAction,
  type DataTableRowActionsProps,
} from "../src/components/ui/data-table";

interface Invoice {
  id: string;
  number: string;
}

const invoices: Invoice[] = [
  { id: "r1", number: "INV-1" },
  { id: "r2", number: "INV-2" },
  { id: "r3", number: "INV-3" },
];

const columns: DataTableColumn<Invoice>[] = [
  { name: "id", header: "Id" },
  { name: "number", header: "Number" },
];

const rowId = (row: Invoice): string => row.id;
const rowLabel = (row: Invoice): string => `Invoice ${row.number}`;

/**
 * A `ResizeObserver` the test can drive: it tells only the observers that were given the element, the
 * way a browser does (the same stub as `data-table-responsive.test.tsx`).
 */
class FakeResizeObserver {
  static all = new Set<FakeResizeObserver>();
  private targets = new Set<Element>();
  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.all.add(this);
  }
  observe(target: Element) {
    this.targets.add(target);
  }
  unobserve(target: Element) {
    this.targets.delete(target);
  }
  disconnect() {
    this.targets.clear();
    FakeResizeObserver.all.delete(this);
  }
  emit(target: Element, width: number) {
    this.callback(
      [{ target, contentRect: { width } } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  watches(target: Element) {
    return this.targets.has(target);
  }
}

/** The element becomes this wide, as far as whoever observes it can tell. */
function resize(target: Element, width: number) {
  act(() => {
    for (const observer of FakeResizeObserver.all) {
      if (observer.watches(target)) observer.emit(target, width);
    }
  });
}

const wrapperOf = (container: HTMLElement): HTMLElement =>
  container.querySelector<HTMLElement>("[data-slot='data-table']")!;

const resizeTo = (container: HTMLElement, width: number) => resize(wrapperOf(container), width);

const watchersOf = (target: Element) =>
  Array.from(FakeResizeObserver.all).filter((observer) => observer.watches(target));

beforeEach(() => {
  FakeResizeObserver.all.clear();
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------------------------
// DataTableRowActions on its own
// ---------------------------------------------------------------------------------------------

describe("DataTableRowActions folded into one menu button", () => {
  const edit: DataTableRowAction<Invoice> = {
    tag: "edit",
    label: "Edit",
    icon: <svg data-testid="edit-icon" aria-hidden="true" />,
  };
  const archive: DataTableRowAction<Invoice> = {
    tag: "archive",
    label: "Archive",
    icon: <svg data-testid="archive-icon" aria-hidden="true" />,
    tooltip: "Keeps it for 30 days",
  };
  const remove: DataTableRowAction<Invoice> = {
    tag: "delete",
    label: "Delete",
    variant: "destructive",
    tooltip: "Delete",
  };
  const share: DataTableRowAction<Invoice> = {
    tag: "share",
    label: "Share",
    children: [
      { tag: "link", label: "Copy link" },
      { tag: "mail", label: "Email" },
    ],
  };
  const invoice = invoices[0];

  function renderActions(props: Partial<DataTableRowActionsProps<Invoice>> = {}) {
    return render(
      <DataTableRowActions
        actions={[edit, archive, remove]}
        row={invoice}
        rowId="r1"
        collapsed
        {...props}
      />,
    );
  }

  async function openMenu(user: ReturnType<typeof userEvent.setup>, name = "More actions") {
    const trigger = screen.getByRole("button", { name });
    trigger.focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    return trigger;
  }

  /** The roles of what the open menu holds, in order: items, separators, groups. */
  const menuShape = () =>
    Array.from(screen.getByRole("menu").children).map((child) => child.getAttribute("role"));

  it("renders one button named for the menu and none for the actions", () => {
    const { container } = renderActions();

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(["More actions"]);
    expect(buttons[0].getAttribute("aria-haspopup")).toBe("menu");
    expect(container.querySelector("[data-slot='data-table-row-actions']")).toHaveProperty(
      "dataset.collapsed",
      "",
    );
  });

  it("names the button what the caller says, so each row's own can say which row it is", () => {
    renderActions({ menuLabel: "Actions for Invoice INV-1" });

    expect(screen.getByRole("button", { name: "Actions for Invoice INV-1" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  });

  it("keeps the ordinary button for a single action: a menu would only add a tap", () => {
    const { container } = renderActions({ actions: [edit] });

    expect(screen.getByRole("button", { name: "Edit" }).getAttribute("aria-haspopup")).toBeNull();
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
    expect(container.querySelector("[data-collapsed]")).toBeNull();
  });

  it("does not count a separator as an action when it decides whether to fold", () => {
    renderActions({ actions: [edit, { tag: "sep", label: "-", variant: "separator" }] });

    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  });

  it("renders the buttons it always did while it is not collapsed", () => {
    renderActions({ collapsed: false });

    expect(
      screen.getAllByRole("button").map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Edit", "Archive", "Delete"]);
  });

  it("renders nothing when there is no action to show, collapsed or not", () => {
    const { container } = renderActions({
      actions: [{ tag: "sep", label: "-", variant: "separator" }],
    });

    expect(container.firstChild).toBeNull();
  });

  it("lists every action as an item, with its icon and its label", async () => {
    const user = userEvent.setup();
    renderActions();

    await openMenu(user);

    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Edit",
      "ArchiveKeeps it for 30 days",
      "Delete",
    ]);
    expect(within(items[0]).getByTestId("edit-icon")).toBeTruthy();
    expect(within(items[1]).getByTestId("archive-icon")).toBeTruthy();
  });

  it("disables the items that are disabled and leaves the others alone", async () => {
    const user = userEvent.setup();
    renderActions({ actions: [edit, { ...archive, disabled: true }, remove] });

    await openMenu(user);

    expect(screen.getByRole("menuitem", { name: "Edit" }).hasAttribute("data-disabled")).toBe(
      false,
    );
    expect(screen.getByRole("menuitem", { name: /^Archive/ }).getAttribute("aria-disabled")).toBe(
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Delete" }).hasAttribute("data-disabled")).toBe(
      false,
    );
  });

  it("steps over a disabled item from the keyboard, so Enter never runs it", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    // Pointer events never reach a disabled item in a browser (`data-[disabled]:pointer-events-none`);
    // jsdom loads no CSS, so the keyboard is the way in that this can check.
    renderActions({ actions: [{ ...archive, disabled: true }, edit], onRowAction });

    await openMenu(user);
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onRowAction).toHaveBeenCalledTimes(1);
    expect(onRowAction).toHaveBeenCalledWith({ id: "r1", tag: "edit", row: invoice });
  });

  it("keeps the destructive colour on a destructive item, and only on that one", async () => {
    const user = userEvent.setup();
    renderActions();

    await openMenu(user);

    expect(screen.getByRole("menuitem", { name: "Delete" }).className).toContain(
      "text-[var(--destructive-800)]",
    );
    expect(screen.getByRole("menuitem", { name: "Edit" }).className).not.toContain("destructive");
  });

  it("shows a tooltip that says more than the label as a second line of the item", async () => {
    const user = userEvent.setup();
    renderActions();

    await openMenu(user);

    // A tooltip is hover-only and a phone has no hover: the note has to be in the item itself.
    const archiveItem = screen.getByRole("menuitem", { name: /^Archive/ });
    expect(within(archiveItem).getByText("Keeps it for 30 days").className).toContain(
      "text-muted-foreground",
    );
    expect(within(archiveItem).getByText("Archive")).toBeTruthy();
  });

  it("does not repeat a tooltip that is only the label", async () => {
    const user = userEvent.setup();
    renderActions();

    await openMenu(user);

    const deleteItem = screen.getByRole("menuitem", { name: "Delete" });
    expect(deleteItem.textContent).toBe("Delete");
    expect(deleteItem.querySelector(".text-muted-foreground")).toBeNull();
  });

  it("turns an action with children into a labelled group of its children, not a sub-menu", async () => {
    const user = userEvent.setup();
    renderActions({ actions: [edit, share] });

    await openMenu(user);

    const group = screen.getByRole("group", { name: "Share" });
    expect(
      within(group)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Copy link", "Email"]);
    // The label is shown too, and there is no second level to open.
    expect(within(group).getByText("Share")).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Share" })).toBeNull();
    expect(document.querySelector("[aria-haspopup='menu'][role='menuitem']")).toBeNull();
  });

  it("puts a separator between a group and whatever is next to it, and nowhere else", async () => {
    const user = userEvent.setup();
    const other: DataTableRowAction<Invoice> = {
      tag: "move",
      label: "Move",
      children: [{ tag: "up", label: "Up" }],
    };
    renderActions({ actions: [edit, archive, share, remove, other] });

    await openMenu(user);

    expect(menuShape()).toEqual([
      "menuitem",
      "menuitem",
      "separator",
      "group",
      "separator",
      "menuitem",
      "separator",
      "group",
    ]);
  });

  it("starts with a group without a separator in front of it", async () => {
    const user = userEvent.setup();
    renderActions({ actions: [share, edit] });

    await openMenu(user);

    expect(menuShape()).toEqual(["group", "separator", "menuitem"]);
  });

  it("drops a separator among the children, and treats a group left with none as a plain item", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    renderActions({
      actions: [
        edit,
        {
          tag: "empty",
          label: "Empty",
          children: [{ tag: "sep", label: "-", variant: "separator" }],
        },
      ],
      onRowAction,
    });

    await openMenu(user);
    expect(menuShape()).toEqual(["menuitem", "menuitem"]);
    await user.click(screen.getByRole("menuitem", { name: "Empty" }));

    expect(onRowAction).toHaveBeenCalledWith({ id: "r1", tag: "empty", row: invoice });
  });

  it("calls onRowAction with the row id, the action's tag and the row", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    renderActions({ onRowAction });

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    expect(onRowAction).toHaveBeenCalledTimes(1);
    expect(onRowAction).toHaveBeenCalledWith({ id: "r1", tag: "edit", row: invoice });
  });

  it("calls onRowAction with the tag of the child, not of its group", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    renderActions({ actions: [edit, share], onRowAction });

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Email" }));

    expect(onRowAction).toHaveBeenCalledTimes(1);
    expect(onRowAction).toHaveBeenCalledWith({ id: "r1", tag: "mail", row: invoice });
  });

  it("does not hand a click on an item to whatever the row does with a click", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    // The menu is in a portal, but React events still bubble through the tree to the cell and row.
    render(
      <div onClick={onRowClick}>
        <DataTableRowActions actions={[edit, archive]} row={invoice} rowId="r1" collapsed />
      </div>,
    );

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("does not hand a mouse down or a click on the menu button to the row", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const onRowMouseDown = vi.fn();
    render(
      <div onClick={onRowClick} onMouseDown={onRowMouseDown}>
        <DataTableRowActions actions={[edit, archive]} row={invoice} rowId="r1" collapsed />
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "More actions" });

    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    await user.click(trigger);

    expect(onRowMouseDown).not.toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("disables the button when every action is disabled", () => {
    renderActions({
      actions: [
        { ...edit, disabled: true },
        { ...archive, disabled: true },
      ],
    });

    expect(
      (screen.getByRole("button", { name: "More actions" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("disables the button when every child of every group is disabled", () => {
    renderActions({
      actions: [
        { ...edit, disabled: true },
        {
          ...share,
          children: share.children!.map((child) => ({ ...child, disabled: true })),
        },
      ],
    });

    expect(
      (screen.getByRole("button", { name: "More actions" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("keeps the button enabled while one action, or one child of a group, can still be run", () => {
    const oneEnabled = renderActions({ actions: [{ ...edit, disabled: true }, archive] });
    expect(
      (screen.getByRole("button", { name: "More actions" }) as HTMLButtonElement).disabled,
    ).toBe(false);
    oneEnabled.unmount();

    renderActions({
      actions: [
        { ...edit, disabled: true },
        {
          ...share,
          children: [{ ...share.children![0], disabled: true }, share.children![1]],
        },
      ],
    });
    expect(
      (screen.getByRole("button", { name: "More actions" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("returns focus to the button when the menu is dismissed with Escape", async () => {
    const user = userEvent.setup();
    renderActions();

    const trigger = await openMenu(user);
    await user.keyboard("{Escape}");

    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("returns focus to the button after an item that opened nothing", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    renderActions({ onRowAction });

    const trigger = await openMenu(user);
    await user.keyboard("{Enter}");

    expect(onRowAction).toHaveBeenCalledWith({ id: "r1", tag: "edit", row: invoice });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("leaves focus in the dialog an item opened instead of pulling it back to the button", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <DataTableRowActions
            actions={[edit, archive]}
            row={invoice}
            rowId="r1"
            collapsed
            onRowAction={() => setOpen(true)}
          />
          <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Content aria-describedby={undefined}>
                <DialogPrimitive.Title>Edit?</DialogPrimitive.Title>
                <button>Confirm edit</button>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </>
      );
    }
    render(<Harness />);

    const trigger = await openMenu(user);
    await user.keyboard("{Enter}");

    const confirm = await screen.findByRole("button", { name: "Confirm edit" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    // Radix returns focus on a timer after the menu unmounts: give it the chance to misbehave.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(document.activeElement).toBe(confirm);
    expect(document.activeElement).not.toBe(trigger);
  });

  it("goes back to returning focus when the menu is dismissed after an earlier item ran", async () => {
    const user = userEvent.setup();
    renderActions();

    const trigger = await openMenu(user);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    await openMenu(user);
    // The menu ran an item once; that must not make every later dismissal a "leave focus alone".
    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

// ---------------------------------------------------------------------------------------------
// DataTable collapseRowActionsBelow
// ---------------------------------------------------------------------------------------------

describe("DataTable collapseRowActionsBelow", () => {
  const edit: DataTableRowAction<Invoice> = { tag: "edit", label: "Edit" };
  const archive: DataTableRowAction<Invoice> = { tag: "archive", label: "Archive" };
  const remove: DataTableRowAction<Invoice> = { tag: "delete", label: "Delete" };
  const three = [edit, archive, remove];

  function tableOf(props: Partial<React.ComponentProps<typeof DataTable<Invoice>>> = {}) {
    return (
      <DataTable
        columns={columns}
        rows={invoices}
        getRowId={rowId}
        getRowLabel={rowLabel}
        rowActions={three}
        collapseRowActionsBelow={600}
        {...props}
      />
    );
  }
  const renderTable = (props: Partial<React.ComponentProps<typeof DataTable<Invoice>>> = {}) =>
    render(tableOf(props));

  const foldedButtons = () =>
    screen
      .queryAllByRole("button", { name: /^Actions for / })
      .map((button) => button.getAttribute("aria-label"));
  const plainButtons = (name: string) => screen.queryAllByRole("button", { name });

  /** The names of the buttons in each row's actions cell, in row order. */
  const actionNames = (container: HTMLElement) =>
    Array.from(container.querySelectorAll("tbody tr[data-row-id]")).map((tr) =>
      Array.from(tr.querySelectorAll("td[data-pin='end'] button")).map((button) =>
        button.getAttribute("aria-label"),
      ),
    );

  it("folds every row's actions into a button named for the row while the container is narrower", () => {
    const { container } = renderTable();

    resizeTo(container, 500);

    expect(actionNames(container)).toEqual([
      ["Actions for Invoice INV-1"],
      ["Actions for Invoice INV-2"],
      ["Actions for Invoice INV-3"],
    ]);
    expect(plainButtons("Edit")).toHaveLength(0);
  });

  it("shows the original buttons once the container is the threshold plus the margin wide", () => {
    const { container } = renderTable();

    resizeTo(container, 500);
    resizeTo(container, 600 + DATA_TABLE_REVEAL_MARGIN - 1);
    expect(foldedButtons()).toHaveLength(3);
    resizeTo(container, 600 + DATA_TABLE_REVEAL_MARGIN);

    expect(actionNames(container)).toEqual([
      ["Edit", "Archive", "Delete"],
      ["Edit", "Archive", "Delete"],
      ["Edit", "Archive", "Delete"],
    ]);
    expect(foldedButtons()).toHaveLength(0);
  });

  it("folds again below the threshold, and keeps the buttons through the band just under it", () => {
    const { container } = renderTable();

    resizeTo(container, 1000);
    resizeTo(container, 600);
    // At the threshold is not below it, and the buttons are what was showing.
    expect(foldedButtons()).toHaveLength(0);
    resizeTo(container, 599);
    expect(foldedButtons()).toHaveLength(3);
  });

  it("keeps what it had inside the band, whichever side it came from", () => {
    const { container } = renderTable();

    resizeTo(container, 500);
    resizeTo(container, 610);
    expect(foldedButtons()).toHaveLength(3);

    resizeTo(container, 700);
    expect(foldedButtons()).toHaveLength(0);
    resizeTo(container, 610);
    expect(foldedButtons()).toHaveLength(0);
  });

  it("takes the first measurement at face value: a width in the band is not folded", () => {
    const { container } = renderTable();

    // Until now the table has been folded as a guess; that is not a decision to be steady about.
    resizeTo(container, 610);

    expect(foldedButtons()).toHaveLength(0);
    expect(plainButtons("Edit")).toHaveLength(3);
  });

  it("starts folded and does not throw before the container has been measured", () => {
    expect(() => renderTable()).not.toThrow();

    // A phone's first paint is never a row of buttons that then folds.
    expect(foldedButtons()).toHaveLength(3);
    expect(plainButtons("Edit")).toHaveLength(0);
  });

  it("keeps the folded guess when the only width it is told is 0, a hidden element", () => {
    const { container } = renderTable();

    resizeTo(container, 0);

    expect(foldedButtons()).toHaveLength(3);
  });

  it("folds without a ResizeObserver, and does not throw", () => {
    vi.stubGlobal("ResizeObserver", undefined);

    expect(() => renderTable()).not.toThrow();

    expect(foldedButtons()).toHaveLength(3);
  });

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["undefined", undefined],
  ])("never folds when the threshold is %s, measured or not", (_name, below) => {
    const { container } = renderTable({ collapseRowActionsBelow: below });

    expect(foldedButtons()).toHaveLength(0);
    expect(plainButtons("Edit")).toHaveLength(3);
    // Nothing to decide, so nothing is watched.
    expect(watchersOf(wrapperOf(container))).toHaveLength(0);
    resizeTo(container, 100);
    expect(foldedButtons()).toHaveLength(0);
  });

  it("does not fold a table in which no row has more than one action, however narrow", () => {
    const { container } = renderTable({ rowActions: [edit] });

    resizeTo(container, 100);

    // One button is as small as the menu button would be.
    expect(actionNames(container)).toEqual([["Edit"], ["Edit"], ["Edit"]]);
  });

  it("does not fold when each row's own list is a single action, either", () => {
    const { container } = renderTable({
      rowActions: (row) => [{ ...edit, tag: `edit-${row.id}` }],
    });

    resizeTo(container, 100);

    expect(foldedButtons()).toHaveLength(0);
    expect(plainButtons("Edit")).toHaveLength(3);
  });

  it("folds only the rows with more than one action in a mixed table, and keeps the single buttons", () => {
    const { container } = renderTable({
      rowActions: (row) => (row.id === "r2" ? [edit] : three),
    });

    resizeTo(container, 500);

    expect(actionNames(container)).toEqual([
      ["Actions for Invoice INV-1"],
      ["Edit"],
      ["Actions for Invoice INV-3"],
    ]);
    resizeTo(container, 1000);
    expect(actionNames(container)).toEqual([
      ["Edit", "Archive", "Delete"],
      ["Edit"],
      ["Edit", "Archive", "Delete"],
    ]);
  });

  it("decides from the rows on the page: a row with more actions on another page does not fold this one", () => {
    const many: Invoice[] = Array.from({ length: 4 }, (_, index) => ({
      id: `p${index + 1}`,
      number: `INV-${index + 1}`,
    }));
    const { container } = renderTable({
      rows: many,
      defaultPageSize: 2,
      pageSizeOptions: [2],
      // Only the rows of the second page have more than one action.
      rowActions: (row) => (Number(row.id.slice(1)) > 2 ? three : [edit]),
    });
    resizeTo(container, 100);
    expect(actionNames(container)).toEqual([["Edit"], ["Edit"]]);

    fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));

    expect(actionNames(container)).toEqual([
      ["Actions for Invoice INV-3"],
      ["Actions for Invoice INV-4"],
    ]);
  });

  it("names the button for the row id when there is no row label", () => {
    const { container } = renderTable({ getRowLabel: undefined });

    resizeTo(container, 500);

    expect(actionNames(container)).toEqual([
      ["Actions for r1"],
      ["Actions for r2"],
      ["Actions for r3"],
    ]);
  });

  it("folds an action with children into a labelled group of the menu", async () => {
    const user = userEvent.setup();
    const { container } = renderTable({
      rows: [invoices[0]],
      rowActions: [
        edit,
        {
          tag: "more",
          label: "More",
          children: [
            { tag: "archive", label: "Archive" },
            { tag: "delete", label: "Delete" },
          ],
        },
      ],
    });
    resizeTo(container, 500);

    await user.click(screen.getByRole("button", { name: "Actions for Invoice INV-1" }));

    const group = await screen.findByRole("group", { name: "More" });
    expect(within(group).getAllByRole("menuitem")).toHaveLength(2);
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeTruthy();
  });

  it("runs a folded item through onRowAction and does not activate the row", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    const onRowClick = vi.fn();
    const { container } = renderTable({ onRowAction, onRowClick });
    resizeTo(container, 500);

    await user.click(screen.getByRole("button", { name: "Actions for Invoice INV-2" }));
    expect(onRowClick).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));

    expect(onRowAction).toHaveBeenCalledTimes(1);
    expect(onRowAction).toHaveBeenCalledWith({ id: "r2", tag: "delete", row: invoices[1] });
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("moves focus to the same row's actions when the fold takes the button that had it", () => {
    const { container } = renderTable();
    resizeTo(container, 1000);
    const buttons = within(
      container.querySelector<HTMLElement>("tr[data-row-id='r2']")!,
    ).getAllByRole("button");
    buttons[1].focus();
    expect(document.activeElement).toBe(buttons[1]);

    resizeTo(container, 500);

    // Not the body, and not another row's menu button: the one in the row the focus was in.
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Actions for Invoice INV-2" }),
    );
  });

  it("moves focus to the same row's first button when the fold ends under the menu button", () => {
    const { container } = renderTable();
    resizeTo(container, 500);
    screen.getByRole("button", { name: "Actions for Invoice INV-3" }).focus();

    resizeTo(container, 1000);

    const row = container.querySelector<HTMLElement>("tr[data-row-id='r3']")!;
    expect(document.activeElement).toBe(within(row).getByRole("button", { name: "Edit" }));
  });

  it("leaves focus alone when the fold flips while it is somewhere else", () => {
    const { container } = renderTable({ toolbar: { left: <input aria-label="Filter" /> } });
    resizeTo(container, 1000);
    within(container.querySelector<HTMLElement>("tr[data-row-id='r2']")!)
      .getAllByRole("button")[1]
      .focus();
    const filter = screen.getByLabelText("Filter");
    filter.focus();

    resizeTo(container, 500);

    expect(document.activeElement).toBe(filter);
  });

  it("forgets the row's focus once it has left, so a later flip does not drag it back", () => {
    const { container } = renderTable({ toolbar: { left: <input aria-label="Filter" /> } });
    resizeTo(container, 1000);
    const row = container.querySelector<HTMLElement>("tr[data-row-id='r2']")!;
    within(row).getAllByRole("button")[1].focus();
    screen.getByLabelText("Filter").focus();
    resizeTo(container, 500);

    // Focus left the row before the table folded. If the cell still remembered it, the body having
    // focus at the next flip would read as "the button just unmounted" and pull it into the row.
    (document.activeElement as HTMLElement).blur();
    resizeTo(container, 1000);

    expect(document.activeElement).toBe(document.body);
  });
});

// ---------------------------------------------------------------------------------------------
// useResponsiveFit and useColumnsHiddenByWidth
// ---------------------------------------------------------------------------------------------

describe("useResponsiveFit and useColumnsHiddenByWidth", () => {
  // 100px each: three fit in 300px with nothing reserved, and every px reserved takes the last one.
  const ranked: DataTableColumn<Invoice>[] = [
    { name: "id", header: "Id", priority: 1, width: "100px" },
    { name: "number", header: "Number", priority: 2, width: "100px" },
    { name: "extra", header: "Extra", priority: 3, width: "100px" },
  ];

  function mount() {
    const element = document.createElement("div");
    return { element, ref: { current: element } as React.RefObject<HTMLElement | null> };
  }

  type FitProps = Partial<Parameters<typeof useResponsiveFit<Invoice>>[0]>;

  function mountFit(initial: FitProps = {}) {
    const { element, ref } = mount();
    const hook = renderHook(
      (props: FitProps) =>
        useResponsiveFit<Invoice>({
          containerRef: ref,
          columns: ranked,
          reservedWidth: 0,
          enabled: true,
          ...props,
        }),
      { initialProps: initial },
    );
    return { ...hook, element, resize: (width: number) => resize(element, width) };
  }

  it("still returns a ReadonlySet from useColumnsHiddenByWidth, the contract custom layouts rely on", () => {
    const { element, ref } = mount();
    const { result } = renderHook(() =>
      useColumnsHiddenByWidth<Invoice>({
        containerRef: ref,
        columns: ranked,
        reservedWidth: 0,
        enabled: true,
      }),
    );

    // Narrow first, as before: every column with a rank is hidden until a width is known, bar the
    // most important one that a table always keeps.
    expect(result.current).toBeInstanceOf(Set);
    expect(Array.from(result.current).sort()).toEqual(["extra", "number"]);
    expect("hidden" in result.current).toBe(false);

    resize(element, 250);
    expect(result.current.has("extra")).toBe(true);
    expect(result.current.has("id")).toBe(false);
    resize(element, 1000);
    expect(result.current.size).toBe(0);
  });

  it("returns a set from useColumnsHiddenByWidth even when disabled", () => {
    const { ref } = mount();
    const { result } = renderHook(() =>
      useColumnsHiddenByWidth<Invoice>({
        containerRef: ref,
        columns: ranked,
        reservedWidth: 0,
        enabled: false,
      }),
    );

    expect(result.current).toBeInstanceOf(Set);
    expect(result.current.size).toBe(0);
  });

  it("returns the hidden set and whether the actions are folded from useResponsiveFit", () => {
    const { result, resize: resizeContainer } = mountFit({ collapseBelow: 400 });

    expect(Object.keys(result.current).sort()).toEqual(["hidden", "rowActionsCollapsed"]);
    expect(result.current.hidden).toBeInstanceOf(Set);
    expect(result.current.rowActionsCollapsed).toBe(true);

    resizeContainer(1000);
    expect(result.current.hidden.size).toBe(0);
    expect(result.current.rowActionsCollapsed).toBe(false);
  });

  it("neither folds nor observes anything while disabled", () => {
    const { result, element } = mountFit({ enabled: false, collapseBelow: 400 });

    expect(result.current.hidden.size).toBe(0);
    expect(result.current.rowActionsCollapsed).toBe(false);
    expect(watchersOf(element)).toHaveLength(0);
  });

  it("never folds without a finite threshold", () => {
    const { result, resize: resizeContainer } = mountFit();

    expect(result.current.rowActionsCollapsed).toBe(false);
    resizeContainer(50);
    expect(result.current.rowActionsCollapsed).toBe(false);
  });

  it("re-fits when collapseBelow changes under a width that has not", () => {
    const { result, rerender, resize: resizeContainer } = mountFit({ collapseBelow: 600 });
    resizeContainer(500);
    expect(result.current.rowActionsCollapsed).toBe(true);

    rerender({ collapseBelow: 400 });
    expect(result.current.rowActionsCollapsed).toBe(false);

    rerender({ collapseBelow: 700 });
    expect(result.current.rowActionsCollapsed).toBe(true);
  });

  it("resets to unfolded when collapseBelow stops being a finite number", () => {
    const { result, rerender, resize: resizeContainer } = mountFit({ collapseBelow: 600 });
    resizeContainer(500);
    expect(result.current.rowActionsCollapsed).toBe(true);

    for (const below of [Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
      rerender({ collapseBelow: 600 });
      expect(result.current.rowActionsCollapsed).toBe(true);
      rerender({ collapseBelow: below });
      expect(result.current.rowActionsCollapsed).toBe(false);
    }
  });

  it("does not keep the old fold as history once the threshold is back", () => {
    const { result, rerender, resize: resizeContainer } = mountFit({ collapseBelow: 600 });
    resizeContainer(610);
    expect(result.current.rowActionsCollapsed).toBe(false);

    rerender({ collapseBelow: Number.NaN });
    rerender({ collapseBelow: 700 });

    // 610 is under 700: folded, not "whatever it was in a band".
    expect(result.current.rowActionsCollapsed).toBe(true);
  });

  it("follows collapseApplies, and remembers the width's verdict while it is off", () => {
    const { result, rerender, resize: resizeContainer } = mountFit({ collapseBelow: 600 });
    resizeContainer(500);
    expect(result.current.rowActionsCollapsed).toBe(true);

    rerender({ collapseBelow: 600, collapseApplies: false });
    expect(result.current.rowActionsCollapsed).toBe(false);

    rerender({ collapseBelow: 600, collapseApplies: true });
    expect(result.current.rowActionsCollapsed).toBe(true);
  });

  it("re-fits when reservedWidth changes: the pinned columns take their room out of the same width", () => {
    const { result, rerender, resize: resizeContainer } = mountFit({ reservedWidth: 0 });
    resizeContainer(300);
    expect(result.current.hidden.size).toBe(0);

    rerender({ reservedWidth: 100 });

    expect(Array.from(result.current.hidden)).toEqual(["extra"]);
  });

  it("reserves the folded width while the actions are folded, and re-fits when that changes", () => {
    const {
      result,
      rerender,
      resize: resizeContainer,
    } = mountFit({ reservedWidth: 100, reservedFoldedWidth: 0, collapseBelow: 600 });

    resizeContainer(300);
    // Folded: the pinned columns leave all 300px to the data columns.
    expect(result.current.rowActionsCollapsed).toBe(true);
    expect(result.current.hidden.size).toBe(0);

    rerender({ reservedWidth: 100, reservedFoldedWidth: 100, collapseBelow: 600 });
    expect(Array.from(result.current.hidden)).toEqual(["extra"]);

    // And unfolded it is the other number that counts: a wide container pays for the buttons.
    resizeContainer(1000);
    expect(result.current.hidden.size).toBe(0);
  });

  it("spends the room the fold frees: crossing the threshold can bring a column back", () => {
    const { result, resize: resizeContainer } = mountFit({
      reservedWidth: 100,
      reservedFoldedWidth: 0,
      collapseBelow: 350,
    });

    resizeContainer(360);
    // Unfolded at 360: 300px of columns and 100px of buttons do not fit.
    expect(result.current.rowActionsCollapsed).toBe(false);
    expect(Array.from(result.current.hidden)).toEqual(["extra"]);

    resizeContainer(340);
    expect(result.current.rowActionsCollapsed).toBe(true);
    expect(result.current.hidden.size).toBe(0);
  });

  it("takes the first measurement without history: a width in the band right after it is unfolded", () => {
    const { result, resize: resizeContainer } = mountFit({ collapseBelow: 600 });
    // The narrow-first guess before any measurement is folded.
    expect(result.current.rowActionsCollapsed).toBe(true);

    resizeContainer(610);

    expect(result.current.rowActionsCollapsed).toBe(false);
  });

  it("keeps a width in the band folded when it was reached by resizing from narrow", () => {
    const { result, resize: resizeContainer } = mountFit({ collapseBelow: 600 });

    resizeContainer(500);
    resizeContainer(610);

    expect(result.current.rowActionsCollapsed).toBe(true);
  });

  it("stops observing when it unmounts", () => {
    const { element, unmount } = mountFit({ collapseBelow: 600 });
    expect(watchersOf(element)).toHaveLength(1);

    unmount();

    expect(watchersOf(element)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Server render, hydration, StrictMode
// ---------------------------------------------------------------------------------------------

describe("DataTable collapseRowActionsBelow: server render, hydration and StrictMode", () => {
  const actions: DataTableRowAction<Invoice>[] = [
    { tag: "edit", label: "Edit" },
    { tag: "delete", label: "Delete" },
  ];
  const folding = (
    <DataTable
      columns={columns}
      rows={invoices}
      getRowId={rowId}
      getRowLabel={rowLabel}
      rowActions={actions}
      collapseRowActionsBelow={600}
    />
  );

  const foldedLabels = (root: ParentNode) =>
    Array.from(root.querySelectorAll("tbody td[data-pin='end'] button")).map((button) =>
      button.getAttribute("aria-label"),
    );

  it("renders the folded markup on the server, where nothing can be measured, without a warning", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const html = renderToString(folding);
      const doc = new DOMParser().parseFromString(html, "text/html");

      expect(foldedLabels(doc)).toEqual([
        "Actions for Invoice INV-1",
        "Actions for Invoice INV-2",
        "Actions for Invoice INV-3",
      ]);
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it("hydrates the server's folded markup without a mismatch warning, then follows the width", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const host = document.createElement("div");
    document.body.append(host);
    try {
      host.innerHTML = renderToString(folding);
      expect(foldedLabels(host)).toHaveLength(3);

      let root!: ReturnType<typeof hydrateRoot>;
      await act(async () => {
        root = hydrateRoot(host, folding);
      });

      expect(error).not.toHaveBeenCalled();
      expect(foldedLabels(host)).toHaveLength(3);

      resize(wrapperOf(host), 1000);
      expect(foldedLabels(host)).toEqual(["Edit", "Delete", "Edit", "Delete", "Edit", "Delete"]);
      expect(error).not.toHaveBeenCalled();

      act(() => root.unmount());
    } finally {
      host.remove();
      error.mockRestore();
    }
  });

  it("mounts, folds, unfolds and unmounts under StrictMode without a warning or a leaked observer", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { container, unmount } = render(<React.StrictMode>{folding}</React.StrictMode>);
      const wrapper = wrapperOf(container);

      // The effect ran twice: the first pass's observer is gone, the second's is the only one.
      expect(watchersOf(wrapper)).toHaveLength(1);
      expect(foldedLabels(container)).toHaveLength(3);

      resize(wrapper, 1000);
      expect(foldedLabels(container)).toHaveLength(6);
      resize(wrapper, 500);
      expect(foldedLabels(container)).toHaveLength(3);

      unmount();
      expect(FakeResizeObserver.all.size).toBe(0);
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
});
