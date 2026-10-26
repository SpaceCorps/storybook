/**
 * Arrow-key navigation for a set of items that share one tab stop (tabs, a tree, a menu): which
 * item a key moves to. Pure, so the widgets that use it keep only their own focus bookkeeping.
 */

export type RovingOrientation = "horizontal" | "vertical" | "both";

export interface RovingOptions {
  /** Which arrow keys move: Left/Right, Up/Down, or either pair. */
  orientation?: RovingOrientation;
  /** Past either end, continue from the other. Off, the position stays at the end. */
  wrap?: boolean;
  /** Left/Right are mirrored in a right-to-left layout. */
  rtl?: boolean;
}

/**
 * The index to move to for a navigation key, or `null` when the key is not one this handles.
 * `current` may be -1 (nothing is current yet): forward lands on the first item, backward on the last.
 */
export function rovingTarget(
  key: string,
  current: number,
  count: number,
  { orientation = "horizontal", wrap = true, rtl = false }: RovingOptions = {},
): number | null {
  if (count <= 0) return null;
  const horizontal = orientation !== "vertical";
  const vertical = orientation !== "horizontal";
  const forwardKeys = [
    vertical && "ArrowDown",
    horizontal && (rtl ? "ArrowLeft" : "ArrowRight"),
  ].filter(Boolean);
  const backwardKeys = [
    vertical && "ArrowUp",
    horizontal && (rtl ? "ArrowRight" : "ArrowLeft"),
  ].filter(Boolean);

  if (key === "Home") return 0;
  if (key === "End") return count - 1;

  const step = forwardKeys.includes(key) ? 1 : backwardKeys.includes(key) ? -1 : 0;
  if (step === 0) return null;

  if (current < 0) return step === 1 ? 0 : count - 1;
  const next = current + step;
  if (next >= 0 && next < count) return next;
  if (!wrap) return current;
  return step === 1 ? 0 : count - 1;
}
