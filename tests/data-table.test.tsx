import * as DialogPrimitive from "@radix-ui/react-dialog";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { CardContent } from "../src/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../src/components/ui/dialog";
import {
  DataTable,
  DataTableCellEditor,
  DataTableColumnHeader,
  DataTableColumnOptions,
  type DataTableColumn,
  type DataTableRowAction,
} from "../src/components/ui/data-table";

interface Person {
  id: string;
  name: string;
  status: string;
  score: number;
}

const people: Person[] = [
  { id: "r1", name: "Charlie", status: "Active", score: 30 },
  { id: "r2", name: "Alice", status: "Pending", score: 10 },
  { id: "r3", name: "Bob", status: "Active", score: 20 },
];

const columns: DataTableColumn<Person>[] = [
  { name: "name", header: "Name" },
  { name: "status", header: "Status" },
  { name: "score", header: "Score", align: "Right" },
];

const manyPeople: Person[] = Array.from({ length: 23 }, (_, index) => ({
  id: `p${index + 1}`,
  name: `Person ${String(index + 1).padStart(2, "0")}`,
  status: index % 2 === 0 ? "Active" : "Pending",
  score: index,
}));

const rowId = (row: Person): string => row.id;

/** An editable cell's button: named "Edit <header>: <value>", so a screen reader hears the value. */
function editCell(header: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^Edit ${header}`) });
}

/** The first cell of every rendered body row, in render order. */
function bodyColumn(container: HTMLElement, columnIndex = 0): string[] {
  return Array.from(container.querySelectorAll("tbody tr")).map(
    (row) => row.querySelectorAll("td")[columnIndex]?.textContent ?? "",
  );
}

function bodyRowCount(container: HTMLElement): number {
  return container.querySelectorAll("tbody tr").length;
}

function headerLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("thead th")).map((th) => th.textContent ?? "");
}

/** The `<th>` carrying a label — looked up by text so the sort button's label cannot shadow it. */
function headerFor(container: HTMLElement, label: string): HTMLTableCellElement {
  const match = Array.from(container.querySelectorAll("thead th")).find(
    (th) => th.textContent === label,
  );
  if (!match) {
    throw new Error(`No header cell labelled "${label}"`);
  }
  return match as HTMLTableCellElement;
}

function ariaSort(container: HTMLElement, label: string): string | null {
  return headerFor(container, label).getAttribute("aria-sort");
}

/**
 * The boundary pager buttons are `aria-disabled`, never natively `disabled`: a disabled button that
 * has focus drops it to `<body>`.
 */
function isDisabled(name: string): boolean {
  const button = screen.getByRole("button", { name }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  return button.getAttribute("aria-disabled") === "true";
}

describe("DataTable sort cycling", () => {
  it("cycles a sortable header none → ascending → descending → none and reorders rows", () => {
    const { container } = render(<DataTable columns={columns} rows={people} getRowId={rowId} />);

    expect(ariaSort(container, "Name")).toBe("none");
    expect(bodyColumn(container)).toEqual(["Charlie", "Alice", "Bob"]);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Name ascending" }));
    expect(ariaSort(container, "Name")).toBe("ascending");
    expect(bodyColumn(container)).toEqual(["Alice", "Bob", "Charlie"]);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Name descending" }));
    expect(ariaSort(container, "Name")).toBe("descending");
    expect(bodyColumn(container)).toEqual(["Charlie", "Bob", "Alice"]);

    fireEvent.click(screen.getByRole("button", { name: "Clear sort on Name" }));
    expect(ariaSort(container, "Name")).toBe("none");
    expect(bodyColumn(container)).toEqual(["Charlie", "Alice", "Bob"]);
  });

  it("moves the sort to a second column and resets the first (single-column sort)", () => {
    const { container } = render(<DataTable columns={columns} rows={people} getRowId={rowId} />);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Name ascending" }));
    expect(ariaSort(container, "Name")).toBe("ascending");

    fireEvent.click(screen.getByRole("button", { name: "Sort by Score ascending" }));
    expect(ariaSort(container, "Score")).toBe("ascending");
    expect(ariaSort(container, "Name")).toBe("none");
    expect(bodyColumn(container, 2)).toEqual(["10", "20", "30"]);
  });

  it("reports every step of the cycle through onSortChange", () => {
    const onSortChange = vi.fn();
    render(
      <DataTable columns={columns} rows={people} getRowId={rowId} onSortChange={onSortChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sort by Name ascending" }));
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "name", direction: "Ascending" });

    fireEvent.click(screen.getByRole("button", { name: "Sort by Name descending" }));
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "name", direction: "Descending" });

    fireEvent.click(screen.getByRole("button", { name: "Clear sort on Name" }));
    expect(onSortChange).toHaveBeenLastCalledWith(null);
    expect(onSortChange).toHaveBeenCalledTimes(3);
  });

  it("renders no sort affordance for a column with sortable: false", () => {
    const onSortChange = vi.fn();
    const withUnsortable: DataTableColumn<Person>[] = [
      { name: "name", header: "Name" },
      { name: "status", header: "Status", sortable: false },
    ];
    const { container } = render(
      <DataTable
        columns={withUnsortable}
        rows={people}
        getRowId={rowId}
        onSortChange={onSortChange}
      />,
    );

    const status = headerFor(container, "Status");
    expect(status.hasAttribute("aria-sort")).toBe(false);
    expect(status.querySelector("button")).toBeNull();

    fireEvent.click(status);
    expect(onSortChange).not.toHaveBeenCalled();
  });

  it("makes no header a sort control when allowSorting is false", () => {
    const onSortChange = vi.fn();
    const { container } = render(
      <DataTable
        columns={columns}
        rows={people}
        getRowId={rowId}
        allowSorting={false}
        onSortChange={onSortChange}
      />,
    );

    expect(container.querySelectorAll("thead button")).toHaveLength(0);
    expect(headerLabels(container)).toEqual(["Name", "Status", "Score"]);

    fireEvent.click(headerFor(container, "Name"));
    expect(onSortChange).not.toHaveBeenCalled();
  });

  it("activates the sort control with Enter and with Space", async () => {
    const user = userEvent.setup();
    const { container } = render(<DataTable columns={columns} rows={people} getRowId={rowId} />);

    screen.getByRole("button", { name: "Sort by Name ascending" }).focus();
    await user.keyboard("{Enter}");
    expect(ariaSort(container, "Name")).toBe("ascending");

    screen.getByRole("button", { name: "Sort by Name descending" }).focus();
    await user.keyboard(" ");
    expect(ariaSort(container, "Name")).toBe("descending");
  });
});

describe("DataTable pagination boundaries", () => {
  it("renders the first page with the leading controls disabled", () => {
    const { container } = render(
      <DataTable columns={columns} rows={manyPeople} getRowId={rowId} defaultPageSize={10} />,
    );

    expect(bodyRowCount(container)).toBe(10);
    expect(screen.getByText("Showing 1–10 of 23")).toBeDefined();
    expect(screen.getByText("Page 1 of 3")).toBeDefined();
    expect(isDisabled("Go to first page")).toBe(true);
    expect(isDisabled("Go to previous page")).toBe(true);
    expect(isDisabled("Go to next page")).toBe(false);
  });

  it("renders the partial last page with the trailing controls disabled", () => {
    const { container } = render(
      <DataTable columns={columns} rows={manyPeople} getRowId={rowId} defaultPageSize={10} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Go to last page" }));

    expect(bodyRowCount(container)).toBe(3);
    expect(bodyColumn(container)).toEqual(["Person 21", "Person 22", "Person 23"]);
    expect(screen.getByText("Showing 21–23 of 23")).toBeDefined();
    expect(isDisabled("Go to next page")).toBe(true);
    expect(isDisabled("Go to last page")).toBe(true);
  });

  it("round-trips from the last page back to the first", () => {
    const { container } = render(
      <DataTable columns={columns} rows={manyPeople} getRowId={rowId} defaultPageSize={10} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Go to last page" }));
    fireEvent.click(screen.getByRole("button", { name: "Go to first page" }));

    expect(screen.getByText("Page 1 of 3")).toBeDefined();
    expect(bodyColumn(container)[0]).toBe("Person 01");
  });

  it("resets to page 1 when the page size grows, reporting the size before the page", () => {
    const events: string[] = [];
    const onPageChange = vi.fn((page: number) => events.push(`page:${page}`));
    const onPageSizeChange = vi.fn((size: number) => events.push(`size:${size}`));
    const { container } = render(
      <DataTable
        columns={columns}
        rows={manyPeople}
        getRowId={rowId}
        defaultPageSize={10}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Go to last page" }));
    expect(screen.getByText("Page 3 of 3")).toBeDefined();

    fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "25" } });

    expect(bodyRowCount(container)).toBe(23);
    expect(screen.getByText("23 rows")).toBeDefined();
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
    expect(events.slice(-2)).toEqual(["size:25", "page:1"]);
  });

  it("clamps a controlled page beyond the end to the last page", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        rows={manyPeople}
        getRowId={rowId}
        page={99}
        defaultPageSize={10}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Page 3 of 3")).toBeDefined();
    expect(bodyColumn(container)).toEqual(["Person 21", "Person 22", "Person 23"]);
  });

  it("renders the empty state with a bare count and no navigation when there are no rows", () => {
    render(<DataTable columns={columns} rows={[]} getRowId={rowId} />);

    expect(screen.getByText("No results.")).toBeDefined();
    expect(screen.getByText("No rows")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Go to first page" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Go to next page" })).toBeNull();
    expect(screen.queryByLabelText("Rows per page")).toBeNull();
  });

  it("leaves manually paginated rows unsliced and reports the supplied total", () => {
    const page = manyPeople.slice(0, 10);
    const { container } = render(
      <DataTable
        columns={columns}
        rows={page}
        getRowId={rowId}
        manualPagination
        rowCount={100}
        defaultPageSize={10}
      />,
    );

    expect(bodyRowCount(container)).toBe(10);
    expect(screen.getByText("Showing 1–10 of 100")).toBeDefined();
    expect(screen.getByText("Page 1 of 10")).toBeDefined();
  });
});

describe("DataTable pagination focus", () => {
  it("keeps focus on the Next button when it reaches the last page and becomes unavailable", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={manyPeople} getRowId={rowId} defaultPageSize={10} />);

    const next = screen.getByRole("button", { name: "Go to next page" });
    next.focus();
    await user.keyboard("{Enter}{Enter}");

    expect(screen.getByText("Page 3 of 3")).toBeDefined();
    expect(next.getAttribute("aria-disabled")).toBe("true");
    expect(next.hasAttribute("disabled")).toBe(false);
    expect(document.activeElement).toBe(next);
  });

  it("keeps focus on Previous at the first page", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={manyPeople} getRowId={rowId} defaultPageSize={10} />);

    fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));
    const previous = screen.getByRole("button", { name: "Go to previous page" });
    previous.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByText("Page 1 of 3")).toBeDefined();
    expect(document.activeElement).toBe(previous);
    expect(previous.getAttribute("aria-disabled")).toBe("true");
  });

  it("ignores activating an unavailable boundary button", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={manyPeople}
        getRowId={rowId}
        defaultPageSize={10}
        onPageChange={onPageChange}
      />,
    );

    const first = screen.getByRole("button", { name: "Go to first page" });
    first.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    fireEvent.click(first);

    expect(onPageChange).not.toHaveBeenCalled();
    expect(screen.getByText("Page 1 of 3")).toBeDefined();
  });

  it("keeps focus on Last after jumping to the last page", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={manyPeople} getRowId={rowId} defaultPageSize={10} />);

    const last = screen.getByRole("button", { name: "Go to last page" });
    last.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByText("Page 3 of 3")).toBeDefined();
    expect(document.activeElement).toBe(last);
  });
});

describe("DataTable pagination footer", () => {
  it("hides the page controls and shows a row count when every row fits on one page", () => {
    render(<DataTable columns={columns} rows={people} getRowId={rowId} />);

    expect(screen.getByText("3 rows")).toBeDefined();
    expect(screen.queryByText(/Page \d+ of \d+/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Go to first page" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Go to previous page" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Go to next page" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Go to last page" })).toBeNull();
    // 3 rows cannot be split by any of the 10/25/50/100 sizes, so the select has nothing to do either.
    expect(screen.queryByLabelText("Rows per page")).toBeNull();
  });

  it("uses the singular for one row", () => {
    render(<DataTable columns={columns} rows={[people[0]]} getRowId={rowId} />);
    expect(screen.getByText("1 row")).toBeDefined();
  });

  it("keeps the page-size select on a single page that a smaller size would split", () => {
    // 23 rows at 100 per page is one page, but dropping back to 10 must stay possible.
    const { container } = render(
      <DataTable columns={columns} rows={manyPeople} getRowId={rowId} defaultPageSize={100} />,
    );

    expect(screen.getByText("23 rows")).toBeDefined();
    expect(screen.queryByText(/Page \d+ of \d+/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Go to next page" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "10" } });

    expect(bodyRowCount(container)).toBe(10);
    expect(screen.getByText("Page 1 of 3")).toBeDefined();
  });

  it("lists a defaultPageSize that is not one of the options, and selects it", () => {
    render(<DataTable columns={columns} rows={manyPeople} getRowId={rowId} defaultPageSize={15} />);

    const select = screen.getByLabelText("Rows per page") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      "10",
      "15",
      "25",
      "50",
      "100",
    ]);
    expect(select.value).toBe("15");
    expect(screen.getByText("Showing 1–15 of 23")).toBeDefined();
    expect(screen.getByText("Page 1 of 2")).toBeDefined();
  });

  it("does not duplicate a page size that is already an option", () => {
    render(<DataTable columns={columns} rows={manyPeople} getRowId={rowId} defaultPageSize={25} />);

    const select = screen.getByLabelText("Rows per page") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      "10",
      "25",
      "50",
      "100",
    ]);
  });
});

describe("DataTable caption", () => {
  it("is visually hidden by default but still the table's caption", () => {
    const { container } = render(
      <DataTable columns={columns} rows={people} getRowId={rowId} caption="Open invoices" />,
    );

    const caption = screen.getByText("Open invoices");
    expect(caption.tagName).toBe("CAPTION");
    expect(caption.className).toContain("sr-only");
    expect(screen.getByRole("table", { name: "Open invoices" })).toBeDefined();
    expect(container.querySelector('[data-slot="data-table-caption"]')).toBeNull();
  });

  it("keeps the sr-only <caption> as the accessible name when showCaption draws a visible copy", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        rows={people}
        getRowId={rowId}
        caption="Open invoices"
        showCaption
      />,
    );

    const table = screen.getByRole("table", { name: "Open invoices" });
    const caption = table.querySelector("caption")!;
    expect(caption.className).toContain("sr-only");

    // The visible line is a separate element, hidden from assistive tech so it is not read twice.
    const visible = container.querySelector('[data-slot="data-table-caption"]')!;
    expect(visible.textContent).toBe("Open invoices");
    expect(visible.getAttribute("aria-hidden")).toBe("true");
    expect(visible.className).not.toContain("sr-only");
    expect(screen.getAllByText("Open invoices")).toHaveLength(2);
  });

  it("draws the visible caption above, and outside, the scroll container", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        rows={people}
        getRowId={rowId}
        caption="Open invoices"
        showCaption
      />,
    );

    const visible = container.querySelector('[data-slot="data-table-caption"]')!;
    const scroller = container.querySelector('[data-slot="table-container"]')!;
    expect(scroller.contains(visible)).toBe(false);
    expect(visible.parentElement).toBe(scroller.parentElement);
    expect(
      visible.compareDocumentPosition(scroller) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("aligns the visible caption with the card padding only inside flush card content", () => {
    const { container, rerender } = render(
      <DataTable columns={columns} rows={people} getRowId={rowId} caption="Open" showCaption />,
    );
    const caption = () => container.querySelector('[data-slot="data-table-caption"]')!;
    expect(caption().className).toContain("px-2");

    rerender(
      <CardContent flush>
        <DataTable columns={columns} rows={people} getRowId={rowId} caption="Open" showCaption />
      </CardContent>,
    );
    expect(caption().className).toContain("px-6");
    expect(caption().className).not.toContain("px-2");
  });
});

describe("DataTable cell wrapping", () => {
  const cellClassFor = (container: HTMLElement, columnIndex: number): string =>
    container.querySelectorAll("tbody tr")[0].querySelectorAll("td")[columnIndex].className;

  it("keeps right-aligned columns on one line without clipping them", () => {
    const { container } = render(<DataTable columns={columns} rows={people} getRowId={rowId} />);

    const amount = cellClassFor(container, 2);
    expect(amount).toContain("whitespace-nowrap");
    expect(amount).not.toContain("text-ellipsis");
  });

  it("truncates other columns on one line by default and wraps them with wrapText", () => {
    const { container } = render(
      <DataTable
        columns={[
          { name: "name", header: "Name" },
          { name: "status", header: "Status", wrapText: true },
        ]}
        rows={people}
        getRowId={rowId}
      />,
    );

    expect(cellClassFor(container, 0)).toContain("text-ellipsis");
    expect(cellClassFor(container, 1)).toContain("whitespace-normal");
    expect(cellClassFor(container, 1)).not.toContain("whitespace-nowrap");
  });

  it("nowrap pins any column to one line with no ellipsis, and beats wrapText", () => {
    const { container } = render(
      <DataTable
        columns={[
          { name: "name", header: "Name", nowrap: true },
          { name: "status", header: "Status", nowrap: true, wrapText: true },
        ]}
        rows={people}
        getRowId={rowId}
      />,
    );

    for (const index of [0, 1]) {
      expect(cellClassFor(container, index)).toContain("whitespace-nowrap");
      expect(cellClassFor(container, index)).not.toContain("text-ellipsis");
    }
  });

  it("lets nowrap: false opt a right-aligned column back into truncating", () => {
    const { container } = render(
      <DataTable
        columns={[{ name: "score", header: "Score", align: "Right", nowrap: false }]}
        rows={people}
        getRowId={rowId}
      />,
    );

    expect(cellClassFor(container, 0)).toContain("text-ellipsis");
  });

  it("ships its layout as utilities on the table, not as a separate stylesheet", () => {
    const { container } = render(<DataTable columns={columns} rows={people} getRowId={rowId} />);

    // The sticky header used to live in data-table.css, which apps taking the design system through
    // `styles/index.css` + a Tailwind @source on dist never received.
    const table = container.querySelector("table")!;
    expect(table.className).toContain("[&_thead_th]:sticky");
    // Opaque, and the table's surface rather than the page, so a header inside a card matches the card.
    expect(table.className).toContain(
      "[&_thead_th]:bg-[color:var(--ivy-data-table-surface,var(--background))]",
    );
  });
});

describe("DataTable row actions", () => {
  const archive: DataTableRowAction<Person> = { tag: "archive", label: "Archive" };

  it("invokes onRowAction with the row id, action tag and row", () => {
    const onRowAction = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={[people[0]]}
        getRowId={rowId}
        rowActions={[archive]}
        onRowAction={onRowAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    expect(onRowAction).toHaveBeenCalledTimes(1);
    expect(onRowAction).toHaveBeenCalledWith({ id: "r1", tag: "archive", row: people[0] });
  });

  it("stops a row action from activating the row but still activates it from the cell", () => {
    const onRowClick = vi.fn();
    const { container } = render(
      <DataTable
        columns={columns}
        rows={[people[0]]}
        getRowId={rowId}
        rowActions={[archive]}
        onRowClick={onRowClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onRowClick).not.toHaveBeenCalled();

    fireEvent.click(container.querySelectorAll("tbody td")[0]);
    expect(onRowClick).toHaveBeenCalledWith(people[0], "r1");
  });

  it("resolves a different action set per row", () => {
    render(
      <DataTable
        columns={columns}
        rows={people.slice(0, 2)}
        getRowId={rowId}
        rowActions={(row) =>
          row.id === "r1"
            ? [{ tag: "promote", label: "Promote Charlie" }]
            : [{ tag: "retire", label: "Retire Alice" }]
        }
      />,
    );

    expect(screen.getAllByRole("button", { name: "Promote Charlie" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Retire Alice" })).toHaveLength(1);
  });

  it("does not render separator actions", () => {
    render(
      <DataTable
        columns={columns}
        rows={[people[0]]}
        getRowId={rowId}
        rowActions={[archive, { tag: "sep", label: "Divider", variant: "separator" }]}
      />,
    );

    expect(screen.getByRole("button", { name: "Archive" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Divider" })).toBeNull();
  });
});

describe("DataTable inline editing", () => {
  const editableColumns: DataTableColumn<Person>[] = [
    { name: "name", header: "Name", editable: true },
    { name: "status", header: "Status" },
  ];

  function renderEditable(onCellCommit = vi.fn(), editable = true) {
    const utils = render(
      <DataTable
        columns={editableColumns}
        rows={[people[0]]}
        getRowId={rowId}
        editable={editable}
        onCellCommit={onCellCommit}
      />,
    );
    return { ...utils, onCellCommit };
  }

  function openEditor(): HTMLInputElement {
    fireEvent.dblClick(editCell("Name"));
    return screen.getByRole("textbox", { name: "Edit Name" }) as HTMLInputElement;
  }

  it("opens an editor holding the current value, selected", () => {
    renderEditable();

    const input = openEditor();

    expect(input.value).toBe("Charlie");
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Charlie".length);
    expect(document.activeElement).toBe(input);
  });

  it("commits on Enter, closes the editor and releases focus to the cell", () => {
    const { onCellCommit } = renderEditable();

    const input = openEditor();
    fireEvent.change(input, { target: { value: "Charlotte" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCellCommit).toHaveBeenCalledTimes(1);
    expect(onCellCommit).toHaveBeenCalledWith({
      id: "r1",
      row: people[0],
      column: "name",
      value: "Charlotte",
      previousValue: "Charlie",
    });
    expect(screen.queryByRole("textbox", { name: "Edit Name" })).toBeNull();
    expect(document.activeElement).toBe(editCell("Name"));
  });

  it("discards the draft on Escape and releases focus to the cell", () => {
    const { onCellCommit } = renderEditable();

    const input = openEditor();
    fireEvent.change(input, { target: { value: "Charlotte" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCellCommit).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Edit Name" })).toBeNull();

    const cell = editCell("Name");
    expect(cell.textContent).toBe("Charlie");
    expect(document.activeElement).toBe(cell);
  });

  it("commits when focus leaves the editor", () => {
    const { onCellCommit } = renderEditable();

    const input = openEditor();
    fireEvent.change(input, { target: { value: "Charlotte" } });
    fireEvent.blur(input);

    expect(onCellCommit).toHaveBeenCalledTimes(1);
    expect(onCellCommit).toHaveBeenCalledWith(
      expect.objectContaining({ column: "name", value: "Charlotte" }),
    );
  });

  it("closes without a commit when the value is unchanged", () => {
    const { onCellCommit } = renderEditable();

    const input = openEditor();
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCellCommit).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Edit Name" })).toBeNull();
  });

  it("never opens an editor on a non-editable column or a non-editable table", () => {
    const { container, unmount } = renderEditable(vi.fn(), true);

    // The status column omits `editable`, so its cell is plain text.
    fireEvent.dblClick(container.querySelectorAll("tbody td")[1]);
    expect(screen.queryByRole("textbox")).toBeNull();
    unmount();

    const disabled = renderEditable(vi.fn(), false);
    expect(screen.queryByRole("button", { name: /^Edit Name/ })).toBeNull();
    fireEvent.dblClick(disabled.container.querySelectorAll("tbody td")[0]);
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("DataTable column visibility", () => {
  it("lists a checkbox per column and reports a toggle off", () => {
    const onToggle = vi.fn();
    render(
      <DataTableColumnOptions
        columns={columns}
        visibility={{ name: true, status: true, score: true }}
        onToggle={onToggle}
      />,
    );

    expect(screen.getAllByRole("checkbox")).toHaveLength(3);

    fireEvent.click(screen.getByRole("checkbox", { name: "Status" }));
    expect(onToggle).toHaveBeenCalledWith("status", false);
  });

  it("removes a column hidden through controlled columnVisibility", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        rows={people}
        getRowId={rowId}
        columnVisibility={{ status: false }}
      />,
    );

    expect(headerLabels(container)).toEqual(["Name", "Score"]);
    expect(container.querySelectorAll("tbody tr")[0].querySelectorAll("td")).toHaveLength(2);
    expect(screen.queryByText("Pending")).toBeNull();
  });

  it("keeps a hidden: true column out until visibility opts it back in", () => {
    const withHidden: DataTableColumn<Person>[] = [
      ...columns,
      { name: "secret", header: "Secret", hidden: true, accessor: () => "classified" },
    ];
    const { container, unmount } = render(
      <DataTable columns={withHidden} rows={people} getRowId={rowId} />,
    );

    expect(headerLabels(container)).toEqual(["Name", "Status", "Score"]);
    unmount();

    const revealed = render(
      <DataTable
        columns={withHidden}
        rows={people}
        getRowId={rowId}
        columnVisibility={{ secret: true }}
      />,
    );

    expect(headerLabels(revealed.container)).toEqual(["Name", "Status", "Score", "Secret"]);
    expect(screen.getAllByText("classified")).toHaveLength(3);
  });

  it("hides a column from the toolbar column-options popover", async () => {
    const { container } = render(
      <DataTable columns={columns} rows={people} getRowId={rowId} showColumnOptions />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Column options" }));

    const statusCheckbox = await screen.findByRole("checkbox", { name: "Status" });
    fireEvent.click(statusCheckbox);

    expect(headerLabels(container)).toEqual(["Name", "Score"]);
  });

  it("disables the last remaining visible column", () => {
    render(
      <DataTableColumnOptions
        columns={columns}
        visibility={{ name: true, status: false, score: false }}
        onToggle={vi.fn()}
      />,
    );

    expect((screen.getByRole("checkbox", { name: "Name" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("checkbox", { name: "Status" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});

describe("DataTable loading, footer and selection", () => {
  it("renders a busy skeleton body instead of rows while loading", () => {
    const { container } = render(
      <DataTable columns={columns} rows={people} getRowId={rowId} loading />,
    );

    expect(container.querySelector("table")?.getAttribute("aria-busy")).toBe("true");
    expect(bodyRowCount(container)).toBe(5);
    expect(screen.queryByText("Charlie")).toBeNull();
  });

  it("renders column footers in a tfoot", () => {
    const withFooter: DataTableColumn<Person>[] = [
      { name: "name", header: "Name" },
      { name: "score", header: "Score", align: "Right", footer: "60" },
    ];
    const { container } = render(<DataTable columns={withFooter} rows={people} getRowId={rowId} />);

    const footer = container.querySelector("tfoot");
    expect(footer).not.toBeNull();
    expect(footer?.textContent).toContain("60");
  });

  it("selects every row on the page from the header checkbox", () => {
    const onSelectedRowIdsChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={people}
        getRowId={rowId}
        selectable
        onSelectedRowIdsChange={onSelectedRowIdsChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all rows" }));

    expect(onSelectedRowIdsChange).toHaveBeenCalledWith(["r1", "r2", "r3"]);
    expect(
      (screen.getByRole("checkbox", { name: "Select row r2" }) as HTMLButtonElement).getAttribute(
        "aria-checked",
      ),
    ).toBe("true");
  });
});

describe("DataTable pagination landmark", () => {
  it("is named after the table, so several tables expose distinct landmarks", () => {
    render(
      <>
        <DataTable columns={columns} rows={manyPeople} getRowId={rowId} caption="Open invoices" />
        <DataTable columns={columns} rows={manyPeople} getRowId={rowId} caption="Paid invoices" />
      </>,
    );

    expect(screen.getByRole("navigation", { name: "Open invoices pagination" })).toBeDefined();
    expect(screen.getByRole("navigation", { name: "Paid invoices pagination" })).toBeDefined();
  });

  it("falls back to the table's aria-label, then to a generic name", () => {
    const { unmount } = render(
      <DataTable columns={columns} rows={manyPeople} getRowId={rowId} aria-label="Ledger" />,
    );
    expect(screen.getByRole("navigation", { name: "Ledger pagination" })).toBeDefined();
    unmount();

    render(<DataTable columns={columns} rows={manyPeople} getRowId={rowId} />);
    expect(screen.getByRole("navigation", { name: "Table pagination" })).toBeDefined();
  });
});

describe("DataTable variant", () => {
  const surfaceOf = (container: HTMLElement): HTMLElement =>
    container.querySelector<HTMLElement>('[data-slot="data-table-surface"]')!;
  const rootOf = (container: HTMLElement): HTMLElement =>
    container.querySelector<HTMLElement>('[data-slot="data-table"]')!;
  const hasOwnBorder = (element: HTMLElement): boolean =>
    /(^|\s)border(-|\s|$)/.test(element.className);

  function table(props: Partial<React.ComponentProps<typeof DataTable<Person>>> = {}) {
    return (
      <DataTable
        columns={columns}
        rows={people}
        getRowId={rowId}
        toolbar={{ left: <span>filters</span> }}
        {...props}
      />
    );
  }

  it("is bordered by default and draws its own rounded box", () => {
    const { container } = render(table());

    expect(rootOf(container).dataset.variant).toBe("bordered");
    expect(surfaceOf(container).className).toContain("rounded-box");
    expect(surfaceOf(container).className).toContain("border-border");
  });

  it("variant=embedded draws no box of its own", () => {
    const { container } = render(table({ variant: "embedded" }));

    expect(rootOf(container).dataset.variant).toBe("embedded");
    expect(surfaceOf(container).className).not.toContain("rounded-box");
    expect(hasOwnBorder(surfaceOf(container))).toBe(false);
  });

  it("defaults to embedded inside flush card content, with a divider on top and the card's inset", () => {
    const { container } = render(<CardContent flush>{table({ rows: manyPeople })}</CardContent>);

    expect(rootOf(container).dataset.variant).toBe("embedded");
    const surface = surfaceOf(container).className;
    expect(surface).not.toContain("rounded-box");
    expect(surface).toContain("border-t");

    // The inset reaches the first and last column, the toolbar and the footer.
    const tableClass = container.querySelector("table")!.className;
    expect(tableClass).toContain("[&_tr>:first-child]:ps-6");
    expect(tableClass).toContain("[&_tr>:last-child]:pe-6");
    expect(screen.getByText("filters").parentElement!.parentElement!.className).toContain("px-6");
    expect(container.querySelector("nav")!.className).toContain("px-6");
    expect(container.querySelector("nav")!.className).not.toContain("px-2");
  });

  it("defaults to embedded inside padded card content too, with no border and no inset", () => {
    const { container } = render(<CardContent>{table({ rows: manyPeople })}</CardContent>);

    expect(rootOf(container).dataset.variant).toBe("embedded");
    expect(surfaceOf(container).className).not.toContain("rounded-box");
    expect(hasOwnBorder(surfaceOf(container))).toBe(false);
    expect(container.querySelector("table")!.className).not.toContain("ps-6");
    expect(container.querySelector("nav")!.className).toContain("px-2");
  });

  it("lets an explicit variant override the card default", () => {
    const { container } = render(
      <CardContent flush>{table({ variant: "bordered", rows: manyPeople })}</CardContent>,
    );

    expect(rootOf(container).dataset.variant).toBe("bordered");
    expect(surfaceOf(container).className).toContain("rounded-box");
    expect(container.querySelector("table")!.className).not.toContain("ps-6");
    expect(container.querySelector("nav")!.className).toContain("px-2");
  });

  it("only a bordered table sets its own surface fill; an embedded one inherits the host's", () => {
    const bordered = render(table());
    expect(surfaceOf(bordered.container).className).toContain(
      "[--ivy-data-table-surface:var(--background)]",
    );
    bordered.unmount();

    const embedded = render(table({ variant: "embedded" }));
    expect(surfaceOf(embedded.container).className).not.toContain("--ivy-data-table-surface");
  });

  it("lets the table shrink inside a flex or grid parent", () => {
    const { container } = render(table());

    expect(rootOf(container).className).toContain("min-w-0");
    expect(rootOf(container).className).toContain("max-w-full");
    expect(surfaceOf(container).className).toContain("min-w-0");
  });
});

describe("DataTable scroll containment and pinned columns", () => {
  const actions: DataTableRowAction<Person>[] = [{ tag: "edit", label: "Edit" }];
  const withFooter: DataTableColumn<Person>[] = [
    { name: "name", header: "Name", footer: "Total" },
    { name: "status", header: "Status" },
    { name: "score", header: "Score", align: "Right", footer: "60" },
  ];

  const pinned = (container: HTMLElement) => ({
    startHead: container.querySelector("thead th[data-pin='start']")!,
    endHead: container.querySelector("thead th[data-pin='end']")!,
    startCells: Array.from(container.querySelectorAll("tbody td[data-pin='start']")),
    endCells: Array.from(container.querySelectorAll("tbody td[data-pin='end']")),
    startFoot: container.querySelector("tfoot td[data-pin='start']")!,
    endFoot: container.querySelector("tfoot td[data-pin='end']")!,
  });

  it("scrolls inside its own container instead of overflowing the host", () => {
    const { container } = render(<DataTable columns={columns} rows={people} getRowId={rowId} />);

    const scroller = container.querySelector<HTMLElement>('[data-slot="table-container"]')!;
    expect(scroller.className).toContain("overflow-auto");
    expect(scroller.className).toContain("min-w-0");
    expect(scroller.className).toContain("max-w-full");
    expect(scroller.className).toContain("overscroll-x-contain");
    expect(scroller.contains(container.querySelector("table"))).toBe(true);
    expect(scroller.contains(container.querySelector("nav"))).toBe(false);
  });

  it("pins the selection column to the left and the row-action column to the right", () => {
    const { container } = render(
      <DataTable
        columns={withFooter}
        rows={people}
        getRowId={rowId}
        selectable
        rowActions={actions}
      />,
    );

    const { startHead, endHead, startCells, endCells, startFoot, endFoot } = pinned(container);
    expect(startCells).toHaveLength(3);
    expect(endCells).toHaveLength(3);

    for (const cell of [...startCells, startFoot]) {
      expect(cell.className).toContain("sticky");
      expect(cell.className).toContain("left-0");
      expect(cell.className).toContain("z-[1]");
      // Opaque, repainted from the row so hover and selection match the cells scrolling under it.
      expect(cell.className).toContain("bg-[color:var(--row-bg)]");
    }
    for (const cell of [...endCells, endFoot]) {
      expect(cell.className).toContain("sticky");
      expect(cell.className).toContain("right-0");
      expect(cell.className).toContain("z-[1]");
      expect(cell.className).toContain("bg-[color:var(--row-bg)]");
    }

    // Header corners stick on both axes, through the table's sticky header utilities plus an edge.
    expect(startHead.className).toContain("left-0");
    expect(endHead.className).toContain("right-0");
    expect(container.querySelector("table")!.className).toContain("[&_thead_th[data-pin]]:z-[3]");
  });

  it("draws the pinned divider only through the scroller's overflow attributes", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        rows={people}
        getRowId={rowId}
        selectable
        rowActions={actions}
      />,
    );

    const { startCells, endCells } = pinned(container);
    expect(startCells[0].className).toContain("in-data-[overflow-start]:shadow-");
    expect(endCells[0].className).toContain("in-data-[overflow-end]:shadow-");
    expect(startCells[0].className).not.toMatch(/(^|\s)shadow-/);
  });

  it("pins nothing when there is no selection or action column", () => {
    const { container } = render(<DataTable columns={columns} rows={people} getRowId={rowId} />);

    expect(container.querySelectorAll("[data-pin]")).toHaveLength(0);
    expect(container.querySelector("tbody td")!.className).not.toContain("sticky");
  });

  it("mirrors horizontal overflow onto the scroller as data attributes", () => {
    const { container } = render(<DataTable columns={columns} rows={people} getRowId={rowId} />);
    const scroller = container.querySelector<HTMLElement>('[data-slot="table-container"]')!;

    let scrollLeft = 0;
    Object.defineProperty(scroller, "scrollWidth", { configurable: true, value: 600 });
    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 200 });
    Object.defineProperty(scroller, "scrollLeft", { configurable: true, get: () => scrollLeft });

    fireEvent.scroll(scroller);
    expect(scroller.hasAttribute("data-overflow-start")).toBe(false);
    expect(scroller.hasAttribute("data-overflow-end")).toBe(true);

    scrollLeft = 150;
    fireEvent.scroll(scroller);
    expect(scroller.hasAttribute("data-overflow-start")).toBe(true);
    expect(scroller.hasAttribute("data-overflow-end")).toBe(true);

    scrollLeft = 400;
    fireEvent.scroll(scroller);
    expect(scroller.hasAttribute("data-overflow-start")).toBe(true);
    expect(scroller.hasAttribute("data-overflow-end")).toBe(false);
  });

  it("sets no overflow attribute while everything fits", () => {
    const { container } = render(<DataTable columns={columns} rows={people} getRowId={rowId} />);
    const scroller = container.querySelector<HTMLElement>('[data-slot="table-container"]')!;

    fireEvent.scroll(scroller);
    expect(scroller.hasAttribute("data-overflow-start")).toBe(false);
    expect(scroller.hasAttribute("data-overflow-end")).toBe(false);
  });

  it("paints rows from an opaque --row-bg that hover and selection override", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        rows={people}
        getRowId={rowId}
        defaultSelectedRowIds={["r2"]}
        selectable
      />,
    );

    const row = container.querySelector<HTMLElement>('tbody tr[data-row-id="r1"]')!;
    expect(row.className).toContain("bg-[color:var(--row-bg)]");
    expect(row.className).toContain("[--row-bg:var(--ivy-data-table-surface,var(--background))]");
    expect(row.className).toContain("hover:[--row-bg:color-mix(");
    expect(row.className).toContain("data-[state=selected]:[--row-bg:var(--muted)]");
    // The translucent TableRow defaults are merged away, or they would beat the opaque fill.
    expect(row.className).not.toContain("hover:bg-muted/50");
    expect(row.className).not.toContain("data-[state=selected]:bg-muted");

    expect(container.querySelector('tbody tr[data-row-id="r2"]')!.getAttribute("data-state")).toBe(
      "selected",
    );
  });

  it("gives the totals row an opaque tint that ignores the pointer", () => {
    const { container } = render(<DataTable columns={withFooter} rows={people} getRowId={rowId} />);

    const row = container.querySelector<HTMLElement>("tfoot tr")!;
    expect(row.className).toContain("[--row-bg:color-mix(");
    expect(row.className).toContain("bg-[color:var(--row-bg)]");
    expect(row.className).toContain("hover:bg-[color:var(--row-bg)]");
    expect(row.className).not.toContain("hover:bg-muted/50");
  });

  it("aligns right-aligned numbers with tabular figures in header, cells and totals", () => {
    const { container } = render(<DataTable columns={withFooter} rows={people} getRowId={rowId} />);

    expect(headerFor(container, "Score").className).toContain("tabular-nums");
    expect(container.querySelector("tbody td:nth-child(3)")!.className).toContain("tabular-nums");
    expect(container.querySelector("tfoot td:nth-child(3)")!.className).toContain("tabular-nums");
    expect(container.querySelector("tbody td:nth-child(1)")!.className).not.toContain(
      "tabular-nums",
    );
  });

  it("keeps the totals cells on one line like the column's body cells", () => {
    const { container } = render(<DataTable columns={withFooter} rows={people} getRowId={rowId} />);

    expect(container.querySelector("tfoot td:nth-child(3)")!.className).toContain(
      "whitespace-nowrap",
    );
    expect(container.querySelector("tfoot td:nth-child(1)")!.className).toContain("text-ellipsis");
  });

  it("gives the focused row an outline rather than a ring", () => {
    const { container } = render(<DataTable columns={columns} rows={people} getRowId={rowId} />);

    const row = container.querySelector<HTMLElement>("tbody tr")!;
    expect(row.className).toContain("focus-visible:outline-2");
    expect(row.className).toContain("focus-visible:-outline-offset-2");
    expect(row.className).toContain("focus-visible:outline-ring");
    expect(row.className).not.toContain("focus-visible:ring");
    // `outline-none` would pin the style to none; the outline must be free to paint.
    expect(row.className).not.toContain("outline-none");
    expect(row.className).not.toContain("outline-hidden");
  });
});

describe("DataTable truncation", () => {
  const longColumns: DataTableColumn<Person>[] = [
    { name: "name", header: "Name" },
    { name: "status", header: "Status", wrapText: true },
    { name: "id", header: "Id", nowrap: true },
    { name: "score", header: "Score", align: "Right" },
  ];
  const CAP = "max-w-[var(--ivy-data-table-truncate-width,20rem)]";

  function stubOverflow(cell: HTMLElement, scrollWidth: number, clientWidth: number) {
    Object.defineProperty(cell, "scrollWidth", { configurable: true, value: scrollWidth });
    Object.defineProperty(cell, "clientWidth", { configurable: true, value: clientWidth });
  }

  it("caps truncating cells so the ellipsis can actually engage", () => {
    const { container } = render(
      <DataTable columns={longColumns} rows={people} getRowId={rowId} />,
    );

    const cells = container.querySelectorAll("tbody tr")[0].querySelectorAll("td");
    expect(cells[0].className).toContain(CAP);
    expect(cells[0].className).toContain("text-ellipsis");
    expect(cells[0].className).toContain("overflow-hidden");
  });

  it("leaves wrapping, nowrap and right-aligned cells uncapped", () => {
    const { container } = render(
      <DataTable columns={longColumns} rows={people} getRowId={rowId} />,
    );

    const cells = container.querySelectorAll("tbody tr")[0].querySelectorAll("td");
    for (const index of [1, 2, 3]) {
      expect(cells[index].className).not.toContain(CAP);
    }
  });

  it("reveals the full text as a title only while it is cut off", () => {
    const { container } = render(
      <DataTable columns={longColumns} rows={people} getRowId={rowId} />,
    );
    const cell = container.querySelector<HTMLElement>("tbody tr td")!;

    // Fits: no title, so short cells do not grow a redundant tooltip.
    stubOverflow(cell, 100, 100);
    fireEvent.mouseEnter(cell);
    expect(cell.hasAttribute("title")).toBe(false);

    stubOverflow(cell, 400, 320);
    fireEvent.mouseEnter(cell);
    expect(cell.getAttribute("title")).toBe("Charlie");

    // Resized so it fits again: the stale title goes.
    stubOverflow(cell, 100, 320);
    fireEvent.mouseEnter(cell);
    expect(cell.hasAttribute("title")).toBe(false);
  });

  it("reads the title from what the cell renders, so custom cells are covered", () => {
    const { container } = render(
      <DataTable
        columns={[
          {
            name: "name",
            header: "Name",
            cell: (value) => <strong>{`${value as string} (primary contact)`}</strong>,
          },
        ]}
        rows={people}
        getRowId={rowId}
      />,
    );
    const cell = container.querySelector<HTMLElement>("tbody tr td")!;

    stubOverflow(cell, 400, 100);
    fireEvent.mouseEnter(cell);
    expect(cell.getAttribute("title")).toBe("Charlie (primary contact)");
  });

  it("never adds a title to a cell that wraps or never truncates", () => {
    const { container } = render(
      <DataTable columns={longColumns} rows={people} getRowId={rowId} />,
    );
    const cells = container.querySelectorAll<HTMLElement>("tbody tr:first-child td");

    for (const index of [1, 2, 3]) {
      stubOverflow(cells[index], 400, 100);
      fireEvent.mouseEnter(cells[index]);
      expect(cells[index].hasAttribute("title")).toBe(false);
    }
  });
});

describe("DataTable header truncation", () => {
  const headedColumns: DataTableColumn<Person>[] = [
    { name: "name", header: "Counterparty of the transaction" },
    { name: "status", header: "Status of the booking", wrapText: true },
    { name: "id", header: "Voucher identifier", nowrap: true },
    { name: "score", header: "Score including VAT", align: "Right" },
    { name: "note", header: "Note", help: "Free text" },
  ];
  const CAP = "max-w-[var(--ivy-data-table-truncate-width,20rem)]";

  const headerOf = (container: HTMLElement, text: string): HTMLElement => {
    const cell = Array.from(container.querySelectorAll<HTMLElement>("thead th")).find(
      (th) => th.textContent?.trim() === text,
    );
    if (!cell) throw new Error(`No header ${text}`);
    return cell;
  };

  function stubOverflow(label: HTMLElement, scrollWidth: number, clientWidth: number) {
    Object.defineProperty(label, "scrollWidth", { configurable: true, value: scrollWidth });
    Object.defineProperty(label, "clientWidth", { configurable: true, value: clientWidth });
  }

  it("caps the header of a column whose cells truncate, at the cells' own cap", () => {
    const { container } = render(
      <DataTable columns={headedColumns} rows={people} getRowId={rowId} />,
    );

    const header = headerOf(container, "Counterparty of the transaction");
    expect(header.className).toContain(CAP);
    // The label is what gives way, and the sort icon after it stays.
    const label = header.querySelector("span")!;
    expect(label.className).toContain("truncate");
    expect(header.querySelector("svg")).not.toBeNull();
    expect(header.querySelector("button")!.className).toContain("max-w-full");
    // The cells of the same column carry the same cap.
    expect(container.querySelector("tbody tr td")!.className).toContain(CAP);
  });

  it("leaves the header of a column that wraps, keeps whole or is right-aligned uncapped", () => {
    const { container } = render(
      <DataTable columns={headedColumns} rows={people} getRowId={rowId} />,
    );

    for (const text of ["Status of the booking", "Voucher identifier", "Score including VAT"]) {
      expect(headerOf(container, text).className).not.toContain(CAP);
    }
  });

  it("follows an explicit nowrap: false on a right-aligned column", () => {
    const { container } = render(
      <DataTable
        columns={[{ name: "score", header: "Score including VAT", align: "Right", nowrap: false }]}
        rows={people}
        getRowId={rowId}
      />,
    );

    expect(headerOf(container, "Score including VAT").className).toContain(CAP);
  });

  it("caps a header that cannot be sorted, and one in a table that does not sort", () => {
    const { container } = render(
      <DataTable
        columns={[{ name: "name", header: "Counterparty of the transaction", sortable: false }]}
        rows={people}
        getRowId={rowId}
      />,
    );
    const header = headerOf(container, "Counterparty of the transaction");
    expect(header.className).toContain(CAP);
    expect(header.querySelector("button")).toBeNull();
    expect(header.querySelector("span")!.className).toContain("truncate");
  });

  it("keeps the whole label as the name of the sort button, truncated or not", () => {
    render(<DataTable columns={headedColumns} rows={people} getRowId={rowId} />);

    expect(
      screen.queryByRole("button", { name: "Sort by Counterparty of the transaction ascending" }),
    ).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Sort by Status of the booking ascending" }),
    ).not.toBeNull();
  });

  it("still sorts from the keyboard with the label truncated", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DataTable columns={headedColumns} rows={people} getRowId={rowId} />,
    );
    const header = headerOf(container, "Counterparty of the transaction");

    await user.tab();
    expect(document.activeElement).toBe(header.querySelector("button"));
    await user.keyboard("{Enter}");

    expect(header.getAttribute("aria-sort")).toBe("ascending");
    expect(bodyColumn(container)).toEqual(["Alice", "Bob", "Charlie"]);
    expect(
      screen.queryByRole("button", { name: "Sort by Counterparty of the transaction descending" }),
    ).not.toBeNull();
  });

  it("shows the full label as a title only while it is cut off", () => {
    const { container } = render(
      <DataTable columns={headedColumns} rows={people} getRowId={rowId} />,
    );
    const header = headerOf(container, "Counterparty of the transaction");
    const label = header.querySelector<HTMLElement>("span")!;

    // Nothing to read in full yet, and a short label never grows a tooltip that repeats it.
    expect(header.hasAttribute("title")).toBe(false);
    stubOverflow(label, 100, 100);
    fireEvent.mouseEnter(header);
    expect(header.hasAttribute("title")).toBe(false);

    stubOverflow(label, 220, 80);
    fireEvent.mouseEnter(header);
    expect(header.getAttribute("title")).toBe("Counterparty of the transaction");

    // Resized so that it fits again: the stale title goes.
    stubOverflow(label, 220, 300);
    fireEvent.mouseEnter(header);
    expect(header.hasAttribute("title")).toBe(false);
  });

  it("adds the column's help to a title that names a cut-off label, and keeps it when not cut off", () => {
    const { container } = render(
      <DataTable
        columns={[{ name: "name", header: "Counterparty of the transaction", help: "Who paid" }]}
        rows={people}
        getRowId={rowId}
      />,
    );
    const header = headerOf(container, "Counterparty of the transaction");
    const label = header.querySelector<HTMLElement>("span")!;
    expect(header.getAttribute("title")).toBe("Who paid");

    stubOverflow(label, 220, 80);
    fireEvent.mouseEnter(header);
    expect(header.getAttribute("title")).toBe("Counterparty of the transaction: Who paid");

    stubOverflow(label, 80, 80);
    fireEvent.mouseEnter(header);
    expect(header.getAttribute("title")).toBe("Who paid");
  });

  it("never adds a title to the header of a column that is not truncated", () => {
    const { container } = render(
      <DataTable columns={headedColumns} rows={people} getRowId={rowId} />,
    );

    for (const text of ["Status of the booking", "Voucher identifier", "Score including VAT"]) {
      const header = headerOf(container, text);
      stubOverflow(header.querySelector<HTMLElement>("span")!, 400, 100);
      fireEvent.mouseEnter(header);
      expect(header.hasAttribute("title")).toBe(false);
    }
  });

  it("runs a consumer's onMouseEnter as well", () => {
    const onMouseEnter = vi.fn();
    const { container } = render(
      <table>
        <thead>
          <tr>
            <DataTableColumnHeader
              column={{ name: "name", header: "Name" }}
              onMouseEnter={onMouseEnter}
            />
          </tr>
        </thead>
      </table>,
    );

    fireEvent.mouseEnter(container.querySelector("th")!);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
  });
});

describe("DataTable row activation by keyboard", () => {
  const rowFor = (container: HTMLElement, id: string): HTMLElement =>
    container.querySelector<HTMLElement>(`tbody tr[data-row-id="${id}"]`)!;

  it("activates the focused row with Enter and with Space", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const { container } = render(
      <DataTable columns={columns} rows={people} getRowId={rowId} onRowClick={onRowClick} />,
    );

    rowFor(container, "r2").focus();
    await user.keyboard("{Enter}");
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenLastCalledWith(people[1], "r2");

    await user.keyboard(" ");
    expect(onRowClick).toHaveBeenCalledTimes(2);
    expect(onRowClick).toHaveBeenLastCalledWith(people[1], "r2");
  });

  it("cancels the page scroll that Space would otherwise cause", () => {
    const { container } = render(
      <DataTable columns={columns} rows={people} getRowId={rowId} onRowClick={vi.fn()} />,
    );

    const row = rowFor(container, "r1");
    row.focus();
    expect(fireEvent.keyDown(row, { key: " " })).toBe(false);
    expect(fireEvent.keyDown(row, { key: "Enter" })).toBe(false);
  });

  it("leaves Enter and Space alone when the table has no onRowClick", () => {
    const { container } = render(<DataTable columns={columns} rows={people} getRowId={rowId} />);

    const row = rowFor(container, "r1");
    row.focus();
    expect(fireEvent.keyDown(row, { key: " " })).toBe(true);
    expect(fireEvent.keyDown(row, { key: "Enter" })).toBe(true);
  });

  it("does not activate the row from its checkbox, row action or a button in a cell", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const onOpen = vi.fn();
    const onRowAction = vi.fn();
    render(
      <DataTable
        columns={[
          ...columns,
          { name: "open", header: "Open", cell: () => <button onClick={onOpen}>Open</button> },
        ]}
        rows={[people[0]]}
        getRowId={rowId}
        selectable
        rowActions={[{ tag: "archive", label: "Archive" }]}
        onRowAction={onRowAction}
        onRowClick={onRowClick}
      />,
    );

    screen.getByRole("checkbox", { name: "Select row r1" }).focus();
    await user.keyboard(" ");
    screen.getByRole("button", { name: "Archive" }).focus();
    await user.keyboard("{Enter}");
    screen.getByRole("button", { name: "Open" }).focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onRowAction).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("ignores a click on a link inside a custom cell, but not on the cell itself", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const { container } = render(
      <DataTable
        columns={[
          { name: "name", header: "Name" },
          {
            name: "link",
            header: "Link",
            cell: () => (
              <a href="#invoice" onClick={(event) => event.preventDefault()}>
                Invoice
              </a>
            ),
          },
        ]}
        rows={[people[0]]}
        getRowId={rowId}
        onRowClick={onRowClick}
      />,
    );

    await user.click(screen.getByRole("link", { name: "Invoice" }));
    expect(onRowClick).not.toHaveBeenCalled();

    await user.click(container.querySelector("tbody td")!);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("still moves between rows with the arrow keys", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DataTable columns={columns} rows={people} getRowId={rowId} onRowClick={vi.fn()} />,
    );

    rowFor(container, "r1").focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rowFor(container, "r2"));
  });
});

describe("DataTable row action menu focus", () => {
  const menuActions: DataTableRowAction<Person>[] = [
    {
      tag: "more",
      label: "More actions",
      children: [
        { tag: "archive", label: "Archive" },
        { tag: "delete", label: "Delete" },
      ],
    },
  ];

  async function openMenu(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
    const trigger = screen.getByRole("button", { name: "More actions" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    return trigger;
  }

  it("returns focus to the trigger when the menu is dismissed with Escape", async () => {
    const user = userEvent.setup();
    render(
      <DataTable columns={columns} rows={[people[0]]} getRowId={rowId} rowActions={menuActions} />,
    );

    const trigger = await openMenu(user);
    await user.keyboard("{Escape}");

    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("returns focus to the trigger after an item that opened nothing", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={[people[0]]}
        getRowId={rowId}
        rowActions={menuActions}
        onRowAction={onRowAction}
      />,
    );

    const trigger = await openMenu(user);
    await user.keyboard("{Enter}");

    expect(onRowAction).toHaveBeenCalledWith({ id: "r1", tag: "archive", row: people[0] });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("leaves focus in the dialog an item opened instead of pulling it back to the trigger", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <DataTable
            columns={columns}
            rows={[people[0]]}
            getRowId={rowId}
            rowActions={menuActions}
            onRowAction={() => setOpen(true)}
          />
          <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Content aria-describedby={undefined}>
                <DialogPrimitive.Title>Archive?</DialogPrimitive.Title>
                <button>Confirm archive</button>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </>
      );
    }
    render(<Harness />);

    const trigger = await openMenu(user);
    await user.keyboard("{Enter}");

    const confirm = await screen.findByRole("button", { name: "Confirm archive" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    // Radix returns focus on a timer after the menu unmounts: give it the chance to misbehave.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(document.activeElement).toBe(confirm);
    expect(document.activeElement).not.toBe(trigger);
  });

  it("returns focus to the trigger when the menu is opened again and dismissed after an item ran", async () => {
    const user = userEvent.setup();
    render(
      <DataTable columns={columns} rows={[people[0]]} getRowId={rowId} rowActions={menuActions} />,
    );

    const trigger = await openMenu(user);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    await openMenu(user);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe("DataTable editable cell keyboard", () => {
  const editableColumns: DataTableColumn<Person>[] = [
    { name: "name", header: "Name", editable: true },
    { name: "status", header: "Status", editable: true },
    { name: "score", header: "Score", align: "Right" },
  ];

  function renderEditable(onCellCommit = vi.fn(), rows: Person[] = people.slice(0, 2)) {
    const utils = render(
      <DataTable
        columns={editableColumns}
        rows={rows}
        getRowId={rowId}
        editable
        onCellCommit={onCellCommit}
      />,
    );
    return { ...utils, onCellCommit };
  }

  // The cell's name is "Edit <header>: <value>"; the editor that replaces it is just "Edit <header>".
  const cell = (label: string, index = 0): HTMLElement =>
    screen.getAllByRole("button", { name: new RegExp(`^${label}`) })[index];

  it("opens the editor with Enter, Space and F2", async () => {
    const user = userEvent.setup();
    renderEditable();

    for (const key of ["{Enter}", " ", "{F2}"]) {
      cell("Edit Name").focus();
      await user.keyboard(key);
      const input = screen.getByRole("textbox", { name: "Edit Name" }) as HTMLInputElement;
      expect(document.activeElement).toBe(input);
      expect(input.value).toBe("Charlie");
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(document.activeElement).toBe(cell("Edit Name"));
    }
  });

  it("does not open the editor for a key typed into something inside the cell", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={[
          {
            name: "name",
            header: "Name",
            editable: true,
            cell: (value) => <a href="#x">{value as string}</a>,
          },
        ]}
        rows={[people[0]]}
        getRowId={rowId}
        editable
      />,
    );

    screen.getByRole("link", { name: "Charlie" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("commits on Tab and moves focus to the next editable cell, without opening it", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderEditable();

    cell("Edit Name").focus();
    await user.keyboard("{Enter}");
    const input = screen.getByRole("textbox", { name: "Edit Name" });
    await user.clear(input);
    await user.type(input, "Charlotte");
    await user.keyboard("{Tab}");

    expect(onCellCommit).toHaveBeenCalledTimes(1);
    expect(onCellCommit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r1", column: "name", value: "Charlotte" }),
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(document.activeElement).toBe(cell("Edit Status"));
  });

  it("moves to the next row's first editable cell from the last editable cell of a row", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderEditable();

    cell("Edit Status", 0).focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Tab}");

    // Unchanged value: nothing to commit, but focus still moves on.
    expect(onCellCommit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(cell("Edit Name", 1));
  });

  it("commits on Shift+Tab and moves to the previous editable cell", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderEditable();

    cell("Edit Status", 1).focus();
    await user.keyboard("{Enter}");
    const input = screen.getByRole("textbox", { name: "Edit Status" });
    await user.clear(input);
    await user.type(input, "Done");
    await user.keyboard("{Shift>}{Tab}{/Shift}");

    expect(onCellCommit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r2", column: "status", value: "Done" }),
    );
    expect(document.activeElement).toBe(cell("Edit Name", 1));
  });

  it("commits but leaves Tab to the browser at the last editable cell", () => {
    const { onCellCommit } = renderEditable();

    fireEvent.dblClick(cell("Edit Status", 1));
    const input = screen.getByRole("textbox", { name: "Edit Status" });
    fireEvent.change(input, { target: { value: "Done" } });

    // Not prevented: the browser's own Tab moves on from the cell focus is released to.
    expect(fireEvent.keyDown(input, { key: "Tab" })).toBe(true);
    expect(onCellCommit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r2", column: "status", value: "Done" }),
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(document.activeElement).toBe(cell("Edit Status", 1));
  });

  it("leaves Shift+Tab to the browser at the first editable cell", () => {
    renderEditable();

    fireEvent.dblClick(cell("Edit Name", 0));
    const input = screen.getByRole("textbox", { name: "Edit Name" });

    expect(fireEvent.keyDown(input, { key: "Tab", shiftKey: true })).toBe(true);
    expect(document.activeElement).toBe(cell("Edit Name", 0));
  });

  it("does not commit twice when the trailing blur follows a Tab", () => {
    const { onCellCommit } = renderEditable();

    fireEvent.dblClick(cell("Edit Name", 0));
    const input = screen.getByRole("textbox", { name: "Edit Name" });
    fireEvent.change(input, { target: { value: "Charlotte" } });
    fireEvent.keyDown(input, { key: "Tab" });
    fireEvent.blur(input);

    expect(onCellCommit).toHaveBeenCalledTimes(1);
  });

  it("lets a standalone cell editor commit on Tab and leaves the key to the browser", () => {
    const onCommit = vi.fn();
    render(
      <DataTableCellEditor aria-label="Edit" value="a" onCommit={onCommit} onCancel={vi.fn()} />,
    );

    const input = screen.getByRole("textbox", { name: "Edit" });
    fireEvent.change(input, { target: { value: "b" } });

    expect(fireEvent.keyDown(input, { key: "Tab" })).toBe(true);
    expect(onCommit).toHaveBeenCalledWith("b");
  });

  it("hands Tab to onNavigate with its direction after committing", () => {
    const onCommit = vi.fn();
    const onNavigate = vi.fn((_direction: string, event: React.KeyboardEvent) =>
      event.preventDefault(),
    );
    render(
      <DataTableCellEditor
        aria-label="Edit"
        value="a"
        onCommit={onCommit}
        onCancel={vi.fn()}
        onNavigate={onNavigate}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Edit" });
    expect(fireEvent.keyDown(input, { key: "Tab", shiftKey: true })).toBe(false);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("previous", expect.anything());
  });
});

describe("DataTable focus after a key that moved nowhere", () => {
  // ArrowDown on the last row, ArrowUp on the first, Home on the first, End on the last and a
  // PageUp/PageDown that clamps all change nothing, so no render follows to settle the focus request
  // they left behind. The next render for any other reason must not honour it: typing into a filter
  // that lives in the same parent re-renders the table on every keystroke.
  function Harness() {
    const [filter, setFilter] = React.useState("");
    return (
      <>
        <input
          aria-label="Filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <DataTable columns={columns} rows={people} getRowId={rowId} />
      </>
    );
  }

  it.each([
    ["ArrowDown", "r3", "{ArrowDown}"],
    ["End", "r3", "{End}"],
    ["PageDown", "r3", "{PageDown}"],
    ["ArrowUp", "r1", "{ArrowUp}"],
    ["Home", "r1", "{Home}"],
    ["PageUp", "r1", "{PageUp}"],
  ])(
    "%s at the end of the list leaves the focus where the user puts it next",
    async (_key, rowIdAtEdge, keys) => {
      const user = userEvent.setup();
      const { container } = render(<Harness />);

      container.querySelector<HTMLElement>(`tbody tr[data-row-id="${rowIdAtEdge}"]`)!.focus();
      await user.keyboard(keys);

      const filter = screen.getByRole("textbox", { name: "Filter" });
      await user.click(filter);
      await user.keyboard("abc");

      expect(document.activeElement).toBe(filter);
      expect((filter as HTMLInputElement).value).toBe("abc");
    },
  );

  it("does not pull focus off the pager after a boundary key", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DataTable columns={columns} rows={manyPeople} getRowId={rowId} />,
    );

    container.querySelector<HTMLElement>('tbody tr[data-row-id="p1"]')!.focus();
    await user.keyboard("{ArrowUp}");

    const next = screen.getByRole("button", { name: "Go to next page" });
    await user.click(next);

    expect(screen.getByText(/Page 2 of 3/)).toBeDefined();
    expect(document.activeElement).toBe(next);
  });

  it("still moves to the neighbouring row on the spot", async () => {
    const user = userEvent.setup();
    const { container } = render(<DataTable columns={columns} rows={people} getRowId={rowId} />);

    container.querySelector<HTMLElement>('tbody tr[data-row-id="r1"]')!.focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(container.querySelector('tr[data-row-id="r2"]'));
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(container.querySelector('tr[data-row-id="r3"]'));
  });
});

describe("DataTable focus when its focused row goes away", () => {
  const ignore: DataTableRowAction<Person> = { tag: "ignore", label: "Ignore" };
  const menu: DataTableRowAction<Person>[] = [
    {
      tag: "more",
      label: "More actions",
      children: [
        { tag: "archive", label: "Archive" },
        { tag: "delete", label: "Delete" },
      ],
    },
  ];

  let setRowsFromOutside: (rows: Person[]) => void = () => undefined;
  function Removable({ actions }: { actions: DataTableRowAction<Person>[] }) {
    const [rows, setRows] = React.useState(people);
    setRowsFromOutside = setRows;
    return (
      <>
        <input aria-label="Elsewhere" />
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={rowId}
          rowActions={actions}
          onRowAction={({ id, tag }) => {
            if (tag === "archive") return;
            setRows((current) => current.filter((row) => row.id !== id));
          }}
        />
      </>
    );
  }

  const rowFor = (container: HTMLElement, id: string): HTMLElement | null =>
    container.querySelector<HTMLElement>(`tbody tr[data-row-id="${id}"]`);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

  it("moves focus to the row that took its place instead of dropping it to <body>", async () => {
    const user = userEvent.setup();
    const { container } = render(<Removable actions={[ignore]} />);

    screen.getAllByRole("button", { name: "Ignore" })[1].focus();
    await user.keyboard("{Enter}");

    expect(rowFor(container, "r2")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(rowFor(container, "r3")));
    // And the arrow keys carry on from there.
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(rowFor(container, "r1"));
  });

  it("falls back to the new last row when the last row was the one removed", async () => {
    const user = userEvent.setup();
    const { container } = render(<Removable actions={[ignore]} />);

    screen.getAllByRole("button", { name: "Ignore" })[2].focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(document.activeElement).toBe(rowFor(container, "r2")));
  });

  it("does the same when the action was a menu item that removed the row", async () => {
    const user = userEvent.setup();
    const { container } = render(<Removable actions={menu} />);

    screen.getAllByRole("button", { name: "More actions" })[1].focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(rowFor(container, "r2")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(rowFor(container, "r3")));
  });

  it("leaves focus on the trigger when a menu item did not remove anything", async () => {
    const user = userEvent.setup();
    render(<Removable actions={menu} />);

    const trigger = screen.getAllByRole("button", { name: "More actions" })[0];
    trigger.focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await settle();
    expect(document.activeElement).toBe(trigger);
  });

  it("does not take focus from a control the user has moved to", async () => {
    const user = userEvent.setup();
    const { container } = render(<Removable actions={[ignore]} />);

    rowFor(container, "r2")!.focus();
    const elsewhere = screen.getByRole("textbox", { name: "Elsewhere" });
    await user.click(elsewhere);

    act(() => setRowsFromOutside(people.filter((row) => row.id !== "r2")));
    await settle();

    expect(rowFor(container, "r2")).toBeNull();
    expect(document.activeElement).toBe(elsewhere);
  });

  it("does not take focus back after the user clicked away to nothing in particular", async () => {
    const { container } = render(<Removable actions={[ignore]} />);

    const row = rowFor(container, "r2")!;
    row.focus();
    act(() => row.blur());
    expect(document.activeElement).toBe(document.body);

    act(() => setRowsFromOutside(people.filter((other) => other.id !== "r2")));
    await settle();

    expect(document.activeElement).toBe(document.body);
  });

  it("copes with the last row going away", async () => {
    render(<Removable actions={[ignore]} />);

    screen.getAllByRole("button", { name: "Ignore" })[0].focus();
    act(() => setRowsFromOutside([]));
    await settle();

    expect(screen.getByText("No results.")).toBeDefined();
  });
});

describe("DataTable row click and portaled content", () => {
  const menuActions: DataTableRowAction<Person>[] = [
    { tag: "more", label: "More actions", children: [{ tag: "archive", label: "Archive" }] },
  ];

  it("ignores a click inside a row action's open menu that is not on an item", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={[people[0]]}
        getRowId={rowId}
        rowActions={menuActions}
        onRowClick={onRowClick}
      />,
    );

    await user.click(screen.getByRole("button", { name: "More actions" }));
    const menu = await screen.findByRole("menu");
    fireEvent.click(menu);

    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("ignores clicks inside a dialog that a cell opened", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={[
          ...columns,
          {
            name: "open",
            header: "Open",
            cell: () => (
              <DialogPrimitive.Root open>
                <DialogPrimitive.Portal>
                  <DialogPrimitive.Content aria-describedby={undefined}>
                    <DialogPrimitive.Title>Details</DialogPrimitive.Title>
                    <p>Some words in the dialog</p>
                    <button>Confirm</button>
                  </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
              </DialogPrimitive.Root>
            ),
          },
        ]}
        rows={[people[0]]}
        getRowId={rowId}
        onRowClick={onRowClick}
      />,
    );

    await user.click(await screen.findByText("Some words in the dialog"));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onRowClick).not.toHaveBeenCalled();

    fireEvent.click(document.querySelector("tbody td")!);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });
});

describe("DataTable consumer handlers", () => {
  it("runs a consumer onKeyDown without switching the row keyboard map off", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    const { container } = render(
      <DataTable columns={columns} rows={people} getRowId={rowId} onKeyDown={onKeyDown} />,
    );

    container.querySelector<HTMLElement>('tbody tr[data-row-id="r1"]')!.focus();
    await user.keyboard("{ArrowDown}");

    expect(onKeyDown).toHaveBeenCalled();
    expect(document.activeElement).toBe(container.querySelector('tr[data-row-id="r2"]'));
  });

  it("lets a consumer onKeyDown take a key for itself", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DataTable
        columns={columns}
        rows={people}
        getRowId={rowId}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") event.preventDefault();
        }}
      />,
    );

    const first = container.querySelector<HTMLElement>('tbody tr[data-row-id="r1"]')!;
    first.focus();
    await user.keyboard("{ArrowDown}");

    expect(document.activeElement).toBe(first);
  });

  it("runs a consumer onFocus and onBlur too", () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const { container } = render(
      <DataTable
        columns={columns}
        rows={people}
        getRowId={rowId}
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    );

    const row = container.querySelector<HTMLElement>('tbody tr[data-row-id="r1"]')!;
    act(() => row.focus());
    act(() => row.blur());

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe("DataTable row index under manual pagination", () => {
  const pageTwo: Person[] = Array.from({ length: 25 }, (_, index) => ({
    id: `m${index + 26}`,
    name: `Person ${index + 26}`,
    status: "Active",
    score: index,
  }));

  it("reports each row's absolute position, not its position on the page", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        rows={pageTwo}
        getRowId={rowId}
        manualPagination
        rowCount={100}
        page={2}
        pageSize={25}
      />,
    );

    const indexes = Array.from(container.querySelectorAll("tbody tr")).map((row) =>
      row.getAttribute("aria-rowindex"),
    );
    expect(container.querySelector("table")!.getAttribute("aria-rowcount")).toBe("100");
    expect(indexes[0]).toBe("26");
    expect(indexes[24]).toBe("50");
  });

  it("starts at 1 on the first page and when the table is not paginated", () => {
    const first = render(
      <DataTable
        columns={columns}
        rows={pageTwo}
        getRowId={rowId}
        manualPagination
        rowCount={100}
        page={1}
        pageSize={25}
      />,
    );
    expect(first.container.querySelector("tbody tr")!.getAttribute("aria-rowindex")).toBe("1");
    first.unmount();

    const unpaged = render(
      <DataTable columns={columns} rows={manyPeople} getRowId={rowId} paginated={false} />,
    );
    expect(unpaged.container.querySelector("tbody tr")!.getAttribute("aria-rowindex")).toBe("1");
  });
});

describe("DataTable inline editing and focus", () => {
  const editableColumns: DataTableColumn<Person>[] = [
    { name: "name", header: "Name", editable: true },
    { name: "status", header: "Status", editable: true },
  ];

  function Harness({ onCellCommit = vi.fn() }: { onCellCommit?: () => void }) {
    return (
      <>
        <input aria-label="Other field" />
        <button>Save</button>
        <DataTable
          columns={editableColumns}
          rows={[people[0]]}
          getRowId={rowId}
          editable
          onCellCommit={onCellCommit}
        />
      </>
    );
  }

  /** Every element that gets focus from now on, in order. */
  function recordFocus(): { targets: HTMLElement[]; stop: () => void } {
    const targets: HTMLElement[] = [];
    const listener = (event: Event) => targets.push(event.target as HTMLElement);
    document.addEventListener("focusin", listener, true);
    return { targets, stop: () => document.removeEventListener("focusin", listener, true) };
  }

  const cells = () => screen.getAllByRole("button", { name: /^Edit / });

  it("lets the control that was clicked take focus when it commits the edit", async () => {
    const user = userEvent.setup();
    const onCellCommit = vi.fn();
    render(<Harness onCellCommit={onCellCommit} />);

    fireEvent.dblClick(cells()[0]);
    const input = screen.getByRole("textbox", { name: "Edit Name" });
    await user.clear(input);
    await user.type(input, "Charlotte");

    const record = recordFocus();
    const other = screen.getByRole("textbox", { name: "Other field" });
    await user.click(other);
    record.stop();

    expect(onCellCommit).toHaveBeenCalledWith(expect.objectContaining({ value: "Charlotte" }));
    expect(document.activeElement).toBe(other);
    // The cell was not given focus in passing, which is what cancels the user's own move in a
    // browser: it blocks the focus change that is under way when a blur handler moves focus.
    expect(record.targets.filter((element) => element.getAttribute("role") === "button")).toEqual(
      [],
    );
  });

  it("lets another editable cell take focus when it is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    fireEvent.dblClick(cells()[0]);
    const input = screen.getByRole("textbox", { name: "Edit Name" });
    await user.type(input, "!");

    const record = recordFocus();
    const status = screen.getByRole("button", { name: /^Edit Status/ });
    await user.click(status);
    record.stop();

    expect(document.activeElement).toBe(status);
    expect(
      record.targets.filter((element) =>
        element.getAttribute("aria-label")?.startsWith("Edit Name"),
      ),
    ).toEqual([]);
  });

  it("gives focus back to the cell when it went nowhere in particular", () => {
    render(<Harness />);

    fireEvent.dblClick(cells()[0]);
    const input = screen.getByRole("textbox", { name: "Edit Name" });
    fireEvent.change(input, { target: { value: "Charlotte" } });
    fireEvent.blur(input);

    expect(screen.queryByRole("textbox", { name: "Edit Name" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Edit Name/ }));
  });

  it("tells a standalone editor's host where focus went", () => {
    const onCommit = vi.fn();
    render(
      <>
        <DataTableCellEditor aria-label="Edit" value="a" onCommit={onCommit} onCancel={vi.fn()} />
        <button>Elsewhere</button>
      </>,
    );

    const input = screen.getByRole("textbox", { name: "Edit" });
    fireEvent.change(input, { target: { value: "b" } });
    act(() => screen.getByRole("button", { name: "Elsewhere" }).focus());

    expect(onCommit).toHaveBeenCalledTimes(1);
    const blur = onCommit.mock.calls[0][1] as React.FocusEvent;
    expect(onCommit.mock.calls[0][0]).toBe("b");
    expect(blur.relatedTarget).toBe(screen.getByRole("button", { name: "Elsewhere" }));
  });

  it("names an editable cell after its value, so a screen reader still hears it", () => {
    render(
      <DataTable
        columns={[
          { name: "name", header: "Name", editable: true },
          { name: "note", header: "Note", editable: true },
        ]}
        rows={[{ id: "x", name: "Charlie", note: "" } as unknown as Person]}
        getRowId={rowId}
        editable
      />,
    );

    expect(screen.getByRole("button", { name: "Edit Name: Charlie" })).toBeDefined();
    // Nothing to read: no dangling colon.
    expect(screen.getByRole("button", { name: "Edit Note" })).toBeDefined();
  });

  it("lets the pinned cells outline themselves in forced colors, where shadows are not painted", () => {
    const { container } = render(
      <DataTable
        columns={editableColumns}
        rows={[people[0]]}
        getRowId={rowId}
        selectable
        rowActions={[{ tag: "edit", label: "Edit" }]}
      />,
    );

    const row = container.querySelector("tbody tr")!;
    expect(row.className).toContain("forced-colors:focus-visible:[&>[data-pin]]:outline-2");
    expect(row.className).toContain("forced-colors:focus-visible:[&>[data-pin]]:-outline-offset-2");
    // The shadow edges stay for the normal case.
    expect(row.className).toContain("focus-visible:[&>[data-pin=start]]:inset-shadow-");
  });

  it("only hides the focus outline while focused, so forced colors boxes no idle cell", () => {
    render(<Harness />);

    for (const cell of cells()) {
      const tokens = cell.className.split(/\s+/);
      expect(tokens).toContain("focus-visible:outline-hidden");
      expect(tokens).not.toContain("outline-hidden");
    }
  });
});

describe("DataTable Escape inside an overlay", () => {
  const editableColumns: DataTableColumn<Person>[] = [
    { name: "name", header: "Name", editable: true },
  ];

  function InDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Edit people</DialogTitle>
          <DialogDescription>Rename a person.</DialogDescription>
          <DataTable columns={editableColumns} rows={[people[0]]} getRowId={rowId} editable />
        </DialogContent>
      </Dialog>
    );
  }

  it("cancels the edit and leaves the dialog open; the next Escape closes the dialog", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<InDialog onOpenChange={onOpenChange} />);

    fireEvent.dblClick(screen.getByRole("button", { name: /^Edit Name/ }));
    const input = screen.getByRole("textbox", { name: "Edit Name" });
    await user.type(input, "xyz");
    await user.keyboard("{Escape}");

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Edit Name" })).toBeNull();
    const cell = screen.getByRole("button", { name: "Edit Name: Charlie" });
    expect(document.activeElement).toBe(cell);

    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not take an Escape pressed somewhere else", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <>
        <button>Elsewhere</button>
        <DataTableCellEditor aria-label="Edit" value="a" onCommit={vi.fn()} onCancel={onCancel} />
      </>,
    );

    // Escape from another control is none of the editor's business.
    fireEvent.keyDown(screen.getByRole("button", { name: "Elsewhere" }), { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();

    await user.click(screen.getByRole("textbox", { name: "Edit" }));
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("leaves an Escape during IME composition to the input method", () => {
    const onCancel = vi.fn();
    render(
      <DataTableCellEditor aria-label="Edit" value="a" onCommit={vi.fn()} onCancel={onCancel} />,
    );

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Edit" }), {
      key: "Escape",
      isComposing: true,
    });

    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe("DataTable accessibility details", () => {
  it("names the column-options popover", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={people} getRowId={rowId} showColumnOptions />);

    await user.click(screen.getByRole("button", { name: "Column options" }));

    expect(await screen.findByRole("dialog", { name: "Column options" })).toBeDefined();
  });

  it("shows a mixed select-all box while some, but not all, rows are selected", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={people} getRowId={rowId} selectable />);

    const all = screen.getByRole("checkbox", { name: "Select all rows" });
    expect(all.getAttribute("aria-checked")).toBe("false");

    await user.click(screen.getByRole("checkbox", { name: "Select row r1" }));
    expect(all.getAttribute("aria-checked")).toBe("mixed");

    // Clicking a mixed box completes the selection, and a full one clears it.
    await user.click(all);
    expect(all.getAttribute("aria-checked")).toBe("true");
    for (const id of ["r1", "r2", "r3"]) {
      expect(
        screen.getByRole("checkbox", { name: `Select row ${id}` }).getAttribute("aria-checked"),
      ).toBe("true");
    }
    await user.click(all);
    expect(all.getAttribute("aria-checked")).toBe("false");

    // From unchecked a click still selects everything rather than cycling through "mixed".
    await user.click(all);
    expect(all.getAttribute("aria-checked")).toBe("true");
  });

  it("names a selection checkbox after the row when getRowLabel says how", () => {
    render(
      <DataTable
        columns={columns}
        rows={people}
        getRowId={rowId}
        getRowLabel={(row) => row.name}
        selectable
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Select row Charlie" })).toBeDefined();
    expect(screen.queryByRole("checkbox", { name: "Select row r1" })).toBeNull();
  });

  it("uses text-safe destructive colours for destructive actions", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns}
        rows={[people[0]]}
        getRowId={rowId}
        rowActions={[
          { tag: "decline", label: "Decline", variant: "destructive" },
          {
            tag: "more",
            label: "More actions",
            children: [{ tag: "delete", label: "Delete", variant: "destructive" }],
          },
        ]}
      />,
    );

    // `text-destructive` is a fill colour: 2.0:1 as text in the dark theme.
    const decline = screen.getByRole("button", { name: "Decline" });
    expect(decline.className).toContain("text-[var(--destructive-800)]");
    expect(decline.className).toContain("dark:text-[var(--destructive-200)]");
    expect(decline.className).not.toMatch(/(^|\s)text-destructive(\s|$)/);

    await user.click(screen.getByRole("button", { name: "More actions" }));
    const item = await screen.findByRole("menuitem", { name: "Delete" });
    expect(item.className).toContain("text-[var(--destructive-800)]");
    expect(item.className).not.toMatch(/(^|\s)text-destructive(\s|$)/);
  });

  it("keeps the unsorted sort icon at a contrast a control needs", () => {
    const { container } = render(<DataTable columns={columns} rows={people} getRowId={rowId} />);

    const icon = container.querySelector("thead svg")!;
    expect(icon.getAttribute("class")).toContain("text-muted-foreground/80");
    expect(icon.getAttribute("class")).not.toContain("text-muted-foreground/60");
  });

  it("marks truncating cells, and lets a keyboard-focused row show them in full", () => {
    const { container } = render(
      <DataTable
        columns={[
          { name: "name", header: "Name" },
          { name: "status", header: "Status", wrapText: true },
          { name: "score", header: "Score", align: "Right" },
        ]}
        rows={[people[0]]}
        getRowId={rowId}
      />,
    );

    const cells = Array.from(container.querySelectorAll("tbody td"));
    expect(cells[0].hasAttribute("data-truncate")).toBe(true);
    expect(cells[1].hasAttribute("data-truncate")).toBe(false);
    expect(cells[2].hasAttribute("data-truncate")).toBe(false);

    const row = container.querySelector("tbody tr")!;
    expect(row.className).toContain("focus-visible:[&>[data-truncate]]:whitespace-normal");
    expect(row.className).toContain("has-focus-visible:[&>[data-truncate]]:whitespace-normal");
  });

  it("leaves room above the toolbar of a flush card so its focus ring is not clipped", () => {
    render(
      <CardContent flush>
        <DataTable
          columns={columns}
          rows={people}
          getRowId={rowId}
          toolbar={{ left: <span>filters</span> }}
        />
      </CardContent>,
    );

    const toolbar = screen.getByText("filters").parentElement!.parentElement!;
    expect(toolbar.className).toContain("px-6");
    expect(toolbar.className).toContain("pt-1.5");
  });
});

describe("DataTable pagination on a phone", () => {
  it("stacks the count, the page-size select and the buttons below 24rem of its own width", () => {
    const { container } = render(
      <DataTable columns={columns} rows={manyPeople} getRowId={rowId} />,
    );

    const grid = container.querySelector("nav > div")!;
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("@[24rem]:grid-cols-[minmax(0,1fr)_auto]");
    const buttons = screen.getByRole("button", { name: "Go to first page" }).parentElement!;
    expect(buttons.className).toContain("col-span-full");
  });

  it("soft-disables the boundary buttons through the shared Button, not by hand", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={manyPeople}
        getRowId={rowId}
        page={1}
        onPageChange={onPageChange}
      />,
    );

    const first = screen.getByRole("button", { name: "Go to first page" });
    expect(first.getAttribute("aria-disabled")).toBe("true");
    expect(first.hasAttribute("disabled")).toBe(false);
    expect(first.hasAttribute("data-disabled")).toBe(true);

    first.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    await user.click(first);
    expect(onPageChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(first);
  });
});
