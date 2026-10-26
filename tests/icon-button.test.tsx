import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vite-plus/test";
import { IconButton } from "../src/components/ui/IconButton";
import { Tooltip } from "../src/components/ui/TuiTooltip";
import { readCssInlined } from "./read-css.ts";

describe("IconButton disabled states", () => {
  it("leaves a natively disabled button with no tab stop in front of it", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <>
        <button type="button">Before</button>
        <IconButton label="Delete" disabled>
          x
        </IconButton>
        <button type="button">After</button>
      </>,
    );

    // The tooltip wrapper used to be focusable, with no name and no outline: an unlabelled stop.
    expect(container.querySelector(".tui-tooltip-trigger-wrap")?.hasAttribute("tabindex")).toBe(
      false,
    );
    await user.tab();
    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });

  it("keeps a focusableWhenDisabled button in the tab order, named, and not native-disabled", async () => {
    const user = userEvent.setup();
    render(
      <IconButton label="Delete" disabled focusableWhenDisabled>
        x
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Delete" });

    await user.tab();

    expect(document.activeElement).toBe(button);
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("ignores click, Enter and Space when soft-disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <IconButton label="Delete" disabled focusableWhenDisabled onClick={onClick}>
        x
      </IconButton>,
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onClick).not.toHaveBeenCalled();
  });

  it("describes the reason and shows it in the tooltip on keyboard focus", async () => {
    const user = userEvent.setup();
    render(
      <IconButton label="Delete" disabled focusableWhenDisabled disabledReason="Select a row first">
        x
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Delete" });

    await user.tab();

    expect(button).toHaveAccessibleDescription("Select a row first");
    expect((await screen.findAllByText("Delete: Select a row first")).length).toBeGreaterThan(0);
  });

  it("does not wrap a soft-disabled button, since its tooltip reaches it directly", () => {
    const { container } = render(
      <IconButton label="Delete" disabled focusableWhenDisabled>
        x
      </IconButton>,
    );

    expect(container.querySelector(".tui-tooltip-trigger-wrap")).toBeNull();
  });

  it("clicks as before when enabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <IconButton label="Delete" onClick={onClick}>
        x
      </IconButton>,
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("IconButton tooltip link", () => {
  it("links the open tooltip to its button, so a screen reader announces it", () => {
    render(
      <IconButton label="Save" tooltip="Save the file (Ctrl+S)" tooltipOpen>
        x
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Save" });

    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toContain("Save the file (Ctrl+S)");
  });

  it("matches a bare Tooltip around a plain button", () => {
    render(
      <>
        <IconButton label="Save" tooltipOpen>
          x
        </IconButton>
        <Tooltip content="Plain" open>
          <button type="button">Plain</button>
        </Tooltip>
      </>,
    );

    expect(screen.getByRole("button", { name: "Save" }).hasAttribute("aria-describedby")).toBe(
      screen.getByRole("button", { name: "Plain" }).hasAttribute("aria-describedby"),
    );
    expect(screen.getByRole("button", { name: "Save" }).hasAttribute("aria-describedby")).toBe(
      true,
    );
  });

  it("emits no aria-describedby of its own while the tooltip is closed", () => {
    render(
      <IconButton label="Save" tooltipOpen={false}>
        x
      </IconButton>,
    );

    expect(screen.getByRole("button", { name: "Save" }).hasAttribute("aria-describedby")).toBe(
      false,
    );
  });

  it("describes a soft-disabled button by its reason alone, and links nothing else to it", () => {
    render(
      <IconButton
        label="Delete"
        disabled
        focusableWhenDisabled
        disabledReason="Select a row first"
        tooltipOpen
      >
        x
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Delete" });

    // The open tooltip says "Delete: Select a row first", which is the name and the reason again, so
    // it is not linked a second time: the child's own aria-describedby wins over Radix's, and that
    // is by design. Linking both would make a screen reader say the reason twice.
    const ids = (button.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
    expect(ids).toHaveLength(1);
    expect(document.getElementById(ids[0]!)?.textContent).toBe("Select a row first");
    expect(button).toHaveAccessibleDescription("Select a row first");
  });
});

describe("Tooltip content that comes and goes", () => {
  it("keeps its trigger mounted and focused, so a gate that opens does not drop focus", () => {
    const Gate = (props: { content?: string }) => (
      <Tooltip content={props.content}>
        <button type="button">Sync</button>
      </Tooltip>
    );
    const { rerender } = render(<Gate />);
    const button = screen.getByRole("button", { name: "Sync" });
    button.focus();

    rerender(<Gate content="Action already in progress" />);
    expect(screen.getByRole("button", { name: "Sync" })).toBe(button);
    expect(document.activeElement).toBe(button);

    rerender(<Gate />);
    expect(screen.getByRole("button", { name: "Sync" })).toBe(button);
    expect(document.activeElement).toBe(button);
  });

  it("shows nothing while there is no content, and does not remember a hover from then", async () => {
    const user = userEvent.setup();
    const Gate = (props: { content?: string }) => (
      <Tooltip content={props.content}>
        <button type="button">Sync</button>
      </Tooltip>
    );
    const { rerender } = render(<Gate />);

    await user.hover(screen.getByRole("button", { name: "Sync" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
    rerender(<Gate content="Now there is a reason" />);

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("renders a bare text child as is when there is nothing to show", () => {
    render(<Tooltip content="">just text</Tooltip>);

    expect(screen.getByText("just text")).toBeTruthy();
  });
});

describe("Tooltip with nothing to show", () => {
  const afterDelay = () => act(() => new Promise((resolve) => setTimeout(resolve, 40)));

  it("does not close a tooltip that is open on another control when it is hovered", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Tooltip content="About A" defaultOpen delayDuration={0}>
          <button type="button">A</button>
        </Tooltip>
        <Tooltip content={undefined} delayDuration={0}>
          <button type="button">B</button>
        </Tooltip>
      </>,
    );
    expect((await screen.findAllByText("About A")).length).toBeGreaterThan(0);

    // Hovering B used to tell Radix a tooltip had opened, and Radix closes the others when one does.
    await user.hover(screen.getByRole("button", { name: "B" }));
    await afterDelay();

    expect(screen.getAllByText("About A").length).toBeGreaterThan(0);
  });

  it("does not close a tooltip that a keyboard user opened by focusing another control", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Tooltip content="About A" delayDuration={0}>
          <button type="button">A</button>
        </Tooltip>
        <Tooltip content={undefined} delayDuration={0}>
          <button type="button">B</button>
        </Tooltip>
      </>,
    );
    await user.tab();
    expect((await screen.findAllByText("About A")).length).toBeGreaterThan(0);

    await user.hover(screen.getByRole("button", { name: "B" }));
    await afterDelay();

    expect(screen.getAllByText("About A").length).toBeGreaterThan(0);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "A" }));
  });

  it("leaves its child looking as it did bare: no state attribute, nothing opens on focus", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content={undefined}>
        <button type="button">B</button>
      </Tooltip>,
    );
    const button = screen.getByRole("button", { name: "B" });

    await user.tab();
    await user.hover(button);

    expect(button.hasAttribute("data-state")).toBe(false);
    expect(button.hasAttribute("aria-describedby")).toBe(false);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("does not wrap a child in a button of its own when it is not its own trigger", () => {
    const { container } = render(
      <Tooltip content="" asChild={false}>
        <span>child</span>
      </Tooltip>,
    );

    // It used to be `<button data-state="closed"><span>child</span></button>`.
    expect(container.querySelector("button")).toBeNull();
    expect(container.innerHTML).toBe("<span>child</span>");
  });

  it("does not add the pointer wrapper around a child when there is nothing to anchor", () => {
    const { container } = render(
      <Tooltip content="" wrapTrigger>
        <button type="button" disabled>
          Go
        </button>
      </Tooltip>,
    );

    expect(container.querySelector(".tui-tooltip-trigger-wrap")).toBeNull();
  });

  it("still opens, with its state attribute, once there is something to say", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Tooltip content={undefined}>
        <button type="button">B</button>
      </Tooltip>,
    );
    rerender(
      <Tooltip content="Now there is a reason">
        <button type="button">B</button>
      </Tooltip>,
    );

    await user.tab();

    expect((await screen.findAllByText("Now there is a reason")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "B" }).hasAttribute("data-state")).toBe(true);
  });
});

describe("Tooltip wrapTrigger", () => {
  it("anchors on a wrapper that is never focusable, even for the deprecated triggerDisabled", () => {
    const { container } = render(
      <Tooltip content="Why" wrapTrigger triggerDisabled>
        <button type="button" disabled>
          Go
        </button>
      </Tooltip>,
    );

    expect(container.querySelector(".tui-tooltip-trigger-wrap")?.hasAttribute("tabindex")).toBe(
      false,
    );
  });
});

describe("IconButton focus ring contrast", () => {
  const uiCss = readCssInlined(resolve(__dirname, "..", "src/components/ui/ui.css"));
  const tokens = readCssInlined(resolve(__dirname, "..", "src/styles/globals.css"));
  const themes = {
    light: /:root\s*\{([^}]+)\}/s.exec(tokens)?.[1] ?? "",
    dark: /\.dark\s*\{([^}]+)\}/s.exec(tokens)?.[1] ?? "",
  } as const;
  const token = (theme: keyof typeof themes, name: string) =>
    new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6});`).exec(themes[theme])?.[1] ?? "#000000";

  /** The declarations of the rule whose selector is exactly `selector`. */
  const rule = (selector: string) => {
    const start = uiCss.indexOf(`${selector} {`);
    if (start === -1) return "";
    return uiCss.slice(uiCss.indexOf("{", start) + 1, uiCss.indexOf("}", start));
  };
  const channels = (hex: string) =>
    [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const luminance = (rgb: number[]) => {
    const [r, g, b] = rgb.map((value) => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const contrast = (a: number[], b: number[]) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high! + 0.05) / (low! + 0.05);
  };

  /** The ring as it reaches the screen: its own alpha, then the button's opacity, over the page. */
  function ringContrast(selector: string, theme: keyof typeof themes) {
    const block = rule(selector);
    const outline = /outline:\s*2px solid ([^;]+);/.exec(block)?.[1] ?? "";
    const opacity = Number(/opacity:\s*([\d.]+);/.exec(block)?.[1] ?? "1");
    const mix = /color-mix\(in srgb, var\(--tui-fg\) (\d+)%, transparent\)/.exec(outline);
    const color = outline.startsWith("var(--ring")
      ? token(theme, "ring")
      : token(theme, "foreground");
    const alpha = (mix ? Number(mix[1]) / 100 : 1) * opacity;
    const page = token(theme, "background");
    const painted = channels(color).map((value, i) =>
      Math.round(value * alpha + channels(page)[i]! * (1 - alpha)),
    );
    return contrast(painted, channels(page));
  }

  it.each(["light", "dark"] as const)(
    "draws the focus ring of a live icon button at 3:1 or better on the %s page",
    (theme) => {
      // A 40% tint of the text colour measured 2.7:1 on white.
      expect(ringContrast(".tui-icon-btn:focus-visible", theme)).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(["light", "dark"] as const)(
    "keeps it at 3:1 or better on a soft-disabled button, which is dimmed, on the %s page",
    (theme) => {
      // The dimmed button used to leave a ring of 1.74:1 in light mode and 2.01:1 in dark.
      expect(
        ringContrast('.tui-icon-btn[aria-disabled="true"]:focus-visible', theme),
      ).toBeGreaterThanOrEqual(3);
    },
  );

  it("uses the theme's ring colour rather than a tint of the text", () => {
    expect(rule(".tui-icon-btn:focus-visible")).toMatch(/outline:\s*2px solid var\(--ring/);
    expect(rule(".tui-icon-btn:focus-visible")).not.toContain("color-mix");
  });
});
