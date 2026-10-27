import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../src/components/ui/alert-dialog";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../src/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../src/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../src/components/ui/dropdown-menu";
import { useReturnFocus } from "../src/hooks/use-return-focus";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "../src/components/ui/sheet";

/**
 * Every overlay below is driven by `open` state from a plain button, with no Trigger: the pattern
 * the accounting app uses for all of its dialogs, and the one Radix returns focus for nowhere.
 */

function ControlledDialog(props: {
  onSave?: () => void;
  fallbackFocusRef?: React.RefObject<HTMLElement | null>;
  children?: React.ReactNode;
  autoFocusField?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button">Before</button>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent fallbackFocusRef={props.fallbackFocusRef}>
          <DialogHeader>
            <DialogTitle>Edit</DialogTitle>
            <DialogDescription>Change the details.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {props.children ?? (
              <>
                <label>
                  Name
                  <input defaultValue="Ada" />
                </label>
                <label>
                  Note
                  <input defaultValue="" />
                </label>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose>Cancel</DialogClose>
            <button
              type="button"
              onClick={() => {
                props.onSave?.();
                setOpen(false);
              }}
            >
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

/**
 * jsdom plays no animations, so Presence unmounts at once. Report an exit animation on anything
 * closing, the way a browser does, and let the test end it.
 */
async function withExitAnimation(run: (finishExit: () => Promise<void>) => Promise<void>) {
  const originalStyle = window.getComputedStyle;
  const originalCss = (globalThis as { CSS?: unknown }).CSS;
  // Presence reads CSS.escape when an animation ends; jsdom defines `CSS` without it.
  (globalThis as { CSS?: unknown }).CSS = { escape: (value: string) => value };
  window.getComputedStyle = ((element: Element, pseudo?: string | null) => {
    const real = originalStyle.call(window, element, pseudo);
    const state = (element as HTMLElement).getAttribute?.("data-state");
    if (state !== "open" && state !== "closed") return real;
    return new Proxy(real, {
      get(target, property) {
        if (property === "animationName") return state === "closed" ? "exit" : "enter";
        const value = (target as never)[property as never] as unknown;
        return typeof value === "function" ? (value as () => unknown).bind(target) : value;
      },
    });
  }) as typeof window.getComputedStyle;
  const finishExit = () =>
    act(async () => {
      document.querySelectorAll('[data-state="closed"]').forEach((element) => {
        const event = new Event("animationend", { bubbles: true });
        Object.defineProperty(event, "animationName", { value: "exit" });
        element.dispatchEvent(event);
      });
    });
  try {
    await run(finishExit);
  } finally {
    window.getComputedStyle = originalStyle;
    (globalThis as { CSS?: unknown }).CSS = originalCss;
  }
}

describe("Dialog opened from state", () => {
  it("returns focus to the opener after Escape", async () => {
    const user = userEvent.setup();
    render(<ControlledDialog />);
    const opener = screen.getByRole("button", { name: "Open" });

    await user.click(opener);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("returns focus to the opener after Cancel and after Save", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ControlledDialog onSave={onSave} />);
    const opener = screen.getByRole("button", { name: "Open" });

    await user.click(opener);
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(document.activeElement).toBe(opener));

    await user.click(opener);
    await user.click(await screen.findByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("returns focus to a keyboard-opened opener, so Tab continues from it", async () => {
    const user = userEvent.setup();
    render(<ControlledDialog />);

    await user.tab();
    await user.tab();
    const opener = screen.getByRole("button", { name: "Open" });
    expect(document.activeElement).toBe(opener);
    await user.keyboard("{Enter}");
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("moves focus to the first field on open, not the Close button", async () => {
    const user = userEvent.setup();
    render(<ControlledDialog />);

    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Name")));
  });

  it("prefers a data-autofocus field over the first one", async () => {
    const user = userEvent.setup();
    render(
      <ControlledDialog>
        <input aria-label="First" />
        <input aria-label="Wanted" data-autofocus="" />
      </ControlledDialog>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Wanted")));
  });

  it("falls back to the Close button when there is no field", async () => {
    const user = userEvent.setup();
    render(<ControlledDialog>Plain text, nothing to type into.</ControlledDialog>);

    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getAllByRole("button", { name: "Close" })[0]),
    );
  });

  it("skips fields that are disabled, read-only, hidden or check boxes", async () => {
    const user = userEvent.setup();
    render(
      <ControlledDialog>
        <input aria-label="Locked" disabled />
        <input aria-label="Shown" readOnly />
        <input type="hidden" aria-label="Hidden" />
        <input type="checkbox" aria-label="Agree" />
        <input aria-label="Real" />
      </ControlledDialog>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Real")));
  });

  it("lets the caller's onOpenAutoFocus claim the focus", async () => {
    function Claimed() {
      const target = React.useRef<HTMLButtonElement>(null);
      return (
        <Dialog defaultOpen>
          <DialogContent
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              target.current?.focus();
            }}
          >
            <DialogTitle>Claimed</DialogTitle>
            <DialogDescription>Caller picks.</DialogDescription>
            <input aria-label="Field" />
            <button ref={target} type="button">
              Mine
            </button>
          </DialogContent>
        </Dialog>
      );
    }
    render(<Claimed />);
    await screen.findByRole("dialog");
    // The field policy must not run over the caller's choice.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Mine" })),
    );
  });

  it("lets the caller's onCloseAutoFocus opt out of the return", async () => {
    const user = userEvent.setup();
    function OptOut() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent onCloseAutoFocus={(event) => event.preventDefault()}>
              <DialogTitle>Opt out</DialogTitle>
              <DialogDescription>Caller decides.</DialogDescription>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    render(<OptOut />);
    const opener = screen.getByRole("button", { name: "Open" });

    await user.click(opener);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await settle();

    expect(document.activeElement).not.toBe(opener);
  });

  it("does not throw when the opener left the page, and uses the fallback", async () => {
    const user = userEvent.setup();
    function Deleting() {
      const [rows, setRows] = React.useState(["a", "b"]);
      const [open, setOpen] = React.useState(false);
      const table = React.useRef<HTMLDivElement>(null);
      return (
        <>
          <div ref={table} tabIndex={-1} aria-label="Rows">
            {rows.map((row) => (
              <button key={row} type="button" onClick={() => setOpen(true)}>
                Delete {row}
              </button>
            ))}
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent fallbackFocusRef={table}>
              <DialogTitle>Delete?</DialogTitle>
              <DialogDescription>Gone for good.</DialogDescription>
              <button
                type="button"
                onClick={() => {
                  setRows((current) => current.slice(1));
                  setOpen(false);
                }}
              >
                Confirm
              </button>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    render(<Deleting />);

    await user.click(screen.getByRole("button", { name: "Delete a" }));
    await user.click(await screen.findByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Rows")));
  });

  it("leaves focus alone when it was put somewhere on purpose", async () => {
    const user = userEvent.setup();
    function NonModal() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <button type="button">Elsewhere</button>
          <Dialog open={open} onOpenChange={setOpen} modal={false}>
            <DialogContent>
              <DialogTitle>Non-modal</DialogTitle>
              <DialogDescription>Click away to close.</DialogDescription>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    render(<NonModal />);

    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await settle();
    // Clicking another control is where the person meant to go; the opener must not pull them back.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Elsewhere" }));
  });

  it("is unchanged for a Trigger: focus goes back to it", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Triggered</DialogTitle>
          <DialogDescription>Has a trigger.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const trigger = screen.getByRole("button", { name: "Open" });

    await user.click(trigger);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  // StrictMode runs the anchor's layout effect, its cleanup, then the effect again, all before Radix
  // moves focus. The cleanup must not forget the opener; the second pass finds the same button.
  it("keeps the opener across StrictMode's extra effect pass", async () => {
    const user = userEvent.setup();
    render(
      <React.StrictMode>
        <ControlledDialog />
      </React.StrictMode>,
    );
    const opener = screen.getByRole("button", { name: "Open" });

    await user.click(opener);
    await screen.findByRole("dialog");
    // The simulated unmount must not have yanked focus out of the open dialog.
    await settle();
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
    await user.keyboard("{Escape}");

    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("returns to the menu's trigger when an item in a menu opened it", async () => {
    const user = userEvent.setup();
    function FromMenu() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setOpen(true)}>Edit</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogTitle>Edit row</DialogTitle>
              <DialogDescription>From the menu.</DialogDescription>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    render(<FromMenu />);
    const trigger = screen.getByRole("button", { name: "Actions" });

    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe("Dialog Close button", () => {
  it("shows a ring on keyboard focus rather than relying on the outline", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ring</DialogTitle>
            <DialogDescription>Close has a ring.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    const classes = screen.getByText("Close").closest("button")!.className.split(/\s+/);

    expect(classes).toContain("focus-visible:outline-hidden");
    expect(classes).toContain("focus-visible:ring-2");
    expect(classes).toContain("focus-visible:ring-ring");
    expect(classes).toContain("focus-visible:ring-offset-2");
    expect(classes).not.toContain("focus:outline-hidden");
  });
});

describe("AlertDialog opened from state", () => {
  function ControlledAlert(props: { onConfirm?: () => void }) {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Delete
        </button>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogTitle>Sure?</AlertDialogTitle>
            <AlertDialogDescription>No undo.</AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={props.onConfirm}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  it("starts on Cancel, the safe choice", async () => {
    const user = userEvent.setup();
    render(<ControlledAlert />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("alertdialog");

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" })),
    );
  });

  it("returns focus to the opener after Escape, Cancel and Confirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ControlledAlert onConfirm={onConfirm} />);
    const opener = screen.getByRole("button", { name: "Delete" });

    await user.click(opener);
    await screen.findByRole("alertdialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));

    await user.click(opener);
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));

    await user.click(opener);
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("is unchanged for a Trigger", async () => {
    const user = userEvent.setup();
    render(
      <AlertDialog>
        <AlertDialogTrigger>Open</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Sure?</AlertDialogTitle>
          <AlertDialogDescription>No undo.</AlertDialogDescription>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>,
    );
    const trigger = screen.getByRole("button", { name: "Open" });

    await user.click(trigger);
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe("Sheet opened from state", () => {
  function ControlledSheet() {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open sheet
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent>
            <SheetTitle>Details</SheetTitle>
            <SheetDescription>Side panel.</SheetDescription>
            <input aria-label="Comment" />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  it("focuses the first field, then returns focus to the opener after Escape", async () => {
    const user = userEvent.setup();
    render(<ControlledSheet />);
    const opener = screen.getByRole("button", { name: "Open sheet" });

    await user.click(opener);
    await screen.findByRole("dialog");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Comment")));
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("returns focus to the opener after the Close button", async () => {
    const user = userEvent.setup();
    render(<ControlledSheet />);
    const opener = screen.getByRole("button", { name: "Open sheet" });

    await user.click(opener);
    await user.click(await screen.findByRole("button", { name: "Close" }));

    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("gives its Close button a keyboard focus ring", async () => {
    const user = userEvent.setup();
    render(<ControlledSheet />);
    await user.click(screen.getByRole("button", { name: "Open sheet" }));
    const classes = (await screen.findByRole("button", { name: "Close" })).className.split(/\s+/);

    expect(classes).toContain("focus-visible:ring-2");
    expect(classes).toContain("focus-visible:ring-ring");
  });

  it("is unchanged for a Trigger", async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetTitle>Details</SheetTitle>
          <SheetDescription>Side panel.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    const trigger = screen.getByRole("button", { name: "Open" });

    await user.click(trigger);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe("useReturnFocus on its own", () => {
  it("gives a hand-built Radix overlay the same open and close focus", async () => {
    const user = userEvent.setup();
    function Custom() {
      const [open, setOpen] = React.useState(false);
      const focus = useReturnFocus({ focusFirstField: true });
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Content
                onOpenAutoFocus={focus.onOpenAutoFocus}
                onCloseAutoFocus={focus.onCloseAutoFocus}
              >
                {focus.anchor}
                <DialogPrimitive.Title>Custom</DialogPrimitive.Title>
                <DialogPrimitive.Description>Hand built.</DialogPrimitive.Description>
                <input aria-label="Field" />
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </>
      );
    }
    render(<Custom />);
    const opener = screen.getByRole("button", { name: "Open" });

    await user.click(opener);
    await screen.findByRole("dialog");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Field")));
    await user.keyboard("{Escape}");

    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

describe("an overlay opened from inside another overlay", () => {
  /** Start opens step 1; its Next closes it and opens step 2 in the same commit. */
  function Wizard() {
    const [step, setStep] = React.useState<0 | 1 | 2>(0);
    return (
      <>
        <button type="button" onClick={() => setStep(1)}>
          Start
        </button>
        <Dialog open={step === 1} onOpenChange={(open) => !open && setStep(0)}>
          <DialogContent>
            <DialogTitle>Step one</DialogTitle>
            <DialogDescription>First.</DialogDescription>
            <button type="button" onClick={() => setStep(2)}>
              Next
            </button>
          </DialogContent>
        </Dialog>
        <Dialog open={step === 2} onOpenChange={(open) => !open && setStep(0)}>
          <DialogContent>
            <DialogTitle>Step two</DialogTitle>
            <DialogDescription>Second.</DialogDescription>
            <button type="button" onClick={() => setStep(0)}>
              Done
            </button>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  it("returns to the control that opened the first one, not to the one that left", async () => {
    const user = userEvent.setup();
    render(<Wizard />);
    const start = screen.getByRole("button", { name: "Start" });

    await user.click(start);
    await user.click(await screen.findByRole("button", { name: "Next" }));
    await screen.findByText("Step two");
    await settle();
    await user.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(start));
  });

  it("does the same while the first one is still animating out", async () => {
    const user = userEvent.setup();
    await withExitAnimation(async (finishExit) => {
      render(<Wizard />);
      const start = screen.getByRole("button", { name: "Start" });

      await user.click(start);
      await user.click(await screen.findByRole("button", { name: "Next" }));
      await settle();
      // Step one is still in the document, closing, with its Next button focused.
      expect(screen.getByText("Step one").closest("[data-state]")?.getAttribute("data-state")).toBe(
        "closed",
      );
      await finishExit();
      await settle();
      await user.click(await screen.findByRole("button", { name: "Done" }));
      await settle();
      await finishExit();

      await waitFor(() => expect(screen.queryByText("Step two")).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(start));
    });
  });

  it("returns to the button that opened an AlertDialog whose Yes opens a Dialog", async () => {
    const user = userEvent.setup();
    function ConfirmThenReason() {
      const [alertOpen, setAlertOpen] = React.useState(false);
      const [reasonOpen, setReasonOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setAlertOpen(true)}>
            Delete
          </button>
          <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
            <AlertDialogContent>
              <AlertDialogTitle>Sure?</AlertDialogTitle>
              <AlertDialogDescription>No undo.</AlertDialogDescription>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => setReasonOpen(true)}>Yes</AlertDialogAction>
            </AlertDialogContent>
          </AlertDialog>
          <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
            <DialogContent>
              <DialogTitle>Reason</DialogTitle>
              <DialogDescription>Why?</DialogDescription>
              <DialogClose>Skip</DialogClose>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    render(<ConfirmThenReason />);
    const opener = screen.getByRole("button", { name: "Delete" });

    await user.click(opener);
    await user.click(await screen.findByRole("button", { name: "Yes" }));
    await screen.findByText("Reason");
    await settle();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("returns to the button inside the first overlay when that one stays open", async () => {
    const user = userEvent.setup();
    function Nested() {
      const [outer, setOuter] = React.useState(false);
      const [inner, setInner] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOuter(true)}>
            Outer opener
          </button>
          <Dialog open={outer} onOpenChange={setOuter}>
            <DialogContent>
              <DialogTitle>Outer</DialogTitle>
              <DialogDescription>Has a child.</DialogDescription>
              <button type="button" onClick={() => setInner(true)}>
                Open inner
              </button>
              <Dialog open={inner} onOpenChange={setInner}>
                <DialogContent>
                  <DialogTitle>Inner</DialogTitle>
                  <DialogDescription>Child.</DialogDescription>
                </DialogContent>
              </Dialog>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    render(<Nested />);

    await user.click(screen.getByRole("button", { name: "Outer opener" }));
    const openInner = await screen.findByRole("button", { name: "Open inner" });
    await user.click(openInner);
    await screen.findByText("Inner");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText("Inner")).toBeNull());
    // Not "Outer opener": the first dialog is still open, and this is where focus belongs.
    await waitFor(() => expect(document.activeElement).toBe(openInner));
    expect(screen.getByText("Outer")).toBeTruthy();
  });

  it("still hands the caller's ref the content element", async () => {
    const user = userEvent.setup();
    const ref = React.createRef<HTMLDivElement>();
    function WithRef() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent ref={ref}>
              <DialogTitle>Ref</DialogTitle>
              <DialogDescription>Has a ref.</DialogDescription>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    render(<WithRef />);

    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(ref.current).toBe(await screen.findByRole("dialog"));
  });
});

describe("a dialog opened from a ContextMenu", () => {
  /** A focusable row with a context menu whose Edit item opens a dialog from state. */
  function RowWithMenu() {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div tabIndex={0} role="group" aria-label="Row">
              Row
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => setOpen(true)}>Edit</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogTitle>Edit row</DialogTitle>
            <DialogDescription>From the context menu.</DialogDescription>
            <button type="button" onClick={() => setOpen(false)}>
              Done
            </button>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  /** What Shift+F10 does on a focused row: ask for its context menu. */
  async function openMenuFromKeyboard() {
    const row = screen.getByRole("group", { name: "Row" });
    act(() => row.focus());
    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    await screen.findByRole("menu");
    return row;
  }

  it("returns focus to the row that had it, when the menu has gone by the time the dialog closes", async () => {
    const user = userEvent.setup();
    render(<RowWithMenu />);
    const row = await openMenuFromKeyboard();

    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    await screen.findByRole("dialog");
    await settle();
    await user.keyboard("{Escape}");

    // A ContextMenu has no trigger carrying aria-controls, so the dialog used to find nothing here
    // and drop focus on <body>.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(row));
  });

  it("does the same while the menu is still animating out, with its item focused", async () => {
    const user = userEvent.setup();
    await withExitAnimation(async (finishExit) => {
      render(<RowWithMenu />);
      const row = await openMenuFromKeyboard();

      await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
      await screen.findByRole("dialog");
      await settle();
      await finishExit();
      await user.keyboard("{Escape}");
      await settle();
      await finishExit();

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(row));
    });
  });

  it("goes back to the menu's trigger button for a DropdownMenu, as before", async () => {
    const user = userEvent.setup();
    function FromDropdown() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setOpen(true)}>Edit</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogTitle>Edit</DialogTitle>
              <DialogDescription>From a dropdown.</DialogDescription>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    render(<FromDropdown />);

    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Actions" })),
    );
  });

  it("does not invent an opener for a mouse user who right-clicked a row that cannot take focus", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Somewhere else</button>
        <RowWithMenu />
      </>,
    );
    const elsewhere = screen.getByRole("button", { name: "Somewhere else" });
    act(() => elsewhere.focus());
    // A right-click on something that takes no focus drops focus on <body> first, so the menu
    // opens from nowhere, and "Somewhere else" has nothing to do with it.
    act(() => elsewhere.blur());
    fireEvent.contextMenu(screen.getByRole("group", { name: "Row" }), { clientX: 10, clientY: 10 });
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    await screen.findByRole("dialog");
    await settle();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await settle();
    expect(document.activeElement).not.toBe(elsewhere);
  });
});

describe("overlay content refs", () => {
  /** A React 19 callback ref: it returns its own cleanup, and must then never be called with null. */
  function cleanupRef() {
    const nodes: Array<HTMLElement | null> = [];
    const cleanup = vi.fn();
    const ref = (node: HTMLElement | null) => {
      nodes.push(node);
      return cleanup;
    };
    return { ref, nodes, cleanup };
  }

  it.each([
    [
      "DialogContent",
      (ref: React.Ref<HTMLDivElement>) => (
        <Dialog open>
          <DialogContent ref={ref}>
            <DialogTitle>Ref</DialogTitle>
            <DialogDescription>Cleanup ref.</DialogDescription>
          </DialogContent>
        </Dialog>
      ),
    ],
    [
      "AlertDialogContent",
      (ref: React.Ref<HTMLDivElement>) => (
        <AlertDialog open>
          <AlertDialogContent ref={ref}>
            <AlertDialogTitle>Ref</AlertDialogTitle>
            <AlertDialogDescription>Cleanup ref.</AlertDialogDescription>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogContent>
        </AlertDialog>
      ),
    ],
    [
      "SheetContent",
      (ref: React.Ref<HTMLDivElement>) => (
        <Sheet open>
          <SheetContent ref={ref}>
            <SheetTitle>Ref</SheetTitle>
            <SheetDescription>Cleanup ref.</SheetDescription>
          </SheetContent>
        </Sheet>
      ),
    ],
  ])("%s runs a callback ref's cleanup and never calls it with null", async (_name, build) => {
    const { ref, nodes, cleanup } = cleanupRef();
    const { unmount } = render(build(ref as React.Ref<HTMLDivElement>));
    await screen.findByRole(_name === "AlertDialogContent" ? "alertdialog" : "dialog");

    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.every((node) => node instanceof HTMLElement)).toBe(true);

    unmount();

    // A hand-rolled merge dropped the cleanup and called the ref with `null` instead. Every time
    // the ref was attached to the content, its own cleanup has now run once.
    expect(cleanup).toHaveBeenCalledTimes(nodes.length);
    expect(nodes.every((node) => node !== null)).toBe(true);
  });

  it("still gives a plain callback ref its null when the content goes", async () => {
    const calls: Array<HTMLElement | null> = [];
    const { unmount } = render(
      <Dialog open>
        <DialogContent ref={(node) => void calls.push(node)}>
          <DialogTitle>Plain</DialogTitle>
          <DialogDescription>Plain ref.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    await screen.findByRole("dialog");

    unmount();

    expect(calls[0]).toBeInstanceOf(HTMLElement);
    expect(calls[calls.length - 1]).toBeNull();
  });
});

describe("useReturnFocus guards", () => {
  type Api = ReturnType<typeof useReturnFocus>;

  /** The hook on a bare container, with the hook's result handed out so a test can call the handlers. */
  function Harness(props: { api: { current: Api | null }; anchorKey?: number; field?: boolean }) {
    const focus = useReturnFocus({ focusFirstField: props.field });
    props.api.current = focus;
    return (
      <div ref={focus.ref} role="group" aria-label="overlay">
        {React.cloneElement(focus.anchor, { key: props.anchorKey ?? 0 })}
        <input aria-label="inside" />
      </div>
    );
  }

  const closeEvent = () => new Event("close", { cancelable: true });

  it("keeps the opener when the anchor remounts with focus already inside the overlay", () => {
    const api: { current: Api | null } = { current: null };
    render(<button type="button">Opener</button>);
    const opener = screen.getByRole("button", { name: "Opener" });
    act(() => opener.focus());
    const { rerender } = render(<Harness api={api} />);
    act(() => screen.getByLabelText("inside").focus());

    // The anchor captures again, now with focus on the field. The first capture must stand.
    rerender(<Harness api={api} anchorKey={1} />);
    rerender(<div />);
    const event = closeEvent();
    api.current!.onCloseAutoFocus(event);

    expect(document.activeElement).toBe(opener);
  });

  it("does not treat an event from content that is still in the document as a close", () => {
    const api: { current: Api | null } = { current: null };
    render(<button type="button">Opener</button>);
    const opener = screen.getByRole("button", { name: "Opener" });
    act(() => opener.focus());
    const { rerender } = render(<Harness api={api} />);
    const content = screen.getByRole("group", { name: "overlay" });
    act(() => screen.getByLabelText("inside").focus());

    // What StrictMode's simulated unmount sends: the content is still there.
    const early = closeEvent();
    content.addEventListener("close", api.current!.onCloseAutoFocus);
    content.dispatchEvent(early);
    rerender(<div />);
    api.current!.onCloseAutoFocus(closeEvent());

    expect(early.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it("stops Radix refocusing its own trigger once it has returned focus", () => {
    const api: { current: Api | null } = { current: null };
    render(<button type="button">Opener</button>);
    act(() => screen.getByRole("button", { name: "Opener" }).focus());
    const { rerender } = render(<Harness api={api} />);
    act(() => screen.getByLabelText("inside").focus());
    rerender(<div />);
    const event = closeEvent();

    api.current!.onCloseAutoFocus(event);

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Opener" }));
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves the event alone when there was nowhere to return to", () => {
    const api: { current: Api | null } = { current: null };
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    const { rerender } = render(<Harness api={api} />);
    rerender(<div />);
    const event = closeEvent();

    api.current!.onCloseAutoFocus(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("does not hand a later overlay the opener of one that closed in an earlier task", async () => {
    const user = userEvent.setup();
    let openB: () => void = () => {};
    function Two() {
      const [a, setA] = React.useState(false);
      const [b, setB] = React.useState(false);
      openB = () => setB(true);
      return (
        <>
          <button type="button" onClick={() => setA(true)}>
            Open A
          </button>
          <Dialog open={a} onOpenChange={setA}>
            <DialogContent>
              <DialogTitle>A</DialogTitle>
              <DialogDescription>First.</DialogDescription>
            </DialogContent>
          </Dialog>
          <Dialog open={b} onOpenChange={setB}>
            <DialogContent>
              <DialogTitle>B</DialogTitle>
              <DialogDescription>Second, opened by a timer.</DialogDescription>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    render(<Two />);
    const openA = screen.getByRole("button", { name: "Open A" });
    await user.click(openA);
    await screen.findByText("A");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(openA));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // A later task, with nobody holding focus: B was opened by nothing in particular.
    act(() => openA.blur());
    await settle();

    act(() => openB());
    await screen.findByText("B");
    await settle();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await settle();

    expect(document.activeElement).not.toBe(openA);
  });

  describe("opening on a field", () => {
    const original = window.matchMedia;
    const stub = (coarse: boolean) => {
      window.matchMedia = ((query: string) => ({
        matches: coarse && query === "(pointer: coarse)",
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia;
    };
    afterEach(() => {
      window.matchMedia = original;
    });

    it("leaves the keyboard down on a phone, where focusing a field would raise it", async () => {
      stub(true);
      const user = userEvent.setup();
      render(<ControlledDialog />);

      await user.click(screen.getByRole("button", { name: "Open" }));
      await screen.findByRole("dialog");
      await settle();

      expect(document.activeElement).not.toBe(screen.getByLabelText("Name"));
      expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
    });

    it("focuses the field with a fine pointer, which is the same dialog on a desktop", async () => {
      stub(false);
      const user = userEvent.setup();
      render(<ControlledDialog />);

      await user.click(screen.getByRole("button", { name: "Open" }));
      await screen.findByRole("dialog");

      await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Name")));
    });
  });

  it("skips a field that is hidden from the page, however early it comes", async () => {
    const user = userEvent.setup();
    render(
      <ControlledDialog>
        <div aria-hidden="true">
          <input aria-label="Decoy" />
        </div>
        <div hidden>
          <input aria-label="Folded away" />
        </div>
        <input aria-label="Real" />
      </ControlledDialog>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Real")));
  });
});
