/**
 * Keyboard model for a rating that takes half values: the WAI-ARIA slider pattern, which is how
 * the APG's own rating example is built. A row of buttons can only say "this star"; a slider says
 * "3.5 out of 5" and moves in steps, so a keyboard (and a screen reader) can reach every value.
 * Pure, so the two rating widgets keep only their own rendering.
 */

/** One arrow key's worth of rating: half a star. */
export const RATING_STEP = 0.5;
/** Page Up and Page Down move a whole star. */
export const RATING_PAGE_STEP = 1;

export interface RatingKeyOptions {
  /** Left and Right swap in a right-to-left layout, so that Right is always toward the end. */
  rtl?: boolean;
}

/** `value` clamped into `0..max`; anything that is not a number counts as no rating. */
export function clampRating(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), max);
}

/** The next multiple of `step` above `value` (a value already on the grid moves a full step). */
function stepUp(value: number, step: number, max: number): number {
  return Math.min(max, (Math.floor(value / step) + 1) * step);
}

/** The next multiple of `step` below `value`. */
function stepDown(value: number, step: number): number {
  return Math.max(0, (Math.ceil(value / step) - 1) * step);
}

/**
 * The rating a key moves to, or `null` when the key is not one a rating handles. Arrow keys move by
 * half a star and land on the half-star grid even when the current value is off it (3.3 goes to 3.5
 * up and 3 down); Page Up and Page Down move a whole star; Home clears the rating and End gives
 * the highest. At either end the value stays where it is.
 */
export function ratingKeyTarget(
  key: string,
  value: number,
  max: number,
  { rtl = false }: RatingKeyOptions = {},
): number | null {
  const current = clampRating(value, max);
  switch (key) {
    case "ArrowRight":
      return rtl ? stepDown(current, RATING_STEP) : stepUp(current, RATING_STEP, max);
    case "ArrowLeft":
      return rtl ? stepUp(current, RATING_STEP, max) : stepDown(current, RATING_STEP);
    case "ArrowUp":
      return stepUp(current, RATING_STEP, max);
    case "ArrowDown":
      return stepDown(current, RATING_STEP);
    case "PageUp":
      return stepUp(current, RATING_PAGE_STEP, max);
    case "PageDown":
      return stepDown(current, RATING_PAGE_STEP);
    case "Home":
      return 0;
    case "End":
      return max;
    default:
      return null;
  }
}

/** The spoken value of a slider-style rating: "3.5 out of 5 stars", or "No rating". */
export function ratingValueText(value: number, max: number, unit = ""): string {
  const current = clampRating(value, max);
  if (current === 0) return "No rating";
  return `${current} out of ${max}${unit ? ` ${unit}` : ""}`;
}
