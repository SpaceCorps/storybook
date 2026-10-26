import { act, render, renderHook, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useElementWidth } from "../src/hooks/use-element-width";
import { useNow } from "../src/hooks/use-now";

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T12:00:30.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const iso = (date: Date) => date.toISOString();

  it("returns the pinned instant and never starts a timer", () => {
    const pinned = new Date("2026-10-23T14:30:00.000Z");
    const { result } = renderHook(() => useNow(pinned));
    expect(iso(result.current)).toBe("2026-10-23T14:30:00.000Z");
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(iso(result.current)).toBe("2026-10-23T14:30:00.000Z");
  });

  it("keeps the same object while a new Date with the same time is passed each render", () => {
    const { result, rerender } = renderHook(({ at }) => useNow(at), {
      initialProps: { at: new Date("2026-10-23T14:30:00.000Z") },
    });
    const first = result.current;
    rerender({ at: new Date("2026-10-23T14:30:00.000Z") });
    expect(result.current).toBe(first);
    rerender({ at: new Date("2026-10-23T14:31:00.000Z") });
    expect(iso(result.current)).toBe("2026-10-23T14:31:00.000Z");
  });

  it("starts at the current time", () => {
    const { result } = renderHook(() => useNow());
    expect(iso(result.current)).toBe("2026-10-23T12:00:30.000Z");
  });

  it("ticks at the top of each minute, not 60 seconds after mounting", () => {
    const { result } = renderHook(() => useNow());
    act(() => {
      vi.advanceTimersByTime(29_999);
    });
    expect(iso(result.current)).toBe("2026-10-23T12:00:30.000Z");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(iso(result.current)).toBe("2026-10-23T12:01:00.000Z");
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(iso(result.current)).toBe("2026-10-23T12:02:00.000Z");
  });

  it("keeps its identity between ticks", () => {
    const { result, rerender } = renderHook(() => useNow());
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
  });

  it("clears its timer when unmounted", () => {
    const { unmount } = renderHook(() => useNow());
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops ticking when it becomes pinned and resumes, current, when it is released", () => {
    const { result, rerender } = renderHook(({ at }: { at: Date | undefined }) => useNow(at), {
      initialProps: { at: undefined as Date | undefined },
    });
    expect(vi.getTimerCount()).toBe(1);

    rerender({ at: new Date("2026-10-23T09:00:00.000Z") });
    expect(vi.getTimerCount()).toBe(0);
    expect(iso(result.current)).toBe("2026-10-23T09:00:00.000Z");

    act(() => {
      vi.setSystemTime(new Date("2026-10-23T15:20:10.000Z"));
    });
    rerender({ at: undefined });
    expect(vi.getTimerCount()).toBe(1);
    expect(iso(result.current)).toBe("2026-10-23T15:20:10.000Z");
  });

  it("catches up when the tab becomes visible again", () => {
    let state: DocumentVisibilityState = "hidden";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    try {
      const { result } = renderHook(() => useNow());
      vi.setSystemTime(new Date("2026-10-23T12:45:00.000Z"));
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(iso(result.current)).toBe("2026-10-23T12:00:30.000Z");
      state = "visible";
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(iso(result.current)).toBe("2026-10-23T12:45:00.000Z");
    } finally {
      delete (document as { visibilityState?: unknown }).visibilityState;
    }
  });

  it("treats an invalid pinned date as no pin", () => {
    const { result } = renderHook(() => useNow(new Date(Number.NaN)));
    expect(iso(result.current)).toBe("2026-10-23T12:00:30.000Z");
    expect(vi.getTimerCount()).toBe(1);
  });
});

describe("useElementWidth", () => {
  const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");

  class FakeResizeObserver {
    static instances: FakeResizeObserver[] = [];
    observed: Element[] = [];
    disconnected = false;
    constructor(private callback: ResizeObserverCallback) {
      FakeResizeObserver.instances.push(this);
    }
    observe(element: Element) {
      this.observed.push(element);
    }
    unobserve() {}
    disconnect() {
      this.disconnected = true;
    }
    emit(entry: Partial<ResizeObserverEntry>) {
      this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
  }

  beforeEach(() => {
    FakeResizeObserver.instances = [];
    // jsdom lays nothing out; let a test say how wide an element is through `data-width`.
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get(this: HTMLElement) {
        return Number(this.dataset.width ?? 0);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalOffsetWidth) {
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
    }
  });

  function Probe({ width }: { width?: number }) {
    const ref = React.useRef<HTMLDivElement>(null);
    const measured = useElementWidth(ref);
    return (
      <div ref={ref} data-testid="box" data-width={width}>
        {measured}
      </div>
    );
  }

  const observer = () => FakeResizeObserver.instances[FakeResizeObserver.instances.length - 1];

  it("reads 0 where nothing is laid out, which means unmeasured and not narrow", () => {
    render(<Probe />);
    expect(screen.getByTestId("box").textContent).toBe("0");
  });

  it("measures the element on mount, before anything is observed to change", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    render(<Probe width={640} />);
    expect(screen.getByTestId("box").textContent).toBe("640");
    expect(observer().observed).toEqual([screen.getByTestId("box")]);
  });

  it("follows the observer, in whole pixels", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    render(<Probe width={640} />);
    act(() => observer().emit({ borderBoxSize: [{ inlineSize: 500.4, blockSize: 10 }] }));
    expect(screen.getByTestId("box").textContent).toBe("500");
    act(() => observer().emit({ borderBoxSize: [{ inlineSize: 1000, blockSize: 10 }] }));
    expect(screen.getByTestId("box").textContent).toBe("1000");
  });

  it("falls back to the element's own width when the entry has no border box", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const { rerender } = render(<Probe width={640} />);
    rerender(<Probe width={720} />);
    act(() => observer().emit({}));
    expect(screen.getByTestId("box").textContent).toBe("720");
  });

  it("stops observing when unmounted", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const { unmount } = render(<Probe width={640} />);
    const watcher = observer();
    expect(watcher.disconnected).toBe(false);
    unmount();
    expect(watcher.disconnected).toBe(true);
  });

  it("still measures once where there is no ResizeObserver", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    render(<Probe width={640} />);
    expect(screen.getByTestId("box").textContent).toBe("640");
  });
});
