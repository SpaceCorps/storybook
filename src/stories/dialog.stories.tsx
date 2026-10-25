import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const meta: Meta = {
  title: "UI/Dialog",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open Dialog</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you are done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input id="name" defaultValue="Pedro Duarte" className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

/** A page tall enough to scroll, so there is a scrollbar for the dialog's scroll lock to remove. */
const TallPage = ({ children }: { children?: React.ReactNode }) => (
  <div className="mx-auto flex max-w-3xl flex-col gap-4">
    <h1 className="text-xl font-semibold">Ledger</h1>
    {Array.from({ length: 24 }, (_, index) => (
      <div
        key={index}
        className="flex items-center justify-between rounded-box border border-border bg-card p-4 text-card-foreground"
      >
        <span>Verification {index + 1}</span>
        <span className="tabular-nums text-muted-foreground">
          {(1000 + index * 137).toFixed(2)} SEK
        </span>
      </div>
    ))}
    {/* Anchored to the viewport's right edge, which is what moves when a scrollbar disappears. */}
    <div
      data-testid="pinned-right"
      className="fixed right-0 top-4 rounded-l-box border border-r-0 border-border bg-card px-3 py-1 text-sm text-card-foreground"
    >
      Pinned right
    </div>
    {children}
  </div>
);

/**
 * Open on load, over a scrolling page: the backdrop dims the page behind it in both themes (flip the
 * toolbar theme), and the page does not shift sideways when the scrollbar goes away. The close
 * button sits on the title row even with a description underneath.
 */
export const OpenOverPage: StoryObj = {
  parameters: {
    // The dialog renders in a portal outside #storybook-root, which is all the screenshot captures.
    visual: { disable: true },
  },
  render: () => (
    <TallPage>
      <Dialog defaultOpen>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Book payment</DialogTitle>
            <DialogDescription>
              Match this payment against an open invoice, or book it directly.
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 pb-4 text-sm text-muted-foreground">
            Everything behind this panel is dimmed and blurred.
          </div>
          <DialogFooter>
            <Button variant="outline">Cancel</Button>
            <Button>Book</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TallPage>
  ),
};

/** Same page, closed: click to open and compare the page position before and after. */
export const ScrollLockDoesNotShiftLayout: StoryObj = {
  parameters: { visual: { disable: true } },
  render: () => (
    <TallPage>
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open dialog</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Scroll lock</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-4 text-sm text-muted-foreground">
            The ledger behind keeps its horizontal position.
          </div>
        </DialogContent>
      </Dialog>
    </TallPage>
  ),
};
