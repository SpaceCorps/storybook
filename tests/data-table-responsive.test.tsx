import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  DataTable,
  DataTableColumnOptions,
  DataTableRowDetail,
  DataTableRowExpander,
  type DataTableColumn,
  type DataTableRowAction,
} from "../src/components/ui/data-table";

interface Entry {
  id: string;
  date: string;
  hours: number;
  project: string | null;
  status: string;
  note: string;
}

const entries: Entry[] = [
  { id: "r1", date: "2026-10-24", hours: 1.5, project: "Alpha", status: "Done", note: "First" },
  { id: "r2", date: "2026-10-23", hours: 3, project: null, status: "Open", note: "Second" },
  { id: "r3", date: "2026-10-22", hours: 2, project: "Gamma", status: "Done", note: "Third" },
];

const columns: DataTableColumn<Entry>[] = [
  { name: "date", header: "Date" },
  { name: "hours", header: "Hours", align: "Right", cell: (value) => `${value as number} h` },
  { name: "project", header: "Project", hideBelow: 600 },
  {
    name: "status",
    header: "Status",
    hideBelow: 600,
    cell: (value) => <strong data-testid="status-cell">{value as string}</strong>,
  },
  { name: "note", header: "Note", hideBelow: 800 },
];

const id = (row: Entry): string => row.id;
const label = (row: Entry): string => `${row.date} ${row.note}`;

/**
 * A `ResizeObserver` the test can drive. Only the observers that watch the table's wrapper are told
 * about a resize, the way a browser tells each observer about the elements it was given.
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
  emitEntry(entry: unknown) {
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  watches(target: Element) {
    return this.targets.has(target);
  }
}

const wrapperOf = (container: HTMLElement): HTMLElement =>
  container.querySelector<HTMLElement>("[data-slot='data-table']")!;

/** The container becomes this wide, as far as the table can tell. */
function resizeTo(container: HTMLElement, width: number) {
  const wrapper = wrapperOf(container);
  act(() => {
    for (const observer of FakeResizeObserver.all) {
      if (observer.watches(wrapper)) observer.emit(wrapper, width);
    }
  });
}

/** The headers of the data columns: not the pinned selection/details and action cells. */
function dataHeaders(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("thead th:not([data-pin])")).map(
    (th) => th.textContent?.trim() ?? "",
  );
}

function expanders(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>("button[aria-label^='Show details for']"),
  );
}

function detailRow(container: HTMLElement, rowId: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`tr[data-detail-for='${rowId}']`);
}

function detailPairs(row: HTMLElement): Array<[string | null, string | null]> {
  return Array.from(row.querySelectorAll("dt")).map((dt) => [
    dt.textContent,
    dt.nextElementSibling?.textContent ?? null,
  ]);
}

function renderTable(props: Partial<React.ComponentProps<typeof DataTable<Entry>>> = {}) {
  return render(
    <DataTable columns={columns} rows={entries} getRowId={id} getRowLabel={label} {...props} />,
  );
}

beforeEach(() => {
  FakeResizeObserver.all.clear();
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DataTable columns hidden by width: what is measured", () => {
  it("assumes the narrow case until the container has been measured", () => {
    const { container } = renderTable();

    expect(dataHeaders(container)).toEqual(["Date", "Hours"]);
    expect(expanders(container)).toHaveLength(entries.length);
  });

  it("renders the narrow case on the server, where nothing can be measured, without a warning", () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const html = renderToString(
        <DataTable columns={columns} rows={entries} getRowId={id} getRowLabel={label} />,
      );
      const doc = new DOMParser().parseFromString(html, "text/html");

      expect(
        Array.from(doc.querySelectorAll("thead th:not([data-pin])")).map((th) =>
          th.textContent?.trim(),
        ),
      ).toEqual(["Date", "Hours"]);
      expect(doc.querySelectorAll("button[aria-label^='Show details for']")).toHaveLength(3);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("measures the wrapper synchronously on mount, so the first paint is already the right one", () => {
    // No resize is ever delivered here: the width comes from the first read alone.
    const read = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockImplementation(function (this: HTMLElement) {
        return this.dataset.slot === "data-table" ? 900 : 0;
      });
    try {
      const { container } = renderTable();
      expect(dataHeaders(container)).toEqual(["Date", "Hours", "Project", "Status", "Note"]);
      expect(expanders(container)).toHaveLength(0);
    } finally {
      read.mockRestore();
    }
  });

  it("reads the layout width, which a transform on a host that is zooming in does not change", () => {
    const layout = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockImplementation(function (this: HTMLElement) {
        return this.dataset.slot === "data-table" ? 900 : 0;
      });
    // What a zoom-in animation would make of it: 95% of the layout width.
    const painted = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const width = this.dataset.slot === "data-table" ? 855 : 0;
        return {
          width,
          height: 0,
          top: 0,
          left: 0,
          right: width,
          bottom: 0,
          x: 0,
          y: 0,
        } as DOMRect;
      });
    try {
      // Note gives way below 880: the layout width (900) keeps it, the painted one (855) would not.
      const columnsNearTheEdge = columns.map((column) =>
        column.name === "note" ? { ...column, hideBelow: 880 } : column,
      );
      const { container } = renderTable({ columns: columnsNearTheEdge });
      expect(dataHeaders(container)).toEqual(["Date", "Hours", "Project", "Status", "Note"]);
    } finally {
      layout.mockRestore();
      painted.mockRestore();
    }
  });

  it("takes the width from the observer entry's border box when it has one", () => {
    const { container } = renderTable();
    const wrapper = wrapperOf(container);

    act(() => {
      for (const observer of FakeResizeObserver.all) {
        if (observer.watches(wrapper)) {
          observer.emitEntry({
            target: wrapper,
            borderBoxSize: [{ inlineSize: 1000, blockSize: 10 }],
            contentRect: { width: 100 },
          });
        }
      }
    });

    expect(dataHeaders(container)).toEqual(["Date", "Hours", "Project", "Status", "Note"]);
  });

  it("follows the container as it resizes, and shows everything once it is wide enough", () => {
    const { container } = renderTable();

    resizeTo(container, 1000);
    expect(dataHeaders(container)).toEqual(["Date", "Hours", "Project", "Status", "Note"]);
    expect(expanders(container)).toHaveLength(0);

    resizeTo(container, 700);
    expect(dataHeaders(container)).toEqual(["Date", "Hours", "Project", "Status"]);
    expect(expanders(container)).toHaveLength(entries.length);

    resizeTo(container, 500);
    expect(dataHeaders(container)).toEqual(["Date", "Hours"]);

    resizeTo(container, 1000);
    expect(dataHeaders(container)).toEqual(["Date", "Hours", "Project", "Status", "Note"]);
  });

  it("keeps a column hidden through a wobble at its threshold, and brings it back past the margin", () => {
    const { container } = renderTable();

    resizeTo(container, 590);
    expect(dataHeaders(container)).toEqual(["Date", "Hours"]);
    resizeTo(container, 610);
    expect(dataHeaders(container)).toEqual(["Date", "Hours"]);
    resizeTo(container, 590);
    resizeTo(container, 622);
    expect(dataHeaders(container)).toEqual(["Date", "Hours"]);
    resizeTo(container, 640);
    expect(dataHeaders(container)).toEqual(["Date", "Hours", "Project", "Status"]);
  });

  it("takes the first measurement at face value: the narrow guess is not a decision to be steady about", () => {
    const { container } = renderTable();

    // 610 is past the 600 threshold, margin or no margin.
    resizeTo(container, 610);

    expect(dataHeaders(container)).toEqual(["Date", "Hours", "Project", "Status"]);
  });

  it("ignores a width of 0, which is a hidden element and not a measurement", () => {
    const { container } = renderTable();

    resizeTo(container, 1000);
    resizeTo(container, 0);
    expect(dataHeaders(container)).toEqual(["Date", "Hours", "Project", "Status", "Note"]);
  });

  it("does not observe anything for a table with no hideBelow or priority", () => {
    const { container } = renderTable({
      columns: columns.map(({ name, header }) => ({ name, header })),
    });

    const wrapper = wrapperOf(container);
    expect(Array.from(FakeResizeObserver.all).some((observer) => observer.watches(wrapper))).toBe(
      false,
    );
    expect(dataHeaders(container)).toEqual(["Date", "Hours", "Project", "Status", "Note"]);
    expect(expanders(container)).toHaveLength(0);
    expect(container.querySelector("[data-pin]")).toBeNull();
  });

  it("stops observing when it unmounts", () => {
    const { container, unmount } = renderTable();
    const wrapper = wrapperOf(container);
    expect(Array.from(FakeResizeObserver.all).some((observer) => observer.watches(wrapper))).toBe(
      true,
    );

    unmount();

    expect(Array.from(FakeResizeObserver.all).some((observer) => observer.watches(wrapper))).toBe(
      false,
    );
  });

  it("ranks columns by priority and measures the same way", () => {
    const ranked: DataTableColumn<Entry>[] = [
      { name: "date", header: "Date", priority: 1, width: "100px" },
      { name: "hours", header: "Hours", priority: 2, width: "80px" },
      { name: "note", header: "Note", priority: 3, width: "300px" },
    ];
    const { container } = renderTable({ columns: ranked });

    resizeTo(container, 800);
    expect(dataHeaders(container)).toEqual(["Date", "Hours", "Note"]);
    // 36px for the details button leaves 180 + 36 for two columns and no room for the 300px note.
    resizeTo(container, 400);
    expect(dataHeaders(container)).toEqual(["Date", "Hours"]);
    expect(expanders(container)).toHaveLength(entries.length);
  });

  it("does not spend the room of a column the person switched off", () => {
    const ranked: DataTableColumn<Entry>[] = [
      { name: "date", header: "Date", priority: 1, width: "100px" },
      // More important than Note, and 100px wide: counted, it would push Note out of 300px.
      { name: "hours", header: "Hours", priority: 2, width: "100px" },
      { name: "note", header: "Note", priority: 3, width: "100px" },
    ];
    const { container } = renderTable({ columns: ranked, columnVisibility: { hours: false } });

    // Date and Note are 200px, and the details button's 36px leaves room to spare in 300px.
    resizeTo(container, 300);

    expect(dataHeaders(container)).toEqual(["Date", "Note"]);
    expect(expanders(container)).toHaveLength(0);
  });
});

describe("DataTable columns hidden by width: the columns change under a width that has not", () => {
  // 36px for the details button and 100px a column: 300px holds two of the three, never all three.
  const ranked: DataTableColumn<Entry>[] = [
    { name: "date", header: "Date", priority: 1, width: "100px" },
    { name: "hours", header: "Hours", priority: 2, width: "100px" },
    { name: "note", header: "Note", priority: 3, width: "100px" },
  ];
  const tableOf = (
    columnsOf: DataTableColumn<Entry>[],
    props: Partial<React.ComponentProps<typeof DataTable<Entry>>> = {},
  ) => (
    <DataTable columns={columnsOf} rows={entries} getRowId={id} getRowLabel={label} {...props} />
  );

  it("brings back the next column when the person unticks one in the options menu", async () => {
    const { container } = render(tableOf(ranked, { showColumnOptions: true }));
    resizeTo(container, 300);
    expect(dataHeaders(container)).toEqual(["Date", "Hours"]);

    fireEvent.click(screen.getByRole("button", { name: "Column options" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Hours" }));

    // Date and Note are 200px and fit as they are: no resize was needed to see that.
    expect(dataHeaders(container)).toEqual(["Date", "Note"]);
    expect(expanders(container)).toHaveLength(0);
  });

  it("fits what is left when the caller hides a column, at the width it already measured", () => {
    const { container, rerender } = render(tableOf(ranked, { columnVisibility: {} }));
    resizeTo(container, 300);
    expect(dataHeaders(container)).toEqual(["Date", "Hours"]);

    rerender(tableOf(ranked, { columnVisibility: { hours: false } }));

    expect(dataHeaders(container)).toEqual(["Date", "Note"]);
    expect(expanders(container)).toHaveLength(0);
  });

  it("keeps one column showing when the width has taken all that remain", () => {
    const { container, rerender } = render(tableOf(ranked, { columnVisibility: {} }));
    // Room for nothing: only the most important column is kept, and the other two are in the details.
    resizeTo(container, 50);
    expect(dataHeaders(container)).toEqual(["Date"]);

    // Date goes, and what is left is all width-hidden: the next most important takes its place.
    rerender(tableOf(ranked, { columnVisibility: { date: false } }));

    expect(dataHeaders(container)).toEqual(["Hours"]);
    expect(expanders(container)).toHaveLength(entries.length);
    fireEvent.click(expanders(container)[0]);
    expect(detailPairs(detailRow(container, "r1")!).map(([name]) => name)).toEqual(["Note"]);
  });

  it("re-fits when the pinned columns change, which take their room out of the same width", () => {
    // 300px of columns and 36px of details button fit 360px; the selection checkbox's 40px does not.
    const { container, rerender } = render(tableOf(ranked));
    resizeTo(container, 360);
    expect(dataHeaders(container)).toEqual(["Date", "Hours", "Note"]);

    rerender(tableOf(ranked, { selectable: true }));

    expect(dataHeaders(container)).toEqual(["Date", "Hours"]);
    expect(expanders(container)).toHaveLength(entries.length);
  });

  it("never commits a table with no data column while it re-fits what is left", () => {
    // What the DOM holds at the end of each commit, read by a layout effect of the parent: the table's
    // own layout effect has already asked for the re-fit by then, and the re-render it causes comes
    // after this snapshot. Without the guard, the commit that follows hiding the kept column renders
    // none of the width-hidden ones, which is what the table's stale answer says.
    const commits: string[][] = [];
    function Snapshot({ children }: { children: React.ReactNode }) {
      const ref = React.useRef<HTMLDivElement>(null);
      React.useLayoutEffect(() => {
        commits.push(ref.current ? dataHeaders(ref.current) : []);
      });
      return <div ref={ref}>{children}</div>;
    }
    const shown = (visibility: Record<string, boolean>) => (
      <Snapshot>{tableOf(ranked, { columnVisibility: visibility })}</Snapshot>
    );

    const { container, rerender } = render(shown({}));
    resizeTo(container, 50);
    expect(dataHeaders(container)).toEqual(["Date"]);

    // Hours and Note were width-hidden; with Date switched off they are every column there is.
    commits.length = 0;
    rerender(shown({ date: false }));

    expect(commits).toHaveLength(1);
    expect(commits[0].length).toBeGreaterThan(0);
    expect(dataHeaders(container)).toEqual(["Hours"]);
  });

  it("follows a changed threshold, rank or width without the container changing", () => {
    const withNote = (change: Partial<DataTableColumn<Entry>>): DataTableColumn<Entry>[] =>
      ranked.map((column) => (column.name === "note" ? { ...column, ...change } : column));

    // hideBelow: 500px is below 600 and above 400.
    const below: DataTableColumn<Entry>[] = [
      { name: "date", header: "Date" },
      { name: "note", header: "Note", hideBelow: 600 },
    ];
    const thresholds = render(tableOf(below));
    resizeTo(thresholds.container, 500);
    expect(dataHeaders(thresholds.container)).toEqual(["Date"]);
    thresholds.rerender(tableOf([below[0], { ...below[1], hideBelow: 400 }]));
    expect(dataHeaders(thresholds.container)).toEqual(["Date", "Note"]);
    thresholds.unmount();

    // priority: Note outranks Hours from now on, so Hours is the one that gives way.
    const ranks = render(tableOf(ranked));
    resizeTo(ranks.container, 300);
    expect(dataHeaders(ranks.container)).toEqual(["Date", "Hours"]);
    ranks.rerender(
      tableOf(
        ranked.map((column) =>
          column.name === "hours"
            ? { ...column, priority: 3 }
            : column.name === "note"
              ? { ...column, priority: 2 }
              : column,
        ),
      ),
    );
    expect(dataHeaders(ranks.container)).toEqual(["Date", "Note"]);
    ranks.unmount();

    // width: a Note of 20px is cheap enough to keep, where one of 100px was not.
    const widths = render(tableOf(ranked));
    resizeTo(widths.container, 300);
    expect(dataHeaders(widths.container)).toEqual(["Date", "Hours"]);
    widths.rerender(tableOf(withNote({ width: "20px" })));
    expect(dataHeaders(widths.container)).toEqual(["Date", "Hours", "Note"]);
  });
});

describe("DataTable row details", () => {
  it("has a button in each row, named for the row and closed to start with", () => {
    const { container } = renderTable();
    resizeTo(container, 700);

    const first = screen.getByRole("button", { name: "Show details for 2026-10-24 First" });
    expect(first.getAttribute("aria-expanded")).toBe("false");
    // Not there yet, so nothing to point at.
    expect(first.hasAttribute("aria-controls")).toBe(false);
    expect(detailRow(container, "r1")).toBeNull();
    expect(expanders(container).map((button) => button.getAttribute("aria-label"))).toEqual([
      "Show details for 2026-10-24 First",
      "Show details for 2026-10-23 Second",
      "Show details for 2026-10-22 Third",
    ]);
  });

  it("falls back to the row id when there is no label, like the selection checkbox", () => {
    const { container } = renderTable({ getRowLabel: undefined });
    resizeTo(container, 700);

    expect(screen.getByRole("button", { name: "Show details for r2" })).toBeTruthy();
  });

  it("opens a panel listing exactly the hidden columns as header and value", () => {
    const { container } = renderTable();
    resizeTo(container, 700);

    fireEvent.click(screen.getByRole("button", { name: /Show details for 2026-10-24/ }));

    const panel = detailRow(container, "r1")!;
    // Note is hidden below 800 and the others show at 700: only it is missing from the row.
    expect(detailPairs(panel)).toEqual([["Note", "First"]]);

    resizeTo(container, 500);
    expect(detailPairs(detailRow(container, "r1")!)).toEqual([
      ["Project", "Alpha"],
      ["Status", "Done"],
      ["Note", "First"],
    ]);
  });

  it("renders each value with its column's own cell renderer", () => {
    const { container } = renderTable();
    resizeTo(container, 500);

    fireEvent.click(screen.getByRole("button", { name: /Show details for 2026-10-24/ }));

    const panel = detailRow(container, "r1")!;
    expect(within(panel).getByTestId("status-cell").tagName).toBe("STRONG");
    expect(within(panel).getByTestId("status-cell").textContent).toBe("Done");
  });

  it("shows a dash, announced as no value, for an empty one", () => {
    const { container } = renderTable();
    resizeTo(container, 500);

    fireEvent.click(screen.getByRole("button", { name: /Show details for 2026-10-23/ }));

    const project = within(detailRow(container, "r2")!).getByText("Project").nextElementSibling!;
    expect(project.textContent).toBe("—No value");
    expect(project.querySelector("[aria-hidden='true']")?.textContent).toBe("—");
    expect(project.querySelector(".sr-only")?.textContent).toBe("No value");
  });

  it("reports the state with aria-expanded and points aria-controls at the panel while it is open", () => {
    const { container } = renderTable();
    resizeTo(container, 700);
    const button = expanders(container)[0];

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const panel = detailRow(container, "r1")!;
    expect(button.getAttribute("aria-controls")).toBe(panel.querySelector("td")!.id);
    expect(panel.querySelector("td")!.id).not.toBe("");

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.hasAttribute("aria-controls")).toBe(false);
    expect(detailRow(container, "r1")).toBeNull();
  });

  it("points aria-controls at one id even when the row id holds spaces, and gives each panel its own", () => {
    // `aria-controls` is a list split at whitespace: an id built from "row 1" would name two elements.
    const { container } = renderTable({ getRowId: (row) => `row ${row.id}` });
    resizeTo(container, 700);
    const [first, second] = expanders(container);

    fireEvent.click(first);
    fireEvent.click(second);

    const ids = ["row r1", "row r2"].map(
      (rowId) => detailRow(container, rowId)!.querySelector("td")!.id,
    );
    expect(ids[0]).not.toBe(ids[1]);
    for (const id of ids) expect(id).not.toMatch(/\s/);
    expect(first.getAttribute("aria-controls")).toBe(ids[0]);
    expect(second.getAttribute("aria-controls")).toBe(ids[1]);
  });

  it("keeps the button's name when it opens, so the state is announced once", () => {
    const { container } = renderTable();
    resizeTo(container, 700);
    const button = expanders(container)[0];
    const name = button.getAttribute("aria-label");

    fireEvent.click(button);

    expect(button.getAttribute("aria-label")).toBe(name);
  });

  it("opens and closes with Enter and Space, and the button keeps focus", async () => {
    const user = userEvent.setup();
    const { container } = renderTable();
    resizeTo(container, 700);
    const button = expanders(container)[0];

    button.focus();
    await user.keyboard("{Enter}");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(button);

    await user.keyboard(" ");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("is reachable by Tab and does not take the row's own keys", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const { container } = renderTable({ onRowClick });
    resizeTo(container, 700);
    const button = expanders(container)[0];

    button.focus();
    await user.keyboard("{Enter}");
    fireEvent.click(expanders(container)[1]);

    // Neither the keyboard nor a click on the button is a click on the row.
    expect(onRowClick).not.toHaveBeenCalled();
    // The details row is not a data row: arrow keys on the row step over it.
    const rows = Array.from(container.querySelectorAll<HTMLElement>("tr[data-row-id]"));
    rows[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rows[1]);
  });

  it("opens several rows at once, and each stays with its row through a re-sort", () => {
    const { container } = renderTable();
    resizeTo(container, 700);

    fireEvent.click(expanders(container)[0]);
    fireEvent.click(expanders(container)[2]);
    expect(container.querySelectorAll("tr[data-detail-for]")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Hours ascending" }));

    const order = Array.from(container.querySelectorAll("tbody tr")).map(
      (row) =>
        (row as HTMLElement).dataset.rowId ?? `detail:${(row as HTMLElement).dataset.detailFor}`,
    );
    // r1 (1.5 h), r3 (2 h), r2 (3 h): each details row still follows its own row.
    expect(order).toEqual(["r1", "detail:r1", "r3", "detail:r3", "r2"]);
  });

  it("spans every column the row has, pinned ones included", () => {
    const actions: DataTableRowAction<Entry>[] = [{ tag: "edit", label: "Edit" }];
    const { container } = renderTable({ selectable: true, rowActions: actions });
    resizeTo(container, 700);

    fireEvent.click(expanders(container)[0]);

    // start cell + Date, Hours, Project, Status + actions
    expect(detailRow(container, "r1")!.querySelector("td")!.colSpan).toBe(6);
  });

  it("is not a data row: no row id, no aria-rowindex", () => {
    const { container } = renderTable();
    resizeTo(container, 700);

    fireEvent.click(expanders(container)[0]);

    const panel = detailRow(container, "r1")!;
    expect(panel.hasAttribute("data-row-id")).toBe(false);
    expect(panel.hasAttribute("aria-rowindex")).toBe(false);
    expect(panel.hasAttribute("data-index")).toBe(false);
    expect(container.querySelector("table")!.getAttribute("aria-rowcount")).toBe("3");
  });

  it("keeps a hidden column editable from its details", () => {
    const onCellCommit = vi.fn();
    const editable: DataTableColumn<Entry>[] = columns.map((column) =>
      column.name === "note" ? { ...column, editable: true } : column,
    );
    const { container } = renderTable({ columns: editable, editable: true, onCellCommit });
    resizeTo(container, 700);
    fireEvent.click(expanders(container)[0]);

    const cell = screen.getByRole("button", { name: "Edit Note: First" });
    expect(detailRow(container, "r1")!.contains(cell)).toBe(true);
    fireEvent.dblClick(cell);
    const input = screen.getByRole("textbox", { name: "Edit Note" });
    fireEvent.change(input, { target: { value: "Changed" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCellCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "r1",
        column: "note",
        value: "Changed",
        previousValue: "First",
      }),
    );
  });

  it("remembers what was open when the container is narrowed again", () => {
    const { container } = renderTable();
    resizeTo(container, 700);
    fireEvent.click(expanders(container)[0]);

    resizeTo(container, 1000);
    expect(container.querySelectorAll("tr[data-detail-for]")).toHaveLength(0);
    expect(expanders(container)).toHaveLength(0);

    resizeTo(container, 700);
    expect(detailRow(container, "r1")).not.toBeNull();
    expect(expanders(container)[0].getAttribute("aria-expanded")).toBe("true");
  });

  it("has no button, and no panel, while nothing is hidden", () => {
    const { container } = renderTable({
      columns: columns.map((column) => ({ ...column, hideBelow: 100 })),
    });
    resizeTo(container, 400);

    expect(expanders(container)).toHaveLength(0);
    expect(container.querySelectorAll("tr[data-detail-for]")).toHaveLength(0);
  });
});

describe("DataTable row details next to the pinned columns", () => {
  const actions: DataTableRowAction<Entry>[] = [{ tag: "edit", label: "Edit" }];

  it("shares the pinned start cell with the selection checkbox", () => {
    const { container } = renderTable({ selectable: true, rowActions: actions });
    resizeTo(container, 700);

    const start = container.querySelector("tbody tr td[data-pin='start']")!;
    expect(start.querySelector("[role='checkbox']")).not.toBeNull();
    expect(start.contains(expanders(container)[0])).toBe(true);
    // One pinned column on each side: the details button did not add a second one.
    expect(container.querySelectorAll("thead th[data-pin='start']")).toHaveLength(1);
    expect(container.querySelectorAll("thead th[data-pin='end']")).toHaveLength(1);
    expect(screen.getByRole("checkbox", { name: "Select all rows" })).toBeTruthy();
    expect(screen.getAllByRole("checkbox", { name: /Select row/ })).toHaveLength(entries.length);
  });

  it("takes the start cell itself when the table has no selection, with a name for its header", () => {
    const { container } = renderTable({ rowActions: actions });
    resizeTo(container, 700);

    const head = container.querySelector("thead th[data-pin='start']")!;
    expect(head.textContent).toBe("Row details");
    expect(head.querySelector(".sr-only")).not.toBeNull();
    expect(container.querySelectorAll("tbody tr td[data-pin='start']")).toHaveLength(
      entries.length,
    );
    // Pinned the same way as the selection column would be.
    expect(container.querySelector("tbody td[data-pin='start']")!.className).toContain("sticky");
    expect(container.querySelector("tbody td[data-pin='start']")!.className).toContain("left-0");
  });

  it("leaves no start cell behind when the last hidden column returns and nothing is selectable", () => {
    const { container } = renderTable();
    resizeTo(container, 700);
    expect(container.querySelector("[data-pin='start']")).not.toBeNull();

    resizeTo(container, 1000);

    expect(container.querySelector("[data-pin='start']")).toBeNull();
  });

  it("keeps the actions column last and selectable rows selectable while details are open", () => {
    const onSelected = vi.fn();
    const { container } = renderTable({
      selectable: true,
      rowActions: actions,
      onSelectedRowIdsChange: onSelected,
    });
    resizeTo(container, 700);
    fireEvent.click(expanders(container)[0]);

    fireEvent.click(screen.getByRole("checkbox", { name: /Select row 2026-10-23/ }));

    expect(onSelected).toHaveBeenCalledWith(["r2"]);
    const row = container.querySelector("tr[data-row-id='r1']")!;
    expect(row.lastElementChild!.getAttribute("data-pin")).toBe("end");
    expect(row.firstElementChild!.getAttribute("data-pin")).toBe("start");
  });

  it("does not make a click on the button a click on the row", () => {
    const onRowClick = vi.fn();
    const { container } = renderTable({ onRowClick, selectable: true });
    resizeTo(container, 700);

    fireEvent.click(expanders(container)[0]);

    expect(onRowClick).not.toHaveBeenCalled();
  });
});

describe("DataTable column options and hidden columns", () => {
  it("still lists every column, and says which ones the width has hidden", async () => {
    const { container } = renderTable({
      showColumnOptions: true,
      defaultColumnVisibility: { project: false },
    });
    resizeTo(container, 700);

    fireEvent.click(screen.getByRole("button", { name: "Column options" }));
    const boxes = await screen.findAllByRole("checkbox");

    expect(boxes.map((box) => box.getAttribute("aria-checked"))).toEqual([
      "true",
      "true",
      "false",
      "true",
      "true",
    ]);
    const note = screen.getByRole("checkbox", { name: "Note" });
    const description = document.getElementById(note.getAttribute("aria-describedby") ?? "");
    expect(description?.textContent).toMatch(/Hidden at this width/);
    // Shown, hidden by the person, and shown at this width: no note on any of them.
    for (const name of ["Date", "Hours", "Project", "Status"]) {
      expect(screen.getByRole("checkbox", { name }).hasAttribute("aria-describedby")).toBe(false);
    }
  });

  it("does not offer a column the person hid, at any width or in any panel", () => {
    const { container } = renderTable({ columnVisibility: { project: false } });

    resizeTo(container, 1000);
    expect(dataHeaders(container)).toEqual(["Date", "Hours", "Status", "Note"]);

    resizeTo(container, 500);
    expect(dataHeaders(container)).toEqual(["Date", "Hours"]);
    fireEvent.click(expanders(container)[0]);
    expect(detailPairs(detailRow(container, "r1")!).map(([name]) => name)).toEqual([
      "Status",
      "Note",
    ]);
  });

  it("lets a column hidden by width be switched off, which then holds at every width", () => {
    const onChange = vi.fn();
    const hiddenByWidth = ["note"];
    render(
      <DataTableColumnOptions
        columns={columns}
        visibility={{}}
        hiddenByWidth={hiddenByWidth}
        onToggle={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Note" }));

    expect(onChange).toHaveBeenCalledWith("note", false);
  });

  it("does not mark a column the person already switched off as hidden by width", () => {
    render(
      <DataTableColumnOptions
        columns={columns}
        visibility={{ note: false }}
        hiddenByWidth={["note"]}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Note" }).hasAttribute("aria-describedby")).toBe(
      false,
    );
  });
});

describe("DataTable with columns hidden by width: sorting, paging, totals", () => {
  it("sorts by a column that is showing and pages with the buttons in place", () => {
    const many: Entry[] = Array.from({ length: 5 }, (_, index) => ({
      id: `m${index + 1}`,
      date: `2026-10-0${index + 1}`,
      hours: 5 - index,
      project: "P",
      status: "Open",
      note: `Note ${index + 1}`,
    }));
    const { container } = renderTable({ rows: many, defaultPageSize: 2, pageSizeOptions: [2] });
    resizeTo(container, 500);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Hours ascending" }));
    const firstPage = Array.from(container.querySelectorAll<HTMLElement>("tr[data-row-id]")).map(
      (row) => row.dataset.rowId,
    );
    expect(firstPage).toEqual(["m5", "m4"]);

    fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));
    const secondPage = Array.from(container.querySelectorAll<HTMLElement>("tr[data-row-id]"));
    expect(secondPage.map((row) => row.dataset.rowId)).toEqual(["m3", "m2"]);
    // Absolute positions, as before, and a button in each row of the new page.
    expect(secondPage.map((row) => row.getAttribute("aria-rowindex"))).toEqual(["3", "4"]);
    expect(expanders(container)).toHaveLength(2);
    expect(container.querySelector("table")!.getAttribute("aria-rowcount")).toBe("5");
  });

  it("lists the total of a hidden column under the table, and drops that line when it is back", () => {
    const withFooters: DataTableColumn<Entry>[] = columns.map((column) =>
      column.name === "hours"
        ? { ...column, footer: "6,5 h" }
        : column.name === "note"
          ? { ...column, footer: "3 notes" }
          : column,
    );
    const { container } = renderTable({ columns: withFooters });

    resizeTo(container, 700);
    const line = container.querySelector<HTMLElement>("[data-slot='data-table-footer-detail']")!;
    expect(detailPairs(line)).toEqual([["Note", "3 notes"]]);
    // The total of a column that is showing stays in its own cell.
    expect(container.querySelector("tfoot")!.textContent).toContain("6,5 h");

    resizeTo(container, 1000);
    expect(container.querySelector("[data-slot='data-table-footer-detail']")).toBeNull();
    expect(container.querySelector("tfoot")!.textContent).toContain("3 notes");
  });

  it("still draws the totals line when only hidden columns have a total", () => {
    const onlyHidden: DataTableColumn<Entry>[] = columns.map((column) =>
      column.name === "note" ? { ...column, footer: "3 notes" } : column,
    );
    const { container } = renderTable({ columns: onlyHidden });

    resizeTo(container, 700);

    expect(container.querySelectorAll("tfoot tr")).toHaveLength(1);
    expect(container.querySelector("[data-slot='data-table-footer-detail']")).not.toBeNull();
  });

  it("sizes the empty and loading rows to the columns that are showing", () => {
    const empty = renderTable({ rows: [] });
    resizeTo(empty.container, 700);
    // start cell + Date, Hours, Project, Status
    expect(empty.container.querySelector("tbody td")!.getAttribute("colspan")).toBe("5");
    empty.unmount();

    const loading = renderTable({ loading: true });
    resizeTo(loading.container, 500);
    expect(loading.container.querySelector("tbody tr")!.querySelectorAll("td")).toHaveLength(3);
  });

  it("caps the aria-rowcount at the data rows however many details are open", () => {
    const { container } = renderTable();
    resizeTo(container, 500);
    for (const button of expanders(container)) fireEvent.click(button);

    expect(container.querySelector("table")!.getAttribute("aria-rowcount")).toBe("3");
    expect(container.querySelectorAll("tr[data-detail-for]")).toHaveLength(3);
  });
});

describe("DataTable focus while columns come and go", () => {
  it("keeps focus on a header button that is still there", () => {
    const { container } = renderTable();
    resizeTo(container, 1000);
    const sort = screen.getByRole("button", { name: "Sort by Hours ascending" });
    sort.focus();

    resizeTo(container, 500);
    expect(document.activeElement).toBe(sort);

    resizeTo(container, 1000);
    expect(document.activeElement).toBe(sort);
  });

  it("keeps focus on a row", () => {
    const { container } = renderTable();
    resizeTo(container, 1000);
    const row = container.querySelector<HTMLElement>("tr[data-row-id='r2']")!;
    row.focus();

    resizeTo(container, 500);

    expect(document.activeElement).toBe(row);
  });

  it("keeps focus on the details button while it opens and closes the panel", () => {
    const { container } = renderTable();
    resizeTo(container, 500);
    const button = expanders(container)[1];
    button.focus();

    fireEvent.click(button);
    expect(document.activeElement).toBe(button);
    expect(button.isConnected).toBe(true);
  });

  it("moves focus to the row when the button it was on goes with the last hidden column", () => {
    const { container } = renderTable();
    resizeTo(container, 500);
    expanders(container)[1].focus();
    expect(document.activeElement?.getAttribute("aria-label")).toMatch(/2026-10-23/);

    resizeTo(container, 1000);

    // Not the body, and not some other row: the one the button was in.
    expect(document.activeElement).toBe(container.querySelector("tr[data-row-id='r2']"));
  });

  it("leaves focus alone when the button goes while focus is somewhere else", () => {
    const { container } = renderTable({
      toolbar: { left: <input aria-label="Filter" /> },
    });
    resizeTo(container, 500);
    const button = expanders(container)[1];
    button.focus();
    const filter = screen.getByLabelText("Filter");
    filter.focus();

    resizeTo(container, 1000);

    expect(document.activeElement).toBe(filter);
  });
});

describe("DataTable row detail parts", () => {
  it("renders the expander with the state a caller gives it", () => {
    render(<DataTableRowExpander rowLabel="Alpha" expanded detailId="panel-1" />);

    const button = screen.getByRole("button", { name: "Show details for Alpha" });
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe("panel-1");
    expect(button.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders a details row from items, in a definition list", () => {
    render(
      <table>
        <tbody>
          <DataTableRowDetail
            rowId="r9"
            rowLabel="Nine"
            cellId="cell-9"
            colSpan={4}
            items={[
              { name: "a", label: "Alpha", content: "one" },
              { name: "b", label: "Beta", content: null },
            ]}
          />
        </tbody>
      </table>,
    );

    const row = document.querySelector<HTMLElement>("tr[data-detail-for='r9']")!;
    expect(row.querySelector("td")!.id).toBe("cell-9");
    expect(row.querySelector("td")!.colSpan).toBe(4);
    expect(row.querySelector("dl")).not.toBeNull();
    expect(detailPairs(row)[0]).toEqual(["Alpha", "one"]);
    expect(row.textContent).toContain("Details for Nine");
    expect(detailPairs(row)[1][1]).toBe("—No value");
  });

  it("pins the details panel with a logical inset, so a right-to-left table keeps it in view", () => {
    render(
      <table>
        <tbody>
          <DataTableRowDetail
            rowId="r9"
            rowLabel="Nine"
            cellId="cell-9"
            colSpan={4}
            items={[{ name: "a", label: "Alpha", content: "one" }]}
          />
        </tbody>
      </table>,
    );

    const panel = document.querySelector<HTMLElement>("[data-slot='data-table-detail-panel']")!;
    expect(panel.className).toContain("sticky");
    expect(panel.className).toContain("start-0");
    // A physical inset would pin it to the left edge of a table whose start is the right.
    expect(panel.className.split(/\s+/)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^(left|right)-0$/)]),
    );
  });
});
