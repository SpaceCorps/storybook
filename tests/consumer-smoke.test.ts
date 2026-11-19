import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

// Import from built dist artifact to test consumer behavior
import {
  WorkbenchShell,
  PlanMarkdown,
  PlanDiffView,
  AgentViewer,
  ProcessViewer,
  ContentInput,
  BadgeSelect,
  SortableVerificationList,
  AgentDashboard,
  QuestionsPanel,
} from "../dist/workbench.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("Consumer Smoke Verification", () => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"));

  // `pnpm pack` runs this package's `prepare` script (`vp config` + the tsgolint patch), so the
  // subprocess routinely takes longer than the 5s default timeout. Give it a generous budget.
  it("verifies package packing succeeds with pnpm pack", () => {
    const packOutput = execSync("pnpm pack --dry-run", {
      cwd: repoRoot,
      encoding: "utf-8",
    });
    expect(packOutput).toContain("@spacecorps/components");
    expect(packOutput).toContain("dist/style.css");
    expect(packOutput).toContain("dist/workbench.mjs");
    expect(packOutput).toContain("dist/workbench.d.mts");
  }, 60_000);

  it("verifies all declared export map targets exist on disk", () => {
    const exportsMap = packageJson.exports as Record<
      string,
      string | { import?: string; types?: string }
    >;

    expect(exportsMap["."]).toBeDefined();
    expect(exportsMap["./workbench"]).toBeDefined();
    expect(exportsMap["./ui"]).toBeDefined();
    expect(exportsMap["./renderers"]).toBeDefined();
    expect(exportsMap["./style.css"]).toBeDefined();

    const expectedFiles = [
      "dist/index.mjs",
      "dist/index.d.mts",
      "dist/workbench.mjs",
      "dist/workbench.d.mts",
      "dist/ui.mjs",
      "dist/ui.d.mts",
      "dist/renderers.mjs",
      "dist/renderers.d.mts",
      "dist/style.css",
    ];

    for (const file of expectedFiles) {
      const fullPath = join(repoRoot, file);
      expect(existsSync(fullPath), `Expected ${file} to exist on disk`).toBe(true);
      const stats = statSync(fullPath);
      expect(stats.size).toBeGreaterThan(0);
    }
  });

  it("verifies dist/style.css contains essential design tokens", () => {
    const cssContent = readFileSync(join(repoRoot, "dist/style.css"), "utf-8");
    expect(cssContent.length).toBeGreaterThan(1000);
    expect(cssContent).toContain("--primary");
    expect(cssContent).toContain("--font-sans");
    expect(cssContent).toContain("--font-mono");
  });

  describe("Smoke renders SpaceCorps widgets from built artifact", () => {
    const noopHandler = () => {};

    it("renders WorkbenchShell", () => {
      const { container } = render(
        React.createElement(WorkbenchShell, {
          id: "smoke-shell",
          eventHandler: noopHandler,
          slots: {
            Content: React.createElement("div", null, "Shell Content"),
          },
        }),
      );
      expect(container.querySelector(".tsh-root, [class*='tsh-']")).not.toBeNull();
    });

    it("renders PlanMarkdown", () => {
      const { container } = render(
        React.createElement(PlanMarkdown, {
          id: "smoke-markdown",
          content: "# Smoke Header\n\nSmoke paragraph content.",
        }),
      );
      expect(container.querySelector(".pmv-markdown, .pmv-root")).not.toBeNull();
      expect(container.textContent).toContain("Smoke Header");
    });

    it("renders PlanDiffView", () => {
      const { container } = render(
        React.createElement(PlanDiffView, {
          id: "smoke-diff",
          diff: "--- a/test.txt\n+++ b/test.txt\n@@ -1 +1 @@\n-old\n+new\n",
        }),
      );
      expect(container.querySelector(".diff, [class*='diff']")).not.toBeNull();
    });

    it("renders AgentViewer", () => {
      const { container } = render(
        React.createElement(AgentViewer, {
          id: "smoke-agent",
          eventHandler: noopHandler,
          events: [],
        }),
      );
      expect(container.querySelector(".aov-root, [class*='aov-']")).not.toBeNull();
    });

    it("renders ProcessViewer", () => {
      const { container } = render(
        React.createElement(ProcessViewer, {
          id: "smoke-process",
          eventHandler: noopHandler,
        }),
      );
      expect(container).not.toBeNull();
    });

    it("renders ContentInput", () => {
      const { container } = render(
        React.createElement(ContentInput, {
          id: "smoke-input",
        }),
      );
      expect(container.querySelector(".content-input, textarea, input")).not.toBeNull();
    });

    it("renders BadgeSelect", () => {
      const { container } = render(
        React.createElement(BadgeSelect, {
          id: "smoke-badge-select",
          options: [{ label: "Choice A", value: "a" }],
        }),
      );
      expect(container.querySelector(".bselect, [class*='bselect']")).not.toBeNull();
    });

    it("renders SortableVerificationList", () => {
      const { container } = render(
        React.createElement(SortableVerificationList, {
          id: "smoke-verifications",
          itemsJson: "[]",
        }),
      );
      expect(container.querySelector(".svl-container, [class*='svl-']")).not.toBeNull();
    });

    it("renders AgentDashboard", () => {
      const { container } = render(
        React.createElement(AgentDashboard, {
          id: "smoke-dashboard",
          eventHandler: noopHandler,
          greeting: "Hello SpaceCorps",
        }),
      );
      expect(container.querySelector(".tdb-dashboard, [class*='tdb-']")).not.toBeNull();
      expect(container.textContent).toContain("Hello SpaceCorps");
    });

    it("renders QuestionsPanel", () => {
      const { container } = render(
        React.createElement(QuestionsPanel, {
          id: "smoke-questions",
          eventHandler: noopHandler,
          content: "- id: q1\n  title: Proceed?\n  options:\n    - title: Yes\n      value: yes",
        }),
      );
      expect(container.querySelector(".tq-root, [class*='tq-']")).not.toBeNull();
      expect(container.textContent).toContain("Proceed?");
    });
  });
});
