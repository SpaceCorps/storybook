import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/ui/tabs";

/*
 * What a tab list does when its tabs do not fit, with the layout supplied by hand: jsdom lays nothing
 * out, so the list's metrics and each tab's box are mocked from a small model (below), and the tests
 * check what the component asks the browser to do with them. That the result is really right on screen
 * is for the play functions in src/stories/tabs.stories.tsx, which run in a browser.
 *
 * Six tabs, 80 60 100 70 90 110 wide, 4px of padding at each end, in a window 200 wide with 24px of
 * scroll padding (the same numbers as tests/tabs-scroll.test.ts). The content is 518 wide: it scrolls
 * 0..318, and a tab is whole at its snap point, its start minus 24.
 */

const TABS = [
  { value: "a", label: "Alpha", width: 80 },
  { value: "b", label: "Beta", width: 60 },
  { value: "c", label: "Gamma", width: 100 },
  { value: "d", label: "Delta", width: 70 },
  { value: "e", label: "Epsilon", width: 90 },
  { value: "f", label: "Zeta", width: 110 },
];

/*
 * `scale` and `shift` stand for a transform on an ancestor (a dialog that opens at 95%): every
 * rectangle the browser reports is scaled and moved, while the scroll metrics stay in layout pixels.
 * `fraction` makes the list's box a fractional number of pixels wide, as it is in a fluid layout, `snap`
 * is how far the browser's rounded `offsetWidth` strays from it (snapped to a device pixel, it can be a
 * pixel off), and `contentBox` is a list whose computed width excludes its padding and border.
 */
const layout = {
  client: 200,
  scroll: 0,
  rtl: false,
  scale: 1,
  shift: 0,
  fraction: 0,
  snap: 0,
  contentBox: false,
};

const isList = (element: Element) => element.getAttribute("role") === "tablist";
const content = () => TABS.reduce((sum, tab) => sum + tab.width, 8);
/** The list's border box: its client width and a pixel of border on each side. */
const listWidth = () => layout.client + 2 + layout.fraction;

/** `scroll` is the distance from the start; the browser reports it negated in a right-to-left list. */
const reported = () => (layout.rtl ? -layout.scroll : layout.scroll);

let scrollTo: ReturnType<typeof vi.fn>;

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(readonly callback: () => void) {
    FakeResizeObserver.instances.push(this);
  }
}

/**
 * Whether an element's focus counts as :focus-visible, which jsdom cannot decide for itself. The
 * descriptor rather than the method: reading `Element.prototype.matches` as a value is an
 * unbound-method reference.
 */
const focusVisible = (visible: boolean) => {
  const original = Object.getOwnPropertyDescriptor(Element.prototype, "matches")?.value as (
    this: Element,
    selector: string,
  ) => boolean;
  vi.spyOn(Element.prototype, "matches").mockImplementation(function (
    this: Element,
    selector: string,
  ) {
    return selector === ":focus-visible" ? visible : original.call(this, selector);
  });
};

const matchMediaReducing = (reduce: boolean) =>
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: reduce && query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList,
  );

beforeEach(() => {
  layout.client = 200;
  layout.scroll = 0;
  layout.rtl = false;
  layout.scale = 1;
  layout.shift = 0;
  layout.fraction = 0;
  layout.snap = 0;
  layout.contentBox = false;
  FakeResizeObserver.instances = [];
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);

  vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(function (this: Element) {
    return isList(this) ? layout.client : 0;
  });
  vi.spyOn(Element.prototype, "scrollWidth", "get").mockImplementation(function (this: Element) {
    return isList(this) ? content() : 0;
  });
  vi.spyOn(Element.prototype, "clientLeft", "get").mockImplementation(function (this: Element) {
    return isList(this) ? 1 : 0;
  });
  // Rounded, as the browser rounds it, whatever the box really measures. The code under test must not
  // lean on it: `snap` makes it a pixel off the way a box at a fractional position can be.
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return isList(this) ? Math.round(listWidth()) + layout.snap : 0;
    },
  );
  vi.spyOn(Element.prototype, "scrollLeft", "get").mockImplementation(function (this: Element) {
    return isList(this) ? reported() : 0;
  });
  vi.spyOn(Element.prototype, "scrollLeft", "set").mockImplementation(function (
    this: Element,
    value: number,
  ) {
    if (isList(this)) layout.scroll = layout.rtl ? -value : value;
  });
  scrollTo = vi.fn(function (this: Element, options: ScrollToOptions) {
    layout.scroll = layout.rtl ? -(options.left ?? 0) : (options.left ?? 0);
  });
  Object.defineProperty(Element.prototype, "scrollTo", { value: scrollTo, configurable: true });

  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    let left = 0;
    let width = listWidth();
    if (this.getAttribute("role") === "tab") {
      const list = this.closest('[role="tablist"]')!;
      const index = Array.from(list.querySelectorAll('[role="tab"]')).indexOf(this);
      const offset = 4 + TABS.slice(0, index).reduce((sum, tab) => sum + tab.width, 0);
      width = TABS[index]!.width;
      // 1px of border, then the content, scrolled away from its start.
      left = layout.rtl
        ? listWidth() - 1 - offset - width + layout.scroll
        : 1 + offset - layout.scroll;
    } else if (!isList(this)) {
      width = 0;
    }
    // Where the screen puts it: scaled about the origin, then moved.
    const x = layout.shift + left * layout.scale;
    const scaled = width * layout.scale;
    return {
      left: x,
      right: x + scaled,
      top: 0,
      bottom: 38,
      width: scaled,
      height: 38,
      x,
      y: 0,
      toJSON() {},
    };
  });

  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const real = original(element, pseudo);
    if (!isList(element)) return real;
    return new Proxy(real, {
      get(target, property) {
        if (property === "direction") return layout.rtl ? "rtl" : "ltr";
        // The used width, which is the border box unless the box-sizing says otherwise (8px of
        // padding and 2px of border).
        if (property === "boxSizing") return layout.contentBox ? "content-box" : "border-box";
        if (property === "width") return `${listWidth() - (layout.contentBox ? 10 : 0)}px`;
        if (property === "paddingLeft" || property === "paddingRight") return "4px";
        if (property === "borderLeftWidth" || property === "borderRightWidth") return "1px";
        if (property === "scrollPaddingLeft" || property === "scrollPaddingRight") return "24px";
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, "scrollTo");
});

/** `count` renders only the first few triggers, as a list does that is still being loaded. */
function SixTabs(
  props: React.ComponentProps<typeof Tabs> & { listProps?: object; count?: number; round?: number },
) {
  const { listProps, count = TABS.length, round = 0, ...rest } = props;
  return (
    <Tabs defaultValue="a" {...rest}>
      <TabsList aria-label="Letters" {...listProps}>
        {/* A new `round` replaces every trigger with a new element for the same tab. */}
        <React.Fragment key={round}>
          {TABS.slice(0, count).map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </React.Fragment>
      </TabsList>
      {TABS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.label} panel
        </TabsContent>
      ))}
    </Tabs>
  );
}

const list = () => screen.getByRole("tablist");
const sides = () => ({
  left: list().hasAttribute("data-overflow-left"),
  right: list().hasAttribute("data-overflow-right"),
});
/**
 * The call the component made to move the list, as [offset, behavior]. Rounded to ten thousandths:
 * a scaled rectangle and its division back leave floating-point dust that no browser would show.
 */
const lastScroll = () => {
  const call = scrollTo.mock.calls.at(-1)?.[0] as ScrollToOptions | undefined;
  return call ? [Math.round((call.left ?? 0) * 1e4) / 1e4, call.behavior] : undefined;
};

describe("TabsList scrolling: where it puts the active tab", () => {
  it("places an active tab that starts off-screen on the first render, without animating", () => {
    render(<SixTabs defaultValue="f" />);

    expect(scrollTo).toHaveBeenCalledTimes(1);
    // The last tab wants its snap point (380), but there is only 318 to scroll.
    expect(lastScroll()).toEqual([318, "auto"]);
  });

  it("leaves the list alone when the active tab is already whole", () => {
    render(<SixTabs defaultValue="a" />);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls smoothly when the value changes from the outside", () => {
    const { rerender } = render(<SixTabs value="a" />);

    rerender(<SixTabs value="c" />);

    // Gamma needs 68 to be whole; the first snap point that holds it is its own, 120.
    expect(lastScroll()).toEqual([120, "smooth"]);
  });

  it("scrolls back to a tab that was left behind", () => {
    layout.scroll = 318;
    const { rerender } = render(<SixTabs value="f" />);
    scrollTo.mockClear();

    rerender(<SixTabs value="b" />);

    expect(lastScroll()).toEqual([60, "smooth"]);
  });

  it("does not animate under prefers-reduced-motion", () => {
    matchMediaReducing(true);
    const { rerender } = render(<SixTabs value="a" />);

    rerender(<SixTabs value="c" />);

    expect(lastScroll()).toEqual([120, "auto"]);
  });

  describe("when matchMedia cannot answer", () => {
    // Stubbed, partial and sandboxed environments: a `matchMedia` that throws, hands back nothing or
    // hands back something that is not a list. A tab change must still work, and mean "not reduced".
    const cases: Array<[string, () => unknown]> = [
      [
        "throws",
        () => {
          throw new Error("matchMedia is not available here");
        },
      ],
      ["returns undefined", () => undefined],
      ["returns null", () => null],
      ["returns an object with no `matches`", () => ({})],
    ];

    it.each(cases)("scrolls smoothly, as without a preference, when it %s", (_name, answer) => {
      vi.stubGlobal("matchMedia", answer);
      const { rerender } = render(<SixTabs value="a" />);

      expect(() => rerender(<SixTabs value="c" />)).not.toThrow();

      expect(lastScroll()).toEqual([120, "smooth"]);
    });

    it("scrolls smoothly when matchMedia is not a function at all", () => {
      vi.stubGlobal("matchMedia", "reduce");
      const { rerender } = render(<SixTabs value="a" />);

      expect(() => rerender(<SixTabs value="c" />)).not.toThrow();

      expect(lastScroll()).toEqual([120, "smooth"]);
    });
  });

  it("brings a tab into view when it is clicked part-way out", async () => {
    const user = userEvent.setup();
    render(<SixTabs />);

    await user.click(screen.getByRole("tab", { name: "Gamma" }));

    expect(layout.scroll).toBe(120);
    expect(screen.getByRole("tab", { name: "Gamma" }).getAttribute("aria-selected")).toBe("true");
  });

  it("never scrolls the page, only the list", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
    const { rerender } = render(<SixTabs defaultValue="f" />);
    rerender(<SixTabs defaultValue="f" value="c" />);
    await user.click(screen.getByRole("tab", { name: "Epsilon" }));
    await user.keyboard("{ArrowLeft}");

    expect(scrollTo).toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("works from the right in a right-to-left list", () => {
    layout.rtl = true;

    render(<SixTabs defaultValue="f" />);

    // The browser counts a right-to-left scroll in negative numbers.
    expect(lastScroll()).toEqual([-318, "auto"]);
    expect(layout.scroll).toBe(318);
  });

  it("waits for a list that has no width yet, then places the tab", () => {
    layout.client = 0;
    render(<SixTabs defaultValue="f" />);
    expect(scrollTo).not.toHaveBeenCalled();

    layout.client = 200;
    act(() => FakeResizeObserver.instances[0]!.callback());

    expect(lastScroll()).toEqual([318, "auto"]);
  });
});

describe("TabsList scrolling: a tab that arrives or is replaced", () => {
  it("places a tab in use that is only mounted after the value was set, without animating", () => {
    // A controlled value whose trigger is rendered later (tabs loaded from a request).
    const { rerender } = render(<SixTabs value="f" count={2} />);
    expect(scrollTo).not.toHaveBeenCalled();

    rerender(<SixTabs value="f" count={6} />);

    expect(lastScroll()).toEqual([318, "auto"]);
  });

  it("places a tab in use that was replaced by a new element for the same value", () => {
    const { rerender } = render(<SixTabs value="f" round={0} />);
    layout.scroll = 0;
    scrollTo.mockClear();

    rerender(<SixTabs value="f" round={1} />);

    expect(lastScroll()).toEqual([318, "auto"]);
  });

  it("does not pull the list back when the person has scrolled away from the tab in use", () => {
    const { rerender } = render(<SixTabs value="f" />);
    expect(scrollTo).toHaveBeenCalledTimes(1);

    // They scroll to look at the other tabs, and the page re-renders for its own reasons.
    layout.scroll = 0;
    fireEvent.scroll(list());
    rerender(<SixTabs value="f" />);
    rerender(<SixTabs value="f" />);

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});

describe("TabsList scrolling: the box is resized", () => {
  it("brings the tab in use back when a narrower box cuts it off, without animating", () => {
    layout.client = 600;
    render(<SixTabs defaultValue="f" />);
    expect(scrollTo).not.toHaveBeenCalled();

    layout.client = 200;
    act(() => FakeResizeObserver.instances[0]!.callback());

    // A smooth scroll would lag behind a window that is being dragged.
    expect(lastScroll()).toEqual([318, "auto"]);
    expect(sides()).toEqual({ left: true, right: false });
  });

  it("keeps a tab in the middle whole as the box shrinks again and again", () => {
    layout.client = 400;
    render(<SixTabs defaultValue="c" />);
    expect(scrollTo).not.toHaveBeenCalled();

    // Gamma ends at 244: it is whole in a window 400 wide, and no longer in one 200 wide.
    layout.client = 200;
    act(() => FakeResizeObserver.instances[0]!.callback());
    expect(lastScroll()).toEqual([120, "auto"]);

    // The browser keeps the offset (it is still a snap point), and Gamma still fits at 160.
    layout.client = 160;
    act(() => FakeResizeObserver.instances[0]!.callback());
    expect(layout.scroll).toBe(120);
  });

  it("leaves the list alone when the tab in use is still whole after the resize", () => {
    layout.client = 600;
    render(<SixTabs defaultValue="b" />);

    layout.client = 300;
    act(() => FakeResizeObserver.instances[0]!.callback());

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("does not fight a person's scroll when the box did not change width", () => {
    render(<SixTabs value="f" />);
    expect(scrollTo).toHaveBeenCalledTimes(1);

    // They scroll away; the observer fires for something that is not the width (the height).
    layout.scroll = 0;
    fireEvent.scroll(list());
    act(() => FakeResizeObserver.instances[0]!.callback());

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("works from the right in a right-to-left list", () => {
    layout.rtl = true;
    layout.client = 600;
    render(<SixTabs defaultValue="f" />);

    layout.client = 200;
    act(() => FakeResizeObserver.instances[0]!.callback());

    expect(lastScroll()).toEqual([-318, "auto"]);
  });

  it("does nothing for a list with no tab in use, or one that turned vertical", () => {
    layout.client = 600;
    const { rerender } = render(<SixTabs value="nowhere" />);
    layout.client = 200;
    act(() => FakeResizeObserver.instances[0]!.callback());
    expect(scrollTo).not.toHaveBeenCalled();

    rerender(<SixTabs value="f" orientation="vertical" />);
    layout.client = 100;
    act(() => FakeResizeObserver.instances[0]!.callback());
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe("TabsList scrolling: under a transform", () => {
  // A dialog or a popover opens with a scale animation, so its first placement is made at 95%, and a
  // page can scale a whole panel. The rectangles are then in screen pixels and the scroll offsets in
  // layout pixels: they have to be brought back to one space before they are compared.
  it("places the tab in use on the first render as it would without the transform", () => {
    layout.scale = 0.8;
    layout.shift = 30;

    render(<SixTabs defaultValue="f" />);

    expect(lastScroll()).toEqual([318, "auto"]);
  });

  it("scrolls to the same snap point for a value change, forwards and back", () => {
    layout.scale = 0.8;
    layout.shift = 30;
    const { rerender } = render(<SixTabs value="a" />);

    rerender(<SixTabs value="c" />);
    expect(lastScroll()).toEqual([120, "smooth"]);

    rerender(<SixTabs value="b" />);
    expect(lastScroll()).toEqual([60, "smooth"]);
  });

  it("is as exact for a tab far from the edge: three tabs along, scaled up", () => {
    layout.scale = 1.25;
    layout.shift = -12;
    const { rerender } = render(<SixTabs value="a" />);

    rerender(<SixTabs value="e" />);

    expect(lastScroll()).toEqual([290, "smooth"]);
  });

  it("works from the right in a right-to-left list", () => {
    layout.scale = 0.9;
    layout.shift = 7;
    layout.rtl = true;

    render(<SixTabs defaultValue="f" />);

    expect(lastScroll()).toEqual([-318, "auto"]);
  });

  it("reads the width of a content-box list as its border box, and is exact", () => {
    // 192px of content in a 202px box: the computed width alone would call this a scale of 0.84.
    layout.contentBox = true;
    layout.scale = 0.8;
    layout.shift = 30;
    const { rerender } = render(<SixTabs value="a" />);

    // A tab 400px along is the one that shows a wrong scale (the last tab is clamped to the end).
    rerender(<SixTabs value="e" />);

    expect(lastScroll()).toEqual([290, "smooth"]);
  });

  it("does not mistake a fractional width for a transform", () => {
    // A fluid layout gives 202.4px; offsetWidth says 202 or, snapped the other way, 203. Read as a
    // scale that is 1.002 or 0.997, which puts a tab 400px along a pixel or more from where it is.
    for (const snap of [0, 1]) {
      layout.fraction = 0.4;
      layout.snap = snap;
      const { rerender, unmount } = render(<SixTabs value="a" />);

      rerender(<SixTabs value="e" />);

      expect(lastScroll()).toEqual([290, "smooth"]);
      unmount();
    }
  });
});

describe("TabsList scrolling: the arrow keys", () => {
  it("reveals the tab the arrow key moved focus to", async () => {
    focusVisible(true);
    const user = userEvent.setup();
    // Manual activation: only the focus moves, so it is the focus that has to bring the tab in.
    render(<SixTabs activationMode="manual" />);

    await user.tab();
    // Beta is whole at the start; Gamma is not.
    await user.keyboard("{ArrowRight}");
    expect(scrollTo).not.toHaveBeenCalled();
    await user.keyboard("{ArrowRight}");
    expect(lastScroll()).toEqual([120, "auto"]);

    await user.keyboard("{ArrowRight}");

    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Delta" }));
    // Instant: the browser scrolls a focused element into view itself, and would cut a smooth one short.
    expect(lastScroll()).toEqual([220, "auto"]);
  });

  it("reveals the last tab on End and the first on Home", async () => {
    focusVisible(true);
    const user = userEvent.setup();
    render(<SixTabs activationMode="manual" />);

    await user.tab();
    await user.keyboard("{End}");
    expect(lastScroll()).toEqual([318, "auto"]);

    await user.keyboard("{Home}");
    expect(lastScroll()).toEqual([0, "auto"]);
  });

  it("leaves the scroll to the selection when focus came from a press", () => {
    // A press focuses the tab too, but is not keyboard focus (:focus-visible), and the click selects
    // the tab, which scrolls it in on its own and smoothly.
    focusVisible(false);
    render(<SixTabs activationMode="manual" />);

    act(() => screen.getByRole("tab", { name: "Epsilon" }).focus());

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("still calls a consumer's own onFocus on the list", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    render(<SixTabs listProps={{ onFocus }} />);

    await user.tab();

    // The list is reached first and hands focus on to the tab: both bubble through it.
    expect(onFocus).toHaveBeenCalled();
  });

  it("keeps the roving focus and the arrow keys as they were", async () => {
    const user = userEvent.setup();
    render(<SixTabs defaultValue="f" />);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Zeta" }));
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Alpha" }));
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Zeta" }));
    expect(screen.getByRole("tab", { name: "Alpha" }).getAttribute("tabindex")).toBe("-1");
  });
});

describe("TabsList scrolling: the fade edges", () => {
  it("marks only the end that has more past it", () => {
    render(<SixTabs />);

    expect(sides()).toEqual({ left: false, right: true });
  });

  it("follows the scroll position", () => {
    render(<SixTabs />);

    layout.scroll = 100;
    fireEvent.scroll(list());
    expect(sides()).toEqual({ left: true, right: true });

    layout.scroll = 318;
    fireEvent.scroll(list());
    expect(sides()).toEqual({ left: true, right: false });

    layout.scroll = 0;
    fireEvent.scroll(list());
    expect(sides()).toEqual({ left: false, right: true });
  });

  it("names the physical side in a right-to-left list", () => {
    layout.rtl = true;
    render(<SixTabs />);

    // Scrolled to the start, which is the right: there is more to the left.
    expect(sides()).toEqual({ left: true, right: false });

    layout.scroll = 318;
    fireEvent.scroll(list());
    expect(sides()).toEqual({ left: false, right: true });
  });

  it("marks nothing, and never scrolls, when the tabs fit", () => {
    layout.client = 600;
    render(<SixTabs defaultValue="f" />);

    expect(sides()).toEqual({ left: false, right: false });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("follows the width of the box: shrinking it brings the fade, growing it takes it away", () => {
    layout.client = 600;
    render(<SixTabs />);
    expect(sides()).toEqual({ left: false, right: false });

    layout.client = 200;
    act(() => FakeResizeObserver.instances[0]!.callback());
    expect(sides()).toEqual({ left: false, right: true });

    layout.client = 600;
    act(() => FakeResizeObserver.instances[0]!.callback());
    expect(sides()).toEqual({ left: false, right: false });
  });

  it("takes the fade away when a list turns vertical, which is not a scroller", () => {
    const { rerender } = render(<SixTabs />);
    expect(sides()).toEqual({ left: false, right: true });

    rerender(<SixTabs orientation="vertical" />);

    expect(sides()).toEqual({ left: false, right: false });
  });

  it("does no scroll work for a vertical list", () => {
    render(<SixTabs defaultValue="f" orientation="vertical" />);

    expect(sides()).toEqual({ left: false, right: false });
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe("TabsList scrolling: housekeeping", () => {
  it("watches the list's own box once, and lets go of it on unmount", () => {
    const { rerender, unmount } = render(<SixTabs />);
    const observer = FakeResizeObserver.instances[0]!;

    rerender(<SixTabs />);
    rerender(<SixTabs value="c" />);

    expect(FakeResizeObserver.instances).toHaveLength(1);
    expect(observer.observe).toHaveBeenCalledTimes(1);
    expect(observer.observe).toHaveBeenCalledWith(list());

    unmount();

    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  it("removes its scroll listener on unmount", () => {
    const { unmount } = render(<SixTabs />);
    const element = list();
    const add = vi.spyOn(element, "addEventListener");
    const remove = vi.spyOn(element, "removeEventListener");

    unmount();

    expect(add).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });

  it("does not re-render for a scroll or a resize that changes nothing", () => {
    const commits = vi.fn();
    render(
      <React.Profiler id="tabs" onRender={commits}>
        <SixTabs />
      </React.Profiler>,
    );
    const afterMount = commits.mock.calls.length;

    for (let step = 0; step < 5; step += 1) {
      fireEvent.scroll(list());
      act(() => FakeResizeObserver.instances[0]!.callback());
    }

    expect(commits).toHaveBeenCalledTimes(afterMount);
  });

  it("re-renders when a side flips, and for no scroll event after it that crosses nothing", () => {
    const commits = vi.fn();
    render(
      <React.Profiler id="tabs" onRender={commits}>
        <SixTabs />
      </React.Profiler>,
    );
    const afterMount = commits.mock.calls.length;

    layout.scroll = 10;
    fireEvent.scroll(list());
    expect(sides().left).toBe(true);
    const afterFlip = commits.mock.calls.length;
    expect(afterFlip).toBeGreaterThan(afterMount);

    // Fifty scroll events that stay between the edges: the state is the same, so nothing renders.
    for (let step = 0; step < 50; step += 1) {
      layout.scroll = 20 + step * 5;
      fireEvent.scroll(list());
    }
    expect(commits.mock.calls.length - afterFlip).toBeLessThanOrEqual(1);
  });

  it("stops measuring after unmount", () => {
    const { unmount } = render(<SixTabs />);
    const element = list();
    unmount();

    // A late scroll event on the detached list finds no listener and nothing to update.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    fireEvent.scroll(element);

    expect(error).not.toHaveBeenCalled();
  });

  it("renders on the server with no scroll state, and says nothing about layout effects", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const html = renderToString(<SixTabs defaultValue="f" />);

    expect(html).toContain('role="tablist"');
    expect(html).not.toMatch(/data-overflow-(left|right)=/);
    expect(error).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("hands the list element to a ref, object or callback, and to both of them", () => {
    const objectRef = React.createRef<HTMLDivElement>();
    const callbackRef = vi.fn();
    const { rerender, unmount } = render(<SixTabs listProps={{ ref: objectRef }} />);
    expect(objectRef.current).toBe(list());

    rerender(<SixTabs listProps={{ ref: callbackRef }} />);
    expect(callbackRef).toHaveBeenCalledWith(list());

    unmount();
    expect(callbackRef).toHaveBeenLastCalledWith(null);
  });
});
