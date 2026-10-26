import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  Dialog,
  DialogBody,
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

/**
 * How an app drives a dialog: `open` state, a plain Button to open it, no DialogTrigger. Radix only
 * hands focus back to a Trigger, so this used to drop focus on the page whatever the way out was.
 *
 * Try it from the keyboard: Tab to "Edit supplier", Enter. Focus lands in Name (not the Close
 * button). Escape, Cancel, Save and Enter inside a field all put focus back on "Edit supplier", so
 * the next Tab is "After".
 */
const ControlledForm = () => {
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState("software");
  const [saved, setSaved] = React.useState("Nothing saved yet.");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button variant="outline">Before</Button>
        <Button onClick={() => setOpen(true)}>Edit supplier</Button>
        <Button variant="outline">After</Button>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {saved}
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              const name = new FormData(event.currentTarget).get("name");
              setSaved(`Saved ${typeof name === "string" ? name : ""} under ${category}.`);
              setOpen(false);
            }}
          >
            <DialogHeader>
              <DialogTitle>Edit supplier</DialogTitle>
              <DialogDescription>Press Enter in a field to save.</DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="supplier-name">Name</Label>
                <Input id="supplier-name" name="name" defaultValue="Acme AB" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supplier-category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="supplier-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="software">Software</SelectItem>
                    <SelectItem value="travel">Travel</SelectItem>
                    <SelectItem value="office">Office supplies</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const ControlledOpen: StoryObj = {
  parameters: {
    // Closed it is three buttons; the dialog itself portals out of #storybook-root, which is all
    // the screenshot captures. The point of the story is where focus goes, which is not visual.
    visual: { disable: true },
  },
  render: () => <ControlledForm />,
};

/**
 * One dialog opening another: "Next" closes step one and opens step two in the same render. Closing
 * step two puts focus back on "Start", the button that began the flow, not on the "Next" button that
 * was already gone. Try it: Start, Next, Escape, then Tab once.
 */
const ChainedWizard = () => {
  const [step, setStep] = React.useState<0 | 1 | 2>(0);
  return (
    <div className="flex gap-2">
      <Button variant="outline">Before</Button>
      <Button onClick={() => setStep(1)}>Start</Button>
      <Button variant="outline">After</Button>
      <Dialog open={step === 1} onOpenChange={(open) => !open && setStep(0)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Step one</DialogTitle>
            <DialogDescription>Choose what to import.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setStep(2)}>Next</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={step === 2} onOpenChange={(open) => !open && setStep(0)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Step two</DialogTitle>
            <DialogDescription>Check it, then finish.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setStep(0)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const ChainedDialogs: StoryObj = {
  parameters: {
    // Closed it is three buttons; the dialogs portal out of #storybook-root. The point of the
    // story is where focus goes, which is not visual.
    visual: { disable: true },
  },
  render: () => <ChainedWizard />,
};

/**
 * A save that fails inside a dialog raises an error toast while the dialog stays open. Escape then
 * cancels the dialog on the first press, and the toast steps aside, instead of the toast taking that
 * press and the dialog needing a second one. With focus on a toast, Escape still closes just that
 * toast.
 */
const ToastOverDialog = () => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex gap-2">
      <Button onClick={() => setOpen(true)}>Edit supplier</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit supplier</DialogTitle>
            <DialogDescription>Saving fails, so you can see the toast.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() =>
                toast({
                  title: "Could not save",
                  description: "The server did not answer.",
                  variant: "destructive",
                })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
};

export const EscapeWithAToastOver: StoryObj = {
  parameters: { visual: { disable: true } },
  render: () => <ToastOverDialog />,
};

/**
 * A dialog that will not close on Escape (an unsaved-changes guard) with an error toast over it. The
 * toast steps aside for the key, finds that the dialog does not close, and comes back: it is only
 * dismissed for good when the dialog actually goes.
 */
const ToastOverGuardedDialog = () => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex gap-2">
      <Button onClick={() => setOpen(true)}>Edit supplier</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-[425px]"
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>Escape is ignored here. Use Discard to leave.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                toast({
                  title: "Could not save",
                  description: "The server did not answer.",
                  variant: "destructive",
                })
              }
            >
              Save
            </Button>
            <Button onClick={() => setOpen(false)}>Discard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
};

export const EscapeVetoedWithAToastOver: StoryObj = {
  parameters: { visual: { disable: true } },
  render: () => <ToastOverGuardedDialog />,
};

/**
 * A dialog opened by choosing an item in a ContextMenu. A ContextMenu has no trigger button, so focus
 * goes back to the row that had it when the menu opened. Tab to the row, press Shift+F10, choose
 * "Edit supplier", then Escape.
 */
const FromContextMenu = () => {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            tabIndex={0}
            role="group"
            aria-label="Supplier row"
            className="w-72 rounded-box border p-4 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            Acme AB. Right-click, or press Shift+F10.
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => setOpen(true)}>Edit supplier</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit supplier</DialogTitle>
            <DialogDescription>Opened from the row's context menu.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const OpenedFromContextMenu: StoryObj = {
  parameters: {
    // Closed it is one row; the menu and the dialog portal out of #storybook-root. The point of the
    // story is where focus goes, which is not visual.
    visual: { disable: true },
  },
  render: () => <FromContextMenu />,
};

/**
 * `asChild` renders the content as the element you give it, with Radix's role, state, ids and focus
 * handling on it. A form opened from inside a field still gets none of that field's id or error.
 */
const AsChildContent = () => (
  <div className="flex gap-2">
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Dialog as a section</Button>
      </DialogTrigger>
      <DialogContent asChild>
        <section className="fixed left-1/2 top-1/4 z-50 w-80 -translate-x-1/2 rounded-box border bg-background p-4 shadow-lg">
          <DialogTitle>Custom element</DialogTitle>
          <DialogDescription>This is a section with role dialog.</DialogDescription>
          <Label htmlFor="as-child-name" className="mt-3 block">
            Name
          </Label>
          <Input id="as-child-name" />
        </section>
      </DialogContent>
    </Dialog>
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Popover as an aside</Button>
      </PopoverTrigger>
      <PopoverContent asChild>
        <aside className="z-50 w-64 rounded-box border bg-popover p-3 text-sm shadow-md">
          This is an aside with role dialog.
        </aside>
      </PopoverContent>
    </Popover>
  </div>
);

export const AsChild: StoryObj = {
  parameters: { visual: { disable: true } },
  render: () => <AsChildContent />,
};
