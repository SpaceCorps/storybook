import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { DataTable, type DataTableColumn } from "./index";
import { detailRowOf, measureRowWithDetail } from "./use-data-table-virtualization";

const ROW_HEIGHT = 40;
const DETAIL_HEIGHT = 100;
const VIEWPORT_HEIGHT = 400;
const ROW_COUNT = 1000;

interface Widget {
  id: string;
  name: string;
  extra: string;
}

const rows: Widget[] = Array.from({ length: ROW_COUNT }, (_, index) => ({
  id: `w${index + 1}`,
  name: `Widget ${index + 1}`,
  extra: `Extra ${index + 1}`,
}));

// `hideBelow` with nothing measured means hidden, so these rows have details without any layout.
const columns: DataTableColumn<Widget>[] = [
  { name: "name", header: "Name" },
  { name: "extra", header: "Extra", hideBelow: 500 },
];

/** A `ResizeObserver` that can be told that one particular element changed size. */
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
  static notify(target: Element) {
    for (const observer of FakeResizeObserver.all) {
      if (observer.targets.has(target)) {
        observer.callback(
          [{ target } as ResizeObserverEntry],
          observer as unknown as ResizeObserver,
        );
      }
    }
  }
}

function renderWindowed() {
  return render(
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.name}
      paginated={false}
      virtualized
      estimateRowHeight={ROW_HEIGHT}
    />,
  );
}

const renderedRows = (container: HTMLElement) =>
  container.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]");

beforeEach(() => {
  FakeResizeObserver.all.clear();
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  // jsdom lays nothing out: these are the heights the virtualizer reads.
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      if (this.hasAttribute("data-detail-for")) return DETAIL_HEIGHT;
      if (this.hasAttribute("data-index")) return ROW_HEIGHT;
      if (this.classList.contains("overflow-auto")) return VIEWPORT_HEIGHT;
      return 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains("overflow-auto") ? VIEWPORT_HEIGHT : 0;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error - restoring jsdom's own getters
  delete HTMLElement.prototype.offsetHeight;
  // @ts-expect-error - as above
  delete HTMLElement.prototype.clientHeight;
});

describe("windowed rows: measuring a row together with its details", () => {
  function pair(detailFor: string, rowId = "a") {
    const body = document.createElement("tbody");
    const row = document.createElement("tr");
    row.dataset.rowId = rowId;
    row.dataset.index = "0";
    const spacer = document.createElement("tr");
    spacer.setAttribute("aria-hidden", "true");
    const detail = document.createElement("tr");
    detail.dataset.detailFor = detailFor;
    body.append(row, detail);
    return { body, row, detail, spacer };
  }

  const height = (node: HTMLElement, value: number) =>
    Object.defineProperty(node, "offsetHeight", { configurable: true, value });

  it("finds the details row that follows a row by id", () => {
    const { row, detail } = pair("a");
    expect(detailRowOf(row)).toBe(detail);
  });

  it("does not take the next row for details that belong to another one", () => {
    const { row } = pair("b");
    expect(detailRowOf(row)).toBeNull();
  });

  it("does not take a spacer or any other sibling for details", () => {
    const { body, row, detail, spacer } = pair("a");
    body.insertBefore(spacer, detail);
    expect(detailRowOf(row)).toBeNull();
  });

  it("weighs the row and its details together", () => {
    const { row, detail } = pair("a");
    height(row, 40);
    height(detail, 100);

    expect(measureRowWithDetail(row, undefined)).toBe(140);
  });

  it("weighs a row with no details as itself", () => {
    const { row } = pair("zzz");
    height(row, 40);

    expect(measureRowWithDetail(row, undefined)).toBe(40);
  });

  it("takes the row's own height from the observer entry when there is one", () => {
    const { row, detail } = pair("a");
    height(row, 1);
    height(detail, 100);
    const entry = { borderBoxSize: [{ blockSize: 41.6 }] } as unknown as ResizeObserverEntry;

    expect(measureRowWithDetail(row, entry)).toBe(142);
  });
});

describe("windowed rows with details", () => {
  it("fits fewer rows in the window once the details of one are open and measured", () => {
    const { container } = renderWindowed();
    const before = renderedRows(container).length;
    expect(before).toBeGreaterThan(8);

    fireEvent.click(
      container.querySelector<HTMLElement>("button[aria-label^='Show details for']")!,
    );
    const detail = container.querySelector<HTMLElement>("tr[data-detail-for='w1']")!;
    expect(detail).not.toBeNull();

    // The details row is watched, and it is what tells the window how tall its item became.
    act(() => FakeResizeObserver.notify(detail));

    expect(renderedRows(container).length).toBeLessThan(before);
  });

  it("measures the item as the row alone again after the details close", () => {
    const { container } = renderWindowed();
    const before = renderedRows(container).length;
    const button = container.querySelector<HTMLElement>("button[aria-label^='Show details for']")!;

    fireEvent.click(button);
    const detail = container.querySelector<HTMLElement>("tr[data-detail-for='w1']")!;
    act(() => FakeResizeObserver.notify(detail));
    const whileOpen = renderedRows(container).length;

    fireEvent.click(button);
    // The details row is out of the document; the observer reports it going.
    act(() => FakeResizeObserver.notify(detail));

    expect(whileOpen).toBeLessThan(before);
    expect(renderedRows(container).length).toBe(before);
  });

  it("keeps the rows windowed, aria-rowcount true and the details out of the row count", () => {
    const { container } = renderWindowed();

    fireEvent.click(
      container.querySelector<HTMLElement>("button[aria-label^='Show details for']")!,
    );

    expect(container.querySelector("table")!.getAttribute("aria-rowcount")).toBe(String(ROW_COUNT));
    expect(renderedRows(container).length).toBeLessThan(60);
    expect(container.querySelectorAll("tr[data-detail-for]")).toHaveLength(1);
  });
});
