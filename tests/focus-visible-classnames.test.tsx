import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { JsonRenderer } from "../src/components/JsonRenderer";
import { XmlRenderer } from "../src/components/XmlRenderer";
import { PopoverLink } from "../src/components/markdown/PopoverLink";
import { ChatMessageList } from "../src/components/ChatMessageList";
import { ScrollArea } from "../src/components/ui/scroll-area";

describe("Focus-visible ring on remaining focusable custom controls", () => {
  it("JsonRenderer toggle carries a focus-visible ring", () => {
    const { container } = render(<JsonRenderer data={{ a: 1 }} initialExpanded={0} />);
    const toggle = container.querySelector('[role="button"]');
    expect(toggle?.className).toContain("focus-visible:ring");
  });

  it("XmlRenderer toggle carries a focus-visible ring", () => {
    const xml = "<root><child>value</child></root>";
    const { container } = render(<XmlRenderer data={xml} initialExpanded={0} />);
    const toggle = container.querySelector('[role="button"]');
    expect(toggle?.className).toContain("focus-visible:ring");
  });

  it("PopoverLink trigger carries a focus-visible ring", () => {
    const { container } = render(<PopoverLink content="More info">Link text</PopoverLink>);
    const trigger = container.querySelector('[role="button"]');
    expect(trigger?.className).toContain("focus-visible:ring");
  });

  it("ChatMessageList scroll container carries an inset focus-visible ring", () => {
    const { container } = render(
      <ChatMessageList>
        <div>Message</div>
      </ChatMessageList>,
    );
    const scrollContainer = container.querySelector(".overflow-y-auto");
    expect(scrollContainer?.className).toContain("focus-visible:ring");
    expect(scrollContainer?.className).toContain("focus-visible:ring-inset");
  });

  it("ScrollArea viewport carries an inset focus-visible ring", () => {
    const { container } = render(
      <ScrollArea>
        <div>Content</div>
      </ScrollArea>,
    );
    const viewport = container.querySelector("[data-radix-scroll-area-viewport]");
    expect(viewport?.className).toContain("focus-visible:ring");
    expect(viewport?.className).toContain("focus-visible:ring-inset");
  });
});
