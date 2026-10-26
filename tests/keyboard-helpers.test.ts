import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ratingKeyTarget, ratingValueText } from "../src/components/keyboard/rating";
import { rovingTarget } from "../src/components/keyboard/roving";
import {
  findByTypeahead,
  isTypeaheadKey,
  TYPEAHEAD_RESET_MS,
  useTypeahead,
} from "../src/components/keyboard/typeahead";

describe("rovingTarget", () => {
  it("moves with the arrow keys of the orientation and ignores the other pair", () => {
    expect(rovingTarget("ArrowRight", 0, 3)).toBe(1);
    expect(rovingTarget("ArrowLeft", 2, 3)).toBe(1);
    expect(rovingTarget("ArrowDown", 0, 3)).toBeNull();
    expect(rovingTarget("ArrowDown", 0, 3, { orientation: "vertical" })).toBe(1);
    expect(rovingTarget("ArrowUp", 2, 3, { orientation: "vertical" })).toBe(1);
    expect(rovingTarget("ArrowRight", 0, 3, { orientation: "vertical" })).toBeNull();
  });

  it("answers both pairs in a two-dimensional orientation", () => {
    expect(rovingTarget("ArrowRight", 0, 3, { orientation: "both" })).toBe(1);
    expect(rovingTarget("ArrowDown", 0, 3, { orientation: "both" })).toBe(1);
    expect(rovingTarget("ArrowLeft", 1, 3, { orientation: "both" })).toBe(0);
    expect(rovingTarget("ArrowUp", 1, 3, { orientation: "both" })).toBe(0);
  });

  it("wraps by default and stops at the ends when asked", () => {
    expect(rovingTarget("ArrowRight", 2, 3)).toBe(0);
    expect(rovingTarget("ArrowLeft", 0, 3)).toBe(2);
    expect(rovingTarget("ArrowRight", 2, 3, { wrap: false })).toBe(2);
    expect(rovingTarget("ArrowLeft", 0, 3, { wrap: false })).toBe(0);
  });

  it("goes to the ends with Home and End in any orientation", () => {
    expect(rovingTarget("Home", 2, 5)).toBe(0);
    expect(rovingTarget("End", 2, 5)).toBe(4);
    expect(rovingTarget("Home", 2, 5, { orientation: "vertical" })).toBe(0);
  });

  it("mirrors Left and Right in a right-to-left layout", () => {
    expect(rovingTarget("ArrowLeft", 0, 3, { rtl: true })).toBe(1);
    expect(rovingTarget("ArrowRight", 1, 3, { rtl: true })).toBe(0);
    // Up and Down do not mirror.
    expect(rovingTarget("ArrowDown", 0, 3, { orientation: "vertical", rtl: true })).toBe(1);
  });

  it("starts from the first item forward and the last backward when nothing is current", () => {
    expect(rovingTarget("ArrowRight", -1, 4)).toBe(0);
    expect(rovingTarget("ArrowLeft", -1, 4)).toBe(3);
  });

  it("is null for other keys and for an empty set", () => {
    expect(rovingTarget("a", 0, 3)).toBeNull();
    expect(rovingTarget("Enter", 0, 3)).toBeNull();
    expect(rovingTarget("ArrowRight", 0, 0)).toBeNull();
    expect(rovingTarget("Home", 0, 0)).toBeNull();
  });
});

describe("findByTypeahead", () => {
  const labels = ["Apple", "Avocado", "Banana", "Blueberry", "Cherry"];

  it("finds the next label starting with a single letter, then cycles", () => {
    expect(findByTypeahead(labels, "a", -1)).toBe(0);
    expect(findByTypeahead(labels, "a", 0)).toBe(1);
    expect(findByTypeahead(labels, "a", 1)).toBe(0);
    expect(findByTypeahead(labels, "b", 1)).toBe(2);
  });

  it("is case-insensitive", () => {
    expect(findByTypeahead(labels, "C", -1)).toBe(4);
    expect(findByTypeahead(["alpha"], "ALP", -1)).toBe(0);
  });

  it("narrows a longer run to the first label starting with all of it, from the current one", () => {
    expect(findByTypeahead(labels, "bl", 2)).toBe(3);
    expect(findByTypeahead(labels, "bl", -1)).toBe(3);
    expect(findByTypeahead(labels, "av", 0)).toBe(1);
  });

  it("treats a held letter as cycling rather than as a run that matches nothing", () => {
    expect(findByTypeahead(labels, "aa", 0)).toBe(1);
    expect(findByTypeahead(labels, "aaa", 1)).toBe(0);
  });

  it("returns -1 when nothing matches, the run is empty or there are no labels", () => {
    expect(findByTypeahead(labels, "z", 0)).toBe(-1);
    expect(findByTypeahead(labels, "bz", 0)).toBe(-1);
    expect(findByTypeahead(labels, "", 0)).toBe(-1);
    expect(findByTypeahead([], "a", -1)).toBe(-1);
  });
});

describe("isTypeaheadKey", () => {
  const key = (init: Partial<KeyboardEvent> & { key: string }) => ({
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...init,
  });

  it("accepts printable characters and nothing with a command modifier", () => {
    expect(isTypeaheadKey(key({ key: "a" }), false)).toBe(true);
    expect(isTypeaheadKey(key({ key: "A" }), false)).toBe(true);
    expect(isTypeaheadKey(key({ key: "a", ctrlKey: true }), false)).toBe(false);
    expect(isTypeaheadKey(key({ key: "a", metaKey: true }), false)).toBe(false);
    expect(isTypeaheadKey(key({ key: "a", altKey: true }), false)).toBe(false);
  });

  it("rejects named keys", () => {
    expect(isTypeaheadKey(key({ key: "Enter" }), true)).toBe(false);
    expect(isTypeaheadKey(key({ key: "ArrowDown" }), true)).toBe(false);
    expect(isTypeaheadKey(key({ key: "Tab" }), true)).toBe(false);
  });

  it("takes a space only once a search has begun", () => {
    expect(isTypeaheadKey(key({ key: " " }), false)).toBe(false);
    expect(isTypeaheadKey(key({ key: " " }), true)).toBe(true);
  });
});

describe("useTypeahead", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a run from letters typed close together", () => {
    const { result } = renderHook(() => useTypeahead());
    expect(result.current.searching).toBe(false);
    act(() => {
      result.current.push("b");
    });
    let run = "";
    act(() => {
      run = result.current.push("l");
    });
    expect(run).toBe("bl");
    expect(result.current.searching).toBe(true);
  });

  it("starts a new run after the pause", () => {
    const { result } = renderHook(() => useTypeahead());
    act(() => {
      result.current.push("b");
      vi.advanceTimersByTime(TYPEAHEAD_RESET_MS + 1);
    });
    expect(result.current.searching).toBe(false);
    let run = "";
    act(() => {
      run = result.current.push("c");
    });
    expect(run).toBe("c");
  });

  it("restarts the pause with every letter", () => {
    const { result } = renderHook(() => useTypeahead());
    act(() => {
      result.current.push("b");
      vi.advanceTimersByTime(TYPEAHEAD_RESET_MS - 100);
      result.current.push("l");
      vi.advanceTimersByTime(TYPEAHEAD_RESET_MS - 100);
    });
    expect(result.current.searching).toBe(true);
  });

  it("forgets the run on reset and keeps one stable object", () => {
    const { result, rerender } = renderHook(() => useTypeahead());
    const first = result.current;
    act(() => {
      result.current.push("b");
      result.current.reset();
    });
    expect(result.current.searching).toBe(false);
    rerender();
    expect(result.current).toBe(first);
  });

  it("clears its timer when the widget unmounts", () => {
    const { result, unmount } = renderHook(() => useTypeahead());
    act(() => {
      result.current.push("b");
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("ratingKeyTarget", () => {
  it("moves by half a star with the arrow keys and a whole star with the page keys", () => {
    expect(ratingKeyTarget("ArrowRight", 3, 5)).toBe(3.5);
    expect(ratingKeyTarget("ArrowUp", 3, 5)).toBe(3.5);
    expect(ratingKeyTarget("ArrowLeft", 3, 5)).toBe(2.5);
    expect(ratingKeyTarget("ArrowDown", 3, 5)).toBe(2.5);
    expect(ratingKeyTarget("PageUp", 3, 5)).toBe(4);
    expect(ratingKeyTarget("PageDown", 3, 5)).toBe(2);
  });

  it("goes to the ends with Home and End, and Home is no rating at all", () => {
    expect(ratingKeyTarget("Home", 3.5, 5)).toBe(0);
    expect(ratingKeyTarget("End", 3.5, 5)).toBe(5);
    expect(ratingKeyTarget("End", 3.5, 10)).toBe(10);
  });

  it("stops at either end", () => {
    expect(ratingKeyTarget("ArrowRight", 5, 5)).toBe(5);
    expect(ratingKeyTarget("PageUp", 4.5, 5)).toBe(5);
    expect(ratingKeyTarget("ArrowLeft", 0, 5)).toBe(0);
    expect(ratingKeyTarget("PageDown", 0.5, 5)).toBe(0);
  });

  it("lands on the half-star grid from a value that is off it", () => {
    expect(ratingKeyTarget("ArrowRight", 3.3, 5)).toBe(3.5);
    expect(ratingKeyTarget("ArrowLeft", 3.3, 5)).toBe(3);
    expect(ratingKeyTarget("PageUp", 3.3, 5)).toBe(4);
    expect(ratingKeyTarget("PageDown", 3.3, 5)).toBe(3);
  });

  it("treats a value outside the range, or not a number, as the nearest end", () => {
    expect(ratingKeyTarget("ArrowLeft", 9, 5)).toBe(4.5);
    expect(ratingKeyTarget("ArrowRight", -2, 5)).toBe(0.5);
    expect(ratingKeyTarget("ArrowRight", Number.NaN, 5)).toBe(0.5);
  });

  it("swaps Left and Right in a right-to-left layout and leaves Up and Down alone", () => {
    expect(ratingKeyTarget("ArrowLeft", 3, 5, { rtl: true })).toBe(3.5);
    expect(ratingKeyTarget("ArrowRight", 3, 5, { rtl: true })).toBe(2.5);
    expect(ratingKeyTarget("ArrowUp", 3, 5, { rtl: true })).toBe(3.5);
    expect(ratingKeyTarget("ArrowDown", 3, 5, { rtl: true })).toBe(2.5);
  });

  it("answers null for a key it does not handle", () => {
    for (const key of ["Enter", " ", "Tab", "a", "Escape", "Delete"]) {
      expect(ratingKeyTarget(key, 3, 5)).toBeNull();
    }
  });
});

describe("ratingValueText", () => {
  it("says the value out of the total, with the unit when there is one", () => {
    expect(ratingValueText(3.5, 5, "stars")).toBe("3.5 out of 5 stars");
    expect(ratingValueText(3, 5)).toBe("3 out of 5");
  });

  it("says no rating for zero and clamps a value outside the range", () => {
    expect(ratingValueText(0, 5, "stars")).toBe("No rating");
    expect(ratingValueText(9, 5, "stars")).toBe("5 out of 5 stars");
    expect(ratingValueText(Number.NaN, 5)).toBe("No rating");
  });
});
