import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { DataTable, type DataTableColumn, type DataTableRowAction } from "./index";
import { HEAD_HEIGHT_VAR, PIN_END_VAR, PIN_START_VAR } from "./use-focus-reveal";

interface Entry {
  id: string;
  name: string;
  hours: number;
}

const entries: Entry[] = [
  { id: "a", name: "Alpha", hours: 1 },
  { id: "b", name: "Bravo", hours: 2 },
];

const columns: DataTableColumn<Entry>[] = [
  { name: "name", header: "Name" },
  { name: "hours", header: "Hours" },
];

const actions: DataTableRowAction<Entry>[] = [{ tag: "edit", label: "Edit entry" }];

const rect = (left: number, top: number, right: number, bottom: number): DOMRect =>
  ({
    left,
    top,
    right,
    bottom,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    toJSON: () => ({}),
  }) as DOMRect;

/** What each element reports, since jsdom lays nothing out. Anything unlisted is 0 x 0. */
let boxes = new Map<Element, DOMRect>();
let resize: (() => void) | undefined;

beforeEach(() => {
  boxes = new Map();
  resize = undefined;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    return boxes.get(this) ?? rect(0, 0, 0, 0);
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return boxes.get(this)?.width ?? 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return boxes.get(this)?.height ?? 0;
    },
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // @ts-expect-error - restoring jsdom's own getters
  delete HTMLElement.prototype.offsetWidth;
  // @ts-expect-error - as above
  delete HTMLElement.prototype.offsetHeight;
});

/**
 * A selectable table with a row-action column, in a 300 x 200 scroller: the select column covers
 * 0-40 and the action column 240-300, so the scrolled content is only visible between x = 40 and
 * x = 240, and below the 40px header.
 */
function setup(scrollLeft = 0, scrollTop = 0) {
  const view = render(
    <DataTable
      columns={columns}
      rows={entries}
      getRowId={(row) => row.id}
      selectable
      rowActions={actions}
      paginated={false}
    />,
  );
  const scroller = view.container.querySelector<HTMLElement>('[data-slot="table-container"]')!;
  const state = { left: scrollLeft, top: scrollTop };
  Object.defineProperty(scroller, "scrollLeft", {
    configurable: true,
    get: () => state.left,
    set: (value: number) => {
      state.left = value;
    },
  });
  Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 200 });
  Object.defineProperty(scroller, "scrollTop", {
    configurable: true,
    get: () => state.top,
    set: (value: number) => {
      state.top = value;
    },
  });

  const startHead = scroller.querySelector<HTMLElement>('thead th[data-pin="start"]')!;
  const endHead = scroller.querySelector<HTMLElement>('thead th[data-pin="end"]')!;
  const plainHead = scroller.querySelector<HTMLElement>("thead th:not([data-pin])")!;
  boxes.set(scroller, rect(0, 0, 300, 200));
  boxes.set(startHead, rect(0, 0, 40, 40));
  boxes.set(endHead, rect(240, 0, 300, 40));
  boxes.set(plainHead, rect(40, 0, 140, 40));
  return { ...view, scroller, state, startHead, endHead };
}

async function focusAndSettle(element: HTMLElement) {
  await act(async () => {
    element.focus();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

describe("DataTable focus reveal", () => {
  it("publishes the pinned columns and the header as the scroller's scroll padding", () => {
    const { scroller } = setup();

    expect(scroller.className).toContain("scroll-pl-[var(--ivy-data-table-pin-start,0px)]");
    expect(scroller.className).toContain("scroll-pr-[var(--ivy-data-table-pin-end,0px)]");
    expect(scroller.className).toContain("scroll-pt-[var(--ivy-data-table-head-height,0px)]");

    act(() => resize?.());

    expect(scroller.style.getPropertyValue(PIN_START_VAR)).toBe("40px");
    expect(scroller.style.getPropertyValue(PIN_END_VAR)).toBe("60px");
    expect(scroller.style.getPropertyValue(HEAD_HEIGHT_VAR)).toBe("40px");
  });

  it("publishes zero when there is nothing pinned", () => {
    const view = render(
      <DataTable columns={columns} rows={entries} getRowId={(row) => row.id} paginated={false} />,
    );
    const scroller = view.container.querySelector<HTMLElement>('[data-slot="table-container"]')!;

    expect(scroller.style.getPropertyValue(PIN_START_VAR)).toBe("0px");
    expect(scroller.style.getPropertyValue(PIN_END_VAR)).toBe("0px");
  });

  it("scrolls a control that pokes out from behind the action column clear of it", async () => {
    const { scroller, state } = setup();
    const sort = screen.getByRole("button", { name: "Sort by Hours ascending" });
    // Straddles the action column, which starts at x = 240: the browser calls that visible.
    boxes.set(sort, rect(200, 10, 270, 30));

    await focusAndSettle(sort);

    expect(state.left).toBe(30);
    expect(scroller.scrollLeft).toBe(30);
  });

  it("scrolls a control that lies wholly behind the action column into view", async () => {
    const { state } = setup();
    const sort = screen.getByRole("button", { name: "Sort by Hours ascending" });
    boxes.set(sort, rect(260, 10, 320, 30));

    await focusAndSettle(sort);

    // Right edge to the edge of the visible region (240), not to the scroller's.
    expect(state.left).toBe(80);
  });

  it("scrolls a control behind the select column back out from under it", async () => {
    const { state } = setup(100);
    const sort = screen.getByRole("button", { name: "Sort by Name ascending" });
    boxes.set(sort, rect(10, 10, 80, 30));

    await focusAndSettle(sort);

    expect(state.left).toBe(70);
  });

  it("never scrolls so far that a control wider than the visible region loses its start", async () => {
    const { state } = setup();
    const sort = screen.getByRole("button", { name: "Sort by Hours ascending" });
    // 300 wide against a visible region of 200: show its start edge.
    boxes.set(sort, rect(100, 10, 400, 30));

    await focusAndSettle(sort);

    expect(state.left).toBe(60);
  });

  it("leaves a control that is already clear alone", async () => {
    const { state } = setup(25);
    const sort = screen.getByRole("button", { name: "Sort by Name ascending" });
    boxes.set(sort, rect(60, 10, 130, 30));

    await focusAndSettle(sort);

    expect(state.left).toBe(25);
  });

  it("never moves a control inside a pinned column", async () => {
    const { state } = setup(50);
    const edit = screen.getAllByRole("button", { name: "Edit entry" })[0];
    boxes.set(edit, rect(250, 60, 290, 90));

    await focusAndSettle(edit);

    expect(state.left).toBe(50);
  });

  it("keeps a focused row below the sticky header, and does not move it sideways", async () => {
    const { container, state } = setup(60, 90);
    const row = container.querySelector<HTMLElement>('tbody tr[data-row-id="a"]')!;
    // The row spans the whole table, far wider than the scroller.
    boxes.set(row, rect(-60, 10, 500, 60));

    await focusAndSettle(row);

    expect(state.top).toBe(60);
    expect(state.left).toBe(60);
  });

  it("keeps a control in the body below the sticky header", async () => {
    const { state } = setup(0, 120);
    const edit = screen.getAllByRole("button", { name: "Edit entry" })[1];
    boxes.set(edit, rect(250, 20, 290, 50));

    await focusAndSettle(edit);

    // Its top is 20px above the header's bottom edge: 20px of it were under the header.
    expect(state.top).toBe(100);
  });

  it("scrolls a row that only a sliver of shows up from the bottom edge", async () => {
    const { container, state } = setup(0, 300);
    const row = container.querySelector<HTMLElement>('tbody tr[data-row-id="b"]')!;
    // 13px of a 57px row inside the 200px viewport, as after a PageDown onto an unmeasured row.
    boxes.set(row, rect(0, 187, 500, 244));

    await focusAndSettle(row);

    expect(state.top).toBe(344);
    expect(state.left).toBe(0);
  });

  it("scrolls a control at the bottom edge into view, but never past the top of a tall one", async () => {
    const { state } = setup(0, 300);
    const edit = screen.getAllByRole("button", { name: "Edit entry" })[1];
    boxes.set(edit, rect(250, 150, 290, 450));

    await focusAndSettle(edit);

    // Its 250px overflow would push its top (150) above the 40px header edge: stop at the header.
    expect(state.top).toBe(300 + (150 - 40));
  });

  it("does not push a header control down from under the header it is part of", async () => {
    const { state } = setup(0, 120);
    const sort = screen.getByRole("button", { name: "Sort by Name ascending" });
    boxes.set(sort, rect(60, 5, 130, 25));

    await focusAndSettle(sort);

    expect(state.top).toBe(120);
  });

  it("does nothing where there is no layout to measure", async () => {
    const { scroller, state } = setup(10, 10);
    boxes.delete(scroller);
    const sort = screen.getByRole("button", { name: "Sort by Hours ascending" });
    boxes.set(sort, rect(260, 10, 320, 30));

    await focusAndSettle(sort);

    expect(state.left).toBe(10);
    expect(state.top).toBe(10);
  });
});
