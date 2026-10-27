import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

/**
 * Tests for the Tab sweep in .storybook/test-runner.ts, which a story opts into with
 * `parameters.keyboard = { sweep, maxStops, forcedColors }` (documented at the top of that file).
 *
 * Timing: vite.config.ts sets `test.testTimeout` to 20 s for EVERY suite, up from vitest's 5 s, because
 * a few other suites spawn tsx or drive Radix overlays on a loaded runner. Nothing here needs it (this
 * file runs in about two seconds), but a test in this file that hangs now takes 20 s to say so.
 */

vi.mock("axe-playwright", () => ({
  injectAxe: vi.fn().mockResolvedValue(undefined),
  configureAxe: vi.fn().mockResolvedValue(undefined),
  checkA11y: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@storybook/test-runner", () => ({
  getStoryContext: vi.fn().mockImplementation((_page, context) => Promise.resolve(context)),
  waitForPageReady: vi.fn().mockResolvedValue(undefined),
}));

import { checkA11y, configureAxe } from "axe-playwright";
import runnerConfig, {
  MIN_INDICATOR_CONTRAST,
  focusIndicator,
  focusIndicators,
  runKeyboardSweep,
  visibleEnough,
  type NodeSignature,
  type SweepStop,
} from "../.storybook/test-runner.ts";

/** A signature with nothing painted, overridden per case. */
function signature(overrides: Partial<NodeSignature> = {}): NodeSignature {
  return {
    shadow: "none",
    outlineStyle: "none",
    outlineWidth: "0px",
    outlineColor: "rgb(0, 0, 0)",
    ...overrides,
  };
}

const RING = "rgb(24, 24, 27) 0px 0px 0px 2px";
const OFFSET_AND_RING = "rgb(255, 255, 255) 0px 0px 0px 2px, rgb(24, 24, 27) 0px 0px 0px 4px";

describe("focusIndicator", () => {
  it("accepts a ring that appears on focus", () => {
    expect(focusIndicator([signature({ shadow: RING })], [signature()])).toContain("box-shadow");
    expect(focusIndicator([signature({ shadow: OFFSET_AND_RING })], [signature()])).not.toBeNull();
  });

  it("accepts an outline that appears on focus, including the browser's own", () => {
    const outline = {
      outlineStyle: "solid",
      outlineWidth: "2px",
      outlineColor: "rgb(0, 95, 204)",
    };
    expect(focusIndicator([signature(outline)], [signature()])).toContain("outline");
    expect(
      focusIndicator(
        [signature({ outlineStyle: "auto", outlineWidth: "1px", outlineColor: "rgb(16, 16, 16)" })],
        [signature()],
      ),
    ).toContain("outline");
  });

  it("rejects a control whose focused and blurred states look the same", () => {
    expect(focusIndicator([signature()], [signature()])).toBeNull();
  });

  it("rejects a flat shadow, which is what an unfocused control carries in Tailwind v4", () => {
    const flat = "rgba(0, 0, 0, 0) 0px 0px 0px 0px";
    expect(focusIndicator([signature({ shadow: flat })], [signature({ shadow: flat })])).toBeNull();
    expect(focusIndicator([signature({ shadow: `${flat}, ${flat}` })], [signature()])).toBeNull();
    expect(
      focusIndicator([signature({ shadow: "oklab(0 0 0 / 0) 0px 0px 0px 2px" })], [signature()]),
    ).toBeNull();
  });

  it("rejects a ring that was already there when the control was blurred", () => {
    expect(focusIndicator([signature({ shadow: RING })], [signature({ shadow: RING })])).toBeNull();
  });

  it("rejects an outline that is hidden, zero-width or transparent", () => {
    for (const hidden of [
      { outlineStyle: "none", outlineWidth: "2px", outlineColor: "rgb(0, 0, 0)" },
      { outlineStyle: "hidden", outlineWidth: "2px", outlineColor: "rgb(0, 0, 0)" },
      { outlineStyle: "solid", outlineWidth: "0px", outlineColor: "rgb(0, 0, 0)" },
      { outlineStyle: "solid", outlineWidth: "2px", outlineColor: "rgba(0, 0, 0, 0)" },
    ]) {
      expect(focusIndicator([signature(hidden)], [signature()])).toBeNull();
    }
  });

  it("rejects an outline that is painted but identical focused and blurred", () => {
    // What unconditional `outline-hidden` gives in forced-colors mode: a permanent 2px outline on
    // every item, which says nothing about which one has focus.
    const permanent = {
      outlineStyle: "solid",
      outlineWidth: "2px",
      outlineColor: "rgb(0, 0, 0)",
    };
    expect(focusIndicator([signature(permanent)], [signature(permanent)])).toBeNull();
    // The same outline in another colour is a change, which is what the system focus colour is.
    expect(
      focusIndicator(
        [signature({ ...permanent, outlineColor: "rgb(55, 0, 110)" })],
        [signature(permanent)],
      ),
    ).toContain("outline");
  });

  it("looks at the ancestors too, for a ring on a focus-within frame", () => {
    expect(
      focusIndicator([signature(), signature({ shadow: RING })], [signature(), signature()]),
    ).toContain("ancestor 1");
  });
});

const element = (id: number, name: string, indicator = true): SweepStop => ({
  kind: "element",
  id,
  element: { tag: "button", name },
  focused: [signature(indicator ? { shadow: RING } : {})],
  blurred: [signature()],
});

interface SweepPageOptions {
  /** The theme the page reports it is in; unset leaves the question unanswered, like an old page. */
  theme?: "light" | "dark";
  /** Answers the page-side contrast call, given the [foreground, background] pairs it was asked about. */
  contrast?: (pairs: string[][]) => Array<number | null>;
}

/** A page that answers the sweep's calls from a script of stops, in order. */
function createSweepPage(stops: SweepStop[], options: SweepPageOptions = {}) {
  let next = 0;
  const log: string[] = [];
  const page = {
    keyboard: {
      press: vi.fn().mockImplementation(async (key: string) => {
        log.push(`press:${key}`);
      }),
    },
    evaluate: vi.fn().mockImplementation(async (script: string) => {
      if (script.includes("__sbKeyboardSweep.step()")) {
        log.push("step");
        return stops[next++] ?? { kind: "none" };
      }
      if (script.includes("classList.contains('dark')")) {
        return options.theme;
      }
      if (script.includes("__sbKeyboardSweep.contrast(")) {
        log.push("contrast");
        const pairs = JSON.parse(script.slice(script.indexOf("(") + 1, script.lastIndexOf(")")));
        return options.contrast?.(pairs);
      }
      if (script.includes("__sbKeyboardSweep.prepare()")) {
        log.push("prepare");
      }
      return undefined;
    }),
    emulateMedia: vi.fn().mockImplementation(async (options: { forcedColors: string | null }) => {
      log.push(`media:${options.forcedColors}`);
    }),
  };
  return { page, log };
}

const sweepStory = (keyboard: Record<string, unknown> = { sweep: true }, extra = {}) =>
  ({
    id: "ui-keyboard--login",
    title: "UI/Keyboard",
    name: "Login",
    parameters: { keyboard },
    ...extra,
  }) as never;

describe("Storybook keyboard sweep", () => {
  beforeEach(() => {
    vi.stubEnv("STORYBOOK_VISUAL_REGRESSION", "false");
    vi.mocked(checkA11y).mockClear();
    vi.mocked(configureAxe).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does nothing for a story that has not opted in, beyond letting the page settle for axe", async () => {
    // The accessibility pass lets the page's animations finish before axe measures it, which is one
    // page.evaluate. Any other property access throws, so a stray page call from the sweep fails.
    const evaluate = vi.fn().mockResolvedValue({ timedOut: false, stuck: [] });
    const page = new Proxy(
      { evaluate },
      {
        get(target, property) {
          if (property === "evaluate") {
            return target.evaluate;
          }
          throw new Error("the page must not be touched");
        },
      },
    );
    for (const parameters of [undefined, {}, { keyboard: {} }, { keyboard: { sweep: false } }]) {
      await expect(
        runnerConfig.postVisit?.(
          page as never,
          { id: "ui-button--default", title: "UI/Button", name: "Default", parameters } as never,
        ),
      ).resolves.toBeUndefined();
    }
    for (const [script] of evaluate.mock.calls) {
      expect(script).toContain("getAnimations");
    }
  });

  it("presses Tab to the end of the page and passes when every stop has an indicator", async () => {
    const { page, log } = createSweepPage([
      element(1, "Username"),
      element(2, "Password"),
      element(3, "Sign in"),
    ]);

    await expect(runKeyboardSweep(page as never, sweepStory())).resolves.toBeUndefined();

    expect(log).toEqual([
      "prepare",
      "press:Tab",
      "step",
      "press:Tab",
      "step",
      "press:Tab",
      "step",
      "press:Tab",
      "step",
    ]);
  });

  it("fails listing each stop with no indicator, the story and the theme", async () => {
    const { page } = createSweepPage([
      element(1, "Username"),
      element(2, "Remember me", false),
      element(3, "Sign in"),
      element(4, "Forgot password", false),
    ]);

    const error = await runKeyboardSweep(
      page as never,
      sweepStory({ sweep: true }, { globals: { theme: "dark" } }),
    ).catch((caught: Error) => caught);

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('story "ui-keyboard--login"');
    expect(message).toContain("dark theme");
    expect(message).toContain('stop 2 <button> "Remember me"');
    expect(message).toContain('stop 4 <button> "Forgot password"');
    expect(message).not.toContain("Username");
    expect(message).not.toContain("Sign in");
  });

  it("stops when Tab wraps back to the first stop", async () => {
    const { page } = createSweepPage([
      element(1, "A"),
      element(2, "B"),
      element(1, "A"),
      element(2, "B", false),
    ]);
    await expect(runKeyboardSweep(page as never, sweepStory())).resolves.toBeUndefined();
    expect(page.keyboard.press).toHaveBeenCalledTimes(3);
  });

  it("fails a page with more stops than maxStops instead of passing it unchecked", async () => {
    const stops = Array.from({ length: 10 }, (_, index) => element(index + 1, `Item ${index + 1}`));
    const capped = createSweepPage(stops);
    const error = await runKeyboardSweep(
      capped.page as never,
      sweepStory({ sweep: true, maxStops: 4 }),
    ).catch((caught: Error) => caught);

    // Four presses for the four stops it checks, and a fifth to find out there was more.
    expect(capped.page.keyboard.press).toHaveBeenCalledTimes(5);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("after 4 presses");
    expect(message).toContain("4 checked");
    expect(message).toContain("maxStops");
    // Every stop it did check was fine; the only complaint is the cut-off.
    expect(message).not.toContain("stop 1");

    // Ten stops are well inside the default of 40, so all ten and the Tab that finds the end.
    const uncapped = createSweepPage(stops);
    await runKeyboardSweep(uncapped.page as never, sweepStory());
    expect(uncapped.page.keyboard.press).toHaveBeenCalledTimes(11);
  });

  it("passes a page with exactly maxStops stops, which is not a truncation", async () => {
    const stops = Array.from({ length: 4 }, (_, index) => element(index + 1, `Item ${index + 1}`));
    const exact = createSweepPage(stops);
    await expect(
      runKeyboardSweep(exact.page as never, sweepStory({ sweep: true, maxStops: 4 })),
    ).resolves.toBeUndefined();
    // The extra Tab finds the end of the page and says so.
    expect(exact.page.keyboard.press).toHaveBeenCalledTimes(5);

    // Tab wrapping round to a stop it has seen is also the end.
    const wrapped = createSweepPage([...stops, stops[0]!]);
    await expect(
      runKeyboardSweep(wrapped.page as never, sweepStory({ sweep: true, maxStops: 4 })),
    ).resolves.toBeUndefined();
  });

  it("reports a truncated forced-colors pass as well as the light one", async () => {
    // Each pass takes three stops and one more Tab to learn there is a fourth.
    const stops = Array.from({ length: 4 }, (_, index) => element(index + 1, `Item ${index + 1}`));
    const { page } = createSweepPage([...stops, ...stops]);
    const error = await runKeyboardSweep(
      page as never,
      sweepStory({ sweep: true, maxStops: 3, forcedColors: true }),
    ).catch((caught: Error) => caught);
    const message = (error as Error).message;
    expect(message).toContain("light theme: Tab was still finding new stops after 3 presses");
    expect(message).toContain("forced-colors mode");
    expect(message).toMatch(/forced-colors mode[^\n]*: Tab was still finding new stops/);
  });

  it("skips Radix focus guards instead of failing them", async () => {
    const { page } = createSweepPage([element(1, "A"), { kind: "guard", id: 99 }, element(2, "B")]);
    await expect(runKeyboardSweep(page as never, sweepStory())).resolves.toBeUndefined();
  });

  it("fails a story with nothing to Tab to", async () => {
    const { page } = createSweepPage([]);
    await expect(runKeyboardSweep(page as never, sweepStory())).rejects.toThrow(/no Tab stop/);
  });

  it("repeats under forced colors when asked, and always restores the media", async () => {
    const withoutOutline: SweepStop = {
      kind: "element",
      id: 1,
      element: { tag: "button", name: "Save" },
      focused: [signature()],
      blurred: [signature()],
    };
    const { page, log } = createSweepPage([
      element(1, "Save"),
      { kind: "none" },
      withoutOutline,
      { kind: "none" },
    ]);

    const error = await runKeyboardSweep(
      page as never,
      sweepStory({ sweep: true, forcedColors: true }),
    ).catch((caught: Error) => caught);

    const message = (error as Error).message;
    expect(message).toContain("forced-colors mode");
    expect(message).toContain('"Save"');
    expect(message).not.toContain("light theme");
    expect(log.filter((entry) => entry.startsWith("media:"))).toEqual([
      "media:active",
      "media:null",
    ]);
  });

  it("does not touch forced colors unless asked", async () => {
    const { page } = createSweepPage([element(1, "Save")]);
    await runKeyboardSweep(page as never, sweepStory());
    expect(page.emulateMedia).not.toHaveBeenCalled();
  });

  it("runs after axe on the accessibility pass, even for a story that disables axe", async () => {
    const disabled = createSweepPage([element(1, "Save")]);
    await runnerConfig.postVisit?.(
      disabled.page as never,
      {
        id: "ui-keyboard--login",
        title: "UI/Keyboard",
        name: "Login",
        parameters: { a11y: { disable: true }, keyboard: { sweep: true } },
      } as never,
    );
    expect(checkA11y).not.toHaveBeenCalled();
    expect(disabled.log).toContain("step");

    const enabled = createSweepPage([element(1, "Save")]);
    await runnerConfig.postVisit?.(enabled.page as never, sweepStory());
    expect(checkA11y).toHaveBeenCalledTimes(1);
    expect(enabled.log).toContain("step");
  });

  it("does not run during a visual regression pass", async () => {
    vi.stubEnv("STORYBOOK_VISUAL_REGRESSION", "true");
    const { page } = createSweepPage([element(1, "Save")]);
    const rootElement = { screenshot: vi.fn().mockResolvedValue(Buffer.from("png")) };
    const visualPage = {
      ...page,
      addStyleTag: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      $: vi.fn().mockResolvedValue(rootElement),
    };

    // The matcher is Jest's global in the real runner; stand one in so the visual branch can finish.
    const globalScope = globalThis as unknown as { expect: unknown };
    const original = globalScope.expect;
    globalScope.expect = () => ({ toMatchImageSnapshot: () => undefined });
    try {
      await runnerConfig.postVisit?.(visualPage as never, sweepStory());
    } finally {
      globalScope.expect = original;
    }

    expect(page.keyboard.press).not.toHaveBeenCalled();
    expect(page.evaluate).not.toHaveBeenCalled();
  });
});

describe("focusIndicators and visibleEnough", () => {
  const ring = (shadow: string, extra: Partial<NodeSignature> = {}) =>
    focusIndicators([signature({ shadow, ...extra })], [signature()]);

  it("names the colour of each added layer, wherever the engine puts it", () => {
    expect(ring("rgb(24, 24, 27) 0px 0px 0px 2px").map((c) => c.colour)).toEqual([
      "rgb(24, 24, 27)",
    ]);
    expect(ring("0 0 0 2px rgb(24, 24, 27)").map((c) => c.colour)).toEqual(["rgb(24, 24, 27)"]);
    expect(ring("oklch(0.21 0.006 285.9) 0px 0px 0px 2px").map((c) => c.colour)).toEqual([
      "oklch(0.21 0.006 285.9)",
    ]);
    expect(ring("red 0px 0px 0px 2px").map((c) => c.colour)).toEqual(["red"]);
    expect(
      ring("rgb(255, 255, 255) 0px 0px 0px 2px, rgb(24, 24, 27) 0px 0px 0px 4px"),
    ).toHaveLength(2);
  });

  it("draws an outside ring on the surround and an inset one on the fill", () => {
    const where = { surround: "rgb(250, 250, 250)", fill: "rgb(10, 10, 10)" };
    expect(ring("rgb(24, 24, 27) 0px 0px 0px 2px", where)[0]?.against).toBe("rgb(250, 250, 250)");
    expect(ring("rgb(24, 24, 27) 0px 0px 0px 2px inset", where)[0]?.against).toBe(
      "rgb(10, 10, 10)",
    );
  });

  it("draws an outline on the surround, or on the fill when its offset is negative", () => {
    const outline = {
      outlineStyle: "solid",
      outlineWidth: "2px",
      outlineColor: "rgb(0, 95, 204)",
      surround: "rgb(250, 250, 250)",
      fill: "rgb(10, 10, 10)",
    };
    const against = (offset: string) =>
      focusIndicators([signature({ ...outline, outlineOffset: offset })], [signature()])[0]
        ?.against;
    expect(against("2px")).toBe("rgb(250, 250, 250)");
    expect(against("0px")).toBe("rgb(250, 250, 250)");
    expect(against("-2px")).toBe("rgb(10, 10, 10)");
  });

  it("does not judge the browser's own ring by its colour, which is only one of its two tones", () => {
    const auto = {
      outlineStyle: "auto",
      outlineWidth: "1px",
      outlineColor: "rgb(16, 16, 16)",
      surround: "rgb(9, 9, 11)",
      fill: "rgb(9, 9, 11)",
    };
    const [candidate] = focusIndicators([signature(auto)], [signature()]);
    expect(candidate?.description).toContain("outline auto");
    expect(candidate?.against).toBeUndefined();
    // The same colour as a plain solid outline is judged.
    expect(
      focusIndicators([signature({ ...auto, outlineStyle: "solid" })], [signature()])[0]?.against,
    ).toBe("rgb(9, 9, 11)");
  });

  it("has no background to compare with when the page did not say", () => {
    expect(ring("rgb(24, 24, 27) 0px 0px 0px 2px")[0]?.against).toBeUndefined();
  });

  it("calls an indicator visible when its best layer reaches the minimum", () => {
    expect(MIN_INDICATOR_CONTRAST).toBe(3);
    expect(visibleEnough([1, 12.5])).toEqual({ visible: true, best: 12.5 });
    expect(visibleEnough([3])).toEqual({ visible: true, best: 3 });
    expect(visibleEnough([2.99, 1])).toEqual({ visible: false, best: 2.99 });
    expect(visibleEnough([1.02])).toEqual({ visible: false, best: 1.02 });
  });

  it("calls an indicator visible when nothing could be compared", () => {
    for (const unknown of [undefined, null, [], [null], "no", [Number.NaN]]) {
      expect(visibleEnough(unknown), String(unknown)).toEqual({ visible: true, best: null });
    }
    expect(visibleEnough([null, 1.5])).toEqual({ visible: false, best: 1.5 });
  });
});

describe("Storybook keyboard sweep: can the indicator be seen", () => {
  const WHITE = "rgb(255, 255, 255)";
  const against = (surround = WHITE): NodeSignature => signature({ surround, fill: surround });
  const stopWith = (shadow: string, id = 1, name = "Save"): SweepStop => ({
    kind: "element",
    id,
    element: { tag: "button", name },
    focused: [{ ...against(), shadow }],
    blurred: [against()],
  });
  const run = (page: unknown) => runKeyboardSweep(page as never, sweepStory());

  beforeEach(() => {
    vi.stubEnv("STORYBOOK_VISUAL_REGRESSION", "false");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails a ring that is the colour of the page, naming the stop and the contrast", async () => {
    const { page } = createSweepPage([stopWith("rgb(255, 255, 255) 0px 0px 0px 2px")], {
      contrast: () => [1],
    });

    const error = await run(page).catch((caught: Error) => caught);

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('stop 1 <button> "Save"');
    expect(message).toContain("too faint to see");
    expect(message).toContain("1.00:1");
    expect(message).toContain("3:1");
    expect(message).toContain("box-shadow rgb(255, 255, 255) 0px 0px 0px 2px");
  });

  it("asks the page about the colour of each added layer and what it is drawn on", async () => {
    const asked: string[][][] = [];
    const { page } = createSweepPage(
      [stopWith("rgb(255, 255, 255) 0px 0px 0px 2px, rgb(24, 24, 27) 0px 0px 0px 4px")],
      {
        contrast: (pairs) => {
          asked.push(pairs);
          return [1, 16.9];
        },
      },
    );

    await expect(run(page)).resolves.toBeUndefined();
    // The white offset layer is invisible by design; the dark ring around it is what shows.
    expect(asked).toEqual([
      [
        ["rgb(255, 255, 255)", WHITE],
        ["rgb(24, 24, 27)", WHITE],
      ],
    ]);
  });

  it("passes a ring with enough contrast", async () => {
    const { page } = createSweepPage([stopWith("rgb(24, 24, 27) 0px 0px 0px 2px")], {
      contrast: () => [16.9],
    });
    await expect(run(page)).resolves.toBeUndefined();
  });

  it("fails an outline that is painted but faint, as well as a shadow", async () => {
    const outline: SweepStop = {
      kind: "element",
      id: 1,
      element: { tag: "a", name: "Docs" },
      focused: [
        {
          ...against(),
          outlineStyle: "solid",
          outlineWidth: "2px",
          outlineColor: "rgba(24, 24, 27, 0.02)",
        },
      ],
      blurred: [against()],
    };
    const { page } = createSweepPage([outline], { contrast: () => [1.01] });

    const error = await run(page).catch((caught: Error) => caught);
    expect((error as Error).message).toContain('stop 1 <a> "Docs"');
    expect((error as Error).message).toContain("too faint");
  });

  it("passes the browser's own near-black ring on a dark page without asking about its colour", async () => {
    const dark = signature({ surround: "rgb(9, 9, 11)", fill: "rgb(9, 9, 11)" });
    const auto: SweepStop = {
      kind: "element",
      id: 1,
      element: { tag: "button", name: "Attach files" },
      focused: [
        { ...dark, outlineStyle: "auto", outlineWidth: "1px", outlineColor: "rgb(16, 16, 16)" },
      ],
      blurred: [dark],
    };
    const { page, log } = createSweepPage([auto], { contrast: () => [1.05] });
    await expect(run(page)).resolves.toBeUndefined();
    expect(log).not.toContain("contrast");
  });

  it("does not ask when the page gave no background, and passes on what it painted", async () => {
    const { page, log } = createSweepPage([element(1, "Save")], { contrast: () => [1] });
    await expect(run(page)).resolves.toBeUndefined();
    expect(log).not.toContain("contrast");
  });

  it("passes when the page cannot judge colours (no canvas), as an old page could not", async () => {
    const { page } = createSweepPage([stopWith("rgb(255, 255, 255) 0px 0px 0px 2px")], {
      contrast: () => [null],
    });
    await expect(run(page)).resolves.toBeUndefined();
  });

  it("does not ask about a stop that shows nothing at all, which fails on its own", async () => {
    const bare: SweepStop = {
      kind: "element",
      id: 1,
      element: { tag: "button", name: "Save" },
      focused: [against()],
      blurred: [against()],
    };
    const { page, log } = createSweepPage([bare], { contrast: () => [20] });
    const error = await run(page).catch((caught: Error) => caught);
    expect((error as Error).message).toContain('stop 1 <button> "Save"');
    expect((error as Error).message).not.toContain("too faint");
    expect(log).not.toContain("contrast");
  });
});

describe("Storybook keyboard sweep: the theme it sweeps", () => {
  beforeEach(() => {
    vi.stubEnv("STORYBOOK_VISUAL_REGRESSION", "false");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses a story set to dark that rendered light, before pressing a key", async () => {
    // What a story gets by asking for dark in `parameters.globals`, which Storybook ignores.
    const { page } = createSweepPage([element(1, "Save")], { theme: "light" });

    const error = await runKeyboardSweep(
      page as never,
      sweepStory({ sweep: true }, { globals: { theme: "dark" } }),
    ).catch((caught: Error) => caught);

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("is set to the dark theme but rendered in the light theme");
    expect(message).toContain("story-level `globals");
    expect(page.keyboard.press).not.toHaveBeenCalled();
  });

  it("refuses a page that rendered dark when the story context says light", async () => {
    const { page } = createSweepPage([element(1, "Save")], { theme: "dark" });
    await expect(runKeyboardSweep(page as never, sweepStory())).rejects.toThrow(
      /set to the light theme but rendered in the dark theme/,
    );
  });

  it("sweeps and labels the dark theme when the page really is dark", async () => {
    const { page } = createSweepPage([element(1, "Save", false)], { theme: "dark" });

    const error = await runKeyboardSweep(
      page as never,
      sweepStory({ sweep: true }, { globals: { theme: "dark" } }),
    ).catch((caught: Error) => caught);

    expect((error as Error).message).toContain("dark theme:");
    expect((error as Error).message).toContain('stop 1 <button> "Save"');
  });

  it("reads the theme from `storyGlobals`, which is where the runner's prepared story keeps it", async () => {
    // `getStoryContext()` returns `storyStore.loadStory(...)`: a story-level `globals: { theme }` is
    // `storyGlobals` there and there is no `globals`, so reading only `globals` called every dark story light.
    const { page } = createSweepPage([element(1, "Save", false)], { theme: "dark" });
    const error = await runKeyboardSweep(
      page as never,
      sweepStory({ sweep: true }, { storyGlobals: { theme: "dark" } }),
    ).catch((caught: Error) => caught);

    expect((error as Error).message).not.toContain("rendered in the");
    expect((error as Error).message).toContain("dark theme:");
  });

  it("takes the story's word for the theme from a page that does not say", async () => {
    const { page } = createSweepPage([element(1, "Save", false)]);
    const error = await runKeyboardSweep(
      page as never,
      sweepStory({ sweep: true }, { globals: { theme: "dark" } }),
    ).catch((caught: Error) => caught);
    expect((error as Error).message).toContain("dark theme:");
  });
});

describe("Storybook keyboard sweep: the script that runs in the page", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    delete (window as { __sbKeyboardSweep?: unknown }).__sbKeyboardSweep;
  });

  /**
   * jsdom does not apply `:focus` rules to getComputedStyle, so a control "rings" here by setting an
   * inline box-shadow while focused, which is what the sweep reads either way.
   */
  function addButton(label: string, rings: boolean, attributes: Record<string, string> = {}) {
    const button = document.createElement("button");
    button.textContent = label;
    for (const [name, value] of Object.entries(attributes)) {
      button.setAttribute(name, value);
    }
    if (rings) {
      button.addEventListener("focus", () => {
        button.style.boxShadow = "0 0 0 2px rgb(24, 24, 27)";
      });
      button.addEventListener("blur", () => {
        button.style.boxShadow = "";
      });
    }
    document.body.append(button);
    return button;
  }

  /** A page whose evaluate runs the sweep's own script in jsdom, and whose Tab walks document order. */
  function jsdomPage() {
    window.scrollTo = vi.fn();
    return {
      keyboard: {
        press: vi.fn().mockImplementation(async () => {
          const focusable = [...document.querySelectorAll<HTMLElement>("button, input, a[href]")];
          const index = focusable.indexOf(document.activeElement as HTMLElement);
          if (index + 1 < focusable.length) {
            focusable[index + 1]!.focus();
          } else {
            (document.activeElement as HTMLElement | null)?.blur();
          }
        }),
      },
      evaluate: vi.fn().mockImplementation(async (script: string) => window.eval(script)),
      emulateMedia: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("reports the stops whose focus style paints nothing, naming them as a person would", async () => {
    addButton("Save", true);
    addButton("Cancel", false);
    addButton("x", true, { "aria-label": "Close" });
    addButton("Menu", false, { role: "menuitem" });

    const error = await runKeyboardSweep(jsdomPage() as never, sweepStory()).catch(
      (caught: Error) => caught,
    );

    const message = (error as Error).message;
    expect(message).toContain('stop 2 <button> "Cancel"');
    expect(message).toContain('stop 4 <button role="menuitem"> "Menu"');
    expect(message).not.toContain('"Save"');
    expect(message).not.toContain('"Close"');
  });

  it("passes a page where every control rings, and leaves focus on nothing", async () => {
    addButton("Save", true);
    addButton("Cancel", true);

    await expect(runKeyboardSweep(jsdomPage() as never, sweepStory())).resolves.toBeUndefined();
    expect(document.activeElement).toBe(document.body);
  });

  it("puts focus back where it was after measuring each stop", async () => {
    const first = addButton("Save", true);
    const second = addButton("Cancel", true);
    const page = jsdomPage();
    const order: string[] = [];
    first.addEventListener("focus", () => order.push("save"));
    second.addEventListener("focus", () => order.push("cancel"));

    await runKeyboardSweep(page as never, sweepStory());

    // Each stop is focused by Tab, blurred to read the baseline, then focused again before the next Tab.
    expect(order).toEqual(["save", "save", "cancel", "cancel"]);
  });

  it("skips a Radix focus guard", async () => {
    addButton("Save", true);
    addButton("", false, { "data-radix-focus-guard": "" });
    addButton("Cancel", true);

    await expect(runKeyboardSweep(jsdomPage() as never, sweepStory())).resolves.toBeUndefined();
  });

  it("can be run twice on one page", async () => {
    addButton("Save", true);
    const page = jsdomPage();
    await runKeyboardSweep(page as never, sweepStory());
    await expect(runKeyboardSweep(page as never, sweepStory())).resolves.toBeUndefined();
  });
});

describe("Storybook keyboard sweep: colours in the page script", () => {
  type Rgba = [number, number, number, number];

  function parseColour(value: string): Rgba | null {
    const text = value.trim();
    const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(text);
    if (hex) {
      return [parseInt(hex[1]!, 16), parseInt(hex[2]!, 16), parseInt(hex[3]!, 16), 1];
    }
    const functional = /^rgba?\(([^)]+)\)$/.exec(text);
    if (functional) {
      const [r = 0, g = 0, b = 0, a = 1] = functional[1]!.split(",").map(Number);
      return [r, g, b, a];
    }
    return text === "transparent" ? [0, 0, 0, 0] : null;
  }

  /** A one pixel canvas that understands hex and rgb(), and ignores what it cannot parse, as a real one does. */
  function fakeContext() {
    let style = "#000000";
    let colour: Rgba = [0, 0, 0, 1];
    let painted: Rgba = [0, 0, 0, 0];
    return {
      get fillStyle() {
        return style;
      },
      set fillStyle(value: string) {
        const parsed = parseColour(value);
        if (parsed) {
          style = value;
          colour = parsed;
        }
      },
      clearRect() {
        painted = [0, 0, 0, 0];
      },
      fillRect() {
        painted = colour;
      },
      getImageData() {
        return {
          data: [painted[0], painted[1], painted[2], Math.round(painted[3] * 255)],
        };
      },
    };
  }

  beforeEach(() => {
    vi.stubEnv("STORYBOOK_VISUAL_REGRESSION", "false");
    // The script treats jsdom as having no canvas; present as a browser with this one.
    Object.defineProperty(navigator, "userAgent", { value: "Chrome", configurable: true });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => fakeContext() as never,
    );
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    delete (navigator as { userAgent?: unknown }).userAgent;
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    document.body.removeAttribute("style");
    document.documentElement.classList.remove("dark");
    delete (window as { __sbKeyboardSweep?: unknown }).__sbKeyboardSweep;
  });

  const sweepApi = () =>
    (
      window as unknown as {
        __sbKeyboardSweep: {
          contrast(pairs: string[][]): Array<number | null>;
          step(): Promise<{ focused: NodeSignature[] }>;
        };
      }
    ).__sbKeyboardSweep;

  function jsdomPage() {
    return {
      keyboard: {
        press: vi.fn().mockImplementation(async () => {
          const focusable = [...document.querySelectorAll<HTMLElement>("button")];
          const index = focusable.indexOf(document.activeElement as HTMLElement);
          if (index + 1 < focusable.length) {
            focusable[index + 1]!.focus();
          } else {
            (document.activeElement as HTMLElement | null)?.blur();
          }
        }),
      },
      evaluate: vi.fn().mockImplementation(async (script: string) => window.eval(script)),
      emulateMedia: vi.fn().mockResolvedValue(undefined),
    };
  }

  /** A button that gets a 2px ring in `ring` when focused. */
  function addButton(parent: HTMLElement, label: string, ring: string) {
    const button = document.createElement("button");
    button.textContent = label;
    button.addEventListener("focus", () => {
      button.style.boxShadow = `0 0 0 2px ${ring}`;
    });
    button.addEventListener("blur", () => {
      button.style.boxShadow = "";
    });
    parent.append(button);
    return button;
  }

  const run = (page: unknown) => runKeyboardSweep(page as never, sweepStory());

  it("measures contrast the way WCAG does, laying a translucent colour over its background first", async () => {
    document.body.style.backgroundColor = "rgb(255, 255, 255)";
    addButton(document.body, "Save", "rgb(24, 24, 27)");
    await run(jsdomPage());

    const [black, same, half, nonsense] = sweepApi().contrast([
      ["rgb(0, 0, 0)", "rgb(255, 255, 255)"],
      ["rgb(255, 255, 255)", "rgb(255, 255, 255)"],
      ["rgba(0, 0, 0, 0.5)", "rgb(255, 255, 255)"],
      ["banana", "rgb(255, 255, 255)"],
    ]);
    expect(black).toBeCloseTo(21, 3);
    expect(same).toBeCloseTo(1, 5);
    expect(half).toBeCloseTo(3.98, 1);
    expect(nonsense).toBeNull();
  });

  it("finds what a node sits on by laying its ancestors' backgrounds over the page", async () => {
    document.body.style.backgroundColor = "rgb(255, 255, 255)";
    const card = document.createElement("div");
    card.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    document.body.append(card);
    const button = addButton(card, "Save", "rgb(24, 24, 27)");
    button.style.backgroundColor = "rgb(10, 20, 30)";
    await run(jsdomPage());

    button.focus();
    const { focused } = await sweepApi().step();
    // Half-black over white is mid grey (alpha is stored in 8 bits, hence 127); the button sits on top for its fill.
    expect(focused[0]!.surround).toBe("rgb(127, 127, 127)");
    expect(focused[0]!.fill).toBe("rgb(10, 20, 30)");
  });

  it("falls back to a dark page when nothing sets a background and the theme is dark", async () => {
    document.documentElement.classList.add("dark");
    const button = addButton(document.body, "Save", "rgb(250, 250, 250)");
    await runKeyboardSweep(
      jsdomPage() as never,
      sweepStory({ sweep: true }, { globals: { theme: "dark" } }),
    );

    button.focus();
    const { focused } = await sweepApi().step();
    expect(focused[0]!.surround).toBe("rgb(9, 9, 11)");
  });

  it("fails a ring that matches the page and passes one that stands out, end to end", async () => {
    document.body.style.backgroundColor = "rgb(255, 255, 255)";
    addButton(document.body, "Save", "rgb(24, 24, 27)");
    addButton(document.body, "Invisible", "rgb(255, 255, 255)");
    addButton(document.body, "Faint", "rgba(24, 24, 27, 0.02)");

    const error = await run(jsdomPage()).catch((caught: Error) => caught);

    const message = (error as Error).message;
    expect(message).not.toContain('"Save"');
    expect(message).toContain('stop 2 <button> "Invisible": the indicator is too faint');
    expect(message).toContain('stop 3 <button> "Faint": the indicator is too faint');
    expect(message).toContain("1.00:1");
  });

  it("judges a ring against the card it is on, not the page", async () => {
    document.body.style.backgroundColor = "rgb(255, 255, 255)";
    const card = document.createElement("div");
    card.style.backgroundColor = "rgb(24, 24, 27)";
    document.body.append(card);
    // The same dark ring that is plain on the page vanishes on a card of its own colour.
    addButton(card, "On a dark card", "rgb(24, 24, 27)");

    await expect(run(jsdomPage())).rejects.toThrow(
      /stop 1 <button> "On a dark card": the indicator/,
    );
  });
});
