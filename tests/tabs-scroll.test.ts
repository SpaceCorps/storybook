import { describe, expect, it } from "vite-plus/test";
import { overflowSides, revealScroll } from "../src/components/ui/tabs-scroll";

/*
 * The arithmetic behind a tab list that scrolls: which sides have more past them, and where to scroll
 * so a tab is whole. jsdom cannot lay anything out, so the numbers are given; the browser half is the
 * play functions in src/stories/tabs.stories.tsx.
 *
 * Six tabs, 4px of padding at each end, in a window 200 wide with 24px of scroll padding (the fade):
 *
 *   tab     0    1    2    3    4    5
 *   start   4   84  144  244  314  404
 *   end    84  144  244  314  404  514      content 518 wide, so it scrolls 0..318
 *   snaps -20   60  120  220  290  380      start minus the inset: where the list rests
 */
const tabs = [
  { start: 4, end: 84 },
  { start: 84, end: 144 },
  { start: 144, end: 244 },
  { start: 244, end: 314 },
  { start: 314, end: 404 },
  { start: 404, end: 514 },
];
const starts = tabs.map((tab) => tab.start);
const frame = { client: 200, size: 518, inset: { start: 24, end: 24 }, starts };
const reveal = (scroll: number, index: number) =>
  revealScroll({ ...frame, scroll, tab: tabs[index]! });

describe("overflowSides", () => {
  it("has more past the end only, at the start", () => {
    expect(overflowSides({ scroll: 0, client: 200, size: 518 })).toEqual({
      start: false,
      end: true,
    });
  });

  it("has more past both sides in the middle", () => {
    expect(overflowSides({ scroll: 100, client: 200, size: 518 })).toEqual({
      start: true,
      end: true,
    });
  });

  it("has more past the start only, at the end", () => {
    expect(overflowSides({ scroll: 318, client: 200, size: 518 })).toEqual({
      start: true,
      end: false,
    });
  });

  it("has nothing past either side when the content fits", () => {
    expect(overflowSides({ scroll: 0, client: 300, size: 300 })).toEqual({
      start: false,
      end: false,
    });
    expect(overflowSides({ scroll: 0, client: 300, size: 250 })).toEqual({
      start: false,
      end: false,
    });
  });

  it("treats a sub-pixel remainder as being at the edge", () => {
    // Scroll positions are fractional; a list resting 0.4px short of its end is at its end.
    expect(overflowSides({ scroll: 0.4, client: 200, size: 518 }).start).toBe(false);
    expect(overflowSides({ scroll: 317.6, client: 200, size: 518 }).end).toBe(false);
    expect(overflowSides({ scroll: 2, client: 200, size: 518 }).start).toBe(true);
    expect(overflowSides({ scroll: 316, client: 200, size: 518 }).end).toBe(true);
  });

  it("does not report overflow for a list a pixel wider than its box", () => {
    expect(overflowSides({ scroll: 0, client: 200, size: 200.8 })).toEqual({
      start: false,
      end: false,
    });
  });
});

describe("revealScroll", () => {
  it("leaves a tab that is already whole where it is", () => {
    // Tab 2 starts exactly at the inset when scrolled to 120, and ends well inside the window.
    expect(reveal(120, 2)).toBeNull();
    expect(reveal(100, 2)).toBeNull();
  });

  it("does not move for the first tab at the start, where the inset does not apply", () => {
    // Its snap point is -20, which the scroll range cannot reach.
    expect(reveal(0, 0)).toBeNull();
  });

  it("brings a tab cut off at the start to the inset, which is where the list snaps", () => {
    expect(reveal(220, 1)).toBe(60);
    expect(reveal(318, 3)).toBe(220);
  });

  it("goes back to the very start for the first tab", () => {
    expect(reveal(220, 0)).toBe(0);
  });

  it("brings a tab cut off at the end to the first tab start that keeps it whole", () => {
    // Showing tab 3 takes 138 at the least, but tab 2's snap point (120) would hide its end again
    // as soon as the list settled; its own (220) is the first that holds.
    expect(reveal(0, 3)).toBe(220);
  });

  it("takes the smallest snap point that keeps the tab whole, not the tab's own", () => {
    // Tab 2 needs 68; snap points are 60 (too short: tab 2 ends at 244, past 60 + 200 - 24) and 120.
    expect(reveal(0, 2)).toBe(120);
    // Tab 4 needs 228; 220 is too short and 290 is its own.
    expect(reveal(0, 4)).toBe(290);
  });

  it("never scrolls past the end of the content", () => {
    // The last tab wants 380, but there is only 318 to scroll.
    expect(reveal(0, 5)).toBe(318);
    expect(reveal(100, 5)).toBe(318);
  });

  it("does nothing for the last tab when already at the end", () => {
    expect(reveal(318, 5)).toBeNull();
  });

  it("shows a tab wider than the window from its start", () => {
    const wide = { start: 100, end: 400 };
    expect(revealScroll({ ...frame, scroll: 0, tab: wide, starts: [...starts, 100] })).toBe(76);
  });

  it("clears the fade on the side the tab is coming from, not only the edge", () => {
    // Tab 3 (244..314) needs 114 with no inset, so tab 2's snap point (144) is enough; the 24px the
    // fade covers asks for 138, which only tab 3's own (220) satisfies.
    const noInset = revealScroll({
      ...frame,
      inset: { start: 0, end: 0 },
      scroll: 0,
      tab: tabs[3]!,
      starts,
    });
    expect(noInset).toBe(144);
    expect(reveal(0, 3)).toBe(220);
  });

  it("ignores a list whose content fits", () => {
    expect(
      revealScroll({
        scroll: 0,
        client: 300,
        size: 250,
        inset: { start: 24, end: 24 },
        tab: tabs[5]!,
        starts,
      }),
    ).toBeNull();
  });

  it("ignores a move smaller than half a pixel", () => {
    expect(reveal(120.3, 2)).toBeNull();
    expect(reveal(120.3, 1)).toBe(60);
  });
});
