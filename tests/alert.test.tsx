import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { AlertCircle, Info } from "lucide-react";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { Alert, AlertDescription, AlertTitle } from "../src/components/ui/alert";
import { fieldErrorTextClass } from "../src/components/ui/field";
import { ConfirmVaultDeleteDialog } from "../src/components/Vault/ConfirmVaultDeleteDialog";
import { readCssInlined } from "./read-css.ts";

const globalsCss = readCssInlined(resolve(__dirname, "..", "src/styles/globals.css"));
const rootBlock = /:root\s*\{([^}]+)\}/s.exec(globalsCss)?.[1] ?? "";
const darkBlock = /\.dark\s*\{([^}]+)\}/s.exec(globalsCss)?.[1] ?? "";

const classesOf = (element: Element) => element.className.split(/\s+/).filter(Boolean);

/** A token's value in a theme; the dark block only restates what differs from `:root`. */
function token(name: string, theme: "light" | "dark"): string {
  const blocks = theme === "dark" ? [darkBlock, rootBlock] : [rootBlock];
  for (const block of blocks) {
    const value = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(block)?.[1];
    if (value) return value;
  }
  throw new Error(`--${name} is not a hex colour in the ${theme} theme`);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function renderAlerts() {
  return render(
    <>
      <Alert variant="default" data-testid="default">
        <Info className="size-4" data-testid="default-icon" />
        <AlertTitle>Default Alert</AlertTitle>
        <AlertDescription>A standard callout.</AlertDescription>
      </Alert>
      <Alert variant="destructive" data-testid="destructive">
        <AlertCircle className="size-4" data-testid="destructive-icon" />
        <AlertTitle>Error Alert</AlertTitle>
        <AlertDescription>Something went wrong.</AlertDescription>
      </Alert>
    </>,
  );
}

describe("Alert destructive variant", () => {
  it("takes its text colour from the pair FormMessage uses, not from the fill token", () => {
    renderAlerts();
    const root = classesOf(screen.getByTestId("destructive"));

    for (const className of fieldErrorTextClass.split(" ")) {
      expect(root).toContain(className);
    }
    // `text-destructive` is 3.8:1 on white and 2.0:1 on the dark page: a fill, not a text colour.
    expect(root).not.toContain("text-destructive");
    expect(root).not.toContain("dark:text-destructive");
  });

  it("clears 4.5:1 for text on the page in both themes", () => {
    renderAlerts();
    const root = classesOf(screen.getByTestId("destructive"));
    const light = /^text-\[var\(--(destructive-\d+)\)\]$/.exec(
      root.find((c) => c.startsWith("text-[var(")) ?? "",
    )?.[1];
    const dark = /^dark:text-\[var\(--(destructive-\d+)\)\]$/.exec(
      root.find((c) => c.startsWith("dark:text-[var(")) ?? "",
    )?.[1];

    expect(light).toBeDefined();
    expect(dark).toBeDefined();
    expect(contrast(token(light!, "light"), token("background", "light"))).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrast(token(dark!, "dark"), token("background", "dark"))).toBeGreaterThanOrEqual(4.5);
  });

  it("leaves the title and description to inherit the alert's colour", () => {
    renderAlerts();

    for (const text of ["Error Alert", "Something went wrong."]) {
      const ownColour = classesOf(screen.getByText(text)).filter(
        (c) => /^(dark:)?text-/.test(c) && c !== "text-sm",
      );
      expect(ownColour).toEqual([]);
    }
  });

  it("colours the icon with the text instead of the fill token", () => {
    renderAlerts();
    const root = classesOf(screen.getByTestId("destructive"));

    expect(root).toContain("[&>svg]:text-current");
    // Neither the default variant's foreground nor the fill colour survives the merge.
    expect(root).not.toContain("[&>svg]:text-foreground");
    expect(root).not.toContain("[&>svg]:text-destructive");
  });

  it("keeps the border behaviour", () => {
    renderAlerts();
    const root = classesOf(screen.getByTestId("destructive"));

    expect(root).toContain("border-destructive/50");
    expect(root).toContain("dark:border-destructive");
  });

  it("keeps the font size next to the colour when a caller adds classes", () => {
    render(
      <Alert variant="destructive" className="mt-2" data-testid="alert">
        Body
      </Alert>,
    );
    const root = classesOf(screen.getByTestId("alert"));

    expect(root).toContain("text-sm");
    expect(root).toContain("mt-2");
    for (const className of fieldErrorTextClass.split(" ")) {
      expect(root).toContain(className);
    }
  });

  it("reaches the vault dialogs that use it", () => {
    render(
      <ConfirmVaultDeleteDialog
        open
        onClose={() => {}}
        onConfirm={() => {}}
        projectName="Alpha"
        error="The pull request could not be created."
      />,
    );
    const error = screen.getByTestId("confirm-vault-delete-dialog-error");

    for (const className of fieldErrorTextClass.split(" ")) {
      expect(classesOf(error)).toContain(className);
    }
    expect(classesOf(error)).not.toContain("text-destructive");
  });
});

describe("Alert default variant", () => {
  it("is unchanged: foreground text and a foreground icon on the page background", () => {
    renderAlerts();
    const root = classesOf(screen.getByTestId("default"));

    expect(root).toContain("bg-background");
    expect(root).toContain("text-foreground");
    expect(root).toContain("[&>svg]:text-foreground");
    expect(root).not.toContain("[&>svg]:text-current");
    for (const className of fieldErrorTextClass.split(" ")) {
      expect(root).not.toContain(className);
    }
  });
});
