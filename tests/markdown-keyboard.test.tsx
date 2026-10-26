import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { MarkdownRenderer } from "../src/components/MarkdownRenderer";
import { ImageOverlay } from "../src/components/markdown/ImageOverlay";
import {
  ImageOverlayProvider,
  useImageOverlayContext,
} from "../src/components/markdown/ImageOverlayContext";
import { PopoverLink } from "../src/components/markdown/PopoverLink";

describe("PopoverLink keyboard", () => {
  it("is a focusable button-role span, because a native button cannot flow with the text around it", () => {
    render(<PopoverLink content="Extra detail">Hover me</PopoverLink>);
    const trigger = screen.getByRole("button", { name: "Hover me" });
    // A <button> is always an inline-block box: a phrase that wraps would stop wrapping with the
    // paragraph. The trigger stays an inline span.
    expect(trigger.tagName).toBe("SPAN");
    expect(trigger.getAttribute("tabindex")).toBe("0");
    expect(trigger.className).not.toMatch(/\b(inline-block|block|flex|inline-flex)\b/);
  });

  it("names the popover it opens after the phrase that opened it", async () => {
    const user = userEvent.setup();
    render(<PopoverLink content="Extra detail">Hover me</PopoverLink>);
    await user.click(screen.getByRole("button", { name: "Hover me" }));
    const dialog = await screen.findByRole("dialog", { name: "Hover me" });
    expect(dialog.textContent).toBe("Extra detail");
  });

  it("opens Space on release, as a native button does, and not on the press", async () => {
    render(<PopoverLink content="Extra detail">Hover me</PopoverLink>);
    const trigger = screen.getByRole("button", { name: "Hover me" });
    trigger.focus();

    // The press must not scroll the page, so it is cancelled; nothing opens yet.
    expect(fireEvent.keyDown(trigger, { key: " " })).toBe(false);
    expect(screen.queryByText("Extra detail")).toBeNull();
    fireEvent.keyUp(trigger, { key: " " });
    expect(await screen.findByText("Extra detail")).toBeDefined();
  });

  it("ignores a Space release whose press began somewhere else", () => {
    render(<PopoverLink content="Extra detail">Hover me</PopoverLink>);
    const trigger = screen.getByRole("button", { name: "Hover me" });
    trigger.focus();
    fireEvent.keyUp(trigger, { key: " " });
    expect(screen.queryByText("Extra detail")).toBeNull();
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("opens with %s and returns focus to the trigger on Escape", async (_name, key) => {
    const user = userEvent.setup();
    render(<PopoverLink content="Extra detail">Hover me</PopoverLink>);
    const trigger = screen.getByRole("button", { name: "Hover me" });

    await user.tab();
    expect(document.activeElement).toBe(trigger);
    await user.keyboard(key);
    expect(await screen.findByText("Extra detail")).toBeDefined();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Extra detail")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("is what markdown renders for a popover link", async () => {
    const user = userEvent.setup();
    render(<MarkdownRenderer content={'See the [glossary term](## "A longer explanation").'} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "glossary term" }));
    await user.keyboard("{Enter}");
    expect(await screen.findByText("A longer explanation")).toBeDefined();
  });
});

describe("MarkdownRenderer images", () => {
  const src = "https://example.com/chart.png";

  it("wraps the image in a button named by its alt text", () => {
    render(<MarkdownRenderer content={`![Quarterly chart](${src})`} />);
    const button = screen.getByRole("button", { name: "Quarterly chart" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.querySelector("img")?.getAttribute("src")).toBe(src);
  });

  it("names the button 'Open image' when the markdown gave no alt text", () => {
    render(<MarkdownRenderer content={`![](${src})`} />);
    expect(screen.getByRole("button", { name: "Open image" })).toBeDefined();
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])(
    "opens the viewer with %s, keeps focus inside it and gives it back on Escape",
    async (_name, key) => {
      const user = userEvent.setup();
      render(<MarkdownRenderer content={`![Quarterly chart](${src})`} />);
      const button = screen.getByRole("button", { name: "Quarterly chart" });

      await user.tab();
      expect(document.activeElement).toBe(button);
      await user.keyboard(key);

      const dialog = await screen.findByRole("dialog", { name: "Image preview" });
      const close = within(dialog).getByRole("button", { name: "Close" });
      expect(document.activeElement).toBe(close);

      // A single image has nothing to cycle to: Tab stays on the one control.
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);

      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(button));
    },
  );

  it("returns focus to the image after the Close button is used", async () => {
    const user = userEvent.setup();
    render(<MarkdownRenderer content={`![Quarterly chart](${src})`} />);
    const button = screen.getByRole("button", { name: "Quarterly chart" });

    await user.click(button);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it("labels the viewer's close button instead of leaving a bare glyph", async () => {
    const user = userEvent.setup();
    render(<MarkdownRenderer content={`![Quarterly chart](${src})`} />);
    await user.click(screen.getByRole("button", { name: "Quarterly chart" }));
    const close = within(await screen.findByRole("dialog")).getByRole("button", { name: "Close" });
    expect(close.textContent).toBe("");
  });
});

describe("ImageOverlay", () => {
  const images = [
    { src: "https://example.com/a.png", alt: "First" },
    { src: "https://example.com/b.png", alt: "Second" },
    { src: "https://example.com/c.png", alt: "Third" },
  ];

  function Gallery({ onNavigate }: { onNavigate?: (index: number) => void }) {
    const [index, setIndex] = React.useState(0);
    return (
      <ImageOverlay
        src={images[index].src}
        alt={images[index].alt}
        images={images}
        currentIndex={index}
        onNavigate={(next) => {
          onNavigate?.(next);
          setIndex(next);
        }}
        onClose={() => {}}
      />
    );
  }

  it("moves between images with the arrow keys, wrapping at both ends", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<Gallery onNavigate={onNavigate} />);
    const dialog = await screen.findByRole("dialog", { name: "Image preview" });
    expect(within(dialog).getByRole("img").getAttribute("alt")).toBe("First");

    await user.keyboard("{ArrowRight}");
    expect(onNavigate).toHaveBeenLastCalledWith(1);
    expect(within(dialog).getByRole("img").getAttribute("alt")).toBe("Second");

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(onNavigate).toHaveBeenLastCalledWith(2);
    expect(within(dialog).getByRole("img").getAttribute("alt")).toBe("Third");
  });

  it("starts on the Close button and cycles Tab through Previous, Close and Next", async () => {
    const user = userEvent.setup();
    render(<Gallery />);
    const dialog = await screen.findByRole("dialog");
    const previous = within(dialog).getByRole("button", { name: "Previous image" });
    const close = within(dialog).getByRole("button", { name: "Close" });
    const next = within(dialog).getByRole("button", { name: "Next image" });

    expect(document.activeElement).toBe(close);
    await user.tab();
    expect(document.activeElement).toBe(next);
    await user.tab();
    expect(document.activeElement).toBe(previous);
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(previous);
  });

  it("announces the position as it changes", async () => {
    const user = userEvent.setup();
    render(<Gallery />);
    const dialog = await screen.findByRole("dialog");
    const position = within(dialog).getByText("1 / 3");
    expect(position.getAttribute("aria-live")).toBe("polite");
    await user.keyboard("{ArrowRight}");
    expect(within(dialog).getByText("2 / 3")).toBeDefined();
  });

  it("closes with Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ImageOverlay src="https://example.com/a.png" alt="First" onClose={onClose} />);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing for an unsafe image URL", () => {
    render(<ImageOverlay src="javascript:alert(1)" alt="x" onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("works through the provider, with the opener getting focus back", async () => {
    const user = userEvent.setup();

    function Thumb({ id, src, alt }: { id: string; src: string; alt: string }) {
      const overlay = useImageOverlayContext();
      React.useEffect(() => {
        overlay?.register(id, src, alt);
        return () => overlay?.unregister(id);
      }, [overlay, id, src, alt]);
      return (
        <button type="button" onClick={() => overlay?.open(id)}>
          {`Open ${alt}`}
        </button>
      );
    }

    render(
      <ImageOverlayProvider>
        {images.map((image, index) => (
          <Thumb key={image.alt} id={String(index)} {...image} />
        ))}
      </ImageOverlayProvider>,
    );

    const second = screen.getByRole("button", { name: "Open Second" });
    await user.click(second);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("img").getAttribute("alt")).toBe("Second");
    expect(within(dialog).getByText("2 / 3")).toBeDefined();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(second));
  });
});
