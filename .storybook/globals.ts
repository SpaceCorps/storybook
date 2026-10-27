import type { Densities } from "../src/types/density";

/** Themes offered by the `theme` toolbar global in `preview.tsx`. */
export type StorybookTheme = "light" | "dark";

/** Densities offered by the `density` toolbar global, derived from the enum so the two cannot drift. */
export type StorybookDensity = `${Densities}`;

export interface StorybookGlobals {
  theme?: StorybookTheme;
  density?: StorybookDensity;
}

/**
 * A `preview.tsx` decorator receives a story context whose `globals` already include the story's own,
 * as `Record<string, any>`. The test runner's `getStoryContext()` is not that: it is the prepared story
 * (`storyStore.loadStory`), which has no `globals` and carries the story-level ones as `storyGlobals`.
 * Read both, the story's own winning as it does in the browser, and narrow them to `StorybookGlobals`
 * here, in one place.
 */
export function readStoryGlobals(context: unknown): StorybookGlobals {
  if (!context || typeof context !== "object") {
    return {};
  }
  const { globals, storyGlobals } = context as {
    globals?: StorybookGlobals;
    storyGlobals?: StorybookGlobals;
  };
  return { ...globals, ...storyGlobals };
}
