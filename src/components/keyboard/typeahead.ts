import { useEffect, useRef } from "react";

/** Typed letters group into one search until this long passes between two of them. */
export const TYPEAHEAD_RESET_MS = 500;

/**
 * Where a typed run lands among `labels`. A single letter moves on to the next label that starts
 * with it, so pressing the same key again cycles through the matches; a longer run narrows to the
 * first label that starts with the whole run (a held letter still cycles). `from` is the current
 * position, or -1 for none. Returns -1 when nothing matches.
 */
export function findByTypeahead(labels: readonly string[], query: string, from: number): number {
  const count = labels.length;
  if (count === 0 || query === "") return -1;
  const needle = query.toLowerCase();
  const repeated = needle.length > 1 && Array.from(needle).every((char) => char === needle[0]);
  const cycling = repeated || needle.length === 1;
  const search = cycling ? needle[0] : needle;
  const start = cycling ? from + 1 : Math.max(from, 0);
  for (let step = 0; step < count; step++) {
    const index = (((start + step) % count) + count) % count;
    if (labels[index].toLowerCase().startsWith(search)) return index;
  }
  return -1;
}

/** A printable key that belongs to a search; a space only counts once a search has begun. */
export function isTypeaheadKey(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">,
  searching: boolean,
): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.key.length !== 1) return false;
  return event.key !== " " || searching;
}

export interface Typeahead {
  /** Adds a typed character to the current run and returns the whole run. */
  push: (char: string) => string;
  /** Whether a run is under way. */
  readonly searching: boolean;
  /** Forgets the run, e.g. when a list closes. */
  reset: () => void;
}

/** The typed-run buffer for one widget: it clears itself after a pause and when the widget unmounts. */
export function useTypeahead(resetMs: number = TYPEAHEAD_RESET_MS): Typeahead {
  const state = useRef<{ query: string; timer: number | undefined }>({
    query: "",
    timer: undefined,
  });
  const api = useRef<Typeahead | null>(null);

  if (api.current === null) {
    const reset = () => {
      window.clearTimeout(state.current.timer);
      state.current.timer = undefined;
      state.current.query = "";
    };
    api.current = {
      push(char) {
        window.clearTimeout(state.current.timer);
        state.current.query += char;
        state.current.timer = window.setTimeout(reset, resetMs);
        return state.current.query;
      },
      get searching() {
        return state.current.query !== "";
      },
      reset,
    };
  }

  useEffect(() => () => api.current?.reset(), []);

  return api.current;
}
