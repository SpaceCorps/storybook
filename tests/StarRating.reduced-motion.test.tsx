import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { StarRating } from "../src/components/StarRating";

// Framer Motion reads prefers-reduced-motion once, the first time something animates, and keeps the
// answer for the life of the module, which is why this has a file of its own: the setting has to be
// in place before the first render. StarRating.motion-control.test.tsx is the same hover without it.
window.matchMedia = ((query: string) => ({
  matches: query.includes("prefers-reduced-motion"),
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

describe("StarRating with prefers-reduced-motion: reduce", () => {
  it("does not scale or rotate the star the pointer is over", async () => {
    render(<StarRating value={0} />);
    const star = screen.getByRole("button", { name: "Rate 3 stars" });
    fireEvent.pointerEnter(star, { pointerType: "mouse" });
    // The control file sees the transform within a frame or two; wait well past that.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(star.style.transform).not.toMatch(/scale\(1\.3\)|rotate\(-10deg\)/);
  });

  it("does not play the press wobble either", async () => {
    render(<StarRating value={0} />);
    const star = screen.getByRole("button", { name: "Rate 3 stars" });
    fireEvent.pointerDown(star, { pointerType: "mouse", button: 0 });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(star.style.transform).not.toMatch(/scale\(0\.9\)|rotate\(15deg\)/);
  });
});
