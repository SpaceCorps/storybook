import { useState } from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { StarRating } from "../src/components/StarRating";

describe("StarRating", () => {
  it("renders 5 stars by default", () => {
    const { container } = render(<StarRating value={3} />);
    const stars = container.querySelectorAll("svg");
    expect(stars.length).toBeGreaterThanOrEqual(5);
  });

  it("disables interaction when disabled is true", () => {
    const handleRate = vi.fn();
    const { container } = render(<StarRating disabled value={2} onRate={handleRate} />);
    const firstStar = container.querySelector("svg");
    if (firstStar) {
      fireEvent.click(firstStar);
    }
    expect(handleRate).not.toHaveBeenCalled();
  });
});

describe("StarRating keyboard and selected state", () => {
  it("is a named group of stars with the current rating pressed", () => {
    render(<StarRating value={3} aria-label="Service quality" />);
    expect(screen.getByRole("group", { name: "Service quality" })).toBeDefined();
    const stars = screen.getAllByRole("button");
    expect(stars).toHaveLength(5);
    expect(stars.map((star) => star.getAttribute("aria-pressed"))).toEqual([
      "false",
      "false",
      "true",
      "false",
      "false",
    ]);
  });

  it("presses no star while unrated, and rounds a half value up", () => {
    const { rerender } = render(<StarRating value={0} />);
    expect(
      screen.getAllByRole("button").every((star) => star.getAttribute("aria-pressed") === "false"),
    ).toBe(true);

    rerender(<StarRating value={3.5} />);
    expect(screen.getByRole("button", { name: "Rate 4 stars" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("falls back to the name 'Rating' for the group", () => {
    render(<StarRating />);
    expect(screen.getByRole("group", { name: "Rating" })).toBeDefined();
  });

  it("rates with Enter and Space, and clears by activating the same star again", async () => {
    const user = userEvent.setup();
    const onRate = vi.fn();
    render(<StarRating value={4} onRate={onRate} />);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Rate 1 star" }));
    await user.keyboard("{Enter}");
    expect(onRate).toHaveBeenLastCalledWith(1);

    await user.tab();
    await user.keyboard(" ");
    expect(onRate).toHaveBeenLastCalledWith(2);

    // The fourth star holds the current value, so activating it clears the rating.
    await user.tab();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onRate).toHaveBeenLastCalledWith(0);
  });

  it("rates a whole star from the keyboard when half stars are off", async () => {
    const user = userEvent.setup();
    const onRate = vi.fn();
    render(<StarRating value={0} onRate={onRate} />);

    await user.tab();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onRate).toHaveBeenLastCalledWith(2);
  });

  it("leaves the stars out of the tab order when disabled", async () => {
    const user = userEvent.setup();
    render(<StarRating value={2} disabled />);
    await user.tab();
    expect(document.activeElement).toBe(document.body);
  });
});

describe("StarRating half stars with a pointer", () => {
  // jsdom has no layout: every star is 20px wide and starts at x = 100.
  const stubRect = () =>
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 0,
      left: 100,
      top: 0,
      right: 120,
      bottom: 20,
      width: 20,
      height: 20,
      toJSON: () => ({}),
    });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** The star the pointer is on: with half values on, the stars are drawn spans of a slider. */
  const starAt = (n: number) => {
    const star = document.querySelector<HTMLElement>(`[data-rating="${n}"]`);
    if (!star) throw new Error(`no star ${n}`);
    return star;
  };

  /** How much of each star's fill overlay is showing; null when a star has none. */
  const fills = () =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-rating]")).map(
      (star) => star.querySelector<HTMLElement>("div.absolute")?.style.width ?? null,
    );

  it("previews a half value while the pointer is over the left half of a star", () => {
    stubRect();
    render(<StarRating allowHalf />);
    const third = starAt(3);

    fireEvent.mouseEnter(third, { clientX: 102 });
    expect(fills()).toEqual(["100%", "100%", "50%", null, null]);

    fireEvent.mouseMove(third, { clientX: 118 });
    expect(fills()).toEqual(["100%", "100%", "100%", null, null]);

    fireEvent.mouseMove(third, { clientX: 105 });
    expect(fills()).toEqual(["100%", "100%", "50%", null, null]);

    fireEvent.mouseLeave(third);
    expect(fills()).toEqual([null, null, null, null, null]);
  });

  it("previews whole stars only when half stars are off", () => {
    stubRect();
    render(<StarRating />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Rate 3 stars" }), { clientX: 102 });
    expect(fills()).toEqual(["100%", "100%", "100%", null, null]);
  });

  it("rates a half value from the left half of a star and a whole one from the right", () => {
    stubRect();
    const onRate = vi.fn();
    render(<StarRating allowHalf onRate={onRate} />);
    const third = starAt(3);

    fireEvent.click(third, { detail: 1, clientX: 102 });
    expect(onRate).toHaveBeenLastCalledWith(2.5);
    fireEvent.click(third, { detail: 1, clientX: 118 });
    expect(onRate).toHaveBeenLastCalledWith(3);
  });

  it("shows what the click will store: preview and click agree on each half", () => {
    stubRect();
    const onRate = vi.fn();
    render(<StarRating allowHalf onRate={onRate} />);
    const third = starAt(3);

    fireEvent.mouseMove(third, { clientX: 101 });
    const previewed = fills()[2];
    fireEvent.click(third, { detail: 1, clientX: 101 });
    expect(previewed).toBe("50%");
    expect(onRate).toHaveBeenLastCalledWith(2.5);
  });

  it("clears the rating when the half that holds it is clicked again", () => {
    stubRect();
    const onRate = vi.fn();
    render(<StarRating allowHalf value={2.5} onRate={onRate} />);
    const third = starAt(3);

    fireEvent.click(third, { detail: 1, clientX: 102 });
    expect(onRate).toHaveBeenLastCalledWith(0);
  });

  it("clears a fractional rating when its pressed star is activated from the keyboard", async () => {
    const user = userEvent.setup();
    const onRate = vi.fn();
    // The same rating in whole mode (a fractional value with the half-star slider off).
    render(<StarRating value={3.5} onRate={onRate} />);
    const fourth = screen.getByRole("button", { name: "Rate 4 stars" });
    expect(fourth.getAttribute("aria-pressed")).toBe("true");

    fourth.focus();
    await user.keyboard("{Enter}");
    expect(onRate).toHaveBeenLastCalledWith(0);
  });
});

describe("StarRating with half values is a slider", () => {
  const slider = () => screen.getByRole("slider", { name: "Rating" });

  /** A parent that owns the value, as an app does, so a run of key presses accumulates. */
  function Controlled({ start = 0, seen }: { start?: number; seen?: (value: number) => void }) {
    const [value, setValue] = useState(start);
    return (
      <StarRating
        allowHalf
        value={value}
        onRate={(next) => {
          seen?.(next);
          setValue(next);
        }}
      />
    );
  }

  it("is one slider carrying the real value, not five buttons that round it", () => {
    render(<StarRating allowHalf value={3.5} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    const el = slider();
    expect(el.getAttribute("aria-valuemin")).toBe("0");
    expect(el.getAttribute("aria-valuemax")).toBe("5");
    expect(el.getAttribute("aria-valuenow")).toBe("3.5");
    expect(el.getAttribute("aria-valuetext")).toBe("3.5 out of 5 stars");
  });

  it("says so when there is no rating yet", () => {
    render(<StarRating allowHalf />);
    expect(slider().getAttribute("aria-valuenow")).toBe("0");
    expect(slider().getAttribute("aria-valuetext")).toBe("No rating");
  });

  it("names itself with the aria-label", () => {
    render(<StarRating allowHalf aria-label="Service quality" />);
    expect(screen.getByRole("slider", { name: "Service quality" })).toBeDefined();
  });

  it("is a single tab stop", async () => {
    const user = userEvent.setup();
    render(
      <>
        <StarRating allowHalf />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    expect(document.activeElement).toBe(slider());
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });

  it.each([
    ["ArrowRight", 3, 3.5],
    ["ArrowUp", 3, 3.5],
    ["ArrowLeft", 3, 2.5],
    ["ArrowDown", 3, 2.5],
    ["ArrowRight", 3.5, 4],
    ["ArrowLeft", 3.5, 3],
    ["PageUp", 3.5, 4],
    ["PageDown", 3.5, 3],
    ["Home", 3.5, 0],
    ["End", 3.5, 5],
  ])("%s moves %s to %s", async (key, from, to) => {
    const user = userEvent.setup();
    const onRate = vi.fn();
    render(<StarRating allowHalf value={from} onRate={onRate} />);
    slider().focus();
    await user.keyboard(`{${key}}`);
    expect(onRate).toHaveBeenCalledTimes(1);
    expect(onRate).toHaveBeenLastCalledWith(to);
  });

  it("reaches every half value from the keyboard alone, which the buttons never could", async () => {
    const user = userEvent.setup();
    const seen: number[] = [];
    render(<Controlled seen={(value) => seen.push(value)} />);
    slider().focus();
    await user.keyboard("{ArrowRight>10/}");
    expect(seen).toEqual([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
    expect(slider().getAttribute("aria-valuetext")).toBe("5 out of 5 stars");
  });

  it("stays put at either end instead of reporting the same value again", async () => {
    const user = userEvent.setup();
    const onRate = vi.fn();
    const { rerender } = render(<StarRating allowHalf value={5} onRate={onRate} />);
    slider().focus();
    await user.keyboard("{ArrowRight}{End}");
    rerender(<StarRating allowHalf value={0} onRate={onRate} />);
    await user.keyboard("{ArrowLeft}{Home}");
    expect(onRate).not.toHaveBeenCalled();
  });

  it("moves a value that is off the half-star grid onto it", async () => {
    const user = userEvent.setup();
    const onRate = vi.fn();
    render(<StarRating allowHalf value={3.3} onRate={onRate} />);
    slider().focus();
    await user.keyboard("{ArrowRight}");
    expect(onRate).toHaveBeenLastCalledWith(3.5);
  });

  it.each([
    ["Alt", { altKey: true }],
    ["Ctrl", { ctrlKey: true }],
    ["Meta", { metaKey: true }],
  ])("leaves %s chords to the browser", (_name, modifier) => {
    const onRate = vi.fn();
    render(<StarRating allowHalf value={3} onRate={onRate} />);
    slider().focus();
    expect(fireEvent.keyDown(slider(), { key: "ArrowLeft", ...modifier })).toBe(true);
    expect(onRate).not.toHaveBeenCalled();
  });

  it("cancels the keys it handles, so the page does not scroll, and no others", () => {
    render(<StarRating allowHalf value={3} onRate={() => {}} />);
    expect(fireEvent.keyDown(slider(), { key: "ArrowRight" })).toBe(false);
    expect(fireEvent.keyDown(slider(), { key: "a" })).toBe(true);
    expect(fireEvent.keyDown(slider(), { key: "Tab" })).toBe(true);
  });

  it("mirrors Left and Right in a right-to-left layout", async () => {
    const user = userEvent.setup();
    const onRate = vi.fn();
    render(
      <div style={{ direction: "rtl" }}>
        <StarRating allowHalf value={3} onRate={onRate} />
      </div>,
    );
    slider().focus();
    await user.keyboard("{ArrowLeft}");
    expect(onRate).toHaveBeenLastCalledWith(3.5);
    await user.keyboard("{ArrowRight}");
    expect(onRate).toHaveBeenLastCalledWith(2.5);
  });

  it("is out of the tab order and inert when disabled", async () => {
    const user = userEvent.setup();
    const onRate = vi.fn();
    render(<StarRating allowHalf value={3} disabled onRate={onRate} />);
    expect(slider().getAttribute("aria-disabled")).toBe("true");
    await user.tab();
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    fireEvent.click(document.querySelector('[data-rating="2"]') as HTMLElement, { detail: 1 });
    expect(onRate).not.toHaveBeenCalled();
  });

  it("keeps the rating of a click with no pointer to whole stars", () => {
    const onRate = vi.fn();
    render(<StarRating allowHalf onRate={onRate} />);
    // A click without a pointer (detail 0), as assistive technology sends, has no half to read.
    fireEvent.click(document.querySelector('[data-rating="4"]') as HTMLElement, { detail: 0 });
    expect(onRate).toHaveBeenLastCalledWith(4);
  });

  it("stays a group of buttons when half values are off", () => {
    render(<StarRating value={3} />);
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });
});

describe("StarRating look and motion", () => {
  const starOutline = () => document.querySelector("svg") as SVGElement;

  it("draws the empty star as an outline in the muted text colour, not a fill in the border colour", () => {
    render(<StarRating value={0} />);
    const classes = starOutline().getAttribute("class") ?? "";
    expect(classes).toContain("stroke-muted-foreground");
    expect(classes).toContain("fill-transparent");
    // text-border was the 1.3:1 colour the old unrated star was drawn in.
    expect(classes).not.toContain("text-border");
  });
});
