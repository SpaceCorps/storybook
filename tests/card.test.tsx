import { render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it } from "vite-plus/test";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "../src/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../src/components/ui/card";
import { DataTable, type DataTableColumn } from "../src/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../src/components/ui/dialog";
import { Popover, PopoverContent } from "../src/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../src/components/ui/sheet";

interface Row {
  id: string;
  name: string;
}

const columns: DataTableColumn<Row>[] = [{ name: "name", header: "Name" }];
const rows: Row[] = [{ id: "1", name: "Alice" }];
const table = <DataTable columns={columns} rows={rows} getRowId={(row) => row.id} />;

describe("Card", () => {
  it("can shrink below its content, so one wide child cannot stretch a flex or grid track", () => {
    render(<Card data-testid="card" />);

    const card = screen.getByTestId("card");
    expect(card.className).toContain("min-w-0");
    expect(card.getAttribute("data-slot")).toBe("card");
  });

  it("lets the caller's classes win over its own", () => {
    render(<Card data-testid="card" className="w-80 min-w-fit" />);

    const card = screen.getByTestId("card");
    expect(card.className).toContain("w-80");
    expect(card.className).toContain("min-w-fit");
    expect(card.className).not.toContain("min-w-0");
  });

  it("marks its parts with data-slot", () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );

    for (const slot of [
      "card",
      "card-header",
      "card-title",
      "card-description",
      "card-content",
      "card-footer",
    ]) {
      expect(container.querySelector(`[data-slot="${slot}"]`), slot).not.toBeNull();
    }
  });
});

describe("CardContent", () => {
  it("is padded by default", () => {
    const { container } = render(<CardContent>Body</CardContent>);

    const content = container.querySelector<HTMLElement>('[data-slot="card-content"]')!;
    expect(content.className).toContain("p-6");
    expect(content.className).toContain("pt-0");
    expect(content.hasAttribute("data-flush")).toBe(false);
  });

  it("flush drops the padding and clips to the card's rounded corners, top and bottom", () => {
    const { container } = render(<CardContent flush>Body</CardContent>);

    const content = container.querySelector<HTMLElement>('[data-slot="card-content"]')!;
    expect(content.className).toContain("p-0");
    expect(content.className).not.toContain("p-6");
    expect(content.className).toContain("overflow-hidden");
    expect(content.className).toContain("last:rounded-b-[calc(var(--radius-boxes)-1px)]");
    // A card with no header: the table's opaque header row would square the top corners off.
    expect(content.className).toContain("first:rounded-t-[calc(var(--radius-boxes)-1px)]");
    expect(content.hasAttribute("data-flush")).toBe(true);
  });

  it("does not leak the flush prop onto the DOM element", () => {
    const { container } = render(<CardContent flush>Body</CardContent>);

    expect(container.querySelector("[flush]")).toBeNull();
  });

  it("hands the card fill to descendants that need an opaque surface", () => {
    const { container } = render(<CardContent>Body</CardContent>);

    expect(container.querySelector('[data-slot="card-content"]')!.className).toContain(
      "[--ivy-data-table-surface:var(--card)]",
    );
  });

  it("forwards its ref and extra props", () => {
    let node: HTMLDivElement | null = null;
    render(
      <CardContent
        ref={(element) => {
          node = element;
        }}
        id="body"
      >
        Body
      </CardContent>,
    );

    expect(node).not.toBeNull();
    expect((node as unknown as HTMLDivElement).id).toBe("body");
  });
});

describe("CardContent and DataTable", () => {
  const variantOf = (container: HTMLElement): string | undefined =>
    container.querySelector<HTMLElement>('[data-slot="data-table"]')?.dataset.variant;

  it("a table in flush content is embedded", () => {
    const { container } = render(
      <Card>
        <CardContent flush>{table}</CardContent>
      </Card>,
    );

    expect(variantOf(container)).toBe("embedded");
  });

  it("a table in padded content is embedded, so the card never shows two borders", () => {
    const { container } = render(
      <Card>
        <CardContent>{table}</CardContent>
      </Card>,
    );

    expect(variantOf(container)).toBe("embedded");
  });

  it("a table outside any card content keeps its own border", () => {
    const { container } = render(
      <Card>
        <CardHeader>{table}</CardHeader>
      </Card>,
    );

    expect(variantOf(container)).toBe("bordered");
  });

  it("the nearest card content wins when contents nest", () => {
    const { container } = render(
      <CardContent flush>
        <CardContent>{table}</CardContent>
      </CardContent>,
    );

    expect(container.querySelector("table")!.className).not.toContain("ps-6");
  });
});

describe("CardContent and portaled overlays", () => {
  // React context crosses portals, so an overlay opened from inside a card is still "in" it for
  // `useCardContentLayout` although its DOM is outside. The overlay's table is not on the card: it
  // must keep its own border, and a flush card must not hand it the card's inset.
  const variants = (): string[] =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-slot="data-table"]')).map(
      (element) => element.dataset.variant ?? "",
    );

  const overlays: Array<[string, (children: React.ReactNode) => React.ReactNode]> = [
    [
      "Dialog",
      (children) => (
        <Dialog open>
          <DialogContent>
            <DialogTitle>Lines</DialogTitle>
            <DialogDescription>The voucher lines.</DialogDescription>
            {children}
          </DialogContent>
        </Dialog>
      ),
    ],
    [
      "AlertDialog",
      (children) => (
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogTitle>Lines</AlertDialogTitle>
            <AlertDialogDescription>The voucher lines.</AlertDialogDescription>
            {children}
          </AlertDialogContent>
        </AlertDialog>
      ),
    ],
    [
      "Sheet",
      (children) => (
        <Sheet open>
          <SheetContent>
            <SheetTitle>Lines</SheetTitle>
            <SheetDescription>The voucher lines.</SheetDescription>
            {children}
          </SheetContent>
        </Sheet>
      ),
    ],
    [
      "Popover",
      (children) => (
        <Popover open>
          <PopoverContent>{children}</PopoverContent>
        </Popover>
      ),
    ],
  ];

  for (const flush of [false, true]) {
    for (const [name, overlay] of overlays) {
      it(`a table in a ${name} opened from ${flush ? "flush" : "padded"} card content keeps its own border`, () => {
        render(
          <Card>
            <CardContent flush={flush}>
              {table}
              {overlay(table)}
            </CardContent>
          </Card>,
        );

        // The table on the card steps back; the one in the overlay is on nothing but the overlay.
        expect(variants()).toEqual(["embedded", "bordered"]);

        const inOverlay = Array.from(
          document.querySelectorAll<HTMLElement>('[data-slot="data-table"]'),
        ).at(-1)!;
        expect(inOverlay.querySelector("table")!.className).not.toContain("ps-6");
        expect(
          inOverlay.querySelector('[data-slot="data-table-surface"]')!.className,
        ).not.toContain("border-t");
      });
    }
  }

  it("still lets a card inside the overlay set its own layout", () => {
    render(
      <Card>
        <CardContent>
          <Dialog open>
            <DialogContent>
              <DialogTitle>Lines</DialogTitle>
              <DialogDescription>The voucher lines.</DialogDescription>
              <Card>
                <CardContent flush>{table}</CardContent>
              </Card>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>,
    );

    expect(variants()).toEqual(["embedded"]);
    expect(document.querySelector("table")!.className).toContain("ps-6");
  });
});
