import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

/**
 * Tests for the settle step of the accessibility pass in .storybook/test-runner.ts: before axe runs,
 * the page's finite animations and transitions are given time to finish, because axe reads the
 * colours as painted and a half-faded blade or a half-switched theme is a blend that is gone in
 * 200 ms. Without it the Blades `Collapsed` and `WidthHints` stories and the ThemeProvider
 * `DarkMode` story failed color-contrast on some CI runs and passed on others.
 *
 * The page half of the step is a string (see SETTLE_SCRIPT), so these tests run the real script in
 * jsdom against fake animations. jsdom has no Web Animations, so `document.getAnimations` is
 * supplied here. Real timers throughout: every wait is tens of milliseconds and the fake animations
 * finish on window timers, so real time keeps the tests short and free of clock plumbing.
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
  AXE_SETTLE_TIMEOUT_MS,
  waitForAnimationsToSettle,
} from "../.storybook/test-runner.ts";

interface FakeAnimation {
  playState: string;
  animationName?: string;
  transitionProperty?: string;
  effect: { target: Element | null; getComputedTiming: () => { endTime: number } };
  finished: Promise<unknown>;
}

interface FakeOptions {
  /** CSS animation name, or a transition property when `transition` is set. */
  name?: string;
  transition?: boolean;
  /** Infinity for `animation-iteration-count: infinite`. */
  endTime?: number;
  playState?: string;
  target?: Element | null;
  /** Milliseconds until it finishes; null never does. */
  finishesAfter: number | null;
  /** Called as it finishes, once it has left `getAnimations()`. */
  onFinish?: () => void;
  /** Settle `finished` with a rejection, as a cancelled animation does. */
  cancels?: boolean;
}

/** What the page reports through `document.getAnimations()`, and what the tests do to it. */
class FakeTimeline {
  readonly active = new Set<FakeAnimation>();
  readonly events: string[] = [];

  add(options: FakeOptions): FakeAnimation {
    let settle: (cancelled: boolean) => void = () => undefined;
    const finished = new Promise<unknown>((resolve, reject) => {
      settle = (cancelled) =>
        cancelled ? reject(new DOMException("cancelled", "AbortError")) : resolve(undefined);
    });
    finished.catch(() => undefined);
    const animation: FakeAnimation = {
      playState: options.playState ?? "running",
      effect: {
        target: options.target ?? null,
        getComputedTiming: () => ({ endTime: options.endTime ?? 200 }),
      },
      finished,
    };
    if (options.transition) {
      animation.transitionProperty = options.name ?? "background-color";
    } else {
      animation.animationName = options.name ?? "bladeSlideIn";
    }
    this.active.add(animation);
    if (options.finishesAfter !== null) {
      window.setTimeout(() => {
        this.active.delete(animation);
        animation.playState = "finished";
        this.events.push(`finished:${options.name ?? "animation"}`);
        options.onFinish?.();
        settle(options.cancels === true);
      }, options.finishesAfter);
    }
    return animation;
  }
}

/** A page whose evaluate runs the script it is given inside jsdom. */
function jsdomPage() {
  return {
    evaluate: vi.fn().mockImplementation(async (script: string) => window.eval(script)),
  };
}

let timeline: FakeTimeline;

beforeEach(() => {
  timeline = new FakeTimeline();
  (document as unknown as { getAnimations: () => FakeAnimation[] }).getAnimations = () => [
    ...timeline.active,
  ];
});

afterEach(() => {
  delete (document as unknown as { getAnimations?: unknown }).getAnimations;
  vi.restoreAllMocks();
});

describe("waitForAnimationsToSettle", () => {
  it("returns at once on a page with nothing running", async () => {
    const page = jsdomPage();

    await expect(waitForAnimationsToSettle(page as never)).resolves.toEqual({
      timedOut: false,
      stuck: [],
    });
    expect(page.evaluate).toHaveBeenCalledTimes(1);
  });

  it("waits for a finite animation to finish", async () => {
    const animation = timeline.add({ name: "bladeSlideIn", finishesAfter: 80 });

    expect(animation.playState).toBe("running");
    const result = await waitForAnimationsToSettle(jsdomPage() as never);

    // Not "some time passed": the animation itself had finished when the wait ended.
    expect(animation.playState).toBe("finished");
    expect(result).toEqual({ timedOut: false, stuck: [] });
  });

  it("waits for a CSS transition, which is how a theme change shows up", async () => {
    const transition = timeline.add({
      name: "background-color",
      transition: true,
      endTime: 200,
      finishesAfter: 60,
    });

    await waitForAnimationsToSettle(jsdomPage() as never);

    expect(transition.playState).toBe("finished");
  });

  it("waits for every one of several animations, and for one that starts when another ends", async () => {
    let successor: FakeAnimation | undefined;
    const short = timeline.add({ name: "short", finishesAfter: 20 });
    const long = timeline.add({
      name: "long",
      finishesAfter: 70,
      // A transition that begins as an animation ends: the second look at the page catches it.
      onFinish: () => {
        successor = timeline.add({ name: "successor", transition: true, finishesAfter: 50 });
      },
    });

    await waitForAnimationsToSettle(jsdomPage() as never);

    expect(short.playState).toBe("finished");
    expect(long.playState).toBe("finished");
    expect(successor?.playState).toBe("finished");
    expect(timeline.events).toEqual(["finished:short", "finished:long", "finished:successor"]);
  });

  it("carries on when an animation is cancelled instead of finishing", async () => {
    timeline.add({ name: "replaced", transition: true, finishesAfter: 30, cancels: true });

    await expect(waitForAnimationsToSettle(jsdomPage() as never)).resolves.toEqual({
      timedOut: false,
      stuck: [],
    });
  });

  it("does not wait for an infinite animation, such as a spinner", async () => {
    timeline.add({
      name: "sb-rotate360",
      endTime: Number.POSITIVE_INFINITY,
      finishesAfter: null,
    });

    // If it were waited for, this would take the whole 300 ms and report a timeout.
    const result = await waitForAnimationsToSettle(jsdomPage() as never, 300);

    expect(result).toEqual({ timedOut: false, stuck: [] });
  });

  it("waits for the finite animations next to an infinite one, and only those", async () => {
    timeline.add({ name: "spin", endTime: Number.POSITIVE_INFINITY, finishesAfter: null });
    const enter = timeline.add({ name: "bladeSlideIn", finishesAfter: 60 });

    const result = await waitForAnimationsToSettle(jsdomPage() as never, 400);

    expect(enter.playState).toBe("finished");
    expect(result).toEqual({ timedOut: false, stuck: [] });
  });

  it("does not wait for an animation that is paused or idle, which cannot change", async () => {
    timeline.add({ name: "held", playState: "paused", finishesAfter: null });
    timeline.add({ name: "cancelled", playState: "idle", finishesAfter: null });

    await expect(waitForAnimationsToSettle(jsdomPage() as never, 300)).resolves.toEqual({
      timedOut: false,
      stuck: [],
    });
  });

  it("gives up after the time limit and says which animation was still running", async () => {
    const section = document.createElement("section");
    timeline.add({ name: "bladeSlideIn", target: section, finishesAfter: null });
    timeline.add({
      name: "color",
      transition: true,
      target: document.createElement("p"),
      finishesAfter: null,
    });

    const started = Date.now();
    const result = await waitForAnimationsToSettle(jsdomPage() as never, 100);
    const waited = Date.now() - started;

    expect(result.timedOut).toBe(true);
    expect(result.stuck).toEqual(["bladeSlideIn on <section>", "color on <p>"]);
    // It waited for the limit, not less, and did not go on to wait for ever.
    expect(waited).toBeGreaterThanOrEqual(90);
    expect(waited).toBeLessThan(2_000);
  });

  it("is not stopped early by the time limit when the animation ends inside it", async () => {
    timeline.add({ name: "bladeSlideIn", finishesAfter: 40 });

    await expect(waitForAnimationsToSettle(jsdomPage() as never, 500)).resolves.toEqual({
      timedOut: false,
      stuck: [],
    });
  });

  it("waits one more frame after the last animation ends", async () => {
    const frame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      timeline.events.push("frame");
      return window.setTimeout(() => callback(0), 0);
    });
    timeline.add({ name: "bladeSlideIn", finishesAfter: 30 });

    await waitForAnimationsToSettle(jsdomPage() as never);

    expect(frame).toHaveBeenCalledTimes(1);
    expect(timeline.events).toEqual(["finished:bladeSlideIn", "frame"]);
  });

  it("is not held up by a page that never paints a frame, such as a hidden tab", async () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);

    await expect(waitForAnimationsToSettle(jsdomPage() as never)).resolves.toEqual({
      timedOut: false,
      stuck: [],
    });
  });

  it("applies the default limit when none is given", async () => {
    const page = jsdomPage();

    await waitForAnimationsToSettle(page as never);

    expect(page.evaluate.mock.calls[0]![0]).toMatch(new RegExp(`\\(${AXE_SETTLE_TIMEOUT_MS}\\)$`));
  });

  it("does not wait at all on a limit that makes no sense", async () => {
    timeline.add({ name: "stuck", finishesAfter: null });

    for (const nonsense of [Number.NaN, -5, Number.POSITIVE_INFINITY]) {
      const started = Date.now();
      const result = await waitForAnimationsToSettle(jsdomPage() as never, nonsense);
      const waited = Date.now() - started;

      expect(result.timedOut).toBe(true);
      // Far under the default limit: falling back to it would take the whole of AXE_SETTLE_TIMEOUT_MS,
      // and passing an infinite one through would never return.
      expect(waited).toBeLessThan(AXE_SETTLE_TIMEOUT_MS / 4);
    }
  });

  it("reads a page that answers with nothing as having nothing to wait for", async () => {
    const page = { evaluate: vi.fn().mockResolvedValue(undefined) };

    await expect(waitForAnimationsToSettle(page as never)).resolves.toEqual({
      timedOut: false,
      stuck: [],
    });
  });
});

describe("the accessibility pass waits for the page to settle", () => {
  const story = (parameters: Record<string, unknown> = {}) =>
    ({
      id: "ui-blades--collapsed",
      title: "UI/Blades",
      name: "Collapsed",
      parameters,
    }) as never;

  beforeEach(() => {
    vi.stubEnv("STORYBOOK_VISUAL_REGRESSION", "false");
    vi.mocked(checkA11y).mockReset().mockResolvedValue(undefined);
    vi.mocked(configureAxe).mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /** A page that takes `settleMs` to settle, and logs what happened to it and to axe in order. */
  function loggedPage(log: string[], settleMs = 40, answer = { timedOut: false, stuck: [] }) {
    vi.mocked(configureAxe).mockImplementation(async () => {
      log.push("configureAxe");
    });
    vi.mocked(checkA11y).mockImplementation(async () => {
      log.push("checkA11y");
    });
    return {
      evaluate: vi.fn().mockImplementation(async (script: string) => {
        log.push("settle:start");
        expect(script).toContain("getAnimations");
        await new Promise((resolve) => setTimeout(resolve, settleMs));
        log.push("settle:end");
        return answer;
      }),
    };
  }

  it("measures only after the animations have finished", async () => {
    const log: string[] = [];

    await runnerConfig.postVisit?.(loggedPage(log) as never, story());

    expect(log).toEqual(["settle:start", "settle:end", "configureAxe", "checkA11y"]);
  });

  it("still fails the story for a violation that is there once everything has settled", async () => {
    const log: string[] = [];
    const page = loggedPage(log);
    vi.mocked(checkA11y).mockImplementation(async () => {
      log.push("checkA11y");
      throw new Error("1 accessibility violation was detected");
    });

    await expect(runnerConfig.postVisit?.(page as never, story())).rejects.toThrow(
      "1 accessibility violation was detected",
    );
    expect(log).toEqual(["settle:start", "settle:end", "configureAxe", "checkA11y"]);
  });

  it("warns and measures anyway when an animation does not finish in time", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const log: string[] = [];
    const page = loggedPage(log, 0, {
      timedOut: true,
      stuck: ["bladeSlideIn on <section>"],
    } as never);

    await runnerConfig.postVisit?.(page as never, story());

    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]![0]);
    expect(message).toContain("ui-blades--collapsed");
    expect(message).toContain(`${AXE_SETTLE_TIMEOUT_MS} ms`);
    expect(message).toContain("bladeSlideIn on <section>");
    expect(log.at(-1)).toBe("checkA11y");
  });

  it("stays quiet when everything settled", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await runnerConfig.postVisit?.(loggedPage([]) as never, story());

    expect(warn).not.toHaveBeenCalled();
  });

  it("leaves the page alone for a story that turns axe off", async () => {
    const page = new Proxy(
      {},
      {
        get() {
          throw new Error("the page must not be touched");
        },
      },
    );

    await expect(
      runnerConfig.postVisit?.(page as never, story({ a11y: { disable: true } })),
    ).resolves.toBeUndefined();
    expect(checkA11y).not.toHaveBeenCalled();
  });

  it("does not wait during the visual regression pass, which freezes animations instead", async () => {
    vi.stubEnv("STORYBOOK_VISUAL_REGRESSION", "true");
    const rootElement = { screenshot: vi.fn().mockResolvedValue(Buffer.from("png")) };
    const page = {
      evaluate: vi.fn(),
      addStyleTag: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      $: vi.fn().mockResolvedValue(rootElement),
    };
    const globalScope = globalThis as unknown as { expect: unknown };
    const original = globalScope.expect;
    globalScope.expect = () => ({ toMatchImageSnapshot: () => undefined });
    try {
      await runnerConfig.postVisit?.(page as never, story());
    } finally {
      globalScope.expect = original;
    }

    expect(page.evaluate).not.toHaveBeenCalled();
    expect(checkA11y).not.toHaveBeenCalled();
  });
});
