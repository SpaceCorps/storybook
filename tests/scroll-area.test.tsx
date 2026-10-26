import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ScrollArea, ScrollBar } from "../src/components/ui/scroll-area";

// jsdom reports every box as 0 x 0, so overflow is staged by overriding the three metrics the
// component reads, and the ResizeObserver is captured so a resize can be fired by hand.
type Metrics = {
  scrollHeight: number;
  clientHeight: number;
  scrollWidth: number;
  clientWidth: number;
};

let metrics: Metrics = { scrollHeight: 0, clientHeight: 0, scrollWidth: 0, clientWidth: 0 };
let observers: Array<() => void> = [];

function stageLayout(next: Metrics) {
  metrics = next;
  for (const key of Object.keys(next) as Array<keyof Metrics>) {
    Object.defineProperty(HTMLElement.prototype, key, {
      configurable: true,
      get() {
        return this.hasAttribute("data-radix-scroll-area-viewport") ? metrics[key] : 0;
      },
    });
  }
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        observers.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
}

function viewportOf(container: HTMLElement): HTMLElement {
  const viewport = container.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
  if (!viewport) throw new Error("viewport not rendered");
  return viewport;
}

afterEach(() => {
  for (const key of ["scrollHeight", "clientHeight", "scrollWidth", "clientWidth"]) {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
  }
  observers = [];
  vi.unstubAllGlobals();
});

describe("ScrollArea keyboard reachability", () => {
  it("leaves the viewport out of the tab order when the content fits", () => {
    stageLayout({ scrollHeight: 100, clientHeight: 100, scrollWidth: 100, clientWidth: 100 });
    const { container } = render(
      <ScrollArea>
        <div>Short</div>
      </ScrollArea>,
    );
    expect(viewportOf(container).hasAttribute("tabindex")).toBe(false);
  });

  it("makes the viewport a tab stop when the content overflows vertically", () => {
    stageLayout({ scrollHeight: 400, clientHeight: 100, scrollWidth: 100, clientWidth: 100 });
    const { container } = render(
      <ScrollArea>
        <div>Tall</div>
      </ScrollArea>,
    );
    expect(viewportOf(container).getAttribute("tabindex")).toBe("0");
  });

  it("makes the viewport a tab stop when the content overflows horizontally and a horizontal scrollbar is mounted", async () => {
    stageLayout({ scrollHeight: 100, clientHeight: 100, scrollWidth: 900, clientWidth: 100 });
    const { container } = render(
      <ScrollArea>
        <div>Wide</div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>,
    );
    // The scrollbar switches the viewport to overflow-x: scroll after it mounts.
    await waitFor(() => expect(viewportOf(container).getAttribute("tabindex")).toBe("0"));
    expect(getComputedStyle(viewportOf(container)).overflowX).toBe("scroll");
  });

  it("is not a tab stop for horizontal overflow it cannot scroll", async () => {
    stageLayout({ scrollHeight: 100, clientHeight: 100, scrollWidth: 900, clientWidth: 100 });
    const { container } = render(
      <ScrollArea>
        <div>Wide</div>
      </ScrollArea>,
    );
    const viewport = viewportOf(container);
    // Without a horizontal scrollbar the viewport clips on x, so arrow keys would do nothing.
    expect(getComputedStyle(viewport).overflowX).toBe("hidden");
    await act(async () => {});
    expect(viewport.hasAttribute("tabindex")).toBe(false);
    act(() => observers.forEach((notify) => notify()));
    expect(viewport.hasAttribute("tabindex")).toBe(false);
  });

  it("is a tab stop for vertical overflow whether or not it also overflows horizontally", () => {
    stageLayout({ scrollHeight: 400, clientHeight: 100, scrollWidth: 900, clientWidth: 100 });
    const { container } = render(
      <ScrollArea>
        <div>Both</div>
      </ScrollArea>,
    );
    expect(viewportOf(container).getAttribute("tabindex")).toBe("0");
  });

  it("follows a horizontal scrollbar that is mounted and removed after the first render", async () => {
    stageLayout({ scrollHeight: 100, clientHeight: 100, scrollWidth: 900, clientWidth: 100 });
    const wide = (withBar: boolean) => (
      <ScrollArea>
        <div>Wide</div>
        {withBar && <ScrollBar orientation="horizontal" />}
      </ScrollArea>
    );
    const { container, rerender } = render(wide(false));
    const viewport = viewportOf(container);
    expect(viewport.hasAttribute("tabindex")).toBe(false);

    rerender(wide(true));
    await waitFor(() => expect(viewport.getAttribute("tabindex")).toBe("0"));

    rerender(wide(false));
    await waitFor(() => expect(viewport.hasAttribute("tabindex")).toBe(false));
  });

  it("follows the content when it grows and shrinks after mount", () => {
    stageLayout({ scrollHeight: 100, clientHeight: 100, scrollWidth: 100, clientWidth: 100 });
    const { container } = render(
      <ScrollArea>
        <div>Dynamic</div>
      </ScrollArea>,
    );
    const viewport = viewportOf(container);
    expect(viewport.hasAttribute("tabindex")).toBe(false);

    metrics = { ...metrics, scrollHeight: 500 };
    act(() => observers.forEach((notify) => notify()));
    expect(viewport.getAttribute("tabindex")).toBe("0");

    metrics = { ...metrics, scrollHeight: 100 };
    act(() => observers.forEach((notify) => notify()));
    expect(viewport.hasAttribute("tabindex")).toBe(false);
  });

  it("keeps the inset focus ring on the viewport for when it is focusable", () => {
    stageLayout({ scrollHeight: 400, clientHeight: 100, scrollWidth: 100, clientWidth: 100 });
    const { container } = render(
      <ScrollArea>
        <div>Tall</div>
      </ScrollArea>,
    );
    const viewport = viewportOf(container);
    expect(viewport.className).toContain("focus-visible:ring-1");
    expect(viewport.className).toContain("focus-visible:outline-hidden");
    expect(viewport.className).toContain("focus-visible:ring-inset");
  });
});

describe("ScrollArea region name", () => {
  const overflowing = () =>
    stageLayout({ scrollHeight: 400, clientHeight: 100, scrollWidth: 100, clientWidth: 100 });

  it("makes the focusable viewport a region named by the caller's aria-label", () => {
    overflowing();
    const { container } = render(
      <ScrollArea aria-label="Release tags">
        <div>Tall</div>
      </ScrollArea>,
    );
    const viewport = viewportOf(container);
    expect(viewport.getAttribute("tabindex")).toBe("0");
    expect(viewport.getAttribute("role")).toBe("region");
    expect(viewport.getAttribute("aria-label")).toBe("Release tags");
    // The root is a bare box that cannot take a name, so the label does not stay there.
    expect(container.firstElementChild?.hasAttribute("aria-label")).toBe(false);
  });

  it("is found by its name", () => {
    overflowing();
    const { getByRole } = render(
      <ScrollArea aria-label="Release tags">
        <div>Tall</div>
      </ScrollArea>,
    );
    expect(getByRole("region", { name: "Release tags" })).toBeDefined();
  });

  it("takes a name from aria-labelledby instead", () => {
    overflowing();
    const { container } = render(
      <>
        <h2 id="heading">Changelog</h2>
        <ScrollArea aria-labelledby="heading">
          <div>Tall</div>
        </ScrollArea>
      </>,
    );
    const viewport = viewportOf(container);
    expect(viewport.getAttribute("role")).toBe("region");
    expect(viewport.getAttribute("aria-labelledby")).toBe("heading");
    expect(viewport.hasAttribute("aria-label")).toBe(false);
  });

  it("falls back to a generic name rather than leaving the focusable box named by its content", () => {
    overflowing();
    const { container } = render(
      <ScrollArea>
        <div>Tall</div>
      </ScrollArea>,
    );
    const viewport = viewportOf(container);
    expect(viewport.getAttribute("role")).toBe("region");
    expect(viewport.getAttribute("aria-label")).toBe("Scrollable content");
  });

  it("is not a region while there is nothing to scroll, however it was named", () => {
    stageLayout({ scrollHeight: 100, clientHeight: 100, scrollWidth: 100, clientWidth: 100 });
    const { container } = render(
      <ScrollArea aria-label="Release tags">
        <div>Short</div>
      </ScrollArea>,
    );
    const viewport = viewportOf(container);
    expect(viewport.hasAttribute("role")).toBe(false);
    expect(viewport.hasAttribute("aria-label")).toBe(false);
    expect(viewport.hasAttribute("tabindex")).toBe(false);
  });

  it("gains and loses the region with the overflow", () => {
    stageLayout({ scrollHeight: 100, clientHeight: 100, scrollWidth: 100, clientWidth: 100 });
    const { container } = render(
      <ScrollArea aria-label="Release tags">
        <div>Dynamic</div>
      </ScrollArea>,
    );
    const viewport = viewportOf(container);
    expect(viewport.hasAttribute("role")).toBe(false);

    metrics = { ...metrics, scrollHeight: 500 };
    act(() => observers.forEach((notify) => notify()));
    expect(viewport.getAttribute("role")).toBe("region");

    metrics = { ...metrics, scrollHeight: 100 };
    act(() => observers.forEach((notify) => notify()));
    expect(viewport.hasAttribute("role")).toBe(false);
  });
});
