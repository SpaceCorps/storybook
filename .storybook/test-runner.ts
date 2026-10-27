import path from "node:path";
import type { TestRunnerConfig } from "@storybook/test-runner";
import { getStoryContext, waitForPageReady } from "@storybook/test-runner";
import { checkA11y, configureAxe, injectAxe } from "axe-playwright";
import { toMatchImageSnapshot } from "jest-image-snapshot";
import { readStoryGlobals } from "./globals";

// `expect` is Jest's global inside the Storybook test runner. tsconfig.json lists
// "jest-image-snapshot" in `types`, which brings in both the jest globals and the
// toMatchImageSnapshot matcher, so nothing needs declaring or suppressing here.

/** Read per call rather than once at import time, so a test can flip it between cases. */
const isVisualRun = () => process.env.STORYBOOK_VISUAL_REGRESSION === "true";

const snapshotsDir = path.join(process.cwd(), ".storybook", "__image_snapshots__");

/**
 * Settle time between freezing the page and screenshotting it. Stories that lazy-load their renderer
 * keep working after `waitForPageReady` resolves, so they can ask for longer through
 * `parameters.visual.settleDelay`.
 */
const DEFAULT_SETTLE_DELAY_MS = 100;

/**
 * How long to wait for a story's `parameters.visual.waitForSelector`. A canvas renderer signals that
 * it has painted by setting an attribute, which is a far tighter gate than a fixed delay.
 */
const WAIT_FOR_SELECTOR_TIMEOUT_MS = 15_000;

// Neutralises everything that would otherwise make two screenshots of the same story differ:
// running animations and transitions, blinking text carets, and smooth scrolling.
const FREEZE_CSS = `
  *, *::before, *::after {
    animation: none !important;
    animation-play-state: paused !important;
    transition: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
`;

type StoryPage = Parameters<NonNullable<TestRunnerConfig["postVisit"]>>[0];
type StoryContext = Awaited<ReturnType<typeof getStoryContext>>;

/**
 * How long the accessibility pass waits for the page's animations and transitions to finish. The
 * library's own run 150 to 500 ms, so this is generous; it only bounds one that never ends.
 */
export const AXE_SETTLE_TIMEOUT_MS = 2_000;

/** What `waitForAnimationsToSettle` found when it stopped waiting. */
export interface AnimationSettle {
  /** Finite animations were still running when the time ran out. */
  timedOut: boolean;
  /** Those animations, named for a log line: `bladeSlideIn on <section>`. */
  stuck: string[];
}

// The page half is a string rather than a function, for the reason given at SWEEP_SCRIPT. It is a
// function expression that the caller applies to the time limit. It uses no template expressions,
// backticks or backslashes, so nothing in it needs escaping.
const SETTLE_SCRIPT = `(async (limit) => {
  const deadline = Date.now() + limit;
  // getAnimations() first applies any style change that is still waiting, which is what creates the
  // transitions of a class that was only just toggled. A paused or finished animation no longer
  // moves, and an infinite one (a spinner) never ends: only the rest are waited for.
  const running = () => document.getAnimations().filter((animation) => {
    if (animation.playState !== 'running' && animation.playState !== 'pending') { return false; }
    const timing = animation.effect && animation.effect.getComputedTiming();
    return !!timing && Number.isFinite(timing.endTime);
  });
  const describe = (animation) => {
    const target = animation.effect && animation.effect.target;
    const name = animation.animationName || animation.transitionProperty || 'animation';
    return target && target.tagName ? name + ' on <' + target.tagName.toLowerCase() + '>' : name;
  };
  let pending = running();
  while (pending.length > 0 && Date.now() < deadline) {
    let timer;
    await Promise.race([
      Promise.allSettled(pending.map((animation) => animation.finished)),
      new Promise((resolve) => { timer = window.setTimeout(resolve, Math.max(0, deadline - Date.now())); }),
    ]);
    window.clearTimeout(timer);
    // One finishing can start the next, and a cancelled one is replaced, so look again.
    pending = running();
  }
  // The frame after the last one ends is the first to be painted from the settled styles.
  await new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
    window.setTimeout(() => resolve(), 100);
  });
  return { timedOut: pending.length > 0, stuck: pending.map(describe) };
})`;

/**
 * Waits for every finite animation and transition on the page to finish, for at most `timeoutMs`,
 * and then for one more frame. Axe reads the colours as they are painted, so an element that is half
 * faded in, or halfway through a theme transition, is measured as a blend of two states that neither
 * the design nor a person ever sees for longer than a fraction of a second. Infinite animations are
 * not waited for (they never end) and a stuck one cannot hang the story: when the time runs out the
 * ones still running are reported and the page is measured as it is. Exported for the tests.
 */
export async function waitForAnimationsToSettle(
  page: StoryPage,
  timeoutMs: number = AXE_SETTLE_TIMEOUT_MS,
): Promise<AnimationSettle> {
  const limit = Number.isFinite(timeoutMs) && timeoutMs >= 0 ? Math.floor(timeoutMs) : 0;
  const result = (await page.evaluate(`${SETTLE_SCRIPT}(${limit})`)) as
    | Partial<AnimationSettle>
    | undefined;
  return {
    timedOut: result?.timedOut === true,
    stuck: Array.isArray(result?.stuck) ? result.stuck : [],
  };
}

/**
 * The accessibility pass: axe over `#storybook-root`, once the page has stopped moving. A story can
 * opt out with `a11y.disable`, or downgrade a violation to a warning with `a11y.failOnViolation: false`.
 */
async function runAxe(page: StoryPage, storyContext: StoryContext): Promise<void> {
  if (storyContext.parameters?.a11y?.disable) {
    return;
  }

  // The story has rendered, but an enter animation or a theme transition may still be running, and a
  // violation measured halfway through one comes and goes with the machine's speed. This only waits:
  // what axe then reports is the settled page, and a real low-contrast element still fails.
  const settled = await waitForAnimationsToSettle(page);
  if (settled.timedOut) {
    console.warn(
      `[a11y warning] Story "${storyContext.id}" still had running animations after ` +
        `${AXE_SETTLE_TIMEOUT_MS} ms, so axe measured them mid-flight: ${settled.stuck.join(", ")}`,
    );
  }

  await configureAxe(page, {
    rules: storyContext.parameters?.a11y?.config?.rules,
  });

  try {
    await checkA11y(page, "#storybook-root", {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
      axeOptions: storyContext.parameters?.a11y?.options,
    });
  } catch (error) {
    if (storyContext.parameters?.a11y?.failOnViolation === false) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[a11y warning] Accessibility violation in story "${storyContext.id}":\n${message}`,
      );
      return;
    }

    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// Keyboard sweep
//
// A story opts in with `parameters.keyboard`; nothing changes for any story that does not.
//
//   parameters: { keyboard: { sweep: true, maxStops: 40, forcedColors: true } }
//
//   sweep         Turns the sweep on. Off unless set.
//   maxStops      How many Tab presses to make before giving up. Default 40. A page with more stops than
//                 that FAILS (the rest would go unchecked, and a pass would claim otherwise); raise it
//                 to cover the page.
//   forcedColors  Repeat the sweep under `forced-colors: active`, where box-shadows are dropped and
//                 only an outline survives.
//
// The sweep presses Tab and, at every stop, reads the focused element's computed outline and
// box-shadow (and its three ancestors', for a ring drawn on a `focus-within` frame), blurs it, reads
// them again, and puts focus back. A stop passes when focus adds an outline or a painted box-shadow
// layer that was not there before AND that layer can be seen: its colour has at least 3:1 contrast
// (WCAG 1.4.11) against what it is drawn on, found by compositing the ancestors' background colours.
// The browser's own ring (`outline-style: auto`) is two-tone and is taken as visible.
// That is what a ring utility produces, and what a `ring-ring` with no width (paints nothing), an
// `outline-none` ring in forced-colors mode (the browser flattens the shadow) or a ring in the colour
// of the page fails to produce. Background images and gradients are not looked through, so a ring on
// one is judged against the colour beneath it.
//
// The theme is whatever the story renders in, and the sweep checks that it is the one the story asked
// for: the story context's `globals.theme` must match the `dark` class on `<html>`. Give a dark story
// a story-level `globals: { theme: "dark" }`; Storybook ignores `parameters.globals`. Radix focus
// guards are skipped, and a Tab that leaves the page or comes back to the first stop ends the sweep.
// ---------------------------------------------------------------------------------------------

const DEFAULT_SWEEP_MAX_STOPS = 40;

/** The WCAG 1.4.11 minimum for the contrast of a focus indicator against what it is drawn on. */
export const MIN_INDICATOR_CONTRAST = 3;

/** The computed values the sweep compares between the focused and the blurred state of one node. */
export interface NodeSignature {
  shadow: string;
  outlineStyle: string;
  outlineWidth: string;
  outlineColor: string;
  /** Distance of the outline from the border box; negative draws it inside. */
  outlineOffset?: string;
  /** The opaque colour behind the node's border box: its ancestors' backgrounds composited. */
  surround?: string;
  /** The same with the node's own background on top, for an indicator drawn inside the node. */
  fill?: string;
}

export interface SweepElement {
  tag: string;
  type?: string;
  role?: string;
  name: string;
}

export type SweepStop =
  | { kind: "none" }
  | { kind: "guard"; id: number }
  | {
      kind: "element";
      id: number;
      element: SweepElement;
      /** The focused element first, then up to three ancestors. */
      focused: NodeSignature[];
      blurred: NodeSignature[];
    };

const TRANSPARENT_COLOR =
  /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)|\btransparent\b|\/\s*0(?:\.0+)?\s*\)/;

/** The layers of a computed `box-shadow` that paint something: not `none`, not `0 0 #0000`. */
function paintedShadowLayers(value: string): string[] {
  if (!value || value === "none") {
    return [];
  }
  const layers: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    }
    if (char === "," && depth === 0) {
      layers.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    layers.push(current.trim());
  }

  return layers.filter((layer) => {
    if (TRANSPARENT_COLOR.test(layer)) {
      return false;
    }
    const lengths =
      layer
        .replace(/(?:rgba?|color|oklab|oklch|lab|lch|hsla?|hwb)\([^)]*\)/g, "")
        .match(/-?[\d.]+px/g) ?? [];
    return !(lengths.length > 0 && lengths.every((length) => Number.parseFloat(length) === 0));
  });
}

/** A description of the outline when it would paint, otherwise null. */
function paintedOutline(signature: NodeSignature): string | null {
  const width = Number.parseFloat(signature.outlineWidth);
  if (
    signature.outlineStyle === "none" ||
    signature.outlineStyle === "hidden" ||
    !(width > 0) ||
    TRANSPARENT_COLOR.test(signature.outlineColor)
  ) {
    return null;
  }
  return `${signature.outlineStyle} ${signature.outlineWidth} ${signature.outlineColor}`;
}

/** The colour of one computed `box-shadow` layer, wherever it sits in the layer's text. */
function shadowLayerColour(layer: string): string {
  const functional = layer.match(/(?:rgba?|color|oklab|oklch|lab|lch|hsla?|hwb)\([^)]*\)/);
  if (functional) {
    return functional[0];
  }
  const keyword = layer
    .split(/\s+/)
    .find((token) => token !== "inset" && !/^-?[\d.]+(?:px)?$/.test(token));
  return keyword ?? layer;
}

/** One thing focus adds, with what is needed to judge whether it can be seen. */
export interface IndicatorCandidate {
  description: string;
  /** The CSS colour it is drawn in. */
  colour: string;
  /** The CSS colour of what it is drawn on, when the page could say. */
  against?: string;
}

/**
 * Everything focus adds to the element or one of its ancestors: outlines that paint, and box-shadow
 * layers that paint and were not there before. Both lists are ordered the same way: the element
 * first, then its ancestors.
 */
export function focusIndicators(
  focused: readonly NodeSignature[],
  blurred: readonly NodeSignature[],
): IndicatorCandidate[] {
  const found: IndicatorCandidate[] = [];
  for (const [index, now] of focused.entries()) {
    const before = blurred[index];
    const owner = index === 0 ? "the element" : `ancestor ${index}`;

    const beforeLayers = paintedShadowLayers(before?.shadow ?? "");
    for (const layer of paintedShadowLayers(now.shadow)) {
      if (!beforeLayers.includes(layer)) {
        found.push({
          description: `${owner} gains box-shadow ${layer}`,
          colour: shadowLayerColour(layer),
          against: (/\binset\b/.test(layer) ? now.fill : now.surround) || undefined,
        });
      }
    }

    const outline = paintedOutline(now);
    if (outline && outline !== (before ? paintedOutline(before) : null)) {
      const inside = Number.parseFloat(now.outlineOffset ?? "0") < 0;
      // `outline-style: auto` is the browser's own focus ring. It is drawn in two tones so that it shows
      // on any background, while the computed colour is only one of them (near black in Chromium), so
      // that colour says nothing about how well it can be seen and the ring is not judged by it.
      const browsersOwn = now.outlineStyle === "auto";
      found.push({
        description: `${owner} gains outline ${outline}`,
        colour: now.outlineColor,
        against: browsersOwn ? undefined : (inside ? now.fill : now.surround) || undefined,
      });
    }
  }
  return found;
}

/** What focus adds to the element or one of its ancestors, or null when it adds nothing that paints. */
export function focusIndicator(
  focused: readonly NodeSignature[],
  blurred: readonly NodeSignature[],
): string | null {
  return focusIndicators(focused, blurred)[0]?.description ?? null;
}

/**
 * Whether the best of `ratios` (the contrast of each candidate against its background, null where the
 * page could not say) reaches the minimum. Unknown counts as visible: with no colours to compare, the
 * painted-ness already checked is all the sweep has.
 */
export function visibleEnough(ratios: unknown): { visible: boolean; best: number | null } {
  const known = Array.isArray(ratios)
    ? ratios.filter((ratio): ratio is number => typeof ratio === "number" && Number.isFinite(ratio))
    : [];
  if (known.length === 0) {
    return { visible: true, best: null };
  }
  const best = Math.max(...known);
  return { visible: best >= MIN_INDICATOR_CONTRAST, best };
}

// The page half is a string rather than a function: this file is transpiled for the runner, and a
// transpiler that injects helpers (esbuild's keepNames wraps inner functions in `__name`) would
// break a function body once Playwright serialises it into the page. It uses no template
// expressions, backticks or backslashes, so nothing in it needs escaping.
const SWEEP_SCRIPT = `(() => {
  if (window.__sbKeyboardSweep) { return; }
  const ids = new WeakMap();
  let nextId = 1;
  // Two frames lets a focus-driven re-render and any remaining style recalculation land.
  const settle = () => new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    window.setTimeout(() => resolve(), 100);
  });
  // Any CSS colour the engine understands (oklch, color-mix, system colours) becomes [r, g, b, a]
  // by painting it on a one pixel canvas. There is no canvas in jsdom; contrast is then unknown.
  const jsdom = typeof navigator !== 'undefined' && navigator.userAgent.indexOf('jsdom') !== -1;
  const canvas = jsdom ? null : document.createElement('canvas');
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d', { willReadFrequently: true }) : null;
  if (canvas) { canvas.width = 1; canvas.height = 1; }
  const SENTINEL = '#010203';
  const rgba = (css) => {
    if (!ctx || !css) { return null; }
    ctx.fillStyle = SENTINEL;
    ctx.fillStyle = css;
    // An assignment the engine cannot parse is ignored and leaves the sentinel behind.
    if (ctx.fillStyle === SENTINEL && css.split(' ').join('').toLowerCase() !== SENTINEL) { return null; }
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const over = (fg, bg) => [
    fg[0] * fg[3] + bg[0] * (1 - fg[3]),
    fg[1] * fg[3] + bg[1] * (1 - fg[3]),
    fg[2] * fg[3] + bg[2] * (1 - fg[3]),
  ];
  const channel = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const luminance = (c) => 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
  const ratioOf = (a, b) => {
    const x = luminance(a);
    const y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const solid = (c) => 'rgb(' + Math.round(c[0]) + ', ' + Math.round(c[1]) + ', ' + Math.round(c[2]) + ')';
  // The opaque colour a node's box sits on: backgrounds from the node up, composited onto the page.
  const backdrop = (start) => {
    if (!ctx) { return ''; }
    const layers = [];
    for (let n = start; n; n = n.parentElement) {
      const c = rgba(window.getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) { break; } }
    }
    let result = document.documentElement.classList.contains('dark') ? [9, 9, 11] : [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i--) { result = over(layers[i], result); }
    return solid(result);
  };
  const sign = (node) => {
    const style = window.getComputedStyle(node);
    return {
      shadow: style.boxShadow,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      outlineOffset: style.outlineOffset,
      surround: backdrop(node.parentElement),
      fill: backdrop(node),
    };
  };
  const nameOf = (el) => {
    const label = el.getAttribute('aria-label');
    if (label) { return label; }
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const text = by.split(' ').map((id) => { const n = document.getElementById(id); return n ? n.textContent : ''; }).join(' ').trim();
      if (text) { return text; }
    }
    if (el.labels && el.labels.length) {
      return Array.prototype.map.call(el.labels, (l) => (l.textContent || '').trim()).join(' ');
    }
    const own = (el.textContent || '').trim();
    if (own) { return own.slice(0, 60); }
    return el.getAttribute('title') || el.getAttribute('placeholder') || '';
  };
  window.__sbKeyboardSweep = {
    // For each [foreground, background] pair of CSS colours, the contrast ratio of the foreground
    // (laid over the background if it is translucent) against the background; null if unknown.
    contrast(pairs) {
      return pairs.map((pair) => {
        const fg = rgba(pair[0]);
        const bg = rgba(pair[1]);
        if (!fg || !bg) { return null; }
        return ratioOf(over(fg, bg), bg);
      });
    },
    prepare() {
      const active = document.activeElement;
      if (active && active !== document.body && active.blur) { active.blur(); }
      window.scrollTo(0, 0);
      // Park the focus navigation starting point at the top of the document, so the first Tab lands
      // on the first stop whatever the story's play function left focused.
      const marker = document.createElement('span');
      marker.tabIndex = -1;
      document.body.insertBefore(marker, document.body.firstChild);
      marker.focus({ preventScroll: true });
      marker.remove();
      if (!document.getElementById('sb-keyboard-sweep-style')) {
        const style = document.createElement('style');
        style.id = 'sb-keyboard-sweep-style';
        style.textContent = '*, *::before, *::after { transition: none !important; }';
        document.head.appendChild(style);
      }
    },
    async step() {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) { return { kind: 'none' }; }
      if (!ids.has(el)) { ids.set(el, nextId++); }
      const id = ids.get(el);
      if (el.hasAttribute('data-radix-focus-guard')) { return { kind: 'guard', id }; }
      await settle();
      const chain = [];
      for (let n = el, i = 0; n && n !== document.documentElement && i < 4; n = n.parentElement, i++) { chain.push(n); }
      const focused = chain.map(sign);
      el.blur();
      await settle();
      const blurred = chain.map(sign);
      el.focus({ preventScroll: true });
      const element = { tag: el.tagName.toLowerCase(), name: nameOf(el) };
      if (el.getAttribute('type')) { element.type = el.getAttribute('type'); }
      if (el.getAttribute('role')) { element.role = el.getAttribute('role'); }
      return { kind: 'element', id, element, focused, blurred };
    },
  };
})()`;

const describeSweepElement = ({ tag, type, role, name }: SweepElement) =>
  `<${tag}${type ? ` type="${type}"` : ""}${role ? ` role="${role}"` : ""}>${name ? ` "${name}"` : ""}`;

/** What one Tab pass found: a line per stop with no visible focus indicator, and whether it ran out of presses. */
interface SweepResult {
  problems: string[];
  /** Tab was still reaching stops it had not seen when `maxStops` presses were used up. */
  truncated: boolean;
  stops: number;
}

/**
 * How well the best of a stop's candidate indicators can be seen, asked of the page: it holds the
 * colours and the canvas that understands them. Unknown (no candidate had a background to compare
 * with, or the page cannot parse colours) reads as visible.
 */
async function indicatorContrast(
  page: StoryPage,
  candidates: readonly IndicatorCandidate[],
): Promise<{ visible: boolean; best: number | null }> {
  const pairs = candidates.flatMap((candidate) =>
    candidate.against ? [[candidate.colour, candidate.against]] : [],
  );
  if (pairs.length === 0) {
    return { visible: true, best: null };
  }
  return visibleEnough(
    await page.evaluate(`window.__sbKeyboardSweep.contrast(${JSON.stringify(pairs)})`),
  );
}

/** One Tab pass over the page. */
async function sweepOnce(page: StoryPage, maxStops: number): Promise<SweepResult> {
  await page.evaluate(SWEEP_SCRIPT);
  await page.evaluate("window.__sbKeyboardSweep.prepare()");

  const seen = new Set<number>();
  const problems: string[] = [];
  let stops = 0;
  let ended = false;

  /** Presses Tab once and reads the stop it lands on; null when the pass is over. */
  const nextStop = async (): Promise<Exclude<SweepStop, { kind: "none" }> | null> => {
    await page.keyboard.press("Tab");
    const stop = (await page.evaluate("window.__sbKeyboardSweep.step()")) as SweepStop;
    if (stop.kind === "none" || seen.has(stop.id)) {
      return null;
    }
    return stop;
  };

  for (let pressed = 0; pressed < maxStops; pressed += 1) {
    const stop = await nextStop();
    if (!stop) {
      ended = true;
      break;
    }
    seen.add(stop.id);
    if (stop.kind === "guard") {
      continue;
    }
    stops += 1;
    const candidates = focusIndicators(stop.focused, stop.blurred);
    const where = `  stop ${stops} ${describeSweepElement(stop.element)}`;
    if (candidates.length === 0) {
      problems.push(`${where}: focus draws no outline or ring`);
      continue;
    }
    const { visible, best } = await indicatorContrast(page, candidates);
    if (!visible) {
      problems.push(
        `${where}: the indicator is too faint to see, ${best?.toFixed(2)}:1 against what it is drawn on and ` +
          `${MIN_INDICATOR_CONTRAST}:1 is the minimum (${candidates.map((c) => c.description).join("; ")})`,
      );
    }
  }

  // Out of presses is not the end of the page: one more Tab says whether there was anything left.
  const truncated = !ended && (await nextStop()) !== null;
  await page.evaluate(
    "document.activeElement && document.activeElement.blur && document.activeElement.blur()",
  );

  if (stops === 0) {
    throw new Error("no Tab stop found: the story has nothing focusable to sweep");
  }
  return { problems, truncated, stops };
}

/** The theme the page is really in, which the sweep reports and checks against the story's `globals`. */
async function readPageTheme(page: StoryPage): Promise<"light" | "dark" | null> {
  const theme = await page.evaluate(
    "document.documentElement.classList.contains('dark') ? 'dark' : 'light'",
  );
  return theme === "dark" || theme === "light" ? theme : null;
}

/**
 * Runs the Tab sweep for a story that asked for it with `parameters.keyboard.sweep`, and throws
 * listing every stop that shows no visible focus indicator, and any page with more stops than
 * `maxStops`. Exported so a script can run it on a live page.
 */
export async function runKeyboardSweep(page: StoryPage, storyContext: StoryContext): Promise<void> {
  const options = storyContext.parameters?.keyboard as
    | { sweep?: boolean; maxStops?: number; forcedColors?: boolean }
    | undefined;
  if (!options?.sweep) {
    return;
  }

  const maxStops = options.maxStops ?? DEFAULT_SWEEP_MAX_STOPS;
  const { theme: declared = "light" } = readStoryGlobals(storyContext);
  const rendered = await readPageTheme(page);
  if (rendered && rendered !== declared) {
    // A story can ask for a theme and not get it (Storybook ignores `parameters.globals`); sweeping the
    // wrong theme would pass without checking a single dark ring.
    throw new Error(
      `Keyboard sweep: story "${storyContext.id}" is set to the ${declared} theme but rendered in the ` +
        `${rendered} theme, so the sweep would not check what it claims to. Give the story a ` +
        "story-level `globals: { theme }`; Storybook ignores `parameters.globals`.",
    );
  }
  const theme = rendered ?? declared;
  const failures: string[] = [];

  const note = (label: string, result: SweepResult) => {
    if (result.problems.length > 0) {
      failures.push(`${label}:\n${result.problems.join("\n")}`);
    }
    if (result.truncated) {
      failures.push(
        `${label}: Tab was still finding new stops after ${maxStops} presses (${result.stops} checked), ` +
          "so the rest were not swept. Raise parameters.keyboard.maxStops.",
      );
    }
  };

  note(`${theme} theme`, await sweepOnce(page, maxStops));

  if (options.forcedColors) {
    await page.emulateMedia({ forcedColors: "active" });
    try {
      note(
        "forced-colors mode (box-shadow rings do not survive it)",
        await sweepOnce(page, maxStops),
      );
    } finally {
      await page.emulateMedia({ forcedColors: null });
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Keyboard sweep: story "${storyContext.id}" did not pass.\n${failures.join("\n")}`,
    );
  }
}

const config: TestRunnerConfig = {
  setup() {
    expect.extend({ toMatchImageSnapshot });
  },
  async preVisit(page, _context) {
    if (isVisualRun()) {
      return;
    }

    await injectAxe(page);
  },
  async postVisit(page, context) {
    const storyContext = await getStoryContext(page, context);

    // The accessibility pass and the visual pass are mutually exclusive. An axe violation throws
    // before a screenshot could be taken, which would leave that story without a baseline; CI runs
    // the two passes as separate jobs instead. The keyboard sweep belongs to the accessibility pass.
    if (!isVisualRun()) {
      await runAxe(page, storyContext);
      await runKeyboardSweep(page, storyContext);
      return;
    }

    if (storyContext.parameters?.visual?.disable) {
      return;
    }

    // Wait for webfonts and network idle first, then freeze: injecting the CSS earlier would
    // suppress the very work this call waits on.
    await waitForPageReady(page);

    // A story whose renderer paints to a canvas can name the marker it sets when it is done, so the
    // settle delay below starts from "finished drawing" rather than from "network idle".
    const waitForSelector = storyContext.parameters?.visual?.waitForSelector;
    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: WAIT_FOR_SELECTOR_TIMEOUT_MS });
    }

    await page.addStyleTag({ content: FREEZE_CSS });
    await page.waitForTimeout(
      storyContext.parameters?.visual?.settleDelay ?? DEFAULT_SETTLE_DELAY_MS,
    );

    const rootElement = await page.$("#storybook-root");
    if (!rootElement) {
      throw new Error(`No #storybook-root element found for story ${storyContext.id}`);
    }

    const image = await rootElement.screenshot();
    const { theme = "light", density = "Medium" } = readStoryGlobals(storyContext);

    expect(image).toMatchImageSnapshot({
      customSnapshotsDir: snapshotsDir,
      customSnapshotIdentifier: `${storyContext.id}-${theme}-${density.toLowerCase()}`,
      customDiffDir: path.join(snapshotsDir, "__diff_output__"),
      failureThreshold: 0.01,
      failureThresholdType: "percent",
    });
  },
};

export default config;
