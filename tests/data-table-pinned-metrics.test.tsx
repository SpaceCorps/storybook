import { act, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "../src/components/ui/data-table";
import {
  ACTIONS_WIDTH_VAR,
  DEFAULT_PINNED_METRICS,
  measureActionsWidth,
  parseCssLength,
  usePinnedMetrics,
  type PinnedMetrics,
} from "../src/components/ui/data-table/use-pinned-metrics";
import { Densities } from "../src/types/density";

/**
 * jsdom lays nothing out, so a test says what the page measures. Sizes are written on the elements
 * (`data-w` for `offsetWidth`, `data-left` for `offsetLeft`, `data-room` for `clientWidth`) and read
 * back by the stubs below; an element that says nothing measures 0, as it does in jsdom. `layout.on`
 * switches the whole page from "no layout yet" to "laid out" for the tests that wait for a font,
 * `layout.room` is the `clientWidth` of an element that does not say (0, as jsdom has it, until a test
 * that builds the page with the real component says its table is laid out), and `layout.override`
 * replaces the numbers for such a test.
 */
const layout: {
  on: boolean;
  room: number;
  rootFontSize: string | null;
  override: ((element: HTMLElement, property: "w" | "left") => number | undefined) | null;
} = { on: true, room: 0, rootFontSize: null, override: null };

const sizeOf = (element: HTMLElement, property: "w" | "left"): number => {
  if (!layout.on) return 0;
  const overridden = layout.override?.(element, property);
  return overridden ?? Number(element.dataset[property] ?? 0);
};

const realComputedStyle = window.getComputedStyle.bind(window);
let computedStyle: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  layout.on = true;
  layout.room = 0;
  layout.rootFontSize = null;
  layout.override = null;
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return sizeOf(this, "w");
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
    function (this: HTMLElement) {
      return sizeOf(this, "left");
    },
  );
  vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(function (this: Element) {
    return layout.on ? Number((this as HTMLElement).dataset?.room ?? layout.room) : 0;
  });
  // Only the elements that opt in (`data-style`), the actions cells and the root are described here;
  // everything else, which Testing Library asks about too, gets jsdom's own answer.
  computedStyle = vi.spyOn(window, "getComputedStyle").mockImplementation(((
    element: Element,
    pseudo?: string | null,
  ) => {
    const data = (element as HTMLElement).dataset;
    const isRoot = element === document.documentElement && layout.rootFontSize !== null;
    const isActionsCell = element.matches?.("td[data-pin='end']") ?? false;
    if (!isRoot && !element.hasAttribute?.("data-style") && !isActionsCell) {
      return realComputedStyle(element, pseudo);
    }
    // A step is 0.27rem, so a cell's `p-2` is 8.64px at 16px: what a real cell resolves to.
    const padding = data?.pad === undefined ? (isActionsCell ? "8.64" : "") : data.pad;
    const px = padding === "" ? "" : `${padding}px`;
    return {
      paddingLeft: px,
      paddingRight: px,
      fontSize: isRoot ? layout.rootFontSize : "",
      getPropertyValue: (name: string) =>
        name === "--spacing"
          ? (data?.spacing ?? "")
          : name === ACTIONS_WIDTH_VAR
            ? (data?.actionsWidth ?? "")
            : "",
    } as unknown as CSSStyleDeclaration;
  }) as typeof window.getComputedStyle);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------------------------
// parseCssLength
// ---------------------------------------------------------------------------------------------

describe("parseCssLength", () => {
  it.each([
    ["4.32px", 16, 4.32],
    ["0.27rem", 16, 4.32],
    ["0.25rem", 20, 5],
    ["8px", 20, 8],
    ["  8px  ", 16, 8],
    ["8PX", 16, 8],
    ["2REM", 10, 20],
    ["4 px", 16, 4],
    ["0px", 16, 0],
    ["12.5px", 16, 12.5],
  ])("reads %j at a %ipx root as %f px", (value, remPx, expected) => {
    expect(parseCssLength(value, remPx)).toBeCloseTo(expected, 10);
  });

  it.each([
    [""],
    ["   "],
    ["12"],
    ["calc(0.25rem * 2)"],
    ["var(--spacing)"],
    ["auto"],
    ["50%"],
    ["4em"],
    ["-4px"],
    ["1e3px"],
    ["px"],
    ["4px 8px"],
  ])("does not take %j for a length it can use", (value) => {
    expect(parseCssLength(value, 16)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// measureActionsWidth
// ---------------------------------------------------------------------------------------------

describe("measureActionsWidth", () => {
  interface MeasuredRow {
    /** `[offsetLeft, offsetWidth]` of each button; `null` for a cell with no actions group at all. */
    buttons: Array<[number, number]> | null;
    pad?: string;
  }

  /** A laid-out container: `room` is its `clientWidth`, and 0 is what jsdom, or a hidden tab, reports. */
  function pageOf(rows: MeasuredRow[], room = 4000): HTMLElement {
    const root = document.createElement("div");
    root.dataset.room = String(room);
    const cells = rows.map(({ buttons, pad }) => {
      const group =
        buttons === null
          ? ""
          : `<div data-slot="data-table-row-actions">${buttons
              .map(([left, w]) => `<button data-left="${left}" data-w="${w}"></button>`)
              .join("")}</div>`;
      return `<tr><td data-pin="end"${pad === undefined ? "" : ` data-pad="${pad}"`}>${group}</td></tr>`;
    });
    root.innerHTML = `<table><tbody>${cells.join("")}</tbody></table>`;
    return root;
  }

  it("is the span of the buttons plus the cell's padding", () => {
    // 8 to 84 is 76px of buttons, with 8px of padding on each side.
    expect(
      measureActionsWidth(
        pageOf([
          {
            buttons: [
              [8, 36],
              [48, 36],
            ],
            pad: "8",
          },
        ]),
      ),
    ).toBe(92);
  });

  it("measures from where the first button starts: space before it is the padding already counted", () => {
    expect(measureActionsWidth(pageOf([{ buttons: [[30, 36]], pad: "8" }]))).toBe(52);
  });

  it("rounds a fractional width up, never down into a cell that does not fit", () => {
    // 36.4 + 2 x 8.5 = 53.4
    expect(measureActionsWidth(pageOf([{ buttons: [[8.5, 36.4]], pad: "8.5" }]))).toBe(54);
  });

  it("is the widest row's, whichever row that is", () => {
    const page = pageOf([
      { buttons: [[8, 36]], pad: "8" },
      {
        buttons: [
          [8, 36],
          [48, 36],
          [88, 36],
        ],
        pad: "8",
      },
      {
        buttons: [
          [8, 36],
          [48, 36],
        ],
        pad: "8",
      },
    ]);

    expect(measureActionsWidth(page)).toBe(132);
  });

  it("ignores a row with no buttons and a cell with no actions group", () => {
    expect(
      measureActionsWidth(
        pageOf([
          { buttons: null },
          { buttons: [] },
          { buttons: [[8, 36]], pad: "8" },
          { buttons: null },
        ]),
      ),
    ).toBe(52);
    expect(measureActionsWidth(pageOf([{ buttons: null }, { buttons: [] }]))).toBeNull();
  });

  it("ignores a button that takes no room, as one that is not displayed does", () => {
    expect(
      measureActionsWidth(
        pageOf([
          {
            buttons: [
              [8, 36],
              [0, 0],
            ],
            pad: "8",
          },
        ]),
      ),
    ).toBe(52);
  });

  it("ignores a number larger than the container, which cannot be a cell that fits in it", () => {
    const page = pageOf(
      [
        { buttons: [[8, 36]], pad: "8" },
        {
          buttons: [
            [8, 36],
            [48, 36],
            [88, 36],
          ],
          pad: "8",
        },
      ],
      100,
    );

    expect(measureActionsWidth(page)).toBe(52);
  });

  it("is null when every row is wider than the container", () => {
    expect(measureActionsWidth(pageOf([{ buttons: [[8, 200]], pad: "8" }], 100))).toBeNull();
  });

  it("is null when the container has no width, which is no layout to believe", () => {
    // clientWidth 0 is jsdom, a hidden tab or a table that is not displayed: whatever the buttons say
    // is not a measurement of anything.
    expect(measureActionsWidth(pageOf([{ buttons: [[8, 200]], pad: "8" }], 0))).toBeNull();
  });

  it("accepts a cell exactly as wide as the container", () => {
    expect(measureActionsWidth(pageOf([{ buttons: [[8, 84]], pad: "8" }], 100))).toBe(100);
  });

  it("only looks at the body: the header's pinned cell has no buttons to speak of", () => {
    const root = pageOf([{ buttons: [[8, 36]], pad: "8" }]);
    root
      .querySelector("table")!
      .insertAdjacentHTML(
        "afterbegin",
        `<thead><tr><th data-pin="end"><div data-slot="data-table-row-actions"><button data-left="0" data-w="500"></button></div></th></tr></thead>`,
      );

    expect(measureActionsWidth(root)).toBe(52);
  });

  it("is null without layout, as in jsdom or a tab that is not shown", () => {
    layout.on = false;

    expect(measureActionsWidth(pageOf([{ buttons: [[8, 36]], pad: "8" }]))).toBeNull();
  });

  it("is null when there is no row to measure", () => {
    expect(measureActionsWidth(pageOf([]))).toBeNull();
    expect(measureActionsWidth(document.createElement("div"))).toBeNull();
  });

  it("is null, not NaN or a guess, when the cell's padding does not resolve to a length", () => {
    expect(measureActionsWidth(pageOf([{ buttons: [[8, 36]], pad: "" }]))).toBeNull();
  });

  it("stops after the first rows it can measure: the model covers the rest", () => {
    const rows: MeasuredRow[] = Array.from({ length: 30 }, (_, index) => ({
      // Only the 26th row is wider, which is past the 25 it looks at.
      buttons: index === 25 ? [[8, 200]] : [[8, 36]],
      pad: "8",
    }));

    expect(measureActionsWidth(pageOf(rows))).toBe(52);
  });

  // jsdom's default style sheet gives a `td` 1px of padding, so the padding is a number and cannot be
  // what rejects the measurement; the container having no width (jsdom reports 0) is.
  it("does not turn a consumer's blanket offsetWidth stub into a huge cell", () => {
    // Some suites stub offsetWidth on every element to get a virtualizer or a chart going. Every
    // button then "measures" 1000px, and a cell of 1002px is not a cell any table has.
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(1000);
    const root = document.createElement("div");
    root.innerHTML = `<table><tbody><tr><td data-pin="end"><div data-slot="data-table-row-actions"><button></button><button></button></div></td></tr></tbody></table>`;
    // jsdom's own computed style, as a consumer's suite has it.
    computedStyle.mockImplementation(realComputedStyle as never);

    expect(measureActionsWidth(root)).toBeNull();
  });

  it("is null when the cell's padding is not a number, as a style jsdom does not resolve", () => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(1000);
    const root = document.createElement("div");
    root.innerHTML = `<table><tbody><tr><td data-pin="end" data-pad=""><div data-slot="data-table-row-actions"><button></button></div></td></tr></tbody></table>`;

    expect(measureActionsWidth(root)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// usePinnedMetrics
// ---------------------------------------------------------------------------------------------

describe("usePinnedMetrics", () => {
  interface HarnessProps {
    enabled?: boolean;
    collapsed?: boolean;
    body?: React.ReactNode;
    containerData?: Record<string, string>;
  }

  const seen: PinnedMetrics[] = [];
  const latest = () => seen[seen.length - 1];

  function Harness({
    enabled = true,
    collapsed = false,
    body = null,
    containerData,
  }: HarnessProps) {
    const ref = React.useRef<HTMLDivElement>(null);
    const collapsedRef = React.useRef(collapsed);
    collapsedRef.current = collapsed;
    const metrics = usePinnedMetrics({ containerRef: ref, enabled, collapsedRef });
    seen.push(metrics);
    return (
      <div ref={ref} data-style="" data-room="4000" {...containerData}>
        <table>
          <tbody>{body}</tbody>
        </table>
      </div>
    );
  }

  const actionsRow = (buttons: Array<[number, number]>, key = "row") => (
    <tr key={key}>
      <td data-pin="end" data-pad="8">
        <div data-slot="data-table-row-actions">
          {buttons.map(([left, w], index) => (
            <button key={index} data-left={left} data-w={w} />
          ))}
        </div>
      </td>
    </tr>
  );
  const pair: Array<[number, number]> = [
    [8, 36],
    [48, 36],
  ];
  const triple: Array<[number, number]> = [...pair, [88, 36]];
  const single: Array<[number, number]> = [[8, 36]];

  beforeEach(() => {
    seen.length = 0;
  });

  afterEach(() => {
    delete (document as unknown as { fonts?: unknown }).fonts;
  });

  it("starts from the defaults and reads nothing from a page with nothing to read", () => {
    render(<Harness />);

    expect(latest()).toEqual(DEFAULT_PINNED_METRICS);
    // No number changed, so nothing was set and nothing re-rendered.
    expect(seen).toHaveLength(1);
  });

  it("measures the unfolded actions when they are what is on the page", () => {
    render(<Harness body={actionsRow(pair)} />);

    expect(latest().unfoldedActionsPx).toBe(92);
    expect(latest().foldedActionsPx).toBeNull();
  });

  it("measures the folded actions when they are what is on the page", () => {
    render(<Harness collapsed body={actionsRow(single)} />);

    expect(latest().foldedActionsPx).toBe(52);
    expect(latest().unfoldedActionsPx).toBeNull();
  });

  it("keeps the folded and unfolded measurements apart, and overwrites only the one on the page", () => {
    const { rerender } = render(<Harness body={actionsRow(pair)} />);
    expect(latest()).toMatchObject({ unfoldedActionsPx: 92, foldedActionsPx: null });

    rerender(<Harness collapsed body={actionsRow(single)} />);
    expect(latest()).toMatchObject({ unfoldedActionsPx: 92, foldedActionsPx: 52 });

    rerender(<Harness body={actionsRow(triple)} />);
    expect(latest()).toMatchObject({ unfoldedActionsPx: 132, foldedActionsPx: 52 });

    rerender(<Harness collapsed body={actionsRow([[8, 50]])} />);
    expect(latest()).toMatchObject({ unfoldedActionsPx: 132, foldedActionsPx: 66 });
  });

  it("lets an unfolded measurement go down as well as up when that is what the page now shows", () => {
    const { rerender } = render(<Harness body={actionsRow(triple)} />);
    expect(latest().unfoldedActionsPx).toBe(132);

    rerender(<Harness body={actionsRow(single)} />);

    expect(latest().unfoldedActionsPx).toBe(52);
  });

  it("keeps the old numbers when there is no row to measure, as while a page is being fetched", () => {
    const { rerender } = render(<Harness body={actionsRow(pair)} />);
    rerender(<Harness collapsed body={actionsRow(single)} />);
    expect(latest()).toMatchObject({ unfoldedActionsPx: 92, foldedActionsPx: 52 });

    rerender(<Harness collapsed body={null} />);
    expect(latest()).toMatchObject({ unfoldedActionsPx: 92, foldedActionsPx: 52 });

    rerender(<Harness body={<tr key="empty" />} />);
    expect(latest()).toMatchObject({ unfoldedActionsPx: 92, foldedActionsPx: 52 });
  });

  it("keeps the old numbers while the page has no layout", () => {
    const { rerender } = render(<Harness body={actionsRow(pair)} />);

    layout.on = false;
    rerender(<Harness body={actionsRow(pair, "again")} />);

    expect(latest().unfoldedActionsPx).toBe(92);
  });

  it("sets state only when a number changed", () => {
    const { rerender } = render(<Harness body={actionsRow(pair)} />);
    // The mount, and the one commit that the measurement asked for.
    expect(seen).toHaveLength(2);

    // The same page again: the parent's render, and nothing the hook added.
    rerender(<Harness body={actionsRow(pair, "same")} />);
    expect(seen).toHaveLength(3);
    rerender(<Harness body={actionsRow(pair, "still")} />);
    expect(seen).toHaveLength(4);

    // A wider cell: the parent's render and the commit for the new number.
    rerender(<Harness body={actionsRow(triple)} />);
    expect(seen).toHaveLength(6);
  });

  it("reads --spacing and the actions-width custom property, in px or rem", () => {
    render(
      <Harness
        body={actionsRow(pair)}
        containerData={{ "data-spacing": "0.25rem", "data-actions-width": "7rem" }}
      />,
    );

    expect(latest().unitPx).toBe(4);
    expect(latest().configuredActionsPx).toBe(112);
  });

  it("reads them in px as well, and follows a change of either", () => {
    const { rerender } = render(
      <Harness containerData={{ "data-spacing": "4.5px", "data-actions-width": "90px" }} />,
    );
    expect(latest()).toMatchObject({ unitPx: 4.5, configuredActionsPx: 90 });

    rerender(<Harness containerData={{ "data-spacing": "5px" }} />);
    expect(latest()).toMatchObject({ unitPx: 5, configuredActionsPx: null });
  });

  it("falls back to the default step and no width for values it cannot read", () => {
    render(
      <Harness
        containerData={{
          "data-spacing": "calc(0.25rem * 1)",
          "data-actions-width": "var(--other, 5rem)",
        }}
      />,
    );

    expect(latest().unitPx).toBeCloseTo(0.27 * 16, 10);
    expect(latest().configuredActionsPx).toBeNull();
  });

  it("reads the root font size, and the default step and rem widths follow it", () => {
    layout.rootFontSize = "20px";

    render(<Harness containerData={{ "data-actions-width": "5rem" }} />);

    expect(latest().remPx).toBe(20);
    expect(latest().unitPx).toBeCloseTo(0.27 * 20, 10);
    expect(latest().configuredActionsPx).toBe(100);
  });

  it.each([[""], ["0px"], ["-4px"], ["normal"]])(
    "takes 16px for a root font size it cannot use (%j)",
    (size) => {
      layout.rootFontSize = size;

      render(<Harness />);

      expect(latest().remPx).toBe(16);
    },
  );

  it("reads a rendered selection checkbox's width, and none when there is not one", () => {
    const checkbox = (
      <tr key="box">
        <td>
          <span role="checkbox" aria-checked="false" data-w="20" />
        </td>
      </tr>
    );
    const { rerender } = render(<Harness body={checkbox} />);
    expect(latest().checkboxPx).toBe(20);

    rerender(<Harness body={actionsRow(pair)} />);
    expect(latest().checkboxPx).toBeNull();
  });

  it("takes no width for a checkbox that takes no room", () => {
    render(
      <Harness
        body={
          <tr>
            <td>
              <span role="checkbox" aria-checked="false" data-w="0" />
            </td>
          </tr>
        }
      />,
    );

    expect(latest().checkboxPx).toBeNull();
  });

  it("does nothing while it is not enabled, and answers with the defaults", () => {
    const { rerender } = render(<Harness enabled={false} body={actionsRow(pair)} />);

    expect(latest()).toBe(DEFAULT_PINNED_METRICS);
    expect(computedStyle).not.toHaveBeenCalledWith(expect.any(HTMLDivElement));
    expect(seen).toHaveLength(1);

    rerender(<Harness body={actionsRow(pair)} />);
    expect(latest().unfoldedActionsPx).toBe(92);
  });

  describe("fonts", () => {
    function stubFonts(extra: Record<string, unknown> = {}) {
      let resolveReady!: () => void;
      const ready = new Promise<void>((resolve) => {
        resolveReady = resolve;
      });
      const listeners = new Map<string, EventListener>();
      const fonts = {
        ready,
        addEventListener: vi.fn((type: string, listener: EventListener) => {
          listeners.set(type, listener);
        }),
        removeEventListener: vi.fn((type: string, listener: EventListener) => {
          if (listeners.get(type) === listener) listeners.delete(type);
        }),
        ...extra,
      };
      Object.defineProperty(document, "fonts", { configurable: true, value: fonts });
      return { fonts, listeners, settle: () => act(async () => resolveReady()) };
    }

    it("measures again when document.fonts.ready settles, with no commit to prompt it", async () => {
      const { settle } = stubFonts();
      // The page is not laid out yet when the table mounts, as when a font is still loading.
      layout.on = false;
      render(<Harness body={actionsRow(pair)} />);
      expect(latest().unfoldedActionsPx).toBeNull();
      const rendered = seen.length;

      layout.on = true;
      await settle();

      expect(latest().unfoldedActionsPx).toBe(92);
      expect(seen.length).toBe(rendered + 1);
    });

    it("measures again when a font finishes loading after that", () => {
      const { listeners } = stubFonts();
      layout.on = false;
      render(<Harness body={actionsRow(pair)} />);

      layout.on = true;
      act(() => listeners.get("loadingdone")!(new Event("loadingdone")));

      expect(latest().unfoldedActionsPx).toBe(92);
    });

    it("takes its listener off again, and ignores a ready that settles after the unmount", async () => {
      const { fonts, listeners, settle } = stubFonts();
      const { unmount } = render(<Harness body={actionsRow(pair)} />);
      const listener = fonts.addEventListener.mock.calls[0][1];
      const reads = computedStyle.mock.calls.length;

      unmount();

      expect(fonts.removeEventListener).toHaveBeenCalledWith("loadingdone", listener);
      expect(listeners.size).toBe(0);
      await settle();
      expect(computedStyle.mock.calls.length).toBe(reads);
    });

    it("does not listen for fonts while it is not enabled", () => {
      const { fonts } = stubFonts();

      render(<Harness enabled={false} body={actionsRow(pair)} />);

      expect(fonts.addEventListener).not.toHaveBeenCalled();
    });

    it("does not throw without document.fonts, as in jsdom or an old browser", () => {
      expect("fonts" in document).toBe(false);

      expect(() => render(<Harness body={actionsRow(pair)} />)).not.toThrow();
      expect(latest().unfoldedActionsPx).toBe(92);
    });

    it("does not throw for a font set that cannot be listened to", async () => {
      const { settle } = stubFonts({ addEventListener: undefined, removeEventListener: undefined });

      const { unmount } = render(<Harness body={actionsRow(pair)} />);
      await settle();

      expect(() => unmount()).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------------------------
// What the table reserves for its pinned columns, seen through what it hides and how wide it makes them
// ---------------------------------------------------------------------------------------------

describe("DataTable reserved width", () => {
  interface Item {
    id: string;
    name: string;
  }
  const items: Item[] = [
    { id: "r1", name: "One" },
    { id: "r2", name: "Two" },
    { id: "r3", name: "Three" },
  ];
  const getRowId = (item: Item) => item.id;

  // 100px each: 300px of columns, so every px the pinned columns take moves the width at which Extra goes.
  const ranked: DataTableColumn<Item>[] = [
    { name: "id", header: "Id", priority: 1, width: "100px" },
    { name: "name", header: "Name", priority: 2, width: "100px" },
    { name: "extra", header: "Extra", priority: 3, width: "100px" },
  ];
  const plain: DataTableColumn<Item>[] = [
    { name: "id", header: "Id" },
    { name: "name", header: "Name" },
  ];

  const icon = (tag: string) => <svg data-testid={`icon-${tag}`} aria-hidden="true" />;
  const iconActions = (count: number): DataTableRowAction<Item>[] =>
    Array.from({ length: count }, (_, index) => ({
      tag: `a${index}`,
      label: `Action ${index}`,
      icon: icon(`a${index}`),
    }));
  const pairOfActions = iconActions(2);

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

  beforeEach(() => {
    FakeResizeObserver.all.clear();
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });

  const wrapperOf = (container: HTMLElement) =>
    container.querySelector<HTMLElement>("[data-slot='data-table']")!;

  function resizeTo(container: HTMLElement, width: number) {
    const wrapper = wrapperOf(container);
    act(() => {
      for (const observer of FakeResizeObserver.all) {
        if (observer.watches(wrapper)) observer.emit(wrapper, width);
      }
    });
  }

  const dataHeaders = (container: HTMLElement) =>
    Array.from(container.querySelectorAll("thead th:not([data-pin])")).map(
      (th) => th.textContent?.trim() ?? "",
    );

  /** Which columns a fresh table shows at this width: a first measurement, so with no history. */
  function shownAt(width: number, props: Partial<React.ComponentProps<typeof DataTable<Item>>>) {
    const { container, unmount } = render(
      <DataTable
        columns={ranked}
        rows={items}
        getRowId={getRowId}
        rowActions={pairOfActions}
        {...props}
      />,
    );
    resizeTo(container, width);
    const headers = dataHeaders(container);
    unmount();
    return headers;
  }
  const ALL = ["Id", "Name", "Extra"];
  const WITHOUT_EXTRA = ["Id", "Name"];

  describe("what the fit holds back for the pinned columns", () => {
    // Bordered table: 48 for the cell with the details button, 100 for two icon buttons and 2 for
    // the border the wrapper's width includes. 0.2.1 held back 116 here (36 + 80, no border).
    it("holds back 150px for a details button and two icon actions, 34px more than 0.2.1 did", () => {
      expect(shownAt(450, {})).toEqual(ALL);
      expect(shownAt(449, {})).toEqual(WITHOUT_EXTRA);
      // Room that 0.2.1 spent on the data columns and the pinned ones really take.
      expect(shownAt(420, {})).toEqual(WITHOUT_EXTRA);
    });

    it("holds nothing back for the actions column when no row has an action", () => {
      // 48 + 2: the details button's cell alone.
      expect(shownAt(350, { rowActions: undefined })).toEqual(ALL);
      expect(shownAt(349, { rowActions: undefined })).toEqual(WITHOUT_EXTRA);
    });

    it("keeps the column with collapseRowActionsBelow, which frees the room of the extra button", () => {
      // Folded: 48 + 57 + 2 = 107, so 407px. The same table without the fold needs 450.
      expect(shownAt(449, { collapseRowActionsBelow: 500 })).toEqual(ALL);
      expect(shownAt(407, { collapseRowActionsBelow: 500 })).toEqual(ALL);
      expect(shownAt(406, { collapseRowActionsBelow: 500 })).toEqual(WITHOUT_EXTRA);
    });

    it("holds back the unfolded width again once the container is wide enough for the buttons", () => {
      // Above the threshold plus the margin the buttons are back, and so are the 43px they take.
      expect(shownAt(524, { collapseRowActionsBelow: 500 })).toEqual(ALL);
      expect(shownAt(449, { collapseRowActionsBelow: 400 })).toEqual(WITHOUT_EXTRA);
    });

    it("does not reserve for a fold that does nothing: no row has more than one action", () => {
      // One icon button is 57px folded or not; the fold has nothing to give back.
      const one = iconActions(1);
      expect(shownAt(407, { rowActions: one, collapseRowActionsBelow: 500 })).toEqual(ALL);
      expect(shownAt(406, { rowActions: one, collapseRowActionsBelow: 500 })).toEqual(
        WITHOUT_EXTRA,
      );
    });

    it("counts the checkbox that selection adds to the start cell", () => {
      // 70 for the checkbox and the details button, 100 and 2.
      expect(shownAt(472, { selectable: true })).toEqual(ALL);
      expect(shownAt(471, { selectable: true })).toEqual(WITHOUT_EXTRA);
    });

    it("sizes the actions cell for the row with the most actions", () => {
      // Three icon buttons are 143px: 48 + 143 + 2 = 193.
      const widest = (item: Item) => iconActions(item.id === "r2" ? 3 : 1);
      expect(shownAt(493, { rowActions: widest })).toEqual(ALL);
      expect(shownAt(492, { rowActions: widest })).toEqual(WITHOUT_EXTRA);
    });

    it("follows the density, whose padding and controls are a different number of steps", () => {
      // Small: 39 for the details cell and 91 for two icon buttons; Large: 57 and 108.
      expect(shownAt(432, { density: Densities.Small })).toEqual(ALL);
      expect(shownAt(431, { density: Densities.Small })).toEqual(WITHOUT_EXTRA);
      expect(shownAt(467, { density: Densities.Large })).toEqual(ALL);
      expect(shownAt(466, { density: Densities.Large })).toEqual(WITHOUT_EXTRA);
    });

    it("does not count the border of a table that draws none", () => {
      expect(shownAt(448, { variant: "embedded" })).toEqual(ALL);
      expect(shownAt(447, { variant: "embedded" })).toEqual(WITHOUT_EXTRA);
    });
  });

  describe("a consumer's blanket offsetWidth stub", () => {
    // Every element "measures" 1000px, the wrapper included, so there is room for everything the
    // reserve could honestly be. A 1000px checkbox or actions cell taken at its word is not, and a
    // container with no width of its own (jsdom's clientWidth is 0) is not a layout to believe.
    function stubbed(props: Partial<React.ComponentProps<typeof DataTable<Item>>>) {
      layout.override = (_element, property) => (property === "w" ? 1000 : undefined);
      computedStyle.mockImplementation(realComputedStyle as never);
      return render(
        <DataTable
          columns={ranked}
          rows={items}
          getRowId={getRowId}
          collapseRowActionsBelow={1}
          {...props}
        />,
      );
    }

    it("does not become a huge reserved width for the actions column", () => {
      const { container } = stubbed({ rowActions: pairOfActions });

      expect(dataHeaders(container)).toEqual(ALL);
    });

    it("does not become a huge reserved width for the selection checkbox", () => {
      const { container } = stubbed({ selectable: true });

      expect(dataHeaders(container)).toEqual(ALL);
    });
  });

  describe("a windowed table, which is laid out with fixed widths", () => {
    const ROW_HEIGHT = 40;
    const VIEWPORT_HEIGHT = 400;

    beforeEach(() => {
      // virtual-core measures with offsetHeight, which jsdom reports as 0: no row would be rendered.
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
        configurable: true,
        get(this: HTMLElement) {
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
      // @ts-expect-error - restoring jsdom's own getters
      delete HTMLElement.prototype.offsetHeight;
      // @ts-expect-error - as above
      delete HTMLElement.prototype.clientHeight;
    });

    function windowed(props: Partial<React.ComponentProps<typeof DataTable<Item>>> = {}) {
      return render(
        <DataTable
          columns={plain}
          rows={items}
          getRowId={getRowId}
          selectable
          rowActions={pairOfActions}
          virtualized
          paginated={false}
          estimateRowHeight={ROW_HEIGHT}
          {...props}
        />,
      );
    }

    const styleOf = (element: Element | null) => element?.getAttribute("style") ?? "";
    const startHead = (container: HTMLElement) =>
      container.querySelector("thead th[data-pin='start']");
    const endHead = (container: HTMLElement) => container.querySelector("thead th[data-pin='end']");
    const startBodyCells = (container: HTMLElement) =>
      Array.from(container.querySelectorAll("tbody td[data-pin='start']"));
    const endBodyCells = (container: HTMLElement) =>
      Array.from(container.querySelectorAll("tbody td[data-pin='end']"));

    it("gives the start and actions cells widths from the model, header and body alike", () => {
      const { container } = windowed();

      expect(container.querySelector("table")!.className).toContain("table-fixed");
      expect(endBodyCells(container)).toHaveLength(items.length);
      // The checkbox alone, 35px: no column is hidden, so there is no details button in the cell.
      for (const cell of [startHead(container), ...startBodyCells(container)]) {
        expect(styleOf(cell)).toContain("width: 35px");
      }
      for (const cell of [endHead(container), ...endBodyCells(container)]) {
        expect(styleOf(cell)).toContain(`width: var(${ACTIONS_WIDTH_VAR}, 100px)`);
      }
    });

    it("does not leave the w-0 class on cells that have a width of their own", () => {
      const { container } = windowed();

      expect(startHead(container)!.className.split(/\s+/)).not.toContain("w-0");
      expect(endHead(container)!.className.split(/\s+/)).not.toContain("w-0");
    });

    it("keeps the shrink-to-fit w-0 of an ordinary table, with no inline width", () => {
      const { container } = windowed({ virtualized: false });

      for (const cell of [startHead(container), endHead(container)]) {
        expect(cell!.className.split(/\s+/)).toContain("w-0");
        expect(styleOf(cell)).not.toContain("width");
      }
    });

    it("sizes the actions cell for the icon buttons of the row with the most", () => {
      const { container } = windowed({ rowActions: iconActions(3) });

      expect(styleOf(endHead(container))).toContain(`${ACTIONS_WIDTH_VAR}, 143px)`);
    });

    it("widens the start cell by the details button when a column is hidden by width", () => {
      const { container } = windowed({ columns: ranked, collapseRowActionsBelow: 1 });

      resizeTo(container, 1000);
      expect(styleOf(startHead(container))).toContain("width: 35px");

      resizeTo(container, 300);
      // 70px: checkbox, gap, details button and the cell's padding.
      expect(styleOf(startHead(container))).toContain("width: 70px");
      for (const cell of startBodyCells(container)) expect(styleOf(cell)).toContain("width: 70px");
    });

    it("shrinks the actions cell to one menu button while the actions are folded", () => {
      const { container } = windowed({ collapseRowActionsBelow: 600 });

      resizeTo(container, 1000);
      expect(styleOf(endHead(container))).toContain(`${ACTIONS_WIDTH_VAR}, 100px)`);

      resizeTo(container, 500);
      expect(styleOf(endHead(container))).toContain(`${ACTIONS_WIDTH_VAR}, 57px)`);
      for (const cell of endBodyCells(container)) {
        expect(styleOf(cell)).toContain(`${ACTIONS_WIDTH_VAR}, 57px)`);
      }
      // And the folded cell really holds the one button that 57px is for.
      expect(screen.getAllByRole("button", { name: /^Actions for / }).length).toBe(items.length);
    });

    it("keeps the unfolded width for a row that is not folded, since a single button needs no menu", () => {
      const { container } = windowed({ rowActions: iconActions(1), collapseRowActionsBelow: 600 });

      resizeTo(container, 500);

      expect(styleOf(endHead(container))).toContain(`${ACTIONS_WIDTH_VAR}, 57px)`);
      expect(screen.queryAllByRole("button", { name: /^Actions for / })).toHaveLength(0);
    });

    it("widens the actions cell to what text-labelled buttons were measured to need", () => {
      layout.room = 4000;
      // The model assumes icons; "Archive" and "Delete" are as wide as their words.
      const labelled: DataTableRowAction<Item>[] = [
        { tag: "archive", label: "Archive" },
        { tag: "delete", label: "Delete" },
      ];
      layout.override = (element, property) => {
        const group = element.parentElement;
        if (group?.dataset.slot !== "data-table-row-actions") return undefined;
        const index = Array.from(group.children).indexOf(element);
        // Two 70px buttons with a 4px gap between them.
        return property === "w" ? 70 : index * 74;
      };
      const { container } = windowed({ rowActions: labelled, collapseRowActionsBelow: 600 });

      resizeTo(container, 1000);

      // 144px of buttons and 2 x 8.64 of padding, rounded up.
      expect(styleOf(endHead(container))).toContain(`${ACTIONS_WIDTH_VAR}, 162px)`);
      for (const cell of endBodyCells(container)) {
        expect(styleOf(cell)).toContain(`${ACTIONS_WIDTH_VAR}, 162px)`);
      }
    });

    it("holds the measured width back from the data columns as well", () => {
      layout.room = 4000;
      const labelled: DataTableRowAction<Item>[] = [
        { tag: "archive", label: "Archive" },
        { tag: "delete", label: "Delete" },
      ];
      layout.override = (element, property) => {
        const group = element.parentElement;
        if (group?.dataset.slot !== "data-table-row-actions") return undefined;
        const index = Array.from(group.children).indexOf(element);
        return property === "w" ? 70 : index * 74;
      };
      const props = { columns: ranked, rowActions: labelled, collapseRowActionsBelow: 1 };

      // Measured: 48 + 162 + 2 + selection's 22 = 234, so 534px. The model alone says 172 + 300.
      const wide = windowed({ ...props });
      resizeTo(wide.container, 534);
      expect(dataHeaders(wide.container)).toEqual(ALL);
      wide.unmount();

      const narrower = windowed({ ...props });
      resizeTo(narrower.container, 533);
      expect(dataHeaders(narrower.container)).toEqual(WITHOUT_EXTRA);
    });
  });
});
