import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
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
