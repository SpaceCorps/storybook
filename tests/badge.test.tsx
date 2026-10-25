import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { Badge } from "../src/components/ui/badge";
import { badgeVariant } from "../src/components/ui/badge/variant";
import { readCssInlined } from "./read-css.ts";

const css = readCssInlined(resolve(__dirname, "..", "src/styles/globals.css"));
const rootBlock = /:root\s*\{([^}]+)\}/s.exec(css)?.[1] ?? "";

const VARIANTS = ["primary", "secondary", "destructive", "outline", "success", "warning", "info"];

function declaration(name: string): string | undefined {
  return new RegExp(`--${name}:s*([^;]+);`).exec(rootBlock)?.[1].trim();
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe("badgeVariant status tints", () => {
  const classes = VARIANTS.map((variant) => badgeVariant({ variant: variant as never }));

  it("only reaches for custom properties that a stylesheet declares", () => {
    // A `bg-[var(--missing)]` resolves to transparent, which is how every status badge once went
    // invisible. Reading the used names off the generated classes keeps this honest as variants grow.
    const used = new Set(
      classes.flatMap((cls) => [...cls.matchAll(/var\(--([\w-]+)\)/g)]).map((m) => m[1]),
    );
    expect(used.size).toBeGreaterThan(0);
    for (const name of used) {
      expect(declaration(name), `--${name} is used by badgeVariant but not declared`).toBeDefined();
    }
  });

  it.each(["success", "warning", "info", "destructive", "ivy-green"])(
    "%s is readable in light (800 on 200) and dark (100 on 800)",
    (scale) => {
      const [s100, s200, s800] = ["100", "200", "800"].map((step) =>
        declaration(`${scale}-${step}`)!,
      );
      expect(contrast(s800, s200)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(s100, s800)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("keeps the label on one line", () => {
    render(<Badge variant="secondary">excl. VAT</Badge>);
    expect(screen.getByText("excl. VAT").className).toContain("whitespace-nowrap");
  });
});
