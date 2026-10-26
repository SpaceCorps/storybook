import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { StarRating } from "../src/components/StarRating";

// The control for StarRating.reduced-motion.test.tsx: with no reduced-motion preference the same
// hover plays, so the reduced-motion test passing means the setting was honoured, not that jsdom
// cannot animate.
describe("StarRating hover wobble without a reduced-motion preference", () => {
  it("scales and rotates the star the pointer is over", async () => {
    render(<StarRating value={0} />);
    const star = screen.getByRole("button", { name: "Rate 3 stars" });
    fireEvent.pointerEnter(star, { pointerType: "mouse" });
    await waitFor(() => expect(star.style.transform).toMatch(/scale\(1\.3\)|rotate\(-10deg\)/));
  });
});
