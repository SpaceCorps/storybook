import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { JsonRenderer } from "../src/components/JsonRenderer";
import { XmlRenderer } from "../src/components/XmlRenderer";
import { PopoverLink } from "../src/components/markdown/PopoverLink";
import { ChatMessageList } from "../src/components/ChatMessageList";
import { ScrollArea } from "../src/components/ui/scroll-area";

/**
 * `focus-visible:ring-ring` is a colour and paints nothing on its own: the ring only exists once a
 * width (`ring` or `ring-N`) is set beside it. These tests compare whole class tokens, so a colour
 * can no longer stand in for the width the way a substring match let it.
 */
const classTokens = (element: Element | null | undefined) =>
  (element?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

const FOCUS_RING_WIDTH = /^focus-visible:ring(-[1-9]\d*)?$/;

/** The ring has a width, and the outline is hidden rather than removed so forced-colors keeps one. */
function expectFocusRing(element: Element | null | undefined, { inset = false } = {}) {
  expect(element).toBeTruthy();
  const tokens = classTokens(element);
  expect(
    tokens.filter((token) => FOCUS_RING_WIDTH.test(token)),
    "exactly one focus-visible ring width token",
  ).toHaveLength(1);
  expect(tokens).toContain("focus-visible:ring-ring");
  expect(tokens).toContain("focus-visible:outline-hidden");
  expect(tokens).not.toContain("focus-visible:outline-none");
  expect(tokens).not.toContain("focus-visible:ring-0");
  if (inset) {
    expect(tokens).toContain("focus-visible:ring-inset");
  }
}

describe("Focus-visible ring on remaining focusable custom controls", () => {
  it("accepts a ring with a width and rejects a colour on its own", () => {
    const element = document.createElement("div");
    element.className = "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";
    expectFocusRing(element);

    element.className = "focus-visible:outline-hidden focus-visible:ring-ring";
    expect(() => expectFocusRing(element)).toThrow();
    element.className = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
    expect(() => expectFocusRing(element)).toThrow();
    element.className = "focus-visible:outline-hidden focus-visible:ring-0 focus-visible:ring-ring";
    expect(() => expectFocusRing(element)).toThrow();
  });

  it("JsonRenderer toggle carries a focus-visible ring", () => {
    const { container } = render(<JsonRenderer data={{ a: 1 }} initialExpanded={0} />);
    expectFocusRing(container.querySelector('[role="button"]'));
  });

  it("XmlRenderer toggle carries a focus-visible ring", () => {
    const xml = "<root><child>value</child></root>";
    const { container } = render(<XmlRenderer data={xml} initialExpanded={0} />);
    expectFocusRing(container.querySelector('[role="button"]'));
  });

  it("PopoverLink trigger carries a focus-visible ring", () => {
    const { container } = render(<PopoverLink content="More info">Link text</PopoverLink>);
    // A native button now; it used to be a span with role="button".
    expectFocusRing(container.querySelector('button, [role="button"]'));
  });

  it("ChatMessageList scroll container carries an inset focus-visible ring", () => {
    const { container } = render(
      <ChatMessageList>
        <div>Message</div>
      </ChatMessageList>,
    );
    expectFocusRing(container.querySelector(".overflow-y-auto"), { inset: true });
  });

  it("ScrollArea viewport carries an inset focus-visible ring", () => {
    const { container } = render(
      <ScrollArea>
        <div>Content</div>
      </ScrollArea>,
    );
    expectFocusRing(container.querySelector("[data-radix-scroll-area-viewport]"), { inset: true });
  });
});
