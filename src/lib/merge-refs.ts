import * as React from "react";

type MaybeRef<T> = React.Ref<T> | undefined;

/** Points a ref at `node`; returns the cleanup a React 19 callback ref may hand back. */
function assignRef<T>(ref: MaybeRef<T>, node: T | null): (() => void) | void {
  if (typeof ref === "function") return ref(node) as (() => void) | void;
  if (ref) (ref as React.RefObject<T | null>).current = node;
}

/**
 * One callback ref that feeds several. React 19 skips the `null` call when a callback ref returns a
 * cleanup, so each source's own cleanup is honoured and a plain ref still gets its `null`.
 */
export function mergeRefs<T>(...refs: MaybeRef<T>[]): React.RefCallback<T> {
  return (node) => {
    const cleanups = refs.map((ref) => assignRef(ref, node));
    return () => {
      refs.forEach((ref, index) => {
        const cleanup = cleanups[index];
        if (typeof cleanup === "function") cleanup();
        else assignRef(ref, null);
      });
    };
  };
}

/**
 * {@link mergeRefs} with a stable identity. A callback ref that changes every render is detached and
 * re-attached every render, so the merge is memoised on the refs themselves.
 */
export function useMergedRefs<T>(...refs: MaybeRef<T>[]): React.RefCallback<T> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useMemo(() => mergeRefs(...refs), refs);
}
