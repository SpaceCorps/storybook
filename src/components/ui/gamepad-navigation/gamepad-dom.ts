/**
 * The DOM half of the gamepad navigation layer: finding what can take focus, moving it, and
 * translating an action into the events a keyboard would have produced. Every function takes the
 * `Document` it works on, so nothing here touches a global at import time.
 */
import {
  ARROW_KEY,
  compositeDirections,
  isForward,
  isTrappingRole,
  layoutOrientation,
  menuDirections,
  pickSpatialTarget,
  runsOffEnd,
  stepIndex,
  type Direction,
  type GamepadAction,
  type Orientation,
} from "./gamepad-logic";

/** Set on the element that has gamepad focus, so a stylesheet or utility class can ring it. */
export const GAMEPAD_FOCUS_ATTRIBUTE = "data-gamepad-focus";

/** Set on `<html>` to the input device used last, once the layer has seen a pad. */
export const INPUT_MODALITY_ATTRIBUTE = "data-input-modality";

/**
 * Put on a field that steps its value with ArrowUp and ArrowDown but has no role that says so (a masked
 * text input, say). The pad then sends Up and Down to it instead of moving focus away. An element with
 * `role="spinbutton"` and a native `input[type=number]` need no attribute.
 */
export const GAMEPAD_STEP_ATTRIBUTE = "data-gamepad-step";

export type InputModality = "gamepad" | "keyboard" | "pointer";

/** What an action did, for the caller's readout. */
export interface ActionOutcome {
  handled: boolean;
  target: HTMLElement | null;
}

// Events the layer dispatches itself must not read as a person picking the keyboard back up.
let syntheticDepth = 0;

/** True while the layer is dispatching a key or click of its own. */
export const isSyntheticInput = (): boolean => syntheticDepth > 0;

function asSynthetic<T>(run: () => T): T {
  syntheticDepth += 1;
  try {
    return run();
  } finally {
    syntheticDepth -= 1;
  }
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button",
  "input:not([type=hidden])",
  "select",
  "textarea",
  "summary",
  "audio[controls]",
  "video[controls]",
  '[contenteditable]:not([contenteditable="false"])',
  "[tabindex]",
].join(",");

const HIDDEN_ANCESTOR_SELECTOR = '[aria-hidden="true"], [inert]';

// Radix sets no `aria-modal`, but every layer it manages carries `data-state="open"`; a persistent
// panel that merely has role="dialog" does not, and must not capture the pad.
const LAYER_SELECTOR = [
  '[role="dialog"][aria-modal="true"]',
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"]',
  "dialog[open]",
].join(",");

const COMPOSITE_CONTAINER_SELECTOR = [
  "tablist",
  "radiogroup",
  "listbox",
  "menu",
  "menubar",
  "toolbar",
  "tree",
  "grid",
  "treegrid",
  // Only a roving-focus group counts, see `isRovingGroup`; any other group is a plain wrapper.
  "group",
]
  .map((role) => `[role="${role}"]`)
  .join(",");

/** Radix puts this on every item of a roving-focus widget: toggle groups, radio groups, tab lists. */
const COLLECTION_ITEM_SELECTOR = "[data-radix-collection-item]";

/** Roles that are a widget on their own, with no container around them. */
const STANDALONE_COMPOSITE_ROLES = new Set(["slider", "spinbutton", "separator", "combobox"]);

/** Roles that mean "pressing this opens something", whose key handling Radix does not mirror on click. */
const isPopupTrigger = (element: Element) =>
  (element.hasAttribute("aria-haspopup") && element.getAttribute("aria-haspopup") !== "false") ||
  element.getAttribute("role") === "combobox";

function isRendered(element: Element): boolean {
  const probe = element as Element & { checkVisibility?: (options?: object) => boolean };
  if (typeof probe.checkVisibility === "function") {
    return probe.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true });
  }
  // No checkVisibility (jsdom, old engines): walk up looking for the usual ways of hiding something.
  const view = element.ownerDocument.defaultView;
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (node.hasAttribute("hidden")) {
      return false;
    }
    if (view?.getComputedStyle(node).display === "none") {
      return false;
    }
  }
  const visibility = view?.getComputedStyle(element).visibility;
  return visibility !== "hidden" && visibility !== "collapse";
}

function isTabbable(element: HTMLElement, root: Element): boolean {
  if (element.matches(":disabled") || element.hasAttribute("data-radix-focus-guard")) {
    return false;
  }
  const tabindex = element.getAttribute("tabindex");
  if (tabindex !== null && Number.parseInt(tabindex, 10) < 0) {
    return false;
  }
  // Only hiding that happens inside the root counts: the root may itself sit in a hidden subtree.
  const hiddenAncestor = element.closest(HIDDEN_ANCESTOR_SELECTOR);
  if (hiddenAncestor && root.contains(hiddenAncestor)) {
    return false;
  }
  return isRendered(element);
}

const isNativeRadio = (element: Element): element is HTMLInputElement =>
  element.localName === "input" && (element as HTMLInputElement).type === "radio";

/**
 * A Tab key visits one radio of a named group: the checked one, else the first. The others are
 * reached with the arrow keys, which is how the pad steps through them, so they are not stops here.
 */
function onePerRadioGroup(elements: readonly HTMLElement[]): HTMLElement[] {
  const stops = new Map<HTMLFormElement | null, Map<string, HTMLInputElement>>();
  for (const element of elements) {
    if (isNativeRadio(element) && element.name) {
      const group = stops.get(element.form) ?? new Map<string, HTMLInputElement>();
      stops.set(element.form, group);
      if (!group.has(element.name) || element.checked) {
        group.set(element.name, element);
      }
    }
  }
  return elements.filter(
    (element) =>
      !isNativeRadio(element) ||
      !element.name ||
      stops.get(element.form)?.get(element.name) === element,
  );
}

/** The visible, enabled elements under `root` that a Tab key would stop on, in document order. */
export function tabbableElements(root: Element): HTMLElement[] {
  return onePerRadioGroup(
    Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) =>
      isTabbable(element, root),
    ),
  );
}

/** The open modal layer on top, or the page when none is open. */
export function navigationRoot(doc: Document): HTMLElement {
  const layers = Array.from(doc.querySelectorAll<HTMLElement>(LAYER_SELECTOR)).filter(
    (layer) => isRendered(layer) && !layer.closest(HIDDEN_ANCESTOR_SELECTOR),
  );
  return layers.at(-1) ?? doc.body;
}

function focusedWithin(doc: Document, root: Element): HTMLElement | null {
  const active = doc.activeElement as HTMLElement | null;
  if (!active || active === doc.body || active === doc.documentElement) {
    return null;
  }
  return root.contains(active) ? active : null;
}

/** Moves real focus. `focusVisible` makes engines that support it treat this as keyboard focus. */
export function focusElement(element: HTMLElement): void {
  const options: FocusOptions & { focusVisible?: boolean } = { focusVisible: true };
  element.focus(options);
}

/** Puts the gamepad focus attribute on `element` and takes it off everything else. */
export function markGamepadFocus(doc: Document, element: Element | null): void {
  for (const stale of doc.querySelectorAll(`[${GAMEPAD_FOCUS_ATTRIBUTE}]`)) {
    if (stale !== element) {
      stale.removeAttribute(GAMEPAD_FOCUS_ATTRIBUTE);
    }
  }
  element?.setAttribute(GAMEPAD_FOCUS_ATTRIBUTE, "");
}

/** The focused element, unless focus is on nothing in particular (the page itself). */
function realActiveElement(doc: Document): HTMLElement | null {
  const active = doc.activeElement as HTMLElement | null;
  return active && active !== doc.body && active !== doc.documentElement ? active : null;
}

/** Marks whatever currently has focus, or clears the mark when nothing real does. */
export function markActiveElement(doc: Document): void {
  markGamepadFocus(doc, realActiveElement(doc));
  rememberActiveElement(doc);
}

/**
 * Where focus was, for when the element that held it is taken out of the page. The browser drops
 * focus onto the page without a word, and Tab then carries on from the spot the element left; the pad
 * has no such memory of its own, so it would start again from the first control and scroll to the top.
 * `spot` is a live range around the element: when the element is removed the range collapses to the
 * place it was, which is exactly the starting point a browser keeps for the next Tab.
 */
interface FocusMemory {
  element: HTMLElement;
  spot: Range;
}

const focusMemories = new WeakMap<Document, FocusMemory>();

/** Remembers the element that has focus now, so the next action can carry on from it if it goes away. */
export function rememberActiveElement(doc: Document): void {
  const active = realActiveElement(doc);
  if (!active?.parentNode || focusMemories.get(doc)?.element === active) {
    return;
  }
  const spot = doc.createRange();
  spot.selectNode(active);
  focusMemories.set(doc, { element: active, spot });
}

/**
 * The control nearest to where the remembered element was, or null when that element is still there
 * and usable (focus was dropped for another reason), lies outside `root` (a layer opened over it), or
 * nothing was remembered. Going down or right it is the first control after the spot, going up or left
 * the last one before it, like Tab and Shift+Tab; when there is none that way it is the one on the
 * other side. Forgets the memory once it has used it.
 */
function recoverFocus(
  doc: Document,
  root: Element,
  tabbables: readonly HTMLElement[],
  direction: Direction | null,
): HTMLElement | null {
  const memory = focusMemories.get(doc);
  if (!memory) {
    return null;
  }
  const { element } = memory;
  const gone = !element.isConnected || (root.contains(element) && !tabbables.includes(element));
  if (!gone) {
    return null;
  }
  focusMemories.delete(doc);
  let before: HTMLElement | null = null;
  let after: HTMLElement | null = null;
  try {
    for (const candidate of tabbables) {
      if (memory.spot.comparePoint(candidate, 0) < 0) {
        before = candidate;
      } else if (!after) {
        after = candidate;
      }
    }
  } catch {
    // The range is in another tree than the page: its element went away along with its whole subtree.
    return null;
  }
  return direction === "up" || direction === "left" ? (before ?? after) : (after ?? before);
}

/** Where to put focus when nothing has it: where it was a moment ago, else the first control. */
function startingTarget(
  doc: Document,
  root: Element,
  tabbables: readonly HTMLElement[],
  direction: Direction | null,
): HTMLElement | null {
  return recoverFocus(doc, root, tabbables, direction) ?? tabbables[0] ?? null;
}

/** A short, human label for an element: its role (or tag) and its accessible name when it has one. */
export function describeElement(element: Element | null): string {
  if (!element) {
    return "nothing";
  }
  const doc = element.ownerDocument;
  const kind = element.getAttribute("role") ?? element.localName;
  const labelledBy = element
    .getAttribute("aria-labelledby")
    ?.split(/\s+/)
    .map((id) => doc.getElementById(id)?.textContent ?? "")
    .join(" ");
  const label = (element as HTMLInputElement).labels?.[0]?.textContent;
  const name = [
    element.getAttribute("aria-label"),
    labelledBy,
    label,
    element.textContent,
    element.getAttribute("placeholder"),
    element.getAttribute("title"),
  ]
    .map((candidate) => candidate?.replace(/\s+/g, " ").trim())
    .find(Boolean);
  return name ? `${kind} "${name.length > 40 ? `${name.slice(0, 39)}…` : name}"` : kind;
}

/** How long a dispatched key stays "down", like a quick tap on a real key. */
const KEY_RELEASE_DELAY_MS = 50;

const pendingReleases = new Set<() => void>();

/**
 * Dispatches a keydown now and the matching keyup a moment later. Radix radios, for one, move focus
 * on a timer after the arrow and only check the new radio if the key is still down when focus lands.
 * True when something handled the keydown.
 */
function pressKey(target: Element, key: string): boolean {
  const init = { key, code: key, bubbles: true, cancelable: true, composed: true };
  const handled = asSynthetic(() => !target.dispatchEvent(new KeyboardEvent("keydown", init)));

  const doc = target.ownerDocument;
  const view = doc.defaultView ?? globalThis;
  const release = () => {
    view.clearTimeout(timer);
    pendingReleases.delete(release);
    asSynthetic(() =>
      (doc.activeElement ?? doc.body).dispatchEvent(new KeyboardEvent("keyup", init)),
    );
  };
  const timer = view.setTimeout(release, KEY_RELEASE_DELAY_MS);
  pendingReleases.add(release);
  return handled;
}

/** Sends the keyups still waiting on their timer now, so no key is left looking pressed. */
export function releasePressedKeys(): void {
  for (const release of pendingReleases) {
    release();
  }
}

const ROW_DIRECTIONS: readonly Direction[] = ["up", "down"];

/**
 * Which way a widget runs, or null when it does not say. `aria-orientation` (or Radix's
 * `data-orientation`) is the widget's own word; a window splitter from react-resizable-panels has
 * neither and names the direction its *panels* run instead, which is the other way round: panels
 * side by side are parted by an upright divider, and an upright divider moves with Left and Right.
 */
function orientationOf(element: Element): Orientation | null {
  const declared =
    element.getAttribute("aria-orientation") ?? element.getAttribute("data-orientation");
  if (declared === "horizontal" || declared === "vertical") {
    return declared;
  }
  if (element.getAttribute("role") === "separator") {
    const panels = element.getAttribute("data-panel-group-direction");
    if (panels === "horizontal") {
      return "vertical";
    }
    if (panels === "vertical") {
      return "horizontal";
    }
  }
  return null;
}

/** How the focused widget takes part in the D-pad; see the table on `compositeDirections`. */
interface WidgetPolicy {
  /** The directions it keeps for itself, sent to it as arrow keys. */
  own: readonly Direction[];
  /** True when `direction` would run off its first or last item, so the pad moves on instead. */
  atEnd?: (direction: Direction) => boolean;
  /** It has no free axis: a key it did not act on has to leave rather than be swallowed. */
  trapping: boolean;
}

const isDisabled = (element: HTMLElement) =>
  element.matches(":disabled") ||
  element.getAttribute("aria-disabled") === "true" ||
  element.hasAttribute("data-disabled");

/**
 * A run of items that rove focus between them: the orientation the group declares, else the way the
 * items are laid out, else all four directions. Past the first or last item the pad moves on.
 */
function rovingPolicy(
  group: HTMLElement,
  active: HTMLElement,
  items: readonly HTMLElement[],
): WidgetPolicy | null {
  const index = items.indexOf(active);
  if (index < 0) {
    return null;
  }
  const orientation =
    orientationOf(group) ?? layoutOrientation(items.map((item) => item.getBoundingClientRect()));
  return {
    own: compositeDirections("radiogroup", orientation) ?? [],
    atEnd: (direction) => runsOffEnd(direction, index, items.length),
    trapping: false,
  };
}

const usable = (item: HTMLElement) => !isDisabled(item) && isRendered(item);

/** The roving items of a radio group, in document order. */
const radioItems = (group: HTMLElement) =>
  Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]')).filter(usable);

/**
 * The roving items of a Radix toggle group (`role="group"`, items marked with the collection
 * attribute). Only the group's own items: a group nested inside it has its own.
 */
const groupItems = (group: HTMLElement) =>
  Array.from(group.querySelectorAll<HTMLElement>(COLLECTION_ITEM_SELECTOR)).filter(
    (item) => item.closest('[role="group"]') === group && usable(item),
  );

/**
 * True when `group` is a toggle group that roves focus around `active`. Its items other than the
 * current one are `tabindex=-1`, so a pad that treated it as a pile of buttons could never reach them
 * (the Month and Week switch of a calendar). A plain `role="group"` wrapper is not one.
 */
function isRovingGroup(group: HTMLElement, active: HTMLElement): boolean {
  return (
    active.matches(COLLECTION_ITEM_SELECTOR) &&
    active.closest('[role="group"]') === group &&
    groupItems(group).length > 1
  );
}

/** The composite widget around `active`: the nearest container that is one, skipping plain groups. */
function compositeContainerOf(active: HTMLElement): HTMLElement | null {
  for (
    let container = active.closest<HTMLElement>(COMPOSITE_CONTAINER_SELECTOR);
    container;
    container = container.parentElement?.closest<HTMLElement>(COMPOSITE_CONTAINER_SELECTOR) ?? null
  ) {
    if (container.getAttribute("role") !== "group" || isRovingGroup(container, active)) {
      return container;
    }
  }
  return null;
}

/**
 * A menu keeps Up and Down; Right and Left are its too only where they open or close a submenu or
 * switch menus in a menubar. A submenu is portaled out of its parent, so what opened a menu is found
 * through `aria-labelledby`, which Radix points at the trigger (or the sub trigger) of every menu;
 * an app that gives its own trigger an id breaks that link, and a submenu is then taken for a menu.
 */
function menuPolicy(menu: HTMLElement, active: HTMLElement): WidgetPolicy {
  const labelledBy = menu.getAttribute("aria-labelledby");
  const opener = labelledBy ? menu.ownerDocument.getElementById(labelledBy) : null;
  const popup = active.getAttribute("aria-haspopup");
  return {
    own: menuDirections({
      hasSubmenu: popup !== null && popup !== "false",
      isSubmenu: opener?.closest('[role="menu"]') != null,
      // Radix marks a menubar's menus itself, which survives an app giving the trigger an id of its own.
      inMenubar:
        menu.hasAttribute("data-radix-menubar-content") ||
        opener?.closest('[role="menubar"]') != null,
    }),
    trapping: false,
  };
}

/** The policy of the widget around `active`, or null outside one. */
function widgetPolicy(active: HTMLElement): WidgetPolicy | null {
  if (active.hasAttribute(GAMEPAD_STEP_ATTRIBUTE)) {
    return { own: compositeDirections("spinbutton") ?? [], trapping: false };
  }
  const ownRole = active.getAttribute("role");
  if (ownRole && STANDALONE_COMPOSITE_ROLES.has(ownRole)) {
    const own = compositeDirections(
      ownRole,
      orientationOf(active),
      active.getAttribute("aria-expanded") === "true",
    );
    return own && { own, trapping: false };
  }
  const container = compositeContainerOf(active);
  if (container) {
    const role = container.getAttribute("role");
    if (role === "radiogroup") {
      return rovingPolicy(container, active, radioItems(container));
    }
    if (role === "group") {
      return rovingPolicy(container, active, groupItems(container));
    }
    if (role === "menu") {
      return menuPolicy(container, active);
    }
    const own = compositeDirections(role, orientationOf(container));
    return own && { own, trapping: isTrappingRole(role) };
  }
  // A focused table row is the roving-row pattern (DataTable): only one row is a tab stop and the
  // vertical arrows move focus between rows, so those two directions are the row's.
  return active.localName === "tr" && active.hasAttribute("tabindex")
    ? { own: ROW_DIRECTIONS, trapping: false }
    : null;
}

function fireInputEvents(element: HTMLElement): void {
  asSynthetic(() => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** The radios that share `input`'s name and form, in document order; an unnamed radio is a group of one. */
function nativeRadioGroup(input: HTMLInputElement): HTMLInputElement[] {
  if (!input.name) {
    return [input];
  }
  return Array.from(
    input.ownerDocument.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
  ).filter(
    (radio) =>
      radio.name === input.name &&
      radio.form === input.form &&
      !radio.disabled &&
      (radio === input || isRendered(radio)),
  );
}

function stepNativeRadio(input: HTMLInputElement, direction: Direction): boolean {
  const group = nativeRadioGroup(input);
  const index = group.indexOf(input);
  const orientation = layoutOrientation(group.map((radio) => radio.getBoundingClientRect()));
  if (
    index < 0 ||
    !compositeDirections("radiogroup", orientation)?.includes(direction) ||
    runsOffEnd(direction, index, group.length)
  ) {
    return false;
  }
  const target = group[index + (isForward(direction) ? 1 : -1)]!;
  focusElement(target);
  asSynthetic(() => target.click());
  return true;
}

/**
 * One step of a range input. `stepUp` and `stepDown` throw on `step="any"`, so that case moves by a
 * hundredth of the range, which is what a browser's own arrow key does there.
 */
function nudgeRange(input: HTMLInputElement, sign: 1 | -1): void {
  if (input.step.toLowerCase() !== "any") {
    try {
      if (sign > 0) {
        input.stepUp();
      } else {
        input.stepDown();
      }
      return;
    } catch {
      // A step the input cannot honour: fall back to the hundredth.
    }
  }
  const min = Number.parseFloat(input.min);
  const max = Number.parseFloat(input.max);
  const low = Number.isFinite(min) ? min : 0;
  const high = Number.isFinite(max) ? max : 100;
  const next = Math.min(high, Math.max(low, Number(input.value) + (sign * (high - low)) / 100));
  setNativeValue(input, String(Number(next.toFixed(10))));
}

/**
 * Sets an input's value the way a person typing would, past the instance setter React wraps to track
 * values: assigning through that one makes React believe nothing changed and drop the `onChange`.
 */
function setNativeValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input) as object,
    "value",
  );
  if (descriptor?.set) {
    descriptor.set.call(input, value);
  } else {
    input.value = value;
  }
}

function stepNativeRange(input: HTMLInputElement, direction: Direction): boolean {
  if (!compositeDirections("slider", orientationOf(input))?.includes(direction)) {
    return false;
  }
  const before = input.value;
  nudgeRange(input, direction === "right" || direction === "up" ? 1 : -1);
  if (input.value !== before) {
    fireInputEvents(input);
  }
  return true;
}

/**
 * A native number input steps with Up and Down. It is a spinbutton by nature, so the pad keeps both
 * directions for it and leaves by Left and Right, which a text caret would use anyway. `stepUp` and
 * `stepDown` throw on `step="any"` or a value they cannot step from; the keys do nothing then, as they
 * do in a browser.
 */
function stepNativeNumber(input: HTMLInputElement, direction: Direction): boolean {
  if (direction !== "up" && direction !== "down") {
    return false;
  }
  if (input.readOnly || input.disabled) {
    return true;
  }
  const before = input.value;
  try {
    if (direction === "up") {
      input.stepUp();
    } else {
      input.stepDown();
    }
  } catch {
    // step="any" or a value that cannot be stepped.
  }
  if (input.value !== before) {
    fireInputEvents(input);
  }
  return true;
}

function stepNativeSelect(select: HTMLSelectElement, direction: Direction): boolean {
  // Left and right change the value; up and down always move on, so passing a select never alters it.
  if (direction !== "left" && direction !== "right") {
    return false;
  }
  const step = isForward(direction) ? 1 : -1;
  const unavailable = (option: HTMLOptionElement | undefined) =>
    !option || option.disabled || option.parentElement?.matches("optgroup[disabled]") === true;
  let index = select.selectedIndex + step;
  while (index >= 0 && index < select.options.length && unavailable(select.options[index])) {
    index += step;
  }
  if (select.options[index] && index !== select.selectedIndex) {
    select.selectedIndex = index;
    fireInputEvents(select);
  }
  return true;
}

/**
 * Native radios, selects, ranges and number inputs only react to trusted arrow keys, so a dispatched
 * ArrowRight would do nothing. Step them directly instead. True when the control took `direction`; false lets
 * the direction move focus, which is how a pad gets out of one (see the table on `compositeDirections`).
 */
function stepNativeControl(active: HTMLElement, direction: Direction): boolean {
  if (active.localName === "input") {
    const input = active as HTMLInputElement;
    if (input.type === "radio") {
      return stepNativeRadio(input, direction);
    }
    if (input.type === "range") {
      return stepNativeRange(input, direction);
    }
    return input.type === "number" ? stepNativeNumber(input, direction) : false;
  }
  if (active.localName === "select" && !(active as HTMLSelectElement).multiple) {
    return stepNativeSelect(active as HTMLSelectElement, direction);
  }
  return false;
}

/** The first tabbable element after `from` in document order, or the last one before it. */
function domOrderNeighbour(
  from: HTMLElement,
  candidates: readonly HTMLElement[],
  direction: Direction,
): HTMLElement | null {
  if (direction === "down" || direction === "right") {
    return (
      candidates.find(
        (candidate) => from.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING,
      ) ?? null
    );
  }
  return (
    candidates.findLast(
      (candidate) => from.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_PRECEDING,
    ) ?? null
  );
}

/** Widgets whose single tab stop stands for the whole widget when focus looks for its neighbours. */
const BOXED_ROLES: ReadonlySet<string | null> = new Set([
  "tablist",
  "radiogroup",
  "listbox",
  "grid",
  "treegrid",
  "tree",
  "toolbar",
  "menubar",
  "group",
]);

/**
 * The box a control counts as occupying when focus looks for its neighbours. A slider's thumb is a
 * few pixels wide and sits wherever the value puts it, so a field below the row would always look
 * "straighter ahead" than the slider itself; the track is what the eye reads as the control. The same
 * goes for the one tab stop of a roving widget (a calendar grid, a tab list, a radio group): the
 * focused cell is a small box off to one side, and a full-width control below the widget would always
 * look "straighter ahead" than the grid it should have gone into. The widget's own box is used, but
 * only when it has one: with no layout (jsdom, a hidden parent) the element's box is all there is.
 */
function spatialRect(element: HTMLElement): DOMRect {
  if (element.getAttribute("role") === "slider") {
    const track = element.parentElement?.closest("[data-orientation]");
    if (track) {
      return track.getBoundingClientRect();
    }
  }
  const container = compositeContainerOf(element);
  if (container && BOXED_ROLES.has(container.getAttribute("role"))) {
    const box = container.getBoundingClientRect();
    if (box.width > 0 || box.height > 0) {
      return box;
    }
  }
  return element.getBoundingClientRect();
}

/** Moves focus to the nearest tabbable element in `direction`, or along document order when none lies that way. */
function moveFocus(doc: Document, direction: Direction): HTMLElement | null {
  const root = navigationRoot(doc);
  const tabbables = tabbableElements(root);
  const active = focusedWithin(doc, root);

  if (!active) {
    const first = startingTarget(doc, root, tabbables, direction);
    if (first) {
      focusElement(first);
    }
    return first;
  }

  // Not the widget that holds focus: Radix's radio group and tab list are tab stops themselves and
  // hand focus straight back to the item that was active, so "moving" onto one goes nowhere and a pad
  // could never leave the group that way. (`contains` is true for `active` itself.)
  const others = tabbables.filter((element) => !element.contains(active));
  const spatial = pickSpatialTarget(spatialRect(active), others.map(spatialRect), direction);
  const target = others[spatial] ?? domOrderNeighbour(active, others, direction);
  if (target) {
    focusElement(target);
  }
  return target;
}

function performDirection(doc: Document, direction: Direction): ActionOutcome {
  const root = navigationRoot(doc);
  const active = focusedWithin(doc, root);

  if (active) {
    if (stepNativeControl(active, direction)) {
      return { handled: true, target: active };
    }
    const policy = widgetPolicy(active);
    if (policy?.own.includes(direction) && !policy.atEnd?.(direction)) {
      const focusBefore = doc.activeElement;
      const taken = pressKey(active, ARROW_KEY[direction]);
      // A widget with no free axis that took no notice of the key must not swallow it: with no Tab on
      // a pad, nothing else would get the user out.
      if (!policy.trapping || taken || doc.activeElement !== focusBefore) {
        return { handled: true, target: active };
      }
    }
  }

  const target = moveFocus(doc, direction);
  return { handled: target !== null, target };
}

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "submit",
  "reset",
  "checkbox",
  "radio",
  "range",
  "color",
  "file",
  "image",
]);

/** The input types that stand in the way of implicit submission (HTML: "fields that block implicit submission"). */
const IMPLICIT_SUBMISSION_BLOCKING_TYPES = new Set([
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
  "date",
  "month",
  "week",
  "time",
  "datetime-local",
  "number",
]);

const isSubmitButton = (element: Element) =>
  (element.localName === "button" && (element as HTMLButtonElement).type === "submit") ||
  (element.localName === "input" &&
    ["submit", "image"].includes((element as HTMLInputElement).type));

/**
 * Submits `form` the way a browser's Enter in a text field does (HTML "implicit submission"), and
 * says whether it did. With a default button (the first submit button) it clicks it, unless that
 * button is disabled, when the form does nothing. With none, the form submits only if this is its
 * single field that could have been submitted from; with two or more text-like fields, Enter alone is
 * not enough to say which form the person meant to send.
 */
function submitImplicitly(form: HTMLFormElement): boolean {
  const elements = Array.from(form.elements);
  const defaultButton = elements.find(isSubmitButton) as
    | HTMLButtonElement
    | HTMLInputElement
    | undefined;
  if (defaultButton) {
    if (defaultButton.disabled) {
      return false;
    }
    asSynthetic(() => defaultButton.click());
    return true;
  }
  const blockers = elements.filter(
    (element) =>
      element.localName === "input" &&
      IMPLICIT_SUBMISSION_BLOCKING_TYPES.has((element as HTMLInputElement).type),
  );
  if (blockers.length > 1) {
    return false;
  }
  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
  } else {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }
  return true;
}

const isSelected = (tab: HTMLElement) => tab.getAttribute("aria-selected") === "true";

/**
 * Focuses a tab and makes sure it is selected. Radix tabs select on focus, so by the time React has
 * rendered there is usually nothing left to do; when there is, press Enter (Radix's manual
 * activation) and then click (hand-rolled tabs).
 */
function selectTab(tab: HTMLElement): void {
  focusElement(tab);
  queueMicrotask(() => {
    if (!tab.isConnected || isSelected(tab)) {
      return;
    }
    pressKey(tab, "Enter");
    queueMicrotask(() => {
      if (tab.isConnected && !isSelected(tab)) {
        asSynthetic(() => tab.click());
      }
    });
  });
}

function performActivate(doc: Document): ActionOutcome {
  const root = navigationRoot(doc);
  const active = focusedWithin(doc, root);
  if (!active) {
    const first = startingTarget(doc, root, tabbableElements(root), null);
    if (first) {
      focusElement(first);
    }
    return { handled: first !== null, target: first };
  }

  if (active.getAttribute("role") === "tab") {
    selectTab(active);
    return { handled: true, target: active };
  }

  if (active.localName === "textarea" || active.isContentEditable) {
    return { handled: false, target: active };
  }

  if (
    active.localName === "input" &&
    !NON_TEXT_INPUT_TYPES.has((active as HTMLInputElement).type)
  ) {
    // Enter in a text field: let the page handle it, else submit the form the way implicit submission does.
    const form = (active as HTMLInputElement).form;
    if (pressKey(active, "Enter") || !form) {
      return { handled: true, target: active };
    }
    return { handled: submitImplicitly(form), target: active };
  }

  if (active.localName === "select") {
    try {
      (active as HTMLSelectElement).showPicker();
    } catch {
      // Not supported, or not allowed without a user gesture.
      return { handled: false, target: active };
    }
    return { handled: true, target: active };
  }

  // Menu and select triggers in Radix open on pointerdown or Enter, not on a bare click, so ask them the
  // way a keyboard would first. Anything that did not take the key gets the click.
  if (isPopupTrigger(active) && pressKey(active, "Enter")) {
    return { handled: true, target: active };
  }

  asSynthetic(() => active.click());
  return { handled: true, target: active };
}

const TRAPPING_CONTAINER_SELECTOR = ["tree", "grid", "treegrid"]
  .map((role) => `[role="${role}"]`)
  .join(",");

/**
 * Steps focus out of the grid, tree or treegrid around `from`, to the nearest control before it, or
 * after it when it is the first. Such a widget wants all four directions, so a calendar that goes on
 * for ever has no direction left to leave by; B is the way out. Null when `from` is not inside one.
 */
function leaveTrappingWidget(doc: Document, from: HTMLElement): HTMLElement | null {
  let widget = from.closest<HTMLElement>(TRAPPING_CONTAINER_SELECTOR);
  if (!widget) {
    return null;
  }
  // A grid inside a tree is left together with the tree.
  for (
    let outer = widget.parentElement?.closest<HTMLElement>(TRAPPING_CONTAINER_SELECTOR);
    outer;
    outer = outer.parentElement?.closest<HTMLElement>(TRAPPING_CONTAINER_SELECTOR)
  ) {
    widget = outer;
  }
  const around = widget;
  const outside = tabbableElements(navigationRoot(doc)).filter(
    (element) => !around.contains(element),
  );
  const target =
    outside.findLast(
      (element) => element.compareDocumentPosition(around) & Node.DOCUMENT_POSITION_FOLLOWING,
    ) ??
    outside.find(
      (element) => element.compareDocumentPosition(around) & Node.DOCUMENT_POSITION_PRECEDING,
    ) ??
    null;
  if (target) {
    focusElement(target);
  }
  return target;
}

function performCancel(doc: Document): ActionOutcome {
  const target =
    focusedWithin(doc, navigationRoot(doc)) ??
    (doc.activeElement as HTMLElement | null) ??
    doc.body;
  const handled = pressKey(target, "Escape");
  if (!handled) {
    // Nothing closed or cancelled: inside a calendar or tree, B backs out of it instead.
    const left = leaveTrappingWidget(doc, target);
    if (left) {
      return { handled: true, target: left };
    }
  }
  return { handled, target };
}

function nearestTablist(
  doc: Document,
  root: HTMLElement,
  active: HTMLElement | null,
): HTMLElement | null {
  const rendered = (list: HTMLElement) => isRendered(list);
  for (let scope: HTMLElement | null = active; scope; scope = scope.parentElement) {
    if (scope.getAttribute("role") === "tablist" && rendered(scope)) {
      return scope;
    }
    const inside = Array.from(scope.querySelectorAll<HTMLElement>('[role="tablist"]')).find(
      rendered,
    );
    if (inside) {
      return inside;
    }
    if (scope === root) {
      return null;
    }
  }
  return Array.from(root.querySelectorAll<HTMLElement>('[role="tablist"]')).find(rendered) ?? null;
}

function performTabSwitch(doc: Document, step: 1 | -1): ActionOutcome {
  const root = navigationRoot(doc);
  const active = focusedWithin(doc, root);
  const tablist = nearestTablist(doc, root, active);
  if (!tablist) {
    return { handled: false, target: active };
  }

  const tabs = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]')).filter(
    (tab) =>
      !tab.matches(":disabled") &&
      tab.getAttribute("aria-disabled") !== "true" &&
      !tab.hasAttribute("data-disabled") &&
      isRendered(tab),
  );
  if (tabs.length === 0) {
    return { handled: false, target: tablist };
  }

  let current = tabs.findIndex(isSelected);
  if (current < 0 && active) {
    current = tabs.findIndex((tab) => tab === active || tab.contains(active));
  }
  const next =
    current < 0 ? (step > 0 ? 0 : tabs.length - 1) : stepIndex(current, tabs.length, step);
  const target = tabs[next]!;
  selectTab(target);
  return { handled: true, target };
}

/**
 * The element an action should be reported against. A move or a tab switch lands on whatever ends up
 * with focus, which is not always what the layer focused: Radix hands focus from a tab list or a radio
 * group straight on to the item that was active. A press or an Escape is reported against the element
 * that received it, which may be gone or have lost focus by now.
 */
export function landedElement(
  doc: Document,
  action: GamepadAction,
  outcome: ActionOutcome,
): HTMLElement | null {
  const moves = action !== "activate" && action !== "cancel";
  const active = realActiveElement(doc);
  return moves && outcome.target && active && active !== outcome.target ? active : outcome.target;
}

/** Carries out one action on `doc` and reports what it touched. */
export function performAction(doc: Document, action: GamepadAction): ActionOutcome {
  // The press itself may remove the focused element (a Delete button); note where it is first.
  rememberActiveElement(doc);
  switch (action) {
    case "up":
    case "down":
    case "left":
    case "right":
      return performDirection(doc, action);
    case "activate":
      return performActivate(doc);
    case "cancel":
      return performCancel(doc);
    case "previous-tab":
      return performTabSwitch(doc, -1);
    case "next-tab":
      return performTabSwitch(doc, 1);
  }
}
