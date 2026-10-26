import "@testing-library/jest-dom";
import * as React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vite-plus/test";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "../src/components/ui/alert-dialog";
import { Field } from "../src/components/ui/field";
import { Input } from "../src/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../src/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../src/components/ui/sheet";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "../src/components/ui/dialog";

describe("Dialog component", () => {
  it("opens and closes via trigger and close button", () => {
    render(
      <Dialog>
        <DialogTrigger>Open Modal</DialogTrigger>
        <DialogContent>
          <DialogTitle>Modal Title</DialogTitle>
          <DialogDescription>Modal Description</DialogDescription>
          <DialogClose>Close Modal</DialogClose>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.queryByText("Modal Title")).toBeNull();
    const trigger = screen.getByText("Open Modal");
    fireEvent.click(trigger);
    expect(screen.getByText("Modal Title")).toBeDefined();

    const closeBtn = screen.getByText("Close Modal");
    fireEvent.click(closeBtn);
    expect(screen.queryByText("Modal Title")).toBeNull();
  });

  it("standardizes the DialogHeader close button styling and icon inheritance", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Header Title</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const closeButton = screen.getByText("Close").closest("button");
    expect(closeButton?.className).toContain("text-muted-foreground");
    expect(closeButton?.className).toContain("hover:bg-accent");
    expect(closeButton?.className).toContain("hover:text-accent-foreground");

    const icon = closeButton?.querySelector("svg");
    expect(icon?.getAttribute("class")).not.toContain("text-muted-foreground");
    expect(icon?.getAttribute("class")).not.toContain("hover:text-foreground");
  });
  it("dims and blurs the page behind it with a scrim that shows up on a dark page too", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Scrim</DialogTitle>
          <DialogDescription>Scrim description</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    const overlay = document.querySelector("[data-state='open'].fixed.inset-0");
    expect(overlay).not.toBeNull();
    const classes = overlay!.className;
    // 30% black was imperceptible over a near-black page.
    expect(classes).toContain("bg-black/50");
    expect(classes).toContain("dark:bg-black/70");
    expect(classes).toContain("backdrop-blur");
    expect(classes).not.toContain("bg-black/30");
  });

  it("pins the close button to the title row rather than centring it on the whole header", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book payment</DialogTitle>
            <DialogDescription>Match it against an invoice.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const closeButton = screen.getByText("Close").closest("button")!;
    const header = closeButton.parentElement!;
    expect(header.className).toContain("items-start");
    expect(header.className).not.toContain("items-center");
    // -mt-1 centres the 24px button on the 16px title line.
    expect(closeButton.className).toContain("-mt-1");
  });
});

describe("asChild on overlay content", () => {
  it("renders a DialogContent as the element it is given, with Radix's props on it", () => {
    render(
      <Dialog open>
        <DialogContent asChild className="mine">
          <section data-testid="custom">
            <DialogTitle>Custom</DialogTitle>
            <DialogDescription>Rendered as a section.</DialogDescription>
          </section>
        </DialogContent>
      </Dialog>,
    );
    const custom = screen.getByTestId("custom");

    expect(custom.tagName).toBe("SECTION");
    expect(custom.getAttribute("role")).toBe("dialog");
    expect(custom.getAttribute("data-state")).toBe("open");
    expect(custom.className).toContain("mine");
    expect(custom.className).toContain("fixed");
    expect(custom).toHaveAccessibleName("Custom");
  });

  it("renders an AlertDialogContent as the element it is given", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent asChild>
          <section data-testid="custom">
            <AlertDialogTitle>Sure?</AlertDialogTitle>
            <AlertDialogDescription>No undo.</AlertDialogDescription>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </section>
        </AlertDialogContent>
      </AlertDialog>,
    );
    const custom = screen.getByTestId("custom");

    expect(custom.tagName).toBe("SECTION");
    expect(custom.getAttribute("role")).toBe("alertdialog");
    expect(custom.getAttribute("data-state")).toBe("open");
  });

  it("renders a SheetContent as the element it is given, still with its Close button", () => {
    render(
      <Sheet open>
        <SheetContent asChild>
          <aside data-testid="custom">
            <SheetTitle>Side</SheetTitle>
            <SheetDescription>Rendered as an aside.</SheetDescription>
          </aside>
        </SheetContent>
      </Sheet>,
    );
    const custom = screen.getByTestId("custom");

    expect(custom.tagName).toBe("ASIDE");
    expect(custom.getAttribute("role")).toBe("dialog");
    expect(within(custom).getByRole("button", { name: "Close" })).toBeTruthy();
  });

  it("renders a PopoverContent as the element it is given, with Radix's props on it", async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent asChild className="mine">
          <section data-testid="custom">hello</section>
        </PopoverContent>
      </Popover>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    const custom = await screen.findByTestId("custom");

    expect(custom.tagName).toBe("SECTION");
    expect(custom.getAttribute("role")).toBe("dialog");
    expect(custom.getAttribute("data-state")).toBe("open");
    expect(custom.className).toContain("mine");
    expect(custom.getAttribute("data-slot")).toBe("popover-content");
  });

  it("still returns focus to the opener after Escape", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent asChild>
              <section>
                <DialogTitle>Custom</DialogTitle>
                <DialogDescription>Rendered as a section.</DialogDescription>
                <input aria-label="Name" />
              </section>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    render(<Controlled />);
    const opener = screen.getByRole("button", { name: "Open" });

    await user.click(opener);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Name")));
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("still keeps the surrounding field away from a form inside", async () => {
    const user = userEvent.setup();
    render(
      <Field label="Project" hint="Pick one" error="Required">
        <Input aria-label="outer" />
        <Popover>
          <PopoverTrigger>Add</PopoverTrigger>
          <PopoverContent asChild>
            <section>
              <Input aria-label="inner popover" />
            </section>
          </PopoverContent>
        </Popover>
        <Dialog>
          <DialogTrigger>Add project</DialogTrigger>
          <DialogContent asChild>
            <section>
              <DialogTitle>New project</DialogTitle>
              <DialogDescription>Create it</DialogDescription>
              <Input aria-label="inner dialog" />
            </section>
          </DialogContent>
        </Dialog>
      </Field>,
    );

    await user.click(screen.getByRole("button", { name: "Add" }));
    const popoverInput = await screen.findByLabelText("inner popover");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Add project" }));
    const dialogInput = await screen.findByLabelText("inner dialog");

    expect(screen.getByLabelText("outer")).toHaveAttribute("aria-invalid", "true");
    for (const input of [popoverInput, dialogInput]) {
      expect(input).not.toHaveAttribute("id");
      expect(input).not.toHaveAttribute("aria-invalid");
      expect(input).not.toHaveAttribute("aria-describedby");
    }
  });
});

describe("DialogContent focus styling", () => {
  it("hides its outline only while it is focused, and draws a ring in its place", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Styled</DialogTitle>
          <DialogDescription>Outline and ring.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const classes = screen.getByRole("dialog").className.split(/\s+/);

    // A bare `outline-hidden` paints a permanent 2px frame around the dialog in forced-colors mode,
    // where the transparent outline becomes a system colour.
    expect(classes).not.toContain("outline-hidden");
    expect(classes).toContain("focus-visible:outline-hidden");
    expect(classes).toContain("focus-visible:ring-2");
    expect(classes).toContain("focus-visible:ring-ring");
  });

  it("does not use a rounded-box variant, which generates no CSS", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Rounded</DialogTitle>
          <DialogDescription>Plain rounded-box.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const classes = screen.getByRole("dialog").className.split(/\s+/);

    expect(classes).toContain("rounded-box");
    expect(classes).not.toContain("sm:rounded-box");
  });
});
