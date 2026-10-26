/**
 * Utilities that size or place an element inside its parent (width, flex and grid item, self
 * alignment, order, margin), as opposed to the ones that style the control itself. A leading `!`
 * (important) is allowed; a leading `-` marks a negative value.
 */
const LAYOUT_UTILITY =
  /^!?-?(?:w|min-w|max-w|basis|grow|shrink|order|col|row|self|justify-self|place-self|m|mx|my|mt|mr|mb|ml|ms|me|flex(?=-(?!row|col|wrap|nowrap)))(?:-|$|\[)/;

/** Variants that only select a screen or container width, which hold for a wrapper as for its child. */
const WIDTH_VARIANT = /^(?:sm|md|lg|xl|2xl|max-(?:sm|md|lg|xl|2xl)|@[\w[\]-]+)$/;

/** Splits `md:hover:w-4` into its variants and the utility, ignoring colons inside `[...]` and `(...)`. */
function splitVariants(token: string): [variants: string[], utility: string] {
  const variants: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < token.length; index += 1) {
    const char = token[index];
    if (char === "[" || char === "(") depth += 1;
    else if (char === "]" || char === ")") depth -= 1;
    else if (char === ":" && depth === 0) {
      variants.push(token.slice(start, index));
      start = index + 1;
    }
  }
  return [variants, token.slice(start)];
}

/**
 * Pulls the classes that place the element in its parent out of a class list, so a component that
 * wraps its `<input>` can put them on the wrapper (which is what the parent lays out) and keep the
 * rest on the input. `w-40` on a password field has to narrow the wrapper, or the show/hide button
 * stays at the far edge of a full-width wrapper while the field is narrow.
 *
 * Only plain and breakpoint-prefixed utilities move; `hover:`, `focus:`, `aria-*` and arbitrary
 * variants describe the control, so they stay.
 */
export function splitLayoutClasses(className: string | undefined): {
  layout: string;
  rest: string;
} {
  const layout: string[] = [];
  const rest: string[] = [];
  for (const token of (className ?? "").split(/\s+/).filter(Boolean)) {
    const [variants, utility] = splitVariants(token);
    const placesElement =
      LAYOUT_UTILITY.test(utility) && variants.every((v) => WIDTH_VARIANT.test(v));
    (placesElement ? layout : rest).push(token);
  }
  return { layout: layout.join(" "), rest: rest.join(" ") };
}
