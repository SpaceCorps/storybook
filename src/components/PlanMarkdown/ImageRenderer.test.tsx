import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { ImageRenderer } from "./ImageRenderer";

describe("ImageRenderer", () => {
  it("renders an img element with correct src and alt", () => {
    render(<ImageRenderer src="https://example.com/test.jpg" alt="Test image" />);
    const img = screen.getByRole("img", { name: "Test image" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/test.jpg");
  });

  it("shows error placeholder when image fails to load", async () => {
    render(<ImageRenderer src="https://example.com/broken.jpg" alt="Broken image" />);
    const img = screen.getByRole("img", { name: "Broken image" });

    fireEvent.error(img);

    await waitFor(() => {
      expect(screen.getByText("Broken image")).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
  });

  it("makes image clickable after successful load", async () => {
    render(<ImageRenderer src="https://example.com/test.jpg" alt="Test image" />);
    const img = screen.getByRole("img", { name: "Test image" });

    fireEvent.load(img);

    await waitFor(() => {
      expect(img).toHaveClass("pmv-img-clickable");
    });
  });

  it("opens overlay on image click", async () => {
    render(<ImageRenderer src="https://example.com/test.jpg" alt="Test image" />);
    const img = screen.getByRole("img", { name: "Test image" });

    fireEvent.load(img);

    await waitFor(() => {
      expect(img).toHaveClass("pmv-img-clickable");
    });

    fireEvent.click(img);

    await waitFor(() => {
      const overlay = document.querySelector(".pmv-img-overlay");
      expect(overlay).toBeInTheDocument();
    });
  });

  it("closes overlay on backdrop click", async () => {
    render(<ImageRenderer src="https://example.com/test.jpg" alt="Test image" />);
    const img = screen.getByRole("img", { name: "Test image" });

    fireEvent.load(img);
    fireEvent.click(img);

    await waitFor(() => {
      const overlay = document.querySelector(".pmv-img-overlay");
      expect(overlay).toBeInTheDocument();
    });

    const overlay = document.querySelector(".pmv-img-overlay")!;
    fireEvent.click(overlay);

    await waitFor(() => {
      expect(document.querySelector(".pmv-img-overlay")).not.toBeInTheDocument();
    });
  });

  it("closes overlay on Escape key press", async () => {
    render(<ImageRenderer src="https://example.com/test.jpg" alt="Test image" />);
    const img = screen.getByRole("img", { name: "Test image" });

    fireEvent.load(img);
    fireEvent.click(img);

    await waitFor(() => {
      const overlay = document.querySelector(".pmv-img-overlay");
      expect(overlay).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(document.querySelector(".pmv-img-overlay")).not.toBeInTheDocument();
    });
  });

  it("displays title in error state", async () => {
    render(
      <ImageRenderer
        src="https://example.com/broken.jpg"
        alt="Broken image"
        title="This is a title"
      />,
    );
    const img = screen.getByRole("img", { name: "Broken image" });

    fireEvent.error(img);

    await waitFor(() => {
      expect(screen.getByText("This is a title")).toBeInTheDocument();
    });
  });

  it("uses alt text as fallback in error state when no alt provided", async () => {
    render(<ImageRenderer src="https://example.com/broken.jpg" />);
    const img = screen.getByRole("img");

    fireEvent.error(img);

    await waitFor(() => {
      expect(screen.getByText("Image failed to load")).toBeInTheDocument();
    });
  });
});

describe("ImageRenderer keyboard", () => {
  const src = "https://example.com/test.jpg";

  async function loadedButton(alt = "Test image") {
    render(<ImageRenderer src={src} alt={alt} />);
    fireEvent.load(screen.getByRole("img", { name: alt }));
    const button = screen.getByRole("button", { name: alt });
    await waitFor(() => expect(button).not.toBeDisabled());
    return button;
  }

  it("wraps the image in a button named by the alt text", async () => {
    const button = await loadedButton();
    expect(button.tagName).toBe("BUTTON");
    expect(button.querySelector("img")).toBeInTheDocument();
  });

  it("names the button 'Open image' when there is no alt text", () => {
    render(<ImageRenderer src={src} />);
    expect(screen.getByRole("button", { name: "Open image" })).toBeInTheDocument();
  });

  it("is not actionable until the image has loaded", () => {
    render(<ImageRenderer src={src} alt="Test image" />);
    expect(screen.getByRole("button", { name: "Test image" })).toBeDisabled();
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("opens the viewer with %s and gives focus back on Escape", async (_name, key) => {
    const user = userEvent.setup();
    const button = await loadedButton();

    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard(key);

    const dialog = await screen.findByRole("dialog", { name: "Image preview" });
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
  });

  it("keeps Tab inside the open viewer", async () => {
    const user = userEvent.setup();
    await loadedButton();
    await user.keyboard("{Tab}{Enter}");

    const dialog = await screen.findByRole("dialog");
    await user.tab();
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("gives focus back to the image after the Close button is used", async () => {
    const user = userEvent.setup();
    const button = await loadedButton();
    await user.click(button);

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
  });
});
