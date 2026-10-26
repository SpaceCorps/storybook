import { useEffect, useMemo, useState } from "react";

const TICK_MS = 60_000;

/**
 * The current time, refreshed at the top of every minute, for things that move with the clock (a
 * now-line, an elapsed timer). Pass `pinned` to freeze it: the same instant is returned for as long as
 * it stays the same time and no timer runs, which is what stories and tests want.
 *
 * The returned `Date` keeps its identity between ticks, so it is safe in a dependency list.
 */
export function useNow(pinned?: Date): Date {
  const pinnedMs = pinned?.getTime();
  const frozenMs = pinnedMs !== undefined && !Number.isNaN(pinnedMs) ? pinnedMs : undefined;
  const frozen = useMemo(
    () => (frozenMs === undefined ? undefined : new Date(frozenMs)),
    [frozenMs],
  );
  const [ticking, setTicking] = useState(() => new Date());

  useEffect(() => {
    if (frozenMs !== undefined) return;

    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => setTicking(new Date());
    // Aim for the minute boundary so the clock changes when the wall clock does; a timer that wakes
    // a hair early only schedules one more short wait.
    const schedule = () => {
      timer = setTimeout(
        () => {
          refresh();
          schedule();
        },
        TICK_MS - (Date.now() % TICK_MS),
      );
    };
    // Timers in a hidden tab are throttled hard, so catch up the moment the tab is shown again.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    // Back from a pinned stretch the stored time is stale; on first mount it is already fresh, and
    // keeping that object avoids a second render.
    setTicking((prev) => (Date.now() - prev.getTime() < 1000 ? prev : new Date()));
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [frozenMs]);

  return frozen ?? ticking;
}
