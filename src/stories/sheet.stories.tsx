import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const meta: Meta = {
  title: "UI/Sheet",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open Sheet</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>
            Make changes to your profile here. Click save when you are done.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};

/**
 * Driven by state from a plain Button, as an app does. Focus lands in Name on open rather than on
 * the Close button, and Escape, Close, Cancel and Save (or Enter in a field) all hand it back to
 * "Open details".
 */
const ControlledDetails = () => {
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState("draft");
  const [saved, setSaved] = React.useState("Nothing saved yet.");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button variant="outline">Before</Button>
        <Button onClick={() => setOpen(true)}>Open details</Button>
        <Button variant="outline">After</Button>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {saved}
      </p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const name = new FormData(event.currentTarget).get("name");
              setSaved(`Saved ${typeof name === "string" ? name : ""} as ${status}.`);
              setOpen(false);
            }}
          >
            <SheetHeader>
              <SheetTitle>Voucher details</SheetTitle>
              <SheetDescription>Press Enter in a field to save.</SheetDescription>
            </SheetHeader>
            <div className="grid gap-2">
              <Label htmlFor="voucher-name">Name</Label>
              <Input id="voucher-name" name="name" defaultValue="Office rent, October" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="voucher-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="voucher-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export const ControlledOpen: StoryObj = {
  parameters: {
    // Closed it is three buttons; the sheet portals out of #storybook-root, which is all the
    // screenshot captures. The point of the story is where focus goes, which is not visual.
    visual: { disable: true },
  },
  render: () => <ControlledDetails />,
};
