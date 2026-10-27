import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vite-plus/test";
import { Checkbox } from "../src/components/ui/checkbox";
import { inputVariant } from "../src/components/ui/input/variant";
import { textInputFieldShellClasses } from "../src/components/ui/input/text-input-variant";
import { RadioGroup, RadioGroupItem } from "../src/components/ui/radio-group";
import { selectSingleTriggerVariant } from "../src/components/ui/select/variant";
import { Popover, PopoverContent } from "../src/components/ui/popover";
import { Switch } from "../src/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../src/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "../src/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../src/components/ui/dialog";
import { Toast, ToastProvider, ToastViewport } from "../src/components/ui/toast";
import { Toggle } from "../src/components/ui/toggle";
import { fileInputVariant } from "../src/components/ui/input/file-input-variant";
import { DataTable, type DataTableColumn } from "../src/components/ui/data-table";
import { MultiSelect } from "../src/components/ui/multiselect";

/**
 * The border tokens only reach a control if its class string lets them: a `dark:border-white/10`
 * left on an input beats `border-input` in dark and the token change never shows. These tests are the
 * class-side half of the token port that `design-tokens.test.ts` covers on the stylesheet side.
 *
 * Classes are compared as whole tokens. A substring check would call `data-[state=checked]:border-primary`
 * a match for `border-primary`, which is exactly the confusion the radio fix is about.
 */

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");

function sourceFiles(directory: string, extensions: readonly string[]): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path, extensions);
    }
    return extensions.some((extension) => entry.name.endsWith(extension)) ? [path] : [];
  });
}

const tokens = (classes: string): string[] => classes.split(/\s+/).filter(Boolean);

describe("no hard-coded dark border override", () => {
  it("leaves no dark:border-white/10 anywhere in src", () => {
    // It was nine copies of the same patch: each beat the token in dark, so the effective dark input
    // border was white at 10% (1.25:1) whatever --input said, and no two controls agreed.
    const offenders = sourceFiles(SRC, [".ts", ".tsx", ".css", ".mdx"])
      .filter((file) => readFileSync(file, "utf-8").includes("dark:border-white/10"))
      .map((file) => relative(SRC, file).replaceAll("\\", "/"));

    expect(offenders).toEqual([]);
  });

  it.each([
    ["Input", inputVariant()],
    ["Select trigger", selectSingleTriggerVariant()],
    ["file drop zone", fileInputVariant({ variant: "Drop" })],
    ["field shell", textInputFieldShellClasses({})],
  ])("%s takes its border from --input in both themes", (_name, classes) => {
    const list = tokens(classes);
    expect(list).toContain("border-input");
    expect(list.filter((token) => token.startsWith("dark:border-"))).toEqual([]);
  });
});

describe("checkable controls draw their unchecked boundary on --input", () => {
  it("Checkbox: border-input, not the soft --border it was near-invisible on", () => {
    render(createElement(Checkbox, { "aria-label": "Accept" }));
    const list = tokens(screen.getByRole("checkbox").className);

    expect(list).toContain("border-input");
    expect(list).not.toContain("border-border");
    // Checked is the primary fill, and it keeps its own border colour.
    expect(list).toContain("data-[state=checked]:border-primary");
  });

  it("RadioGroupItem: border-input unchecked, primary only once checked, in both themes", () => {
    render(
      createElement(
        RadioGroup,
        { "aria-label": "Method" },
        createElement(RadioGroupItem, { value: "a", "aria-label": "A" }),
      ),
    );
    const list = tokens(screen.getByRole("radio").className);

    expect(list).toContain("border-input");
    expect(list).toContain("data-[state=checked]:border-primary");
    // A bare border-primary draws a black ring around every unchecked radio in light.
    expect(list).not.toContain("border-primary");
    expect(list.filter((token) => token.startsWith("dark:data-[state=checked]"))).toEqual([]);
  });

  it("RadioGroupItem: an invalid radio keeps its red border once checked", () => {
    // `data-[state=checked]:border-primary` sorts after a plain `aria-invalid:border-destructive`, so
    // without the stacked variants a checked radio went back to a black ring in light mode.
    render(
      createElement(
        RadioGroup,
        { "aria-label": "Method", "aria-invalid": true },
        createElement(RadioGroupItem, { value: "a", "aria-label": "A" }),
      ),
    );
    const list = tokens(screen.getByRole("radio").className);

    for (const variant of ["aria-invalid", "group-aria-invalid/radiogroup"]) {
      expect(list, variant).toContain(`${variant}:data-[state=checked]:border-destructive`);
      expect(list, variant).toContain(`dark:${variant}:data-[state=checked]:border-red`);
    }
  });
});

describe("the off switch keeps its 3:1 track while hovered", () => {
  it("darkens the unchecked track on hover instead of thinning it", () => {
    // The variant's `hover:data-[state=unchecked]:bg-input/80` took the 3.3:1 track to 2.5:1.
    render(createElement(Switch, { "aria-label": "Airplane mode" }));
    const list = tokens(screen.getByRole("switch").className);

    expect(list).toContain("hover:data-[state=unchecked]:bg-foreground/50");
    expect(list).not.toContain("hover:data-[state=unchecked]:bg-input/80");
  });
});

describe("an invalid control keeps a border stronger than a valid one in dark", () => {
  // Dark --destructive is a button fill (1.99:1 on the page) and a valid control edge is now 3.4:1, so
  // a border on --destructive alone would make an invalid field read weaker than a valid one. Every
  // `...aria-invalid...:border-destructive` has a `dark:` twin on the named red, in the same file.
  const files = sourceFiles(SRC, [".ts", ".tsx"]);
  const invalidBorder = /^(?!dark:).*aria-invalid.*:border-destructive$/;

  it("scans the control files it is meant to", () => {
    // Guards the scan below from passing by finding nothing.
    const found = files.filter((file) =>
      tokens(readFileSync(file, "utf-8").replace(/["'`,;(){}<>]/g, " ")).some((token) =>
        invalidBorder.test(token),
      ),
    );
    expect(found.map((file) => relative(SRC, file).replaceAll("\\", "/")).sort()).toEqual(
      expect.arrayContaining([
        "components/ui/checkbox.tsx",
        "components/ui/date-picker/date-picker-variant.ts",
        "components/ui/input/variant.ts",
        "components/ui/radio-group.tsx",
        "components/ui/select/variant.ts",
        "components/ui/textarea/textarea.tsx",
      ]),
    );
  });

  it("gives each aria-invalid:border-destructive a dark:...:border-red twin in its file", () => {
    const missing: string[] = [];
    for (const file of files) {
      // Brackets stay: `has-[input[aria-invalid=true]]:border-destructive` is one token.
      const found = new Set(tokens(readFileSync(file, "utf-8").replace(/["'`,;(){}<>]/g, " ")));
      for (const token of found) {
        if (invalidBorder.test(token)) {
          const twin = `dark:${token.replace(/border-destructive$/, "border-red")}`;
          if (!found.has(twin)) {
            missing.push(`${relative(SRC, file).replaceAll("\\", "/")}: ${token} needs ${twin}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("Checkbox invalid by className gets the dark red, unchecked and checked", () => {
    render(createElement(Checkbox, { "aria-label": "Accept", className: "border-destructive" }));
    const list = tokens(screen.getByRole("checkbox").className);

    expect(list).toContain("border-destructive");
    expect(list).toContain("dark:border-red");
    expect(list).toContain("dark:data-[state=checked]:border-red");
  });

  it("Toggle invalid by className gets the dark red on its outline", () => {
    render(
      createElement(Toggle, {
        variant: "outline",
        "aria-label": "Bold",
        className: "border-destructive",
      }),
    );
    const list = tokens(screen.getByRole("button", { name: "Bold" }).className);

    expect(list).toContain("border-destructive");
    expect(list).toContain("dark:border-red");
    expect(list).not.toContain("border-input");
  });

  it("the field shell gets the dark red when invalid, and keeps the focus ring colour otherwise", () => {
    const invalid = tokens(textInputFieldShellClasses({ invalid: "Required" }));
    expect(invalid).toContain("border-destructive");
    expect(invalid).toContain("dark:border-red");

    // Focused and valid: the ring colour, in both themes.
    const focused = tokens(textInputFieldShellClasses({ focused: true }));
    expect(focused).toContain("border-ring");
    expect(focused).toContain("dark:border-ring");
  });
});

describe("lifted dark surfaces hand their fill to an embedded table", () => {
  // In dark, --card and --popover are a step above --background. A table that is not a bordered box of
  // its own (`variant="embedded"`) paints its rows with `--ivy-data-table-surface`, falling back to
  // the page, so a host that is lifted has to name its fill or the table reads as a dark patch on it
  // (CardContent already does). The default bordered table sets its own surface and is not covered by
  // this: see "a table takes the fill of the raised surface that hosts it" below.
  it("PopoverContent names --popover", () => {
    render(createElement(Popover, { open: true }, createElement(PopoverContent, null, "Body")));

    expect(tokens(document.querySelector('[data-slot="popover-content"]')!.className)).toContain(
      "[--ivy-data-table-surface:var(--popover)]",
    );
  });

  it("SheetContent names --card, the fill it paints", () => {
    render(
      createElement(
        Sheet,
        { open: true },
        createElement(
          SheetContent,
          null,
          createElement(SheetTitle, null, "Details"),
          createElement(SheetDescription, null, "Body"),
        ),
      ),
    );

    const list = tokens(screen.getByRole("dialog").className);
    expect(list).toContain("bg-card");
    expect(list).toContain("[--ivy-data-table-surface:var(--card)]");
  });
});

describe("a table takes the fill of the raised surface that hosts it", () => {
  // The hand-off above is only a class on the host; what matters is which fill a table ends up with.
  // That is the nearest `[--ivy-data-table-surface:...]` on the way up from the table's own surface
  // element, which is how the custom property inherits in the browser. The table's own element is
  // included, because a bordered table sets the property there and that is what stops the walk.
  const surfaceFor = (table: Element): string | undefined => {
    for (let node: Element | null = table; node !== null; node = node.parentElement) {
      const named = tokens(node.getAttribute("class") ?? "").find((token) =>
        token.startsWith("[--ivy-data-table-surface:"),
      );
      if (named !== undefined) {
        return named.slice("[--ivy-data-table-surface:".length, -1);
      }
    }
    return undefined;
  };

  interface Line {
    id: string;
    account: string;
  }
  const lines: Line[] = [{ id: "l1", account: "1930 Företagskonto" }];
  const columns: DataTableColumn<Line>[] = [{ name: "account", header: "Account" }];
  const lineTable = (variant: "bordered" | "embedded") =>
    createElement(DataTable<Line>, {
      columns,
      rows: lines,
      getRowId: (row) => row.id,
      caption: "Voucher lines",
      paginated: false,
      variant,
    });
  const surfaceOf = () => document.querySelector('[data-slot="data-table-surface"]')!;

  it("Dialog: an embedded table follows the panel, a bordered one keeps the page colour", () => {
    const dialog = (variant: "bordered" | "embedded") =>
      createElement(
        Dialog,
        { open: true },
        createElement(
          DialogContent,
          null,
          createElement(
            DialogHeader,
            null,
            createElement(DialogTitle, null, "Voucher lines"),
            createElement(DialogDescription, null, "Debit and credit."),
          ),
          lineTable(variant),
        ),
      );

    const embedded = render(dialog("embedded"));
    expect(surfaceFor(surfaceOf())).toBe("var(--popover)");
    embedded.unmount();

    // A bordered table is a box of its own, so inside a raised panel it is a recessed inset by design.
    render(dialog("bordered"));
    expect(surfaceFor(surfaceOf())).toBe("var(--background)");
  });

  it("AlertDialog: an embedded table follows the panel", () => {
    render(
      createElement(
        AlertDialog,
        { open: true },
        createElement(
          AlertDialogContent,
          null,
          createElement(AlertDialogTitle, null, "Void voucher"),
          createElement(AlertDialogDescription, null, "These lines are reversed."),
          lineTable("embedded"),
        ),
      ),
    );

    expect(surfaceFor(surfaceOf())).toBe("var(--popover)");
  });

  it("Popover: an embedded table follows the popover", () => {
    render(
      createElement(
        Popover,
        { open: true },
        createElement(PopoverContent, null, lineTable("embedded")),
      ),
    );

    expect(surfaceFor(surfaceOf())).toBe("var(--popover)");
  });

  it("Sheet: an embedded table follows the card fill the sheet paints", () => {
    render(
      createElement(
        Sheet,
        { open: true },
        createElement(
          SheetContent,
          null,
          createElement(SheetTitle, null, "Voucher lines"),
          createElement(SheetDescription, null, "Debit and credit."),
          lineTable("embedded"),
        ),
      ),
    );

    expect(surfaceFor(surfaceOf())).toBe("var(--card)");
  });

  it("the walk finds nothing for an embedded table on a host that names no fill", () => {
    // The control for the helper itself: it must be able to say "none", or every assertion above could
    // be satisfied by a walk that returns whatever it finds first.
    render(lineTable("embedded"));

    expect(surfaceFor(surfaceOf())).toBeUndefined();
  });
});

describe("a Multiselect keeps the control edge of the field it sits beside", () => {
  // It was `border-0`: the one field in a form with no visible edge. The box inherits
  // `border border-input` from the shared trigger base now, the same 3:1 tier as the Input and the
  // Select trigger; only `ghost` drops it, on purpose, for toolbars.
  const box = (container: HTMLElement) =>
    container.querySelector("[cmdk-input]")!.closest("div[class*=focus-within]")!;
  const field = (props: { ghost?: boolean }) =>
    createElement(MultiSelect, {
      defaultOptions: [{ value: "ledger", label: "General ledger" }],
      value: [],
      commandProps: { label: "Reports" },
      ...props,
    });

  it("draws the --input edge, as the Select trigger does", () => {
    const { container } = render(field({}));

    const list = tokens(box(container).getAttribute("class") ?? "");
    expect(list).toContain("border");
    expect(list).toContain("border-input");
    expect(list).not.toContain("border-0");
    expect(list).not.toContain("border-transparent");
    // The border and edge colour it takes are the ones the single Select's trigger is built on.
    for (const token of ["border", "border-input"]) {
      expect(tokens(selectSingleTriggerVariant())).toContain(token);
    }
  });

  it("ghost has no visible edge", () => {
    const { container } = render(field({ ghost: true }));

    expect(tokens(box(container).getAttribute("class") ?? "")).toContain("border-transparent");
  });

  it("can be narrower than its chips and its input", () => {
    // In a grid or flex parent (a Field is a grid) an item cannot shrink below its content unless it
    // says so, and this one's content is the chips plus a 120px input: the edge ran out past a narrow
    // column. Layout is the browser's, so the class is what can be pinned; the Borders story measures it.
    const { container } = render(field({}));

    const root = container.querySelector("[cmdk-root]")!;
    expect(tokens(root.getAttribute("class") ?? "")).toContain("min-w-0");
  });
});

describe("translucent edge tokens are never used as an opaque fill", () => {
  // --border and --input are color-mix() recipes at 14% and 38-46% alpha now. As a line that is the
  // point; as a background it lets the page through, and text on it loses contrast. The devtools label
  // and dialog were exactly that: `background: var(--input)`.
  const stylesheets = sourceFiles(SRC, [".css"]);
  const fillOf = (token: string) =>
    new RegExp(String.raw`(?:^|[;{\s])background(?:-color)?\s*:\s*var\(--${token}\)`, "m");
  const names = (files: string[]) => files.map((file) => relative(SRC, file).replaceAll("\\", "/"));

  it("scans the stylesheets it is meant to", () => {
    // Guards the scans below from passing by finding nothing.
    expect(names(stylesheets)).toEqual(
      expect.arrayContaining([
        "components/devtools.css",
        "components/AgentViewer/agent-output.css",
        "components/PlanMarkdown/plan-markdown.css",
      ]),
    );
  });

  it("the fill pattern matches what it is looking for", () => {
    expect(fillOf("input").test("  background: var(--input);")).toBe(true);
    expect(fillOf("input").test("  background-color: var(--input);")).toBe(true);
    expect(fillOf("input").test("  border: 1px solid var(--input);")).toBe(false);
  });

  it("no stylesheet paints a background with --input", () => {
    const offenders = stylesheets.filter((file) =>
      fillOf("input").test(readFileSync(file, "utf-8")),
    );
    expect(names(offenders)).toEqual([]);
  });

  it("the devtools label and dialog use neither --border nor --input as a fill", () => {
    const css = readFileSync(join(SRC, "components", "devtools.css"), "utf-8");
    expect(css).not.toMatch(fillOf("input"));
    expect(css).not.toMatch(fillOf("border"));
  });

  it("AgentViewer's --aov-border-strong keeps its own strength instead of following --input", () => {
    // It is a fill (the scrollbar thumb) and the colour of two thick left rules, so the 3:1
    // form-control tier would have made every one of them jump.
    const css = readFileSync(join(SRC, "components", "AgentViewer", "agent-output.css"), "utf-8");
    const strong = /--aov-border-strong:\s*([^;]+);/.exec(css)?.[1];

    expect(strong).toBeDefined();
    expect(strong).not.toContain("var(--input)");
    expect(strong).toMatch(/^color-mix\(in oklab, var\(--foreground\) \d+%, transparent\)$/);
  });
});

describe("the default toast is a raised surface", () => {
  it("sits on --popover, not the page colour: dark mode gives it no shadow to lift it", () => {
    render(
      createElement(
        ToastProvider,
        null,
        createElement(Toast, { open: true }, createElement("p", null, "Saved")),
        createElement(ToastViewport),
      ),
    );
    const list = tokens(document.querySelector("li[data-state]")!.className);

    expect(list).toContain("bg-popover");
    expect(list).toContain("text-popover-foreground");
    expect(list).not.toContain("bg-background");
  });
});

describe("modal panels are raised surfaces", () => {
  // Dark mode has no shadow to lift a panel, and the scrim alone left it 1.02:1 (Dialog) and 1.04:1
  // (AlertDialog) off the dimmed page. They sit on --popover, which dark mode lifts a step. The sticky
  // header paints its own fill, so it has to follow or it shows as a darker band across the top.
  it("Dialog: the panel, its sticky header and an embedded table all use --popover", () => {
    render(
      createElement(
        Dialog,
        { open: true },
        createElement(
          DialogContent,
          null,
          createElement(
            DialogHeader,
            null,
            createElement(DialogTitle, null, "Book payment"),
            createElement(DialogDescription, null, "Match it against an invoice."),
          ),
        ),
      ),
    );

    const panel = tokens(screen.getByRole("dialog").className);
    expect(panel).toContain("bg-popover");
    expect(panel).not.toContain("bg-background");
    expect(panel).toContain("[--ivy-data-table-surface:var(--popover)]");

    const header = tokens(screen.getByText("Book payment").closest(".sticky")!.className);
    expect(header).toContain("bg-popover");
    expect(header).not.toContain("bg-background");
  });

  it("AlertDialog: the panel and an embedded table use --popover", () => {
    render(
      createElement(
        AlertDialog,
        { open: true },
        createElement(
          AlertDialogContent,
          null,
          createElement(AlertDialogTitle, null, "Void invoice"),
          createElement(AlertDialogDescription, null, "This cannot be undone."),
        ),
      ),
    );

    const panel = tokens(screen.getByRole("alertdialog").className);
    expect(panel).toContain("bg-popover");
    expect(panel).not.toContain("bg-background");
    expect(panel).toContain("[--ivy-data-table-surface:var(--popover)]");
  });
});
