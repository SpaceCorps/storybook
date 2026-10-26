import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  title: "UI/AlertDialog",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Show Dialog</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

/**
 * Driven by state from a plain Button, as an app does. Focus starts on Cancel, the safe choice, and
 * Escape, Cancel and the confirm button all hand it back to "Void invoice". The fields are there to
 * Tab into: Enter in "Note" confirms, like the confirm button.
 */
const ControlledVoid = () => {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("duplicate");
  const [result, setResult] = React.useState("Invoice 1042 is open.");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button variant="outline">Before</Button>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Void invoice
        </Button>
        <Button variant="outline">After</Button>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {result}
      </p>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const note = new FormData(event.currentTarget).get("note");
              setResult(
                `Invoice 1042 voided (${reason}${typeof note === "string" && note ? `: ${note}` : ""}).`,
              );
              setOpen(false);
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Void invoice 1042?</AlertDialogTitle>
              <AlertDialogDescription>
                A voided invoice stays in the ledger as a credit. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="void-reason">Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="void-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="duplicate">Duplicate</SelectItem>
                  <SelectItem value="wrong-customer">Wrong customer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="void-note">Note</Label>
              <Input id="void-note" name="note" />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              {/* A real submit button, not AlertDialogAction: that one closes the dialog on click, and
                  the form is gone before the browser gets to submit it. */}
              <Button type="submit" variant="destructive">
                Void invoice
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export const ControlledOpen: StoryObj = {
  parameters: {
    // Closed it is three buttons; the dialog portals out of #storybook-root, which is all the
    // screenshot captures. The point of the story is where focus goes, which is not visual.
    visual: { disable: true },
  },
  render: () => <ControlledVoid />,
};

/**
 * A confirmation whose "Yes" opens a form: both happen in one render. Escape in the form puts focus
 * back on "Delete project", the button that began it, not on a "Yes" that has already left.
 */
const ConfirmThenReasonDemo = () => {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [reasonOpen, setReasonOpen] = React.useState(false);
  return (
    <div className="flex gap-2">
      <Button variant="outline">Before</Button>
      <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
        Delete project
      </Button>
      <Button variant="outline">After</Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>Its verifications stay in the ledger.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setReasonOpen(true)}>Yes, delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Why delete it?</DialogTitle>
            <DialogDescription>A short note for the audit trail.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 px-4 pb-2">
            <Label htmlFor="delete-reason">Reason</Label>
            <Input id="delete-reason" />
          </div>
          <DialogFooter>
            <Button onClick={() => setReasonOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const ConfirmThenReason: StoryObj = {
  parameters: { visual: { disable: true } },
  render: () => <ConfirmThenReasonDemo />,
};
