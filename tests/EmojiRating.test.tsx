import { useState } from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { EmojiRating } from "../src/components/EmojiRating";

describe("EmojiRating", () => {
  it("renders 5 default emoji buttons", () => {
    const { container } = render(<EmojiRating />);
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(5);
  });

  it("fires onRate callback on click with correct rating value", () => {
    const handleRate = vi.fn();
    const { container } = render(<EmojiRating onRate={handleRate} />);
    const buttons = container.querySelectorAll("button");

    fireEvent.click(buttons[3]);
    expect(handleRate).toHaveBeenCalledWith(4);
  });

  it("disables interaction when disabled is true", () => {
    const handleRate = vi.fn();
    const { container } = render(<EmojiRating disabled onRate={handleRate} />);
    const buttons = container.querySelectorAll("button");
    fireEvent.click(buttons[2]);
    expect(handleRate).not.toHaveBeenCalled();
  });
});

describe("EmojiRating keyboard and selected state", () => {
  it("names every face and the group", () => {
    render(<EmojiRating aria-label="How was it?" />);
    expect(screen.getByRole("group", { name: "How was it?" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Rate 1 out of 5" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Rate 5 out of 5" })).toBeDefined();
  });

  it("keeps the emoji glyphs out of the accessible name", () => {
    render(<EmojiRating />);
    const [first] = screen.getAllByRole("button");
    expect(first.textContent).toBeTruthy();
    expect(first.querySelector("[aria-hidden='true']")).not.toBeNull();
    expect(first.getAttribute("aria-label")).toBe("Rate 1 out of 5");
  });

  it("presses the face holding the current rating", () => {
    render(<EmojiRating value={4} />);
    const faces = screen.getAllByRole("button");
    expect(faces.map((face) => face.getAttribute("aria-pressed"))).toEqual([
      "false",
      "false",
      "false",
      "true",
      "false",
    ]);
  });

  it("rates with Enter and Space", async () => {
    const user = userEvent.setup();
    const onRate = vi.fn();
    render(<EmojiRating onRate={onRate} />);

    await user.tab();
    await user.keyboard("{Enter}");
    expect(onRate).toHaveBeenLastCalledWith(1);

    await user.tab();
    await user.keyboard(" ");
    expect(onRate).toHaveBeenLastCalledWith(2);
  });
});

describe("EmojiRating half faces with a pointer", () => {
  // jsdom has no layout: every face is 20px wide and starts at x = 100.
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

  /** The face the pointer is on: with half values on, the faces are drawn spans of a slider. */
  const faceAt = (n: number) => {
    const face = document.querySelector<HTMLElement>(`[data-rating="${n}"]`);
    if (!face) throw new Error(`no face ${n}`);
    return face;
  };

  /** The state each face shows: full, half-way (partial) or off. */
  const states = () =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-rating]")).map(
      (face) => face.querySelector<HTMLElement>("[data-state]")?.dataset.state,
    );

  it("previews a half value while the pointer is over the left half of a face", () => {
    stubRect();
    render(<EmojiRating allowHalf />);
    const third = faceAt(3);

    fireEvent.mouseEnter(third, { clientX: 102 });
    expect(states()).toEqual(["full", "full", "partial", "off", "off"]);

    fireEvent.mouseMove(third, { clientX: 118 });
    expect(states()).toEqual(["full", "full", "full", "off", "off"]);

    fireEvent.mouseMove(third, { clientX: 105 });
    expect(states()).toEqual(["full", "full", "partial", "off", "off"]);

    fireEvent.mouseLeave(third);
    expect(states()).toEqual(["off", "off", "off", "off", "off"]);
  });

  it("previews whole faces only when half values are off", () => {
    stubRect();
    render(<EmojiRating />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Rate 3 out of 5" }), {
      clientX: 102,
    });
    expect(states()).toEqual(["full", "full", "full", "off", "off"]);
  });

  it("rates a half value from the left half of a face and a whole one from the right", () => {
    stubRect();
    const onRate = vi.fn();
    render(<EmojiRating allowHalf onRate={onRate} />);
    const third = faceAt(3);

    fireEvent.click(third, { detail: 1, clientX: 102 });
    expect(onRate).toHaveBeenLastCalledWith(2.5);
    fireEvent.click(third, { detail: 1, clientX: 118 });
    expect(onRate).toHaveBeenLastCalledWith(3);
  });

  it("clears a fractional rating when its pressed face is activated from the keyboard", async () => {
    const user = userEvent.setup();
    const onRate = vi.fn();
    // The same rating in whole mode (a fractional value with the half-face slider off).
    render(<EmojiRating value={3.5} onRate={onRate} />);
    const fourth = screen.getByRole("button", { name: "Rate 4 out of 5" });
    expect(fourth.getAttribute("aria-pressed")).toBe("true");

    fourth.focus();
    await user.keyboard("{Enter}");
    expect(onRate).toHaveBeenLastCalledWith(0);
  });
});

describe("EmojiRating with half values is a slider", () => {
  const slider = () => screen.getByRole("slider", { name: "Rating" });

  function Controlled({ seen }: { seen: (value: number) => void }) {
    const [value, setValue] = useState(0);
    return (
      <EmojiRating
        allowHalf
        value={value}
        onRate={(next) => {
          seen(next);
          setValue(next);
        }}
      />
    );
  }

  it("is one slider carrying the real value, not five buttons that round it", () => {
    render(<EmojiRating allowHalf value={3.5} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(slider().getAttribute("aria-valuemin")).toBe("0");
    expect(slider().getAttribute("aria-valuemax")).toBe("5");
    expect(slider().getAttribute("aria-valuenow")).toBe("3.5");
    expect(slider().getAttribute("aria-valuetext")).toBe("3.5 out of 5");
  });

  it("is a single tab stop and names itself with the aria-label", async () => {
    const user = userEvent.setup();
    render(
      <>
        <EmojiRating allowHalf aria-label="How was it?" />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("slider", { name: "How was it?" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });

  it.each([
    ["ArrowRight", 3, 3.5],
    ["ArrowLeft", 3, 2.5],
    ["ArrowUp", 3.5, 4],
    ["ArrowDown", 3.5, 3],
    ["PageUp", 3.5, 4],
    ["PageDown", 3.5, 3],
    ["Home", 3.5, 0],
    ["End", 3.5, 5],
  ])("%s moves %s to %s", async (key, from, to) => {
    const user = userEvent.setup();
    const onRate = vi.fn();
    render(<EmojiRating allowHalf value={from} onRate={onRate} />);
    slider().focus();
    await user.keyboard(`{${key}}`);
    expect(onRate).toHaveBeenCalledTimes(1);
    expect(onRate).toHaveBeenLastCalledWith(to);
  });

  it("reaches every half value from the keyboard alone", async () => {
    const user = userEvent.setup();
    const seen: number[] = [];
    render(<Controlled seen={(value) => seen.push(value)} />);
    slider().focus();
    await user.keyboard("{ArrowRight>10/}");
    expect(seen).toEqual([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
  });

  it.each([
    ["Alt", { altKey: true }],
    ["Ctrl", { ctrlKey: true }],
    ["Meta", { metaKey: true }],
  ])("leaves %s chords to the browser", (_name, modifier) => {
    const onRate = vi.fn();
    render(<EmojiRating allowHalf value={3} onRate={onRate} />);
    expect(fireEvent.keyDown(slider(), { key: "ArrowLeft", ...modifier })).toBe(true);
    expect(onRate).not.toHaveBeenCalled();
  });

  it("is out of the tab order and inert when disabled", async () => {
    const user = userEvent.setup();
    const onRate = vi.fn();
    render(<EmojiRating allowHalf value={3} disabled onRate={onRate} />);
    expect(slider().getAttribute("aria-disabled")).toBe("true");
    await user.tab();
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(onRate).not.toHaveBeenCalled();
  });

  it("stays a group of buttons when half values are off", () => {
    render(<EmojiRating value={3} />);
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });
});

describe("EmojiRating look and motion", () => {
  const faces = () => Array.from(document.querySelectorAll<HTMLElement>("[data-state]"));

  it("draws a face that is not reached in grey and circled, not only dimmed", () => {
    render(<EmojiRating value={2} />);
    const [reached, , unreached] = faces();
    expect(reached.dataset.state).toBe("full");
    expect(reached.className).not.toContain("grayscale");
    expect(unreached.dataset.state).toBe("off");
    // 40% opacity alone left it at 1.3:1; the ring is a 3:1 outline whatever the glyph looks like.
    expect(unreached.className).toContain("grayscale");
    expect(unreached.className).toContain("ring-muted-foreground");
    expect(unreached.className).not.toContain("opacity-40");
  });

  it("does not scale or fade on hover and press when the person asks for reduced motion", () => {
    render(<EmojiRating value={2} />);
    const [button] = screen.getAllByRole("button");
    expect(button.className).toContain("motion-reduce:hover:scale-100");
    expect(button.className).toContain("motion-reduce:active:scale-100");
    expect(button.className).toContain("motion-reduce:transition-none");
  });
});
