import type { Meta, StoryObj } from "@storybook/react";
import { expect, waitFor } from "@storybook/test";
import * as React from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect, type Option } from "@/components/ui/multiselect";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

/*
 * Colour maths for the readouts and the play functions. The borders are `color-mix()` recipes over the
 * foreground, so a computed `border-top-color` comes back translucent (`oklab(... / 0.14)`) and has to
 * be painted over whatever is behind it before it can be compared with anything. A canvas does the
 * parsing, which is the one place in the package a canvas reads a colour back: here it is a
 * single-pixel readback of a computed value, not a hand-off to a chart library.
 */

type Rgba = [number, number, number, number];

let context: CanvasRenderingContext2D | null = null;

function parse(css: string): Rgba {
  context ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (context === null) {
    throw new Error("No 2d canvas to parse colours with");
  }
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = "#000";
  context.fillStyle = css;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

const over = (top: Rgba, base: Rgba): Rgba => [
  top[0] * top[3] + base[0] * (1 - top[3]),
  top[1] * top[3] + base[1] * (1 - top[3]),
  top[2] * top[3] + base[2] * (1 - top[3]),
  1,
];

function luminance([r, g, b]: Rgba): number {
  const linear = (value: number) => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: Rgba, b: Rgba): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/** The opaque colour at an element, its own fill included: ancestors' fills painted back to front. */
function surfaceAt(element: Element | null): Rgba {
  const fills: Rgba[] = [];
  for (let node = element; node !== null; node = node.parentElement) {
    const fill = parse(getComputedStyle(node).backgroundColor);
    if (fill[3] > 0) {
      fills.push(fill);
      if (fill[3] === 1) {
        break;
      }
    }
  }
  return fills.reduceRight<Rgba>((base, fill) => over(fill, base), [255, 255, 255, 1]);
}

/**
 * Contrast of an element's border against what it is painted over. A border that has no width draws
 * nothing, whatever colour it keeps (`border-0` leaves `border-color` alone), so it measures 1:1.
 */
function edgeContrast(element: Element): number {
  const style = getComputedStyle(element);
  const surface = surfaceAt(element);
  if (parseFloat(style.borderTopWidth) === 0) {
    return 1;
  }
  return contrast(over(parse(style.borderTopColor), surface), surface);
}

/** Contrast of an element's own fill against the surface behind it (a switch track, a raised card). */
function fillContrast(element: Element): number {
  const behind = surfaceAt(element.parentElement);
  return contrast(over(parse(getComputedStyle(element).backgroundColor), behind), behind);
}

/**
 * The box a Multiselect draws its edge on. It carries no slot attribute, so it is found the way
 * tests/multiselect.test.tsx finds it: the box around the combobox input that shows the focus ring.
 */
function multiselectBox(root: ParentNode | null): Element | null {
  return root?.querySelector("[cmdk-input]")?.closest("div[class*=focus-within]") ?? null;
}

const reportOptions: Option[] = [
  { value: "ledger", label: "General ledger" },
  { value: "vat", label: "VAT report" },
];

function ReportsField() {
  const [value, setValue] = React.useState<Option[]>([]);
  return (
    <MultiSelect
      defaultOptions={reportOptions}
      value={value}
      onValueChange={setValue}
      placeholder="Select reports..."
      commandProps={{ label: "Reports" }}
    />
  );
}

const meta: Meta = {
  title: "Foundation/Borders and Surfaces",
  parameters: {
    // No baseline yet: the figures are measured live, and the Dark story needs the dark baseline path.
    visual: { disable: true },
  },
};

export default meta;

type Measured = Record<string, number>;

/** Measures every `data-edge` and `data-fill` element under the root, and again when the theme flips. */
function useMeasured(): [React.RefObject<HTMLDivElement | null>, Measured] {
  const root = React.useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = React.useState<Measured>({});

  React.useLayoutEffect(() => {
    const measure = () => {
      const next: Measured = {};
      for (const element of root.current?.querySelectorAll("[data-edge]") ?? []) {
        next[`edge:${element.getAttribute("data-edge")}`] = edgeContrast(element);
      }
      for (const element of root.current?.querySelectorAll("[data-fill]") ?? []) {
        next[`fill:${element.getAttribute("data-fill")}`] = fillContrast(element);
      }
      const multiselect = multiselectBox(root.current);
      if (multiselect !== null) {
        next["edge:multiselect"] = edgeContrast(multiselect);
      }
      setMeasured(next);
    };
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return [root, measured];
}

const ratioText = (measured: Measured, key: string) =>
  measured[key] === undefined ? "measuring" : `${measured[key].toFixed(2)}:1`;

/** One labelled sample with the contrast measured on it. */
function Sample({
  label,
  readout,
  children,
}: {
  label: string;
  readout: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {children}
      <p className="text-xs text-muted-foreground">
        {label}: <span className="font-mono">{readout}</span>
      </p>
    </div>
  );
}

function BordersAndSurfaces() {
  const [root, measured] = useMeasured();
  const ratio = (key: string) => ratioText(measured, key);

  return (
    <div ref={root} className="flex max-w-3xl flex-col gap-6">
      <p className="max-w-prose text-sm text-muted-foreground">
        Borders are a share of the foreground colour rather than fixed greys, so they follow the
        surface behind them. The soft edge frames cards, tables and separators; the control edge
        draws a form field, and clears 3:1 against everything a field sits on. Figures are measured
        on this page.
      </p>

      <section aria-labelledby="surfaces-heading" className="flex flex-col gap-3">
        <h2 id="surfaces-heading" className="text-sm font-semibold">
          Surfaces
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Sample label="Card edge" readout={ratio("edge:card")}>
            <Card data-edge="card" data-fill="card">
              <CardHeader>
                <CardTitle>Card</CardTitle>
                <CardDescription>
                  Lifted: <span className="font-mono">{ratio("fill:card")}</span> against the page
                </CardDescription>
              </CardHeader>
            </Card>
          </Sample>
          <Sample label="Popover edge" readout={ratio("edge:popover")}>
            <div
              data-edge="popover"
              data-fill="popover"
              className="rounded-box border bg-popover p-6 text-popover-foreground shadow-md"
            >
              <p className="font-semibold leading-none tracking-tight">Popover</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Lifted: <span className="font-mono">{ratio("fill:popover")}</span> against the page
              </p>
            </div>
          </Sample>
        </div>
      </section>

      <section aria-labelledby="controls-heading" className="flex flex-col gap-3">
        <h2 id="controls-heading" className="text-sm font-semibold">
          Control edges, valid and invalid
        </h2>
        <Card>
          <CardContent className="grid grid-cols-1 gap-6 pt-6 sm:grid-cols-2">
            <Sample label="Input" readout={ratio("edge:input-valid")}>
              <Input aria-label="Valid input" defaultValue="Acme AB" data-edge="input-valid" />
            </Sample>
            <Sample label="Input, aria-invalid" readout={ratio("edge:input-invalid")}>
              <Input
                aria-label="Invalid input"
                aria-invalid
                defaultValue="556000-01"
                data-edge="input-invalid"
              />
            </Sample>
            <Sample label="Multiselect" readout={ratio("edge:multiselect")}>
              <ReportsField />
            </Sample>
            <Sample label="Switch track, off" readout={ratio("fill:switch")}>
              <div className="flex items-center gap-2">
                <Switch id="borders-switch" data-fill="switch" />
                <Label htmlFor="borders-switch">Send reminders</Label>
              </div>
            </Sample>
            <Sample label="Checkbox" readout={ratio("edge:checkbox-valid")}>
              <div className="flex items-center gap-2">
                <Checkbox id="borders-checkbox" data-edge="checkbox-valid" />
                <Label htmlFor="borders-checkbox">Accept terms</Label>
              </div>
            </Sample>
            <Sample label="Checkbox, aria-invalid" readout={ratio("edge:checkbox-invalid")}>
              <div className="flex items-center gap-2">
                <Checkbox id="borders-checkbox-invalid" aria-invalid data-edge="checkbox-invalid" />
                <Label htmlFor="borders-checkbox-invalid">Accept terms</Label>
              </div>
            </Sample>
            <Sample label="Radio" readout={ratio("edge:radio-valid")}>
              <RadioGroup aria-label="Delivery">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="email" id="borders-radio" data-edge="radio-valid" />
                  <Label htmlFor="borders-radio">E-invoice</Label>
                </div>
              </RadioGroup>
            </Sample>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

/** Every edge and fill on the page, by the `data-edge` / `data-fill` it carries. */
function measuredIn(canvasElement: HTMLElement) {
  const edge = (key: string) => {
    const element = canvasElement.querySelector(`[data-edge="${key}"]`);
    if (element === null) {
      throw new Error(`No element with data-edge="${key}"`);
    }
    return edgeContrast(element);
  };
  const fill = (key: string) => {
    const element = canvasElement.querySelector(`[data-fill="${key}"]`);
    if (element === null) {
      throw new Error(`No element with data-fill="${key}"`);
    }
    return fillContrast(element);
  };
  return { edge, fill };
}

/** What both themes promise, measured on the rendered page rather than read off the stylesheet. */
async function expectEdgeTiers(canvasElement: HTMLElement) {
  await waitFor(() => expect(canvasElement.querySelector('[data-edge="card"]')).not.toBeNull());
  const { edge, fill } = measuredIn(canvasElement);

  // The control tier clears WCAG 1.4.11's 3:1 on the card a field sits on.
  await expect(edge("input-valid")).toBeGreaterThanOrEqual(3);
  // The Multiselect is a text-entry field too, and was borderless: it takes the same tier as the Input.
  const multiselect = multiselectBox(canvasElement);
  await expect(multiselect).not.toBeNull();
  await expect(edgeContrast(multiselect as Element)).toBeGreaterThanOrEqual(3);
  await expect(edgeContrast(multiselect as Element)).toBeCloseTo(edge("input-valid"), 1);
  await expect(edge("checkbox-valid")).toBeGreaterThanOrEqual(3);
  await expect(edge("radio-valid")).toBeGreaterThanOrEqual(3);
  await expect(fill("switch")).toBeGreaterThanOrEqual(3);

  // The soft tier stays a hairline: seen, but quieter than a field's edge.
  await expect(edge("card")).toBeGreaterThanOrEqual(1.3);
  await expect(edge("card")).toBeLessThan(edge("input-valid"));

  // An invalid control keeps an edge stronger than a valid one, in both themes.
  await expect(edge("input-invalid")).toBeGreaterThan(edge("input-valid"));
  await expect(edge("checkbox-invalid")).toBeGreaterThan(edge("checkbox-valid"));

  return { edge, fill };
}

/**
 * Light: the card and popover are the page colour, so the border and the shadow carry the lift. The
 * play function measures the contrast tiers on the rendered page.
 */
export const Light: StoryObj = {
  // Pinned, not left to the toolbar: the play function measures a flat light surface.
  globals: { theme: "light" },
  render: () => <BordersAndSurfaces />,
  play: async ({ canvasElement }) => {
    await expect(document.documentElement.classList.contains("dark")).toBe(false);
    const { fill } = await expectEdgeTiers(canvasElement);
    await expect(fill("card")).toBeCloseTo(1, 2);
  },
};

/**
 * Dark: the card and popover sit one step above the page (about 1.05:1) because dark mode has no
 * shadow to lift them, and an invalid control's border is the named red, not the button-fill
 * `--destructive`, which would be weaker than a valid border (2:1 against 3.4:1).
 *
 * The theme is a story-level `globals` entry: Storybook ignores `parameters.globals`, so asking for
 * dark that way would render light. The play function says so out loud.
 */
export const Dark: StoryObj = {
  globals: { theme: "dark" },
  render: () => <BordersAndSurfaces />,
  play: async ({ canvasElement }) => {
    await expect(document.documentElement.classList.contains("dark")).toBe(true);
    const { fill } = await expectEdgeTiers(canvasElement);
    await expect(fill("card")).toBeGreaterThan(1.02);
    await expect(fill("popover")).toBeGreaterThan(1.02);
  },
};

/**
 * A dark subtree inside a light page. `--border` holds a `color-mix()` of `--foreground`, which a
 * browser resolves where it is declared and then inherits as a finished colour, so `.dark` has to
 * declare it again: otherwise this card would keep the page's dark-grey border on its near-black fill.
 */
export const DarkSubtreeInLightPage: StoryObj = {
  globals: { theme: "light" },
  render: () => (
    <div
      data-testid="nested-dark"
      className="dark max-w-sm rounded-box bg-background p-6 text-foreground"
    >
      <Card data-edge="nested-card">
        <CardHeader>
          <CardTitle>Dark card in a light page</CardTitle>
          <CardDescription>Its border follows its own foreground.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input aria-label="Name" defaultValue="Acme AB" data-edge="nested-input" />
        </CardContent>
      </Card>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(document.documentElement.classList.contains("dark")).toBe(false);
    const nested = canvasElement.querySelector('[data-testid="nested-dark"]');
    await expect(nested).not.toBeNull();

    // Resolved on each element: the light page's foreground is #09090b, the dark subtree's #fafafa.
    const border = (element: Element) => getComputedStyle(element).getPropertyValue("--border");
    await expect(border(document.documentElement)).toContain("#09090b");
    await expect(border(nested as Element)).toContain("#fafafa");

    const { edge } = measuredIn(canvasElement);
    await expect(edge("nested-input")).toBeGreaterThanOrEqual(3);
    await expect(edge("nested-card")).toBeGreaterThanOrEqual(1.3);
  },
};

/*
 * Tables on raised surfaces. In dark, Popover, Sheet, Dialog and AlertDialog sit a step above the page,
 * and each names its fill as `--ivy-data-table-surface`. A table that draws no box of its own
 * (`variant="embedded"`) paints its header and rows with that name, so it joins the host. A bordered
 * table, the default, is a box of its own and always sets the page colour: inside a raised host it is a
 * deliberate, slightly recessed inset with a visible edge, not a patch that failed to follow.
 */

interface Line {
  id: string;
  account: string;
  debit: string;
  credit: string;
}

const lines: Line[] = [
  { id: "l1", account: "1930 Företagskonto", debit: "", credit: "1 250,00" },
  { id: "l2", account: "2641 Ingående moms", debit: "250,00", credit: "" },
  { id: "l3", account: "5410 Förbrukningsinventarier", debit: "1 000,00", credit: "" },
];

const lineColumns: DataTableColumn<Line>[] = [
  { name: "account", header: "Account" },
  { name: "debit", header: "Debit", align: "Right" },
  { name: "credit", header: "Credit", align: "Right" },
];

function LinesTable({ variant, testId }: { variant: "bordered" | "embedded"; testId: string }) {
  return (
    <div data-testid={testId}>
      <DataTable
        columns={lineColumns}
        rows={lines}
        getRowId={(row) => row.id}
        caption={`Voucher lines, ${variant}`}
        paginated={false}
        variant={variant}
      />
    </div>
  );
}

/** The opaque fill of an element as "r,g,b": comparable whatever notation the browser reports. */
const fillText = (element: Element) =>
  parse(getComputedStyle(element).backgroundColor).slice(0, 3).map(Math.round).join(",");

/** The page colour, from the token rather than from an element that might itself be a lifted surface. */
const pageFill = () =>
  parse(getComputedStyle(document.documentElement).getPropertyValue("--background"))
    .slice(0, 3)
    .map(Math.round)
    .join(",");

/** Waits for the open host, then for the table it holds to have rows. */
async function openTable(hostSelector: string, testId: string) {
  await waitFor(() => expect(document.querySelector(hostSelector)).not.toBeNull());
  const host = document.querySelector(hostSelector) as Element;
  await waitFor(() =>
    expect(host.querySelector(`[data-testid="${testId}"] tbody tr`)).not.toBeNull(),
  );
  const table = host.querySelector(`[data-testid="${testId}"]`) as Element;
  return {
    host,
    header: table.querySelector("thead th") as Element,
    row: table.querySelector("tbody tr") as Element,
  };
}

/** The embedded table is painted with its host's own colour, and that colour is not the page's. */
async function expectJoinsHost(hostSelector: string) {
  await expect(document.documentElement.classList.contains("dark")).toBe(true);
  const { host, header, row } = await openTable(hostSelector, "embedded");
  // Not vacuous: a host on the page colour would make the equality below true for any table.
  await expect(fillText(host)).not.toBe(pageFill());
  await expect(fillText(header)).toBe(fillText(host));
  await expect(fillText(row)).toBe(fillText(host));
}

const tableHostStory = (render: () => React.ReactElement, hostSelector: string): StoryObj => ({
  globals: { theme: "dark" },
  render,
  play: async () => {
    await expectJoinsHost(hostSelector);
  },
});

/**
 * An embedded table directly in a Dialog, with the bordered default beside it for comparison. The
 * embedded one has no fill of its own and reads as part of the panel; the bordered one keeps the page
 * colour and a visible edge, a recessed inset. Which of the two a dialog wants is the caller's call.
 */
export const DarkTablesInDialog: StoryObj = {
  globals: { theme: "dark" },
  render: () => (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Voucher lines</DialogTitle>
          <DialogDescription>Embedded above, bordered below.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-6">
          <LinesTable variant="embedded" testId="embedded" />
          <LinesTable variant="bordered" testId="bordered" />
        </DialogBody>
      </DialogContent>
    </Dialog>
  ),
  play: async () => {
    await expectJoinsHost("[role='dialog']");

    // The bordered table is a box of its own: the page colour, one step below the lifted panel.
    const { host, header, row } = await openTable("[role='dialog']", "bordered");
    await expect(fillText(header)).toBe(pageFill());
    await expect(fillText(row)).toBe(pageFill());
    await expect(fillText(header)).not.toBe(fillText(host));
    const surface = document.querySelector(
      "[data-testid='bordered'] [data-slot='data-table-surface']",
    ) as Element;
    await expect(parseFloat(getComputedStyle(surface).borderTopWidth)).toBe(1);
  },
};

/** An embedded table in an AlertDialog panel (on `--popover`). */
export const DarkEmbeddedTableInAlertDialog: StoryObj = tableHostStory(
  () => (
    <AlertDialog defaultOpen>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void this voucher?</AlertDialogTitle>
          <AlertDialogDescription>These lines are reversed.</AlertDialogDescription>
        </AlertDialogHeader>
        <LinesTable variant="embedded" testId="embedded" />
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
  "[role='alertdialog']",
);

/** An embedded table in a Sheet (on `--card`). */
export const DarkEmbeddedTableInSheet: StoryObj = tableHostStory(
  () => (
    <Sheet defaultOpen>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Voucher lines</SheetTitle>
          <SheetDescription>Debit and credit per account.</SheetDescription>
        </SheetHeader>
        <LinesTable variant="embedded" testId="embedded" />
      </SheetContent>
    </Sheet>
  ),
  "[role='dialog']",
);

/** An embedded table in a Popover (on `--popover`). */
export const DarkEmbeddedTableInPopover: StoryObj = tableHostStory(
  () => (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="outline">Lines</Button>
      </PopoverTrigger>
      <PopoverContent className="w-[30rem] max-w-[90vw]">
        <LinesTable variant="embedded" testId="embedded" />
      </PopoverContent>
    </Popover>
  ),
  "[data-slot='popover-content']",
);
