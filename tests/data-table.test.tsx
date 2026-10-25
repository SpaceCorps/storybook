import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  DataTable,
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

function isDisabled(name: string): boolean {
  return (screen.getByRole("button", { name }) as HTMLButtonElement).disabled;
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
    render(<DataTable columns={columns} rows={people} getRowId={rowId} caption="Open invoices" />);

    const caption = screen.getByText("Open invoices");
    expect(caption.tagName).toBe("CAPTION");
    expect(caption.className).toContain("sr-only");
    expect(screen.getByRole("table", { name: "Open invoices" })).toBeDefined();
  });

  it("renders as a visible line above the table with showCaption", () => {
    render(
      <DataTable
        columns={columns}
        rows={people}
        getRowId={rowId}
        caption="Open invoices"
        showCaption
      />,
    );

    const caption = screen.getByText("Open invoices");
    expect(caption.className).not.toContain("sr-only");
    expect(caption.className).toContain("caption-top");
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
    expect(table.className).toContain("[&_thead_th]:bg-background");
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
    fireEvent.dblClick(screen.getByRole("button", { name: "Edit Name" }));
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
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit Name" }));
  });

  it("discards the draft on Escape and releases focus to the cell", () => {
    const { onCellCommit } = renderEditable();

    const input = openEditor();
    fireEvent.change(input, { target: { value: "Charlotte" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCellCommit).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Edit Name" })).toBeNull();

    const cell = screen.getByRole("button", { name: "Edit Name" });
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

  it("traps Tab inside the editor without committing", () => {
    const { onCellCommit } = renderEditable();

    const input = openEditor();
    fireEvent.change(input, { target: { value: "Charlotte" } });
    const notPrevented = fireEvent.keyDown(input, { key: "Tab" });

    expect(notPrevented).toBe(false);
    expect(document.activeElement).toBe(input);
    expect(onCellCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Edit Name" })).toBeDefined();
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
    expect(screen.queryByRole("button", { name: "Edit Name" })).toBeNull();
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
