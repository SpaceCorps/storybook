import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VirtualList } from "@/components/ui/virtual-list";
import { Densities } from "@/types/density";

const meta: Meta = {
  title: "UI/VirtualList",
  parameters: {
    // An overflowing list is a tab stop of its own: the sweep fails a story whose focus indicator is
    // missing or faint.
    keyboard: { sweep: true, forcedColors: true },
    // No baseline image for any of these yet.
    visual: { disable: true },
  },
};

export default meta;

interface LogEntry {
  id: string;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
}

const levels: LogEntry["level"][] = ["info", "warn", "error"];
const sources = ["scheduler", "worktree", "agent", "promptware", "server"];

/**
 * Message length varies with the index, so rows have genuinely different heights and the story
 * exercises `measureElement` rather than a fixed-height fast path.
 */
const entries: LogEntry[] = Array.from({ length: 1000 }, (_, index) => ({
  id: `log-${index + 1}`,
  level: levels[index % levels.length],
  source: sources[index % sources.length],
  message: `Job ${index + 1} ${"reconciled its worktree and flushed the queue. ".repeat(
    1 + (index % 4),
  )}`,
}));

const levelVariant: Record<LogEntry["level"], "secondary" | "warning" | "destructive"> = {
  info: "secondary",
  warn: "warning",
  error: "destructive",
};

const renderEntry = (entry: LogEntry) => (
  <div className="flex gap-3 border-b px-3 py-2">
    <Badge variant={levelVariant[entry.level]}>{entry.level}</Badge>
    <div className="min-w-0">
      <p className="text-sm font-medium">{entry.source}</p>
      <p className="text-sm text-muted-foreground">{entry.message}</p>
    </div>
  </div>
);

/**
 * 1,000 variable-height rows in a bounded container. Only the visible slice plus overscan is in the
 * DOM; the scrollbar still reports the full height.
 *
 * While it overflows, the list is a keyboard tab stop and a named region (`aria-label`, or
 * `aria-labelledby` for a visible heading): Tab to it, then the arrow and Page Up/Down keys scroll it.
 */
export const VariableHeight: StoryObj = {
  render: () => (
    <div className="h-[480px] w-[700px] rounded-md border">
      <VirtualList
        items={entries}
        getItemKey={(entry) => entry.id}
        renderItem={renderEntry}
        aria-label="Job log"
      />
    </div>
  ),
};

/** The density estimate only affects first paint, before a row has been measured. */
export const DensityEstimates: StoryObj = {
  render: () => (
    <div className="flex gap-4">
      {[Densities.Small, Densities.Medium, Densities.Large].map((density) => (
        <div key={density} className="flex flex-col gap-2">
          <p className="text-sm font-medium">{density}</p>
          <div className="h-[320px] w-[320px] rounded-md border">
            <VirtualList
              items={entries}
              density={density}
              getItemKey={(entry) => entry.id}
              renderItem={(entry) => (
                <div className="border-b px-3 py-2 text-sm">
                  {entry.source}: {entry.message}
                </div>
              )}
              aria-label={`Job log (${density})`}
            />
          </div>
        </div>
      ))}
    </div>
  ),
};

/**
 * `pinnedIndex` keeps one row mounted no matter where the viewport is — the guarantee a focused row
 * or a streaming tail needs. Scroll away from the top and item 0 stays in the DOM.
 */
export const PinnedItem: StoryObj = {
  render: () => (
    <div className="h-[400px] w-[700px] rounded-md border">
      <VirtualList
        items={entries}
        pinnedIndex={0}
        getItemKey={(entry) => entry.id}
        renderItem={renderEntry}
        aria-label="Job log with a pinned first row"
      />
    </div>
  ),
};

/**
 * Rows with buttons in them. The overflowing list is still a tab stop of its own, ahead of the
 * buttons: only the mounted rows have buttons to tab to, and a keyboard needs a way to scroll on to
 * the rest. The heading names the list (`aria-labelledby`) instead of repeating its text in an
 * `aria-label`. The rows have a background, and the focus outline is drawn over it.
 */
function JobLogWithRetry() {
  const headingId = React.useId();
  return (
    <div className="flex w-[700px] flex-col gap-2">
      <h3 id={headingId} className="text-sm font-medium">
        Job log
      </h3>
      <div className="h-[400px] rounded-md border">
        <VirtualList
          items={entries}
          getItemKey={(entry) => entry.id}
          aria-labelledby={headingId}
          renderItem={(entry, index) => (
            <div className="flex items-center gap-3 border-b bg-muted px-3 py-2">
              <Badge variant={levelVariant[entry.level]}>{entry.level}</Badge>
              <p className="min-w-0 flex-1 text-sm">
                {entry.source}: {entry.message}
              </p>
              <Button size="sm" variant="outline" aria-label={`Retry job ${index + 1}`}>
                Retry
              </Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}

export const WithControls: StoryObj = {
  parameters: {
    // Every button that takes focus scrolls the list and mounts the rows after it, so Tab never runs
    // out of stops to sweep. The list's own stop is the sweep of the other stories.
    keyboard: { sweep: false },
  },
  render: () => <JobLogWithRetry />,
  play: async ({ canvasElement }) => {
    // Opaque rows would hide the focus outline were they not beneath it. Only a browser paints, and
    // a unit test sees class names, so this checks that those classes became the CSS that does it.
    const list = within(canvasElement).getByRole("region", { name: "Job log" });
    const spacer = list.firstElementChild;
    if (!(spacer instanceof HTMLElement)) throw new Error("No spacer rendered");
    await expect(getComputedStyle(list).isolation).toBe("isolate");
    await expect(getComputedStyle(spacer).position).toBe("relative");
    await expect(getComputedStyle(spacer).zIndex).toMatch(/^-\d+$/);
  },
};

/**
 * A list that fits its box has nothing to scroll, so it is not a tab stop and not a region: a stop
 * with nothing to scroll would be a dead one. The same goes for an empty list.
 */
export const FitsWithoutScrolling: StoryObj = {
  parameters: {
    // Nothing to focus, and the sweep fails a story with nothing to sweep.
    keyboard: { sweep: false },
  },
  render: () => (
    <div className="h-[480px] w-[700px] rounded-md border">
      <VirtualList
        items={entries.slice(0, 4)}
        getItemKey={(entry) => entry.id}
        renderItem={renderEntry}
        aria-label="Job log"
        data-testid="short-list"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByTestId("short-list");
    await expect(list.scrollHeight).toBeLessThanOrEqual(list.clientHeight + 1);
    await expect(list).not.toHaveAttribute("tabindex");
    await expect(list).not.toHaveAttribute("role");
    await expect(list).not.toHaveAttribute("aria-label");
  },
};
