import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

describe("README Catalog Section Structure", () => {
  // Use dirname + fileURLToPath instead of new URL(..., import.meta.url) because
  // Vite rewrites new URL() expressions in a way that breaks path resolution in tests
  const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const readmePath = resolve(rootDir, "README.md");
  const readmeContent = readFileSync(readmePath, "utf8");
  const lines = readmeContent.split("\n");

  const catalogLabels = [
    "Foundation",
    "UI Primitives",
    "Renderers",
    "Tendril Shell",
    "Tendril Widgets",
    "Inputs & Controls",
    "Specialized Components",
  ];

  it("has exactly one Visual Catalog Structure heading", () => {
    const catalogHeadings = lines.filter((line) => line.trim() === "### Visual Catalog Structure");
    expect(catalogHeadings).toHaveLength(1);
  });

  it("has catalog bullets directly under the Visual Catalog Structure heading", () => {
    const catalogHeadingIndex = lines.findIndex(
      (line) => line.trim() === "### Visual Catalog Structure",
    );
    expect(catalogHeadingIndex).toBeGreaterThan(-1);

    // Find the next H2/H3/H4 heading after the catalog heading
    const nextHeadingIndex = lines.findIndex(
      (line, idx) => idx > catalogHeadingIndex && /^#{2,4} /.test(line),
    );
    expect(nextHeadingIndex).toBeGreaterThan(catalogHeadingIndex);

    const catalogSection = lines.slice(catalogHeadingIndex, nextHeadingIndex);

    // The section should contain the intro sentence
    const hasIntro = catalogSection.some((line) =>
      line.includes("The Storybook catalog is organized into the following sections:"),
    );
    expect(hasIntro).toBe(true);

    // The section should contain exactly 7 bullets starting with "- **"
    const bullets = catalogSection.filter((line) => line.startsWith("- **"));
    expect(bullets).toHaveLength(7);

    // Each catalog label should appear in the section
    for (const label of catalogLabels) {
      const hasLabel = catalogSection.some((line) => line.includes(label));
      if (!hasLabel) {
        throw new Error(
          `Catalog label "${label}" not found in Visual Catalog Structure section. ` +
            `The bullets may have drifted out of their section.`,
        );
      }
    }
  });

  it("has no catalog bullets orphaned between CI heading and Development heading", () => {
    const ciHeadingIndex = lines.findIndex((line) => line.trim() === "#### CI");
    const devHeadingIndex = lines.findIndex(
      (line) => line.trim() === "## Development & Quality Gates",
    );

    expect(ciHeadingIndex).toBeGreaterThan(-1);
    expect(devHeadingIndex).toBeGreaterThan(ciHeadingIndex);

    const betweenSection = lines.slice(ciHeadingIndex, devHeadingIndex);
    const orphanedBullets = betweenSection.filter((line) => {
      if (!line.startsWith("- **")) return false;
      return catalogLabels.some((label) => line.includes(label));
    });

    if (orphanedBullets.length > 0) {
      throw new Error(
        `Found ${orphanedBullets.length} catalog bullet(s) orphaned between "#### CI" and "## Development & Quality Gates". ` +
          `The Visual Catalog Structure bullets have drifted out of their section.`,
      );
    }

    expect(orphanedBullets).toHaveLength(0);
  });
});

describe("README visual regression opt-outs", () => {
  const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const readme = readFileSync(resolve(rootDir, "README.md"), "utf8");

  // The list the README keeps of stories left out of the screenshot pass, up to the sentence after it.
  const listStart = readme.indexOf("Currently opted out");
  const listEnd = readme.indexOf("Animated stories do **not**", listStart);
  const optOutList = listStart === -1 || listEnd === -1 ? "" : readme.slice(listStart, listEnd);

  function storyFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return storyFiles(path);
      return /\.stories\.(?:js|jsx|mjs|ts|tsx)$/.test(entry.name) ? [path] : [];
    });
  }

  // `visual: { disable: true }` on one line or several, in the meta or in a story or in a const that
  // a story spreads in. An `a11y: { disable: true }` is a different opt-out and does not match.
  const VISUAL_DISABLE = /\bvisual:\s*\{[^{}]*?\bdisable:\s*true\b/;
  // Titles are hierarchical ("UI/Calendar"), which is what tells the meta's apart from other `title`s.
  // The last segment may hold spaces ("Patterns/Auth forms").
  const META_TITLE = /\btitle:\s*["'`]([A-Za-z]+\/[A-Za-z][A-Za-z ]*)["'`]/;

  const optedOut = new Map<string, string>();
  for (const file of storyFiles(join(rootDir, "src"))) {
    const source = readFileSync(file, "utf8");
    if (!VISUAL_DISABLE.test(source)) continue;
    optedOut.set(META_TITLE.exec(source)?.[1] ?? `(no title) ${relative(rootDir, file)}`, file);
  }

  it("finds the list and at least one opted-out story file", () => {
    expect(optOutList).not.toBe("");
    expect(optedOut.size).toBeGreaterThan(0);
  });

  it("names every story title that sets parameters.visual.disable", () => {
    const missing = [...optedOut.keys()].filter((title) => !optOutList.includes(`\`${title}\``));
    // Each missing title sets `visual: { disable: true }` on the meta or on a story. Add it to the
    // "Currently opted out" list in the README, under the reason it is left out.
    expect(missing).toEqual([]);
  });

  it("names no title that no longer opts out", () => {
    const named = [...optOutList.matchAll(/`([A-Z][A-Za-z]*\/[A-Za-z][A-Za-z ]*)`/g)].map(
      (match) => match[1],
    );
    const stale = named.filter((title) => !optedOut.has(title));
    expect(stale).toEqual([]);
  });
});
