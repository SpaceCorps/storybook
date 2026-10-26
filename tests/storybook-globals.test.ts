import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("axe-playwright", () => ({
  injectAxe: vi.fn().mockResolvedValue(undefined),
  configureAxe: vi.fn().mockResolvedValue(undefined),
  checkA11y: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@storybook/test-runner", () => ({
  getStoryContext: vi.fn().mockImplementation((_page, context) => {
    return Promise.resolve(context);
  }),
  waitForPageReady: vi.fn().mockResolvedValue(undefined),
}));

import { readStoryGlobals } from "../.storybook/globals";
import testRunnerConfig from "../.storybook/test-runner";
import previewConfig from "../.storybook/preview";

describe("Storybook Globals Typing", () => {
  describe("readStoryGlobals", () => {
    it("returns empty object for empty input", () => {
      expect(readStoryGlobals({})).toEqual({});
    });

    it("returns empty object for undefined globals", () => {
      expect(readStoryGlobals({ globals: undefined })).toEqual({});
    });

    it("returns empty object for undefined input", () => {
      expect(readStoryGlobals(undefined)).toEqual({});
    });

    it("returns the globals object unchanged for valid input", () => {
      const globals = { theme: "dark" as const, density: "Small" as const };
      expect(readStoryGlobals({ globals })).toEqual(globals);
    });
  });

  describe("test-runner postVisit with visual regression", () => {
    const originalEnv = process.env.STORYBOOK_VISUAL_REGRESSION;

    afterEach(() => {
      process.env.STORYBOOK_VISUAL_REGRESSION = originalEnv;
      vi.clearAllMocks();
    });

    it("generates snapshot identifier with custom theme and density", async () => {
      process.env.STORYBOOK_VISUAL_REGRESSION = "true";

      const mockImage = Buffer.from("fake-image");
      const mockRootElement = {
        screenshot: vi.fn().mockResolvedValue(mockImage),
      };
      const mockPage = {
        $: vi.fn().mockResolvedValue(mockRootElement),
        addStyleTag: vi.fn().mockResolvedValue(undefined),
        waitForTimeout: vi.fn().mockResolvedValue(undefined),
      } as any;

      const mockMatcher = vi.fn();
      (global as any).expect = Object.assign(
        (_value: any) => ({
          toMatchImageSnapshot: mockMatcher,
        }),
        expect,
      );

      const mockContext = {
        id: "button--primary",
        parameters: {},
        globals: { theme: "dark", density: "Small" },
      };

      if (testRunnerConfig.postVisit) {
        await testRunnerConfig.postVisit(mockPage, mockContext as any);
      }

      expect(mockMatcher).toHaveBeenCalledWith({
        customSnapshotsDir: expect.stringContaining("__image_snapshots__"),
        customSnapshotIdentifier: "button--primary-dark-small",
        customDiffDir: expect.stringContaining("__diff_output__"),
        failureThreshold: 0.01,
        failureThresholdType: "percent",
      });
    });

    it("uses default light theme and medium density when globals are absent", async () => {
      process.env.STORYBOOK_VISUAL_REGRESSION = "true";

      const mockImage = Buffer.from("fake-image");
      const mockRootElement = {
        screenshot: vi.fn().mockResolvedValue(mockImage),
      };
      const mockPage = {
        $: vi.fn().mockResolvedValue(mockRootElement),
        addStyleTag: vi.fn().mockResolvedValue(undefined),
        waitForTimeout: vi.fn().mockResolvedValue(undefined),
      } as any;

      const mockMatcher = vi.fn();
      (global as any).expect = Object.assign(
        (_value: any) => ({
          toMatchImageSnapshot: mockMatcher,
        }),
        expect,
      );

      const mockContext = {
        id: "button--secondary",
        parameters: {},
      };

      if (testRunnerConfig.postVisit) {
        await testRunnerConfig.postVisit(mockPage, mockContext as any);
      }

      expect(mockMatcher).toHaveBeenCalledWith({
        customSnapshotsDir: expect.stringContaining("__image_snapshots__"),
        customSnapshotIdentifier: "button--secondary-light-medium",
        customDiffDir: expect.stringContaining("__diff_output__"),
        failureThreshold: 0.01,
        failureThresholdType: "percent",
      });
    });
  });

  describe("preview decorator with globals", () => {
    it("renders with dark theme and small density", () => {
      const decorators = previewConfig.decorators;
      expect(decorators).toBeDefined();
      expect(Array.isArray(decorators)).toBe(true);

      if (Array.isArray(decorators) && decorators.length > 0) {
        const decorator = decorators[0] as any;
        const MockStory = () => null;
        const context = {
          globals: { theme: "dark", density: "Small" },
        };

        const result = decorator(MockStory, context);
        expect(result).toBeDefined();
      }
    });

    it("renders with default light theme and medium density when globals are absent", () => {
      const decorators = previewConfig.decorators;
      expect(decorators).toBeDefined();
      expect(Array.isArray(decorators)).toBe(true);

      if (Array.isArray(decorators) && decorators.length > 0) {
        const decorator = decorators[0] as any;
        const MockStory = () => null;
        const context = {};

        const result = decorator(MockStory, context);
        expect(result).toBeDefined();
      }
    });
  });
});

/**
 * Storybook 8.6 honours a theme set in a story's own `globals` entry and ignores `parameters.globals`
 * (it logs "Global args/argTypes can only be set globally" instead). A story that asked for dark the
 * ignored way renders light, and the Tab sweep in the test runner, which sweeps whatever theme the
 * page is in, would then check the light theme twice. Pairs of story file and the line it sits on.
 */
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

/** `globals: {` entries that sit directly inside a `parameters` object, as `file:line`. */
function findParameterGlobals(source: string, file: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/\bglobals\s*:\s*\{/g)) {
    // Walk back to the brace of the object this entry is a key of.
    let depth = 0;
    let open = -1;
    for (let i = match.index! - 1; i >= 0; i -= 1) {
      if (source[i] === "}") {
        depth += 1;
      } else if (source[i] === "{") {
        if (depth === 0) {
          open = i;
          break;
        }
        depth -= 1;
      }
    }
    const owner = /(\w+)\s*:\s*$/.exec(source.slice(0, Math.max(open, 0)))?.[1];
    if (owner === "parameters") {
      found.push(`${file}:${source.slice(0, match.index).split("\n").length}`);
    }
  }
  return found;
}

/**
 * Stories known to ask for a theme through `parameters.globals`. Each says why it is left: the entry
 * is a bug that only the toolbar and `<html>` feel, because the story wraps itself in its own theme.
 */
const PARAMETER_GLOBALS_ALLOWLIST: ReadonlyArray<{ file: string; reason: string }> = [
  {
    file: "src/stories/typography.stories.tsx",
    reason:
      "DarkMode and LightMode wrap their content in their own .dark / light div, so the page looks as meant; only <html> stays light. For the story's owner to move to a story-level globals entry.",
  },
];

describe("stories ask for their theme in a way Storybook honours", () => {
  const stories = readdirSync(srcDir, { recursive: true, encoding: "utf8" })
    .map((relative) => relative.replaceAll("\\", "/"))
    .filter((relative) => /\.stories\.tsx?$/.test(relative));
  const misuse = stories.flatMap((relative) =>
    findParameterGlobals(readFileSync(path.join(srcDir, relative), "utf8"), `src/${relative}`),
  );
  const unexpected = misuse.filter(
    (site) => !PARAMETER_GLOBALS_ALLOWLIST.some((entry) => site.startsWith(`${entry.file}:`)),
  );

  it("finds a globals entry inside parameters, and only there", () => {
    const wrong = "export const A = {\n  parameters: {\n    globals: { theme: 'dark' },\n  },\n};";
    expect(findParameterGlobals(wrong, "a.tsx")).toEqual(["a.tsx:3"]);

    const wrongNested =
      "export const A = {\n  parameters: { a11y: { x: 1 }, globals: { theme: 'dark' } },\n};";
    expect(findParameterGlobals(wrongNested, "a.tsx")).toEqual(["a.tsx:2"]);

    const right = "export const A = {\n  globals: { theme: 'dark' },\n  parameters: { x: 1 },\n};";
    expect(findParameterGlobals(right, "a.tsx")).toEqual([]);

    const prose = "/** Storybook ignores `parameters.globals`. */\nexport const A = {};";
    expect(findParameterGlobals(prose, "a.tsx")).toEqual([]);
  });

  it("reads a meaningful number of stories", () => {
    expect(stories.length).toBeGreaterThan(50);
  });

  it("has no story that sets its theme through parameters.globals", () => {
    expect(
      unexpected,
      "use a story-level `globals: { theme }` entry, and say so with a play function that checks <html>",
    ).toEqual([]);
  });

  it("keeps the allowlist honest: every entry is explained and still needed", () => {
    for (const entry of PARAMETER_GLOBALS_ALLOWLIST) {
      expect(entry.reason.trim().length, entry.file).toBeGreaterThan(10);
      expect(
        misuse.some((site) => site.startsWith(`${entry.file}:`)),
        `${entry.file} no longer sets parameters.globals; remove it`,
      ).toBe(true);
    }
  });

  it("is satisfied by the Keyboard stories, whose Dark story sets its theme the honoured way", () => {
    const source = readFileSync(path.join(srcDir, "stories", "keyboard.stories.tsx"), "utf8");
    expect(findParameterGlobals(source, "keyboard.stories.tsx")).toEqual([]);
    expect(source).toMatch(/export const Dark[\s\S]*?\n\s+globals: \{ theme: "dark" \}/);
    expect(source).toContain('classList.contains("dark")');
  });
});
