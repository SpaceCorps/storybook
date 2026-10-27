import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VirtualList, type VirtualListProps } from "./virtual-list";

/** Measured height of every item. `estimateSize` matches it so the total size is exact. */
const ITEM_HEIGHT = 40;
const VIEWPORT_HEIGHT = 400;
const ITEM_COUNT = 1000;
const TOTAL_HEIGHT = ITEM_COUNT * ITEM_HEIGHT;
const TEST_ID = "virtual-list";
const VIEWPORT_WIDTH = 300;

interface Entry {
  id: string;
  label: string;
}

const entries: Entry[] = Array.from({ length: ITEM_COUNT }, (_, index) => ({
  id: `e${index + 1}`,
  // Zero-padded so "Entry 1" cannot substring-match "Entry 1000".
  label: `Entry ${String(index + 1).padStart(4, "0")}`,
}));

const itemKey = (item: Entry): string => item.id;

/** Entries 1 to `count`: few enough to fit the viewport, or enough to overflow it. */
const firstEntries = (count: number): Entry[] => entries.slice(0, count);

/** How many items fit the viewport exactly. */
const FITTING_COUNT = VIEWPORT_HEIGHT / ITEM_HEIGHT;

function renderList(items: Entry[] = entries) {
  return render(
    <VirtualList
      items={items}
      getItemKey={itemKey}
      estimateSize={ITEM_HEIGHT}
      data-testid={TEST_ID}
      aria-label="Entries"
      renderItem={(item) => <div>{item.label}</div>}
    />,
  );
}

/** The list with only what it must have, so a test can leave a prop out or add one. */
function renderBare(
  props: Partial<VirtualListProps<Entry>> = {},
  renderItem?: VirtualListProps<Entry>["renderItem"],
) {
  return render(
    <VirtualList
      items={entries}
      getItemKey={itemKey}
      estimateSize={ITEM_HEIGHT}
      data-testid={TEST_ID}
      renderItem={renderItem ?? ((item) => <div>{item.label}</div>)}
      {...props}
    />,
  );
}

function scroller(): HTMLElement {
  return screen.getByTestId(TEST_ID);
}

/** The inner element whose height stands in for every unrendered item. */
function spacer(): HTMLElement {
  const node = scroller().firstElementChild;
  if (!(node instanceof HTMLElement)) throw new Error("No spacer rendered");
  return node;
}

function renderedItems(): HTMLElement[] {
  return Array.from(spacer().querySelectorAll<HTMLElement>("[data-index]"));
}

/** jsdom does no layout, so a scroll has to be driven by hand. */
function scrollTo(offset: number) {
  const element = scroller();
  act(() => {
    element.scrollTop = offset;
    element.dispatchEvent(new Event("scroll"));
  });
}

/** The scroller's box and how wide its content is, which jsdom has no layout to work out. */
let box = {
  clientHeight: VIEWPORT_HEIGHT,
  clientWidth: VIEWPORT_WIDTH,
  scrollWidth: VIEWPORT_WIDTH,
};
let resizeCallbacks: Array<ResizeObserverCallback> = [];

/** Fires every ResizeObserver a component made, as the browser does when a box changes size. */
function resizeBoxes() {
  act(() => {
    for (const callback of resizeCallbacks) callback([], {} as ResizeObserver);
  });
}

function stubResizeObserver() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
}

const isScroller = (node: HTMLElement) => node.dataset.testid === TEST_ID;

beforeEach(() => {
  box = { clientHeight: VIEWPORT_HEIGHT, clientWidth: VIEWPORT_WIDTH, scrollWidth: VIEWPORT_WIDTH };
  // virtual-core measures with `offsetHeight`, which jsdom always reports as 0 — without this the
  // virtualizer renders nothing at all.
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      if (this.hasAttribute("data-index")) return ITEM_HEIGHT;
      if (isScroller(this)) return VIEWPORT_HEIGHT;
      return 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return isScroller(this) ? box.clientHeight : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return isScroller(this) ? box.clientWidth : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return isScroller(this) ? box.scrollWidth : 0;
    },
  });
  // What makes a scroller scroll is its spacer, whose height stands in for every item.
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLElement) {
      const spacerNode = this.firstElementChild;
      if (!isScroller(this) || !(spacerNode instanceof HTMLElement)) return 0;
      return Number.parseFloat(spacerNode.style.height) || 0;
    },
  });
});

afterEach(() => {
  for (const key of [
    "offsetHeight",
    "clientHeight",
    "clientWidth",
    "scrollWidth",
    "scrollHeight",
  ]) {
    // jsdom's own getters are not configurable by default, so removing ours restores them.
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
  }
  resizeCallbacks = [];
  vi.unstubAllGlobals();
});

describe("VirtualList", () => {
  it("mounts a bounded window while reporting the full scroll height", () => {
    renderList();

    const rendered = renderedItems();
    expect(rendered.length).toBeGreaterThan(0);
    // Not an exact count: overscan is tunable, a blown-open window is not.
    expect(rendered.length).toBeLessThan(60);
    expect(spacer().style.height).toBe(`${TOTAL_HEIGHT}px`);
    expect(screen.getByText("Entry 0001")).toBeInTheDocument();
    expect(screen.queryByText("Entry 1000")).not.toBeInTheDocument();
  });

  it("renders the last item at the end of the range and the first back at the top", () => {
    renderList();

    scrollTo(TOTAL_HEIGHT - VIEWPORT_HEIGHT);
    expect(screen.getByText("Entry 1000")).toBeInTheDocument();
    expect(screen.queryByText("Entry 0001")).not.toBeInTheDocument();

    scrollTo(0);
    expect(screen.getByText("Entry 0001")).toBeInTheDocument();
    expect(screen.queryByText("Entry 1000")).not.toBeInTheDocument();
  });

  it("tags every rendered item with the data-index measureElement reads back", () => {
    renderList();

    const indexes = renderedItems().map((node) => Number(node.dataset.index));
    expect(indexes).toEqual(indexes.map((_, position) => indexes[0] + position));
    expect(indexes.every((index) => Number.isInteger(index))).toBe(true);
  });

  it("keys items by getItemKey, so mutating one item does not remount its neighbours", () => {
    const { rerender } = renderList();

    const before = renderedItems();
    const neighbours = [before[0], before[2]];

    const mutated = entries.slice();
    mutated[1] = { ...mutated[1], label: "Entry 0002 (edited)" };
    act(() => {
      rerender(
        <VirtualList
          items={mutated}
          getItemKey={itemKey}
          estimateSize={ITEM_HEIGHT}
          data-testid={TEST_ID}
          aria-label="Entries"
          renderItem={(item) => <div>{item.label}</div>}
        />,
      );
    });

    expect(screen.getByText("Entry 0002 (edited)")).toBeInTheDocument();
    // Same DOM nodes, not replacements: the key is the item id, not the array position.
    const after = renderedItems();
    expect(after[0]).toBe(neighbours[0]);
    expect(after[2]).toBe(neighbours[1]);
  });
});

describe("VirtualList keyboard reachability", () => {
  it("is a tab stop while it overflows, so a keyboard can scroll it when no row holds anything focusable", async () => {
    const user = userEvent.setup();
    renderList();

    expect(scroller()).toHaveAttribute("tabindex", "0");
    await user.tab();
    expect(scroller()).toHaveFocus();
  });

  it("stays a tab stop, ahead of the controls, when the rows hold focusable content", async () => {
    const user = userEvent.setup();
    renderBare({ "aria-label": "Entries" }, (item) => <button type="button">{item.label}</button>);

    await user.tab();
    expect(scroller()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Entry 0001" })).toHaveFocus();
  });

  it("is a region named by its aria-label", () => {
    renderList();

    expect(screen.getByRole("region", { name: "Entries" })).toBe(scroller());
  });

  it("is named by the element aria-labelledby points to, and carries no aria-label then", () => {
    render(
      <>
        <h3 id="log-heading">Job log</h3>
        <VirtualList
          items={entries}
          getItemKey={itemKey}
          estimateSize={ITEM_HEIGHT}
          data-testid={TEST_ID}
          aria-labelledby="log-heading"
          renderItem={(item) => <div>{item.label}</div>}
        />
      </>,
    );

    expect(screen.getByRole("region", { name: "Job log" })).toBe(scroller());
    expect(scroller()).not.toHaveAttribute("aria-label");
  });

  it('is called "Scrollable list" when nobody named it, not left as an unnamed stop', () => {
    renderBare();

    expect(screen.getByRole("region", { name: "Scrollable list" })).toBe(scroller());
  });

  it("is not a stop, a region or named when its items fit, since there is nothing to scroll", async () => {
    const user = userEvent.setup();
    renderList(firstEntries(FITTING_COUNT));

    expect(scroller()).not.toHaveAttribute("tabindex");
    expect(scroller()).not.toHaveAttribute("role");
    expect(scroller()).not.toHaveAttribute("aria-label");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    await user.tab();
    expect(scroller()).not.toHaveFocus();
  });

  it("is not a stop, a region or named when it is empty", () => {
    renderList([]);

    expect(scroller()).not.toHaveAttribute("tabindex");
    expect(scroller()).not.toHaveAttribute("role");
    expect(scroller()).not.toHaveAttribute("aria-label");
  });

  it("does not name an unnamed list either while it fits", () => {
    renderBare({ items: firstEntries(3) });

    expect(scroller()).not.toHaveAttribute("aria-label");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("allows a pixel of overflow, which rounding alone can produce", () => {
    box.clientHeight = VIEWPORT_HEIGHT - 1;
    renderList(firstEntries(FITTING_COUNT));
    expect(scroller()).not.toHaveAttribute("tabindex");
  });

  it("is a stop from two pixels of overflow", () => {
    box.clientHeight = VIEWPORT_HEIGHT - 2;
    renderList(firstEntries(FITTING_COUNT));
    expect(scroller()).toHaveAttribute("tabindex", "0");
  });

  it("follows its items: a stop once they outgrow the box, and not once they fit again", () => {
    const { rerender } = renderList(firstEntries(FITTING_COUNT));
    const listWith = (items: Entry[]) => (
      <VirtualList
        items={items}
        getItemKey={itemKey}
        estimateSize={ITEM_HEIGHT}
        data-testid={TEST_ID}
        aria-label="Entries"
        renderItem={(item) => <div>{item.label}</div>}
      />
    );
    expect(scroller()).not.toHaveAttribute("tabindex");

    rerender(listWith(firstEntries(FITTING_COUNT + 5)));
    expect(scroller()).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("region", { name: "Entries" })).toBe(scroller());

    rerender(listWith(firstEntries(FITTING_COUNT)));
    expect(scroller()).not.toHaveAttribute("tabindex");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("follows its box: resizing it past the content takes the stop away, and back brings it", () => {
    stubResizeObserver();
    renderList(firstEntries(FITTING_COUNT + 5));
    expect(scroller()).toHaveAttribute("tabindex", "0");

    box.clientHeight = TOTAL_HEIGHT;
    resizeBoxes();
    expect(scroller()).not.toHaveAttribute("tabindex");
    expect(scroller()).not.toHaveAttribute("role");

    box.clientHeight = VIEWPORT_HEIGHT;
    resizeBoxes();
    expect(scroller()).toHaveAttribute("tabindex", "0");
    expect(scroller()).toHaveAttribute("role", "region");
  });

  describe("sideways", () => {
    // jsdom has no stylesheet for the utility classes, so the overflow a class would set is stated.
    const style = document.createElement("style");
    style.textContent =
      ".sideways-auto { overflow-x: auto } .sideways-hidden { overflow-x: hidden }";

    beforeEach(() => {
      document.head.append(style);
      box.scrollWidth = VIEWPORT_WIDTH * 3;
    });
    afterEach(() => style.remove());

    it("is a stop when the content is wider than the box and can be scrolled sideways", () => {
      renderBare({ items: firstEntries(FITTING_COUNT), className: "sideways-auto" });
      expect(scroller()).toHaveAttribute("tabindex", "0");
    });

    it("is not a stop when the wide content cannot be scrolled, because overflow-x is hidden", () => {
      renderBare({ items: firstEntries(FITTING_COUNT), className: "sideways-hidden" });
      expect(scroller()).not.toHaveAttribute("tabindex");
    });
  });

  it("carries the classes that put its rows beneath its focus outline", () => {
    renderList();

    // Whether the outline is then visible is paint, which jsdom has none of: the WithControls story
    // checks in a browser that these classes become the CSS that does it.
    expect(scroller()).toHaveClass(
      "focus-visible:outline-2",
      "focus-visible:-outline-offset-2",
      "focus-visible:outline-ring",
      "isolate",
    );
    expect(spacer()).toHaveClass("-z-10");
  });
});
