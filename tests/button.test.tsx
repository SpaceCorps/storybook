import "@testing-library/jest-dom";
import { resolve } from "node:path";
import type * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { Button } from "../src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../src/components/ui/dropdown-menu";
import { IconButton } from "../src/components/ui/IconButton";
import { readCssInlined } from "./read-css.ts";

function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
  const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
  const b = parseInt(cleanHex.slice(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getRelativeLuminance(color1);
  const lum2 = getRelativeLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe("Button component", () => {
  it("renders with children and fires click events", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    const btn = screen.getByRole("button", { name: "Click Me" });
    expect(btn).toBeDefined();
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("prevents click when disabled", () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Disabled" });
    expect(btn.hasAttribute("disabled")).toBe(true);
    fireEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("applies variant and size classes", () => {
    const { container } = render(
      <Button variant="destructive" size="sm">
        Delete
      </Button>,
    );
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("bg-destructive");
    expect(btn?.className).toContain("text-destructive-foreground");
  });
});

const ENTRY_POINTS: readonly (readonly [string, string])[] = [
  ["globals.css", resolve(__dirname, "..", "src/styles/globals.css")],
  ["index.css", resolve(__dirname, "..", "src/styles/index.css")],
];

/**
 * Both entry points import the same `tokens.css`, so they resolve every shared token to the same
 * value and the expectations below hold for either one. `readCssInlined` splices the imported blocks
 * back in, which is what keeps the `[^}]+` block regexes here working — `style-token-parity.test.ts`
 * asserts the single-block invariant they rely on.
 */
function block(path: string, selector: ":root" | ".dark"): string {
  const css = readCssInlined(path);
  const pattern = selector === ":root" ? /:root\s*\{([^}]+)\}/s : /\.dark\s*\{([^}]+)\}/s;
  return pattern.exec(css)?.[1] ?? "";
}

function token(css: string, name: string): string | undefined {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1].trim();
}

describe("Destructive theme contrast compliance (WCAG 2.1 AA)", () => {
  it.each(ENTRY_POINTS)(
    "%s light mode meets WCAG 2.1 AA contrast requirements (>= 4.5:1)",
    (_name, path) => {
      const rootBlock = block(path, ":root");
      const destructive = token(rootBlock, "destructive");
      const foreground = token(rootBlock, "destructive-foreground");

      expect(destructive).toBeDefined();
      expect(foreground).toBe("#000000");
      const contrast = getContrastRatio(destructive!, foreground!);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(ENTRY_POINTS)(
    "%s dark mode meets WCAG 2.1 AA contrast requirements (>= 4.5:1)",
    (_name, path) => {
      const darkBlock = block(path, ".dark");
      const destructive = token(darkBlock, "destructive");
      const foreground = token(darkBlock, "destructive-foreground");

      expect(destructive).toBeDefined();
      expect(foreground).toBeDefined();
      const contrast = getContrastRatio(destructive!, foreground!);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe("Semantic theme contrast compliance (WCAG 2.1 AA)", () => {
  const cases = ENTRY_POINTS.flatMap(([name, path]) =>
    ["info", "success", "warning"].map((semantic) => [name, semantic, path] as const),
  );

  it.each(cases)(
    "%s light mode --%s-foreground is #000000 and meets AA contrast (>= 4.5:1)",
    (_name, semantic, path) => {
      const rootBlock = block(path, ":root");
      const background = token(rootBlock, semantic);
      const foreground = token(rootBlock, `${semantic}-foreground`);

      expect(background).toBeDefined();
      expect(foreground).toBe("#000000");
      const contrast = getContrastRatio(background!, foreground!);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(cases)(
    "%s dark mode --%s-foreground is #ffffff and meets AA contrast (>= 4.5:1)",
    (_name, semantic, path) => {
      const darkBlock = block(path, ".dark");
      const background = token(darkBlock, semantic);
      const foreground = token(darkBlock, `${semantic}-foreground`);

      expect(background).toBeDefined();
      expect(foreground).toBe("#ffffff");
      const contrast = getContrastRatio(background!, foreground!);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe("Disabled button legibility", () => {
  const SOLID = ["default", "destructive", "secondary", "success", "warning", "info"] as const;

  it.each(SOLID)(
    "a disabled %s button swaps to the muted surface instead of dimming its fill",
    (variant) => {
      render(
        <Button variant={variant} disabled>
          Save
        </Button>,
      );
      const classes = screen.getByRole("button", { name: "Save" }).className.split(/\s+/);

      expect(classes).toContain("disabled:bg-muted");
      expect(classes).toContain("disabled:text-muted-foreground");
      expect(classes).toContain("disabled:opacity-100");
      // twMerge drops the base `disabled:opacity-60` once the variant sets its own.
      expect(classes).not.toContain("disabled:opacity-60");
    },
  );

  it.each(["outline", "ghost", "link"] as const)(
    "a disabled %s button, which has no fill to swap, stays dimmed",
    (variant) => {
      render(
        <Button variant={variant} disabled>
          Save
        </Button>,
      );
      expect(screen.getByRole("button", { name: "Save" }).className).toContain(
        "disabled:opacity-60",
      );
    },
  );

  it.each(ENTRY_POINTS)(
    "%s keeps --muted-foreground on --muted at AA contrast in both themes",
    (_name, path) => {
      for (const selector of [":root", ".dark"] as const) {
        const tokens = block(path, selector);
        const contrast = getContrastRatio(
          token(tokens, "muted")!,
          token(tokens, "muted-foreground")!,
        );
        expect(contrast, `${selector} muted/muted-foreground`).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it("dims the transparent variants far enough that their label clears 4.5:1 on either page", () => {
    // The label (--foreground) at 60% over the page (--background), the worst case being light mode.
    const mix = (fg: string, bg: string, alpha: number): string =>
      "#" +
      [1, 3, 5]
        .map((i) =>
          Math.round(
            parseInt(fg.slice(i, i + 2), 16) * alpha +
              parseInt(bg.slice(i, i + 2), 16) * (1 - alpha),
          )
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
    for (const selector of [":root", ".dark"] as const) {
      const tokens = block(ENTRY_POINTS[0][1], selector);
      const page = token(tokens, "background")!;
      const label = mix(token(tokens, "foreground")!, page, 0.6);
      expect(getContrastRatio(label, page), selector).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("Button focusableWhenDisabled", () => {
  it("stays out of the native disabled state so it can keep focus", () => {
    render(
      <Button disabled focusableWhenDisabled>
        Save
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Save" });

    expect(btn.hasAttribute("disabled")).toBe(false);
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(btn.hasAttribute("data-disabled")).toBe(true);
  });

  it("is a tab stop, unlike a natively disabled button", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Button disabled>Native</Button>
        <Button disabled focusableWhenDisabled>
          Soft
        </Button>
      </>,
    );

    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Soft" }));
  });

  it("ignores clicks", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <Button disabled focusableWhenDisabled onClick={onClick}>
          Save
        </Button>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onClick).not.toHaveBeenCalled();
    // Swallowed, so a parent does not see a click on a disabled control either.
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("ignores Enter and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled focusableWhenDisabled onClick={onClick}>
        Save
      </Button>,
    );

    await user.tab();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Save" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not submit the form it belongs to, by click, Enter, or Enter in a field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="Name" />
        <Button type="submit" disabled focusableWhenDisabled>
          Save
        </Button>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByLabelText("Name"));
    await user.keyboard("{Enter}");
    screen.getByRole("button", { name: "Save" }).focus();
    await user.keyboard("{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits normally once it is no longer disabled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" disabled={false} focusableWhenDisabled>
          Save
        </Button>
      </form>,
    );
    const btn = screen.getByRole("button", { name: "Save" });

    expect(btn.hasAttribute("aria-disabled")).toBe(false);
    await user.click(btn);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("describes why it is unavailable without adding the reason to its name", () => {
    render(
      <Button disabled focusableWhenDisabled disabledReason="Add a line first">
        Save
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Save" });

    expect(btn).toHaveAccessibleDescription("Add a line first");
    expect(btn).toHaveAccessibleName("Save");
  });

  it("keeps the caller's own aria-describedby alongside the reason", () => {
    render(
      <>
        <p id="hint">Needs a line</p>
        <Button
          disabled
          focusableWhenDisabled
          disabledReason="Add a line first"
          aria-describedby="hint"
        >
          Save
        </Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toHaveAccessibleDescription(
      "Needs a line Add a line first",
    );
  });

  it("drops the reason once the button is enabled", () => {
    const { rerender } = render(
      <Button disabled focusableWhenDisabled disabledReason="Add a line first">
        Save
      </Button>,
    );
    rerender(
      <Button disabled={false} focusableWhenDisabled disabledReason="Add a line first">
        Save
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toHaveAccessibleDescription("");
  });

  it("does not change what plain disabled does", async () => {
    const user = userEvent.setup();
    render(<Button disabled>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });

    expect(btn.hasAttribute("disabled")).toBe(true);
    expect(btn.hasAttribute("aria-disabled")).toBe(false);
    await user.tab();
    expect(document.activeElement).not.toBe(btn);
  });

  it("still applies a caller's aria-disabled when it is not soft-disabled", () => {
    render(
      <Button disabled aria-disabled>
        Save
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Save" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("works on a child element with asChild, leaving the reason to the caller", () => {
    render(
      <Button asChild disabled focusableWhenDisabled disabledReason="not rendered">
        <a href="#next">Next</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Next" });

    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(link.querySelector("[hidden]")).toBeNull();
  });

  it.each(["default", "destructive", "secondary", "success", "warning", "info"] as const)(
    "styles a soft-disabled %s button like its disabled twin",
    (variant) => {
      render(
        <Button variant={variant} disabled focusableWhenDisabled>
          Save
        </Button>,
      );
      const classes = screen.getByRole("button", { name: "Save" }).className.split(/\s+/);

      expect(classes).toContain("aria-disabled:bg-muted");
      expect(classes).toContain("aria-disabled:text-muted-foreground");
      expect(classes).toContain("aria-disabled:opacity-100");
      expect(classes).toContain("aria-disabled:cursor-not-allowed");
      // It still takes the pointer, so the hover effect has to be cancelled, not just never reached.
      expect(classes).toContain("aria-disabled:hover:brightness-100");
      expect(classes).not.toContain("aria-disabled:pointer-events-none");
    },
  );

  it.each(["outline", "ghost", "ai"] as const)(
    "dims a soft-disabled %s button and cancels its hover surface",
    (variant) => {
      render(
        <Button variant={variant} disabled focusableWhenDisabled>
          Save
        </Button>,
      );
      const classes = screen.getByRole("button", { name: "Save" }).className.split(/\s+/);

      expect(classes).toContain("aria-disabled:opacity-60");
      expect(classes.some((c) => c.startsWith("aria-disabled:hover:bg-"))).toBe(true);
    },
  );

  it("keeps the focus ring on a soft-disabled button", () => {
    render(
      <Button disabled focusableWhenDisabled>
        Save
      </Button>,
    );
    const classes = screen.getByRole("button", { name: "Save" }).className.split(/\s+/);

    expect(classes).toContain("focus-visible:ring-2");
    expect(classes).toContain("focus-visible:ring-ring");
  });
});

describe("A soft-disabled control as a menu trigger", () => {
  /** Radix opens a menu on pointer-down and on ArrowDown, so swallowing click is not enough. */
  function MenuOver(props: { trigger: React.ReactNode }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{props.trigger}</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Delete all</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  const menuIsOpen = () => screen.queryByRole("menuitem", { name: "Delete all" }) !== null;

  it("opens when it is enabled, which is what the cases below must not do", async () => {
    const user = userEvent.setup();
    render(<MenuOver trigger={<Button>Actions</Button>} />);

    await user.click(screen.getByRole("button", { name: "Actions" }));

    expect(menuIsOpen()).toBe(true);
  });

  it("does not open on a press, which is where Radix opens it", async () => {
    const user = userEvent.setup();
    render(
      <MenuOver
        trigger={
          <Button disabled focusableWhenDisabled disabledReason="Nothing selected">
            Actions
          </Button>
        }
      />,
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));

    expect(menuIsOpen()).toBe(false);
    expect(screen.getByRole("button", { name: "Actions" }).getAttribute("aria-disabled")).toBe(
      "true",
    );
  });

  it("does not open on ArrowDown, ArrowUp, Enter or Space either, yet stays focusable", async () => {
    const user = userEvent.setup();
    render(
      <MenuOver
        trigger={
          <Button disabled focusableWhenDisabled>
            Actions
          </Button>
        }
      />,
    );

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Actions" }));
    // One key at a time: a menu that did open would be closed again by the next key.
    for (const key of ["{ArrowDown}", "{ArrowUp}", "{Enter}", " "]) {
      await user.keyboard(key);
      expect(menuIsOpen(), key).toBe(false);
    }
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Actions" }));
  });

  it("holds for an IconButton trigger too", async () => {
    const user = userEvent.setup();
    render(
      <MenuOver
        trigger={
          <IconButton label="Actions" disabled focusableWhenDisabled>
            x
          </IconButton>
        }
      />,
    );
    const trigger = screen.getByRole("button", { name: "Actions" });

    await user.click(trigger);
    expect(menuIsOpen()).toBe(false);
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(menuIsOpen()).toBe(false);
  });

  it("does not run the caller's own press handlers while soft-disabled", async () => {
    const user = userEvent.setup();
    const onPointerDown = vi.fn();
    const onMouseDown = vi.fn();
    const { rerender } = render(
      <Button
        disabled
        focusableWhenDisabled
        onPointerDown={onPointerDown}
        onMouseDown={onMouseDown}
      >
        Drag
      </Button>,
    );

    await user.click(screen.getByRole("button", { name: "Drag" }));
    expect(onPointerDown).not.toHaveBeenCalled();
    expect(onMouseDown).not.toHaveBeenCalled();

    rerender(
      <Button
        disabled={false}
        focusableWhenDisabled
        onPointerDown={onPointerDown}
        onMouseDown={onMouseDown}
      >
        Drag
      </Button>,
    );
    await user.click(screen.getByRole("button", { name: "Drag" }));
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onMouseDown).toHaveBeenCalledTimes(1);
  });

  it("keeps the arrow keys for a control that opens nothing, so it never traps a roving group", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    const onGroupKeyDown = vi.fn();
    render(
      <div onKeyDown={onGroupKeyDown}>
        <Button disabled focusableWhenDisabled onKeyDown={onKeyDown}>
          Item
        </Button>
      </div>,
    );

    await user.tab();
    await user.keyboard("{ArrowDown}");

    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onGroupKeyDown).toHaveBeenCalledTimes(1);
  });
});
