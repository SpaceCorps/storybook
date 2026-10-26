import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
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
import {
  GamepadNavigationProvider,
  useGamepadNavigation,
} from "@/components/ui/gamepad-navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** A form field as text; a file input would give a File, which none of these forms has. */
const formText = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
};

const meta: Meta = {
  title: "UI/GamepadNavigation",
  parameters: {
    // The story reads a live gamepad and opens a dialog in a portal, so a screenshot adds nothing.
    visual: { disable: true },
  },
};

export default meta;

const CONTROLS: ReadonlyArray<readonly [string, string]> = [
  ["D-pad or left stick", "Move focus to the nearest control in that direction."],
  ["A", "Press the focused control: click a button, tick a box, submit from a text field."],
  ["B", "Escape: closes a dialog, popover or list. Inside a calendar or tree it steps back out."],
  ["LB and RB", "Previous and next tab."],
  [
    "Inside a widget",
    "A widget keeps only the directions it uses: Left and Right on tabs, a slider, a row of radios or toggles (a calendar's Month and Week switch) or a splitter between side-by-side panels. The other directions move on, and a group lets go at its first and last item. A number or time field steps with Up and Down. In a menu, Right opens a submenu and Left closes it.",
  ],
];

/** The live state of the layer: which pad, which device was used last, and what the last press did. */
function Readout() {
  const { enabled, connected, padId, modality, lastAction } = useGamepadNavigation();

  return (
    <dl
      className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-box border border-border bg-muted p-3 text-sm"
      data-testid="gamepad-readout"
    >
      <dt className="text-muted-foreground">Layer</dt>
      <dd>{enabled ? "on" : "off"}</dd>
      <dt className="text-muted-foreground">Gamepad</dt>
      <dd data-testid="gamepad-id">{connected ? (padId ?? "connected") : "none connected"}</dd>
      <dt className="text-muted-foreground">Last input</dt>
      <dd data-testid="gamepad-modality">{modality ?? "none yet"}</dd>
      <dt className="text-muted-foreground">Last action</dt>
      <dd data-testid="gamepad-last-action">
        {lastAction
          ? `#${lastAction.sequence} ${lastAction.action} on ${lastAction.target}${lastAction.handled ? "" : " (nothing responded)"}`
          : "none yet"}
      </dd>
    </dl>
  );
}

function Hint() {
  const { enabled, connected } = useGamepadNavigation();
  if (!enabled) {
    return (
      <p className="text-sm text-muted-foreground">Switch the layer on, then connect a gamepad.</p>
    );
  }
  if (!connected) {
    return (
      <p role="status" className="text-sm text-foreground">
        Connect a gamepad and press a button. Browsers only report a pad once it has been used.
      </p>
    );
  }
  return (
    <p role="status" className="text-sm text-foreground">
      Gamepad ready. Use the D-pad to move around the form on the right.
    </p>
  );
}

function TryIt() {
  const [saved, setSaved] = React.useState("");
  const [startDate, setStartDate] = React.useState("2026-11-01");
  const [chosen, setChosen] = React.useState("");

  return (
    <div className="flex flex-col gap-6">
      <form
        aria-labelledby="gamepad-form-title"
        className="flex flex-col gap-3 rounded-box border border-border bg-card p-4 text-card-foreground"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setSaved(`Saved ${formText(data, "name") || "(no name)"}.`);
        }}
      >
        <h2 id="gamepad-form-title" className="text-base font-semibold">
          A small form
        </h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gamepad-name">Name</Label>
          <Input id="gamepad-name" name="name" autoComplete="name" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gamepad-plan">Plan</Label>
          <Select defaultValue="team">
            <SelectTrigger id="gamepad-plan" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solo">Solo</SelectItem>
              <SelectItem value="team">Team</SelectItem>
              <SelectItem value="company">Company</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="gamepad-news" />
          <Label htmlFor="gamepad-news">Send me the newsletter</Label>
        </div>
        <RadioGroup
          name="billing"
          defaultValue="monthly"
          aria-label="Billing"
          className="flex gap-4"
        >
          {["monthly", "yearly"].map((billing) => (
            <div key={billing} className="flex items-center gap-2">
              <RadioGroupItem id={`gamepad-billing-${billing}`} value={billing} />
              <Label htmlFor={`gamepad-billing-${billing}`} className="capitalize">
                {billing}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium leading-none">Seats</span>
          <Slider defaultValue={[5]} max={20} step={1} aria-label="Seats" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gamepad-start">Start date</Label>
          <DatePicker id="gamepad-start" value={startDate} onChange={setStartDate} />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit">Save</Button>
          <Button type="button" variant="outline">
            Cancel
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline">
                More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {["Duplicate", "Archive", "Export"].map((action) => (
                <DropdownMenuItem key={action} onSelect={() => setChosen(action)}>
                  {action}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex gap-3">
          <p role="status" className="text-sm text-muted-foreground">
            {[saved, chosen && `Chose ${chosen}.`].filter(Boolean).join(" ")}
          </p>
        </div>
      </form>

      <Tabs defaultValue="overview" className="rounded-box border border-border bg-card p-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-3 text-sm">
          Press RB for the next tab and LB for the previous one.
        </TabsContent>
        <TabsContent value="activity" className="pt-3 text-sm">
          Nothing has happened yet.
        </TabsContent>
        <TabsContent value="settings" className="flex items-center gap-2 pt-3 text-sm">
          <Switch id="gamepad-notify" />
          <Label htmlFor="gamepad-notify">Notify me</Label>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col gap-2 rounded-box border border-border bg-card p-4">
        <h2 id="gamepad-split-title" className="text-sm font-semibold">
          Split view
        </h2>
        <div className="h-20">
          <ResizablePanelGroup
            direction="horizontal"
            className="rounded-box border border-border"
            data-testid="gamepad-split"
          >
            <ResizablePanel defaultSize={50}>
              <div className="flex h-full items-center justify-center text-sm">Left</div>
            </ResizablePanel>
            <ResizableHandle withHandle aria-label="Resize the split view" />
            <ResizablePanel defaultSize={50}>
              <div className="flex h-full items-center justify-center text-sm">Right</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
        <p className="text-sm text-muted-foreground">
          Left and Right on the handle resize the panels. Up and Down move on.
        </p>
      </div>

      <div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open a dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename the workspace</DialogTitle>
              <DialogDescription>
                The D-pad stays inside the dialog while it is open. B closes it.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gamepad-workspace">Workspace name</Label>
                <Input id="gamepad-workspace" defaultValue="Accounting" />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button">Rename</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function GamepadDemo() {
  const [enabled, setEnabled] = React.useState(false);

  return (
    <GamepadNavigationProvider enabled={enabled}>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Gamepad navigation</h1>
          <p className="text-sm text-muted-foreground">
            Off by default. Switched on, a game controller drives the page through the same keyboard
            behaviour the components already have: arrows reach the focused widget as real key
            events, A presses, B sends Escape.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Switch id="gamepad-enabled" checked={enabled} onCheckedChange={setEnabled} />
              <Label htmlFor="gamepad-enabled">Enable gamepad navigation</Label>
            </div>
            <Hint />
            <Readout />
            <section aria-labelledby="gamepad-controls" className="space-y-2">
              <h2 id="gamepad-controls" className="text-sm font-semibold">
                Controls
              </h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {CONTROLS.map(([button, effect]) => (
                  <React.Fragment key={button}>
                    <dt className="font-medium">{button}</dt>
                    <dd className="text-muted-foreground">{effect}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </section>
          </div>
          <TryIt />
        </div>
      </div>
    </GamepadNavigationProvider>
  );
}

/** Flip the switch, connect a controller and press a button, then drive the form, tabs and dialog. */
export const Default: StoryObj = {
  render: () => <GamepadDemo />,
};
