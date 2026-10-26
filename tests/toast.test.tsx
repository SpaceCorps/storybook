import * as React from "react";
import { render, renderHook, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { resolve } from "node:path";
import { Toaster } from "../src/components/ui/toaster";
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastViewport,
} from "../src/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../src/components/ui/dialog";
import { reducer, toast, useToast } from "../src/hooks/use-toast";
import { readCssInlined } from "./read-css.ts";

afterEach(() => {
  vi.useRealTimers();
  // The toast store is module state, shared by every test in the file.
  const { result } = renderHook(() => useToast());
  act(() => result.current.dismiss());
});

/**
 * Radix renders each toast twice: the visible `li` and a screen-reader announcement in a live
 * region. The `li` is the one with a state, and it leaves the DOM once it has closed.
 */
const toastState = (title: string) =>
  Array.from(document.querySelectorAll("li[data-state]"))
    .find((item) => item.textContent?.includes(title))
    ?.getAttribute("data-state") ?? "gone";

describe("Toast notification system", () => {
  it("dispatches and renders a toast notification", () => {
    render(<Toaster />);

    act(() => {
      toast({
        title: "Test Toast",
        description: "Test Description",
      });
    });

    expect(screen.getAllByText("Test Toast").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Test Description").length).toBeGreaterThan(0);
  });

  it("allows dismissing a toast manually", () => {
    render(<Toaster />);

    let handle: { dismiss: () => void } | undefined;
    act(() => {
      handle = toast({
        title: "Dismissible",
      });
    });

    expect(toastState("Dismissible")).toBe("open");

    act(() => {
      handle?.dismiss();
    });

    expect(toastState("Dismissible")).not.toBe("open");
  });
});

describe("Toast dismissal", () => {
  function RaisesOnClick() {
    const { toast: raise } = useToast();
    return (
      <>
        <button type="button" onClick={() => raise({ title: "Saved from a click" })}>
          Save
        </button>
        <button type="button">Elsewhere</button>
        <Toaster />
      </>
    );
  }

  it("keeps a toast raised synchronously inside the click that created it", async () => {
    const user = userEvent.setup();
    render(<RaisesOnClick />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(toastState("Saved from a click")).toBe("open");
  });

  it("does not dismiss on a click elsewhere on the page", async () => {
    const user = userEvent.setup();
    render(<RaisesOnClick />);

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    fireEvent.click(document.body);

    expect(toastState("Saved from a click")).toBe("open");
  });

  it("leaves a toast alone when Escape closes a dialog opened after it", async () => {
    const user = userEvent.setup();
    function Page() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Edit
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogTitle>Form</DialogTitle>
              <DialogDescription>Fill it in.</DialogDescription>
            </DialogContent>
          </Dialog>
          <Toaster />
        </>
      );
    }
    render(<Page />);
    act(() => {
      toast({ title: "Upload failed", variant: "destructive" });
    });
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    // A page-wide Escape listener in use-toast used to take the error message down with the dialog.
    expect(toastState("Upload failed")).toBe("open");
  });

  it("names its close button, which is an icon with no text", () => {
    render(<Toaster />);
    act(() => {
      toast({ title: "Named close" });
    });

    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });

  it("still closes through its own close button", () => {
    render(<Toaster />);
    act(() => {
      toast({ title: "Closable" });
    });

    const item = Array.from(document.querySelectorAll("li[data-state]")).find((li) =>
      li.textContent?.includes("Closable"),
    )!;
    fireEvent.click(item.querySelector("button[toast-close]")!);

    expect(toastState("Closable")).not.toBe("open");
  });
});

describe("Toast durations", () => {
  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  it("auto-dismisses an ordinary toast after the default five seconds", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast({ title: "Ordinary" });
    });

    advance(4900);
    expect(toastState("Ordinary")).toBe("open");
    advance(300);
    expect(toastState("Ordinary")).not.toBe("open");
  });

  it("keeps a destructive toast up for much longer", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast({ title: "Failed", variant: "destructive" });
    });

    advance(11_900);
    expect(toastState("Failed")).toBe("open");
    advance(300);
    expect(toastState("Failed")).not.toBe("open");
  });

  it("keeps a toast with an action up as long, so there is time to press it", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast({ title: "Deleted", action: (<button type="button">Undo</button>) as never });
    });

    advance(11_900);
    expect(toastState("Deleted")).toBe("open");
  });

  it("honours an explicit duration over either default", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast({ title: "Quick", variant: "destructive", duration: 1000 });
    });

    advance(1100);
    expect(toastState("Quick")).not.toBe("open");
  });
});

describe("Toast durations after an update", () => {
  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  it("gives a progress toast that becomes an error the error's length, counted from the update", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    let handle!: ReturnType<typeof toast>;
    act(() => {
      handle = toast({ title: "Saving" });
    });
    advance(4000);

    act(() => handle.update({ title: "Failed to save", variant: "destructive" }));

    // Without the update's own length it would have gone at the five seconds it began with.
    advance(1500);
    expect(toastState("Failed to save")).toBe("open");
    advance(10_300);
    expect(toastState("Failed to save")).toBe("open");
    advance(400);
    expect(toastState("Failed to save")).not.toBe("open");
  });

  it("does the same for a toast that gains an action to press", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    let handle!: ReturnType<typeof toast>;
    act(() => {
      handle = toast({ title: "Removed" });
    });
    advance(4000);

    act(() => handle.update({ action: (<button type="button">Undo</button>) as never }));

    advance(11_000);
    expect(toastState("Removed")).toBe("open");
  });

  it("takes the length back when an error becomes an ordinary toast", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    let handle!: ReturnType<typeof toast>;
    act(() => {
      handle = toast({ title: "Retrying", variant: "destructive" });
    });
    advance(1000);

    act(() => handle.update({ title: "Saved", variant: "default" }));

    advance(5300);
    expect(toastState("Saved")).not.toBe("open");
  });

  it("leaves a duration the caller chose alone, even when the variant changes", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    let handle!: ReturnType<typeof toast>;
    act(() => {
      handle = toast({ title: "Quick", duration: 2000 });
    });

    act(() => handle.update({ title: "Quick failure", variant: "destructive" }));

    advance(2300);
    expect(toastState("Quick failure")).not.toBe("open");
  });

  it("takes a new explicit duration from an update, and keeps it through the next one", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    let handle!: ReturnType<typeof toast>;
    act(() => {
      handle = toast({ title: "Pinned" });
    });

    act(() => handle.update({ duration: 20_000 }));
    act(() => handle.update({ variant: "destructive" }));

    advance(19_000);
    expect(toastState("Pinned")).toBe("open");
    advance(1500);
    expect(toastState("Pinned")).not.toBe("open");
  });

  it("does not restart the clock for an update that changes only the words", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    let handle!: ReturnType<typeof toast>;
    act(() => {
      handle = toast({ title: "Uploading" });
    });
    advance(4000);

    act(() => handle.update({ title: "Uploading, nearly done" }));

    advance(1200);
    expect(toastState("Uploading, nearly done")).not.toBe("open");
  });
});

describe("Escape with a toast over an overlay", () => {
  /** A form in a dialog whose Save fails and raises an error toast, the usual way to meet this. */
  function FormThatFails(props: { modal?: boolean }) {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Edit
        </button>
        <Dialog open={open} onOpenChange={setOpen} modal={props.modal}>
          <DialogContent>
            <DialogTitle>Form</DialogTitle>
            <DialogDescription>Fill it in.</DialogDescription>
            <button
              type="button"
              onClick={() => toast({ title: "Save failed", variant: "destructive" })}
            >
              Save
            </button>
          </DialogContent>
        </Dialog>
        <Toaster />
      </>
    );
  }
  const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 60)));

  it("lets the first Escape cancel a dialog that was open before the toast", async () => {
    const user = userEvent.setup();
    render(<FormThatFails />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await settle();
    expect(toastState("Save failed")).toBe("open");

    await user.keyboard("{Escape}");
    await settle();

    // The toast used to take this key, and the dialog needed a second press.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(toastState("Save failed")).toBe("gone");
  });

  it("does the same however many toasts are stacked above it", async () => {
    const user = userEvent.setup();
    render(<FormThatFails />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    act(() => {
      toast({ title: "Also this" });
    });
    await settle();

    await user.keyboard("{Escape}");
    await settle();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("still closes a toast with Escape when nothing is open beneath it", async () => {
    const user = userEvent.setup();
    render(<Toaster />);
    act(() => {
      toast({ title: "Alone" });
    });
    expect(toastState("Alone")).toBe("open");

    await user.keyboard("{Escape}");

    expect(toastState("Alone")).not.toBe("open");
  });

  it("closes only the toast when focus is on it, and leaves the overlay open", async () => {
    const user = userEvent.setup();
    // Non-modal, so focus can leave the dialog and rest on the toast.
    render(<FormThatFails modal={false} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await settle();
    const close = document.querySelector<HTMLButtonElement>("li[data-state] button[toast-close]")!;

    // The close button stays a real, focusable control: it is how a keyboard user reaches a toast.
    close.focus();
    expect(document.activeElement).toBe(close);
    await user.keyboard("{Escape}");
    await settle();

    expect(toastState("Save failed")).not.toBe("open");
    expect(screen.queryByRole("dialog")).toBeTruthy();
  });

  it("respects a toast that handles Escape itself", async () => {
    const user = userEvent.setup();
    const onEscapeKeyDown = vi.fn((event: KeyboardEvent) => event.preventDefault());
    render(
      <>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Form</DialogTitle>
            <DialogDescription>Open.</DialogDescription>
          </DialogContent>
        </Dialog>
        <Toaster />
      </>,
    );
    act(() => {
      toast({ title: "Sticky", onEscapeKeyDown });
    });

    await user.keyboard("{Escape}");
    await settle();

    expect(onEscapeKeyDown).toHaveBeenCalled();
    expect(toastState("Sticky")).toBe("open");
    expect(screen.queryByRole("dialog")).toBeTruthy();
  });

  it("sends the page one Escape, from where the key was pressed, not a second one from <body>", async () => {
    const user = userEvent.setup();
    render(<FormThatFails />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await settle();
    const heard: Array<{ type: string; target: EventTarget | null }> = [];
    const onWindow = (event: KeyboardEvent) => {
      if (event.key === "Escape") heard.push({ type: "window", target: event.target });
    };
    const onDocument = (event: KeyboardEvent) => {
      if (event.key === "Escape") heard.push({ type: "document", target: event.target });
    };
    // Page-level handlers, the kind an app uses for its own Escape shortcuts.
    window.addEventListener("keydown", onWindow);
    document.addEventListener("keydown", onDocument);
    const pressedIn = document.activeElement;

    try {
      await user.keyboard("{Escape}");
      await settle();
    } finally {
      window.removeEventListener("keydown", onWindow);
      document.removeEventListener("keydown", onDocument);
    }

    expect(screen.queryByRole("dialog")).toBeNull();
    // One keypress bubbles through `document` and then `window`: two listeners, two calls. A
    // second event would make it four.
    expect(heard.map((entry) => entry.type)).toEqual(["document", "window"]);
    expect(heard.every((entry) => entry.target === pressedIn)).toBe(true);
    expect(pressedIn).not.toBe(document.body);
  });

  it("leaves the toasts where they were when the overlay will not close", async () => {
    const user = userEvent.setup();
    function Guarded() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Edit
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent onEscapeKeyDown={(event) => event.preventDefault()}>
              <DialogTitle>Unsaved changes</DialogTitle>
              <DialogDescription>Escape is not allowed here.</DialogDescription>
              <button
                type="button"
                onClick={() => toast({ title: "Save failed", variant: "destructive" })}
              >
                Save
              </button>
            </DialogContent>
          </Dialog>
          <Toaster />
        </>
      );
    }
    render(<Guarded />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Save" }));
    act(() => {
      toast({ title: "Also unrelated" });
    });
    await settle();

    await user.keyboard("{Escape}");
    await settle();

    // The dialog said no. The error message must not vanish for nothing, and neither must the rest.
    expect(screen.queryByRole("dialog")).toBeTruthy();
    expect(toastState("Save failed")).toBe("open");
    expect(toastState("Also unrelated")).toBe("open");
  });

  it("still closes the dialog in one press with a toast under it and another above it", async () => {
    const user = userEvent.setup();
    act(() => {
      toast({ title: "Raised before the dialog" });
    });
    render(<FormThatFails />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await settle();

    await user.keyboard("{Escape}");
    await settle();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("goes back to closing toasts once the overlay is gone", async () => {
    const user = userEvent.setup();
    render(<FormThatFails />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await settle();

    await user.keyboard("{Escape}");
    await settle();
    act(() => {
      toast({ title: "Raised afterwards" });
    });

    expect(toastState("Raised afterwards")).toBe("open");
    await user.keyboard("{Escape}");
    expect(toastState("Raised afterwards")).not.toBe("open");
  });
});

describe("Toast limit", () => {
  const entry = (id: string, open = true) => ({ id, open, title: id });
  const openIds = (state: ReturnType<typeof reducer>) =>
    state.toasts.filter((item) => item.open !== false).map((item) => item.id);

  it("counts only open toasts, so closed ones cannot push a live one out", () => {
    // Newest first: two quick toasts that have since closed sit in front of an unread error.
    const state = { toasts: [entry("quick-2", false), entry("quick-1", false), entry("error")] };

    const next = reducer(state, { type: "ADD_TOAST", toast: entry("new") });

    expect(openIds(next)).toEqual(["new", "error"]);
  });

  it("still keeps no more than three open toasts, dropping the oldest", () => {
    const state = { toasts: [entry("c"), entry("closed", false), entry("b"), entry("a")] };

    const next = reducer(state, { type: "ADD_TOAST", toast: entry("d") });

    expect(openIds(next)).toEqual(["d", "c", "b"]);
  });

  it("keeps an error on screen when quick toasts have come and gone behind a new one", () => {
    render(<Toaster />);
    act(() => {
      toast({ title: "ERROR-A", variant: "destructive" });
    });
    const quick: Array<ReturnType<typeof toast>> = [];
    act(() => {
      quick.push(toast({ title: "quick one" }), toast({ title: "quick two" }));
    });
    act(() => quick.forEach((handle) => handle.dismiss()));

    act(() => {
      toast({ title: "Fourth" });
    });

    expect(toastState("ERROR-A")).toBe("open");
    expect(toastState("Fourth")).toBe("open");
  });
});

describe("Toast colours", () => {
  const css = readCssInlined(resolve(__dirname, "..", "src/styles/globals.css"));
  const block = (selector: RegExp) => selector.exec(css)?.[1] ?? "";
  const themes = {
    light: block(/:root\s*\{([^}]+)\}/s),
    dark: block(/\.dark\s*\{([^}]+)\}/s),
  } as const;
  const token = (theme: keyof typeof themes, name: string) =>
    new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6});`).exec(themes[theme])?.[1] ?? "#000000";

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
  /** `foreground` painted at `alpha` over `background`, the way opacity composites. */
  const blend = (foreground: string, alpha: number, background: string) =>
    channels(foreground).map((value, i) =>
      Math.round(value * alpha + channels(background)[i]! * (1 - alpha)),
    );

  function renderVariant(variant: "destructive" | "success" | "warning" | "info") {
    render(
      <ToastProvider>
        <Toast variant={variant} open>
          <ToastDescription>Words</ToastDescription>
          <ToastAction altText="Retry now">Retry</ToastAction>
          <ToastClose />
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );
    return {
      toast: document.querySelector("li[data-state]") as HTMLElement,
      action: screen.getByText("Retry"),
      close: document.querySelector("button[toast-close]") as HTMLElement,
      description: screen.getByText("Words"),
    };
  }

  describe.each(["light", "dark"] as const)("%s", (theme) => {
    it("draws the destructive toast's focus rings in a colour that is not its own background", () => {
      const { action, close } = renderVariant("destructive");

      // The old ring was `destructive` on a `destructive` toast: 1:1, no focus indicator at all.
      expect(action.className).toContain("group-[.destructive]:focus:ring-destructive-foreground");
      expect(close.className).toContain("group-[.destructive]:focus:ring-destructive-foreground");
      expect(action.className).not.toContain("focus:ring-destructive ");
      expect(
        contrast(
          channels(token(theme, "destructive-foreground")),
          channels(token(theme, "destructive")),
        ),
      ).toBeGreaterThanOrEqual(3);
    });

    it.each(["destructive", "success", "warning", "info"] as const)(
      "reads the close icon on a %s toast at 3:1 or better",
      (variant) => {
        const { close } = renderVariant(variant);
        const text = token(theme, `${variant}-foreground`);
        const background = token(theme, variant);

        // The icon takes the toast's own text colour at 70%. The old destructive icon was the
        // toast's background colour at 70%, which is to say invisible.
        expect(close.className).toContain("text-inherit");
        expect(close.className).toContain("[&>svg]:opacity-70");
        expect(close.className).not.toContain("text-destructive/70");
        expect(contrast(blend(text, 0.7, background), channels(background))).toBeGreaterThanOrEqual(
          3,
        );
      },
    );

    it.each(["destructive", "success", "warning", "info"] as const)(
      "reads the description on a %s toast at 4.5:1 or better",
      (variant) => {
        const { description } = renderVariant(variant);
        const text = token(theme, `${variant}-foreground`);
        const background = token(theme, variant);
        const opaque = description.className.includes(`group-[.${variant}]:opacity-100`);

        // 90% of white on the dark success green is 4.39:1, just under the line.
        expect(description.className).toContain("opacity-90");
        expect(
          contrast(blend(text, opaque ? 1 : 0.9, background), channels(background)),
        ).toBeGreaterThanOrEqual(4.5);
      },
    );
  });

  it("honours prefers-reduced-motion for the slide-in and the slide-out", () => {
    const { toast: item } = renderVariant("info");

    // `!` because the slide-in is plain CSS outside any layer, which beats every utility.
    expect(item.className).toContain("motion-reduce:animate-none!");
  });
});
