import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vite-plus/test";
import { CollapsedRail, FullAppShell } from "../src/components/Shell/TendrilShell.stories.tsx";
import {
  ReorderableVerificationList,
  WithStatusBadges,
} from "../src/components/SortableVerificationList/SortableVerificationList.stories.tsx";
import { composite, contrast, declaration, evaluate, ruleBody, valueFor } from "./css-color.ts";
import type { Rgba, Theme } from "./css-color.ts";

// The dark theme's text colours that CI never sees: the test runner visits stories in light, so a
// failure that only shows in dark reaches the app first. jsdom paints nothing, so this reads the
// authored stylesheets and evaluates each text colour against the surface it sits on, in both themes,
// with the token values from tokens.css. The ratios match what a canvas helper measured in Edge, on the
// rendered stories and on injected markup for the states no story shows. Axe is not a second opinion
// on all of them: where it cannot resolve a background it says `incomplete`, which CI does not fail.

const read = (path: string) => readFileSync(resolve(__dirname, "..", path), "utf-8");
const markdownCss = read("src/components/PlanMarkdown/plan-markdown.css");
const diffCss = read("src/components/PlanDiffView/plan-diff.css");

const THEMES: Theme[] = ["light", "dark"];
const AA = 4.5;

/** The colour `property` resolves to on `selector` in a theme. */
function colorOf(css: string, selector: string, theme: Theme, property = "color"): Rgba {
  const value = valueFor(css, selector, property, theme);
  if (value === undefined) throw new Error(`${selector} sets no ${property}`);
  return evaluate(value, theme);
}

/** A surface token, then each selector's own fill painted over it, as the cascade stacks them. */
function surface(css: string, theme: Theme, base: string, selectors: string[]): Rgba {
  let under = evaluate(`var(${base})`, theme);
  for (const selector of selectors) {
    const fill =
      valueFor(css, selector, "background", theme) ??
      valueFor(css, selector, "background-color", theme);
    if (fill !== undefined) under = composite(evaluate(fill, theme), under);
  }
  return under;
}

const KINDS = ["note", "tip", "important", "warning", "caution"] as const;

describe("PlanMarkdown alerts", () => {
  describe.each(THEMES)("%s theme", (theme) => {
    it.each(KINDS)("the %s title and icon read at AA on the alert's own tint", (kind) => {
      const tint = surface(markdownCss, theme, "--background", [`.pmv-alert--${kind}`]);
      const title = colorOf(markdownCss, `.pmv-alert--${kind} .pmv-alert-header`, theme);

      expect(title[3]).toBe(1);
      expect(contrast(title, tint)).toBeGreaterThanOrEqual(AA);
    });
  });

  // `--border` is a translucent mix of `--foreground`; a colour mixed into it is translucent too and
  // takes on whatever sits behind the alert. The rule has to be the same opaque line it always was.
  describe.each(THEMES)("%s theme borders", (theme) => {
    const FORMER_BORDER: Record<Theme, string> = { light: "#e4e4e7", dark: "#27272a" };
    const alertRule = ruleBody(markdownCss, ".pmv-alert") ?? "";
    const scope = { "--pmv-alert-rule": declaration(alertRule, "--pmv-alert-rule") ?? "" };

    it("derives the shared rule colour from --foreground and --background, not --border", () => {
      expect(scope["--pmv-alert-rule"]).toMatch(/--foreground/);
      expect(scope["--pmv-alert-rule"]).not.toMatch(/--border/);
    });

    it.each(KINDS)("draws the %s border opaque and as it was before the token rework", (kind) => {
      const value = valueFor(markdownCss, `.pmv-alert--${kind}`, "border-color", theme) ?? "";
      expect(value).not.toMatch(/--border/);

      const border = evaluate(value, theme, scope);
      const former = evaluate(value.replace("var(--pmv-alert-rule)", FORMER_BORDER[theme]), theme);

      expect(border[3]).toBe(1);
      for (const channel of [0, 1, 2]) {
        // A few levels of 255 apart at most: the old grey was a hex, the new one is a 12% mix.
        expect(Math.abs(border[channel] - former[channel])).toBeLessThanOrEqual(6);
      }
    });
  });
});

type TextCase = {
  name: string;
  css: string;
  text: string;
  /** Overrides the colour read from `text`, for text that inherits its colour. */
  inherited?: string;
  base: string;
  on: string[];
  min?: number;
};

const TEXT_CASES: TextCase[] = [
  {
    name: "annotation popover Delete button",
    css: markdownCss,
    text: ".pmv-popover-btn--danger",
    base: "--popover",
    on: [],
  },
  {
    name: "annotation popover Delete button, hovered",
    css: markdownCss,
    text: ".pmv-popover-btn--danger",
    base: "--popover",
    on: [".pmv-popover-btn--danger:hover"],
  },
  {
    name: "annotation popover Resolve button",
    css: markdownCss,
    text: ".pmv-popover-btn--success",
    base: "--popover",
    on: [".pmv-popover-btn--success"],
  },
  {
    name: "annotation popover Resolve button, hovered",
    css: markdownCss,
    text: ".pmv-popover-btn--success",
    base: "--popover",
    on: [".pmv-popover-btn--success:hover"],
  },
  {
    name: "resolved badge",
    css: markdownCss,
    text: ".pmv-resolved-badge",
    base: "--popover",
    on: [".pmv-resolved-badge"],
  },
  {
    name: "diagram error message",
    css: markdownCss,
    text: ".pmv-diagram-error",
    base: "--background",
    on: [".pmv-diagram-error"],
  },
  {
    name: "broken image message",
    css: markdownCss,
    text: ".pmv-img-error",
    // The box sets no usable colour of its own (`--text-secondary` is declared nowhere), so the text
    // is the page's.
    inherited: "var(--foreground)",
    base: "--background",
    on: [".pmv-img-error"],
  },
  {
    name: "broken image icon",
    css: markdownCss,
    text: ".pmv-img-error svg",
    base: "--background",
    on: [".pmv-img-error"],
    min: 3,
  },
  {
    name: "recommended question pill",
    css: markdownCss,
    text: ".pmv-question-option-recommended",
    base: "--background",
    on: [".pmv-questions", ".pmv-question-option-recommended"],
  },
  {
    name: "question Clear button, hovered",
    css: markdownCss,
    text: ".pmv-question-clear:hover",
    base: "--background",
    on: [".pmv-questions", ".pmv-question-clear:hover"],
  },
  {
    name: "current search match",
    css: markdownCss,
    text: ".pmv-search-highlight--active",
    base: "--background",
    on: [".pmv-search-highlight--active"],
  },
  // The line numbers are plain text in `td.diff-gutter`, yet axe never fails them: the cell's `::after`
  // (the hover plus button) stops it resolving the background, so it reports them `incomplete` ("could
  // not be determined due to a pseudo element"). The old colours passed CI with 0 violations; this
  // stylesheet check is the only thing that can go red on them.
  {
    name: "added line number",
    css: diffCss,
    text: ".diff-gutter-insert",
    base: "--background",
    on: [".diff-gutter-insert"],
  },
  {
    name: "removed line number",
    css: diffCss,
    text: ".diff-gutter-delete",
    base: "--background",
    on: [".diff-gutter-delete"],
  },
];

describe("plan stylesheet text that is not a story's default state", () => {
  describe.each(THEMES)("%s theme", (theme) => {
    it.each(TEXT_CASES)("$name reads on its surface", (entry) => {
      const text =
        entry.inherited === undefined
          ? colorOf(entry.css, entry.text, theme)
          : evaluate(entry.inherited, theme);
      const under = surface(entry.css, theme, entry.base, entry.on);

      expect(contrast(text, under)).toBeGreaterThanOrEqual(entry.min ?? AA);
    });
  });
});

// Stories that set a text colour inline have no stylesheet to read, and a hex written for the light
// page is what failed on the dark one: #666 is 3.5:1 on the dark page, #15803d 4.0:1.
type StoryExport = { render?: unknown } | ComponentType;

/** The elements of a rendered story that carry the colour under test. */
type Select = (container: HTMLElement) => HTMLElement[];

const withInlineColor: Select = (container) =>
  [...container.querySelectorAll<HTMLElement>("[style]")].filter((element) =>
    /(?:^|;)\s*color:/.test(element.getAttribute("style") ?? ""),
  );

// The shell draws its own coloured chrome; only the demo paragraph in the content area is the story's.
const shellDemoParagraph: Select = (container) =>
  [...container.querySelectorAll<HTMLElement>("p")].filter((element) =>
    element.textContent?.includes("sidebar toggle button"),
  );

const STORIES: { name: string; story: StoryExport; select: Select; found: number }[] = [
  {
    name: "TendrilShell / Full App Shell",
    story: FullAppShell,
    select: shellDemoParagraph,
    found: 1,
  },
  {
    name: "TendrilShell / Collapsed Rail",
    story: CollapsedRail,
    select: shellDemoParagraph,
    found: 1,
  },
  {
    name: "SortableVerificationList / Reorderable Verification List",
    story: ReorderableVerificationList,
    select: withInlineColor,
    found: 1,
  },
  {
    name: "SortableVerificationList / With Status Badges",
    story: WithStatusBadges,
    select: withInlineColor,
    found: 4,
  },
];

function renderStory(story: StoryExport) {
  const Story = (typeof story === "function" ? story : story.render) as ComponentType;
  return render(createElement(Story));
}

describe("story text colours set inline", () => {
  describe.each(THEMES)("%s theme", (theme) => {
    it.each(STORIES)("$name reads on the page", ({ story, select, found }) => {
      const elements = select(renderStory(story).container);

      // Guards the guard: a selector that stops matching would otherwise pass for free.
      expect(elements.length).toBeGreaterThanOrEqual(found);
      for (const element of elements) {
        // No inline colour means the page's own text colour, which is the one thing that always reads.
        const value =
          /(?:^|;)\s*color:\s*([^;]+)/.exec(element.getAttribute("style") ?? "")?.[1] ??
          "var(--foreground)";
        expect(
          contrast(evaluate(value, theme), evaluate("var(--background)", theme)),
        ).toBeGreaterThanOrEqual(AA);
      }
    });
  });
});
