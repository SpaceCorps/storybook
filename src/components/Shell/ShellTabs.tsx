import React, { useEffect, useRef, useState } from "react";
import { Plus, SquareTerminal, X } from "lucide-react";
import { rovingTarget } from "../keyboard/roving";
import type { ShellTabDto, ShellWidgetProps } from "./types.ts";
import "./shell.css";

/** Where focus goes once a closed tab has left `tabs`. */
interface PendingFocus {
  /** The tab that was closed. */
  closedId: string;
  /** Its neighbour when it was closed, the preferred landing; null when it had none. */
  neighbourId: string | null;
  /** Where it sat in the strip, for when the neighbour has left too. */
  index: number;
}

interface ShellTabsProps extends ShellWidgetProps {
  tabs?: ShellTabDto[];
  selectedId?: string;
}

/**
 * The agent-session tab strip at the bottom of the content area.
 *
 * The `role="tab"` buttons are the whole tablist; the close buttons live in a sibling layer drawn
 * over them. Closing from the keyboard is Delete on the focused tab, so the roving strip stays one
 * tab stop and the close buttons are a pointer (and screen-reader) affordance, `tabIndex={-1}`.
 *
 * Each tab is between 144px and 200px wide. The tabs share the row while they fit; past that the
 * strip scrolls sideways (the wheel scrolls it, and so does moving focus or selecting a tab off
 * screen) and the new-session button stays put at its end. Every tab carries its title as a
 * tooltip, since a narrow tab shows only the start of it.
 *
 * With no sessions the strip is hidden. Closing the last one with focus in the strip leaves the
 * new-session button showing, with focus on it, until focus moves on, so a keyboard user is not
 * dropped on the page.
 */
export const ShellTabs: React.FC<ShellTabsProps> = ({
  id,
  events = [],
  eventHandler,
  tabs = [],
  selectedId,
}) => {
  const fire = (eventName: string, args: unknown[] = []) => {
    if (events.includes(eventName)) eventHandler(eventName, id, args);
  };

  const listRef = useRef<HTMLDivElement>(null);
  const closesRef = useRef<HTMLDivElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  // Set when a close was asked for with focus in the strip, and kept until the closed tab has left
  // `tabs` or the person has moved focus themselves. The host decides when (and whether) the tab
  // goes, so other updates in between must neither spend it nor leave it armed for good.
  const pendingFocus = useRef<PendingFocus | null>(null);
  // The roving stop. Selecting is manual (Enter or Space), so the tab that holds focus after an
  // arrow key is not yet the selected one; the stop follows the selection again once focus leaves.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // The tab whose close button the pointer is over: the buttons are a layer above the tabs, so the
  // tab under one is no longer :hover and would drop its highlight.
  const [closeHoverId, setCloseHoverId] = useState<string | null>(null);
  // The last tab was closed with focus in the strip: only the new-session button is shown, holding
  // that focus, until focus leaves it.
  const [loneNew, setLoneNew] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const hasTabs = tabs.length > 0;

  const tabButtons = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);

  const stopId = tabs.some((tab) => tab.id === focusedId)
    ? focusedId
    : tabs.some((tab) => tab.id === selectedId)
      ? selectedId
      : (tabs[0]?.id ?? null);

  // Focus the person moves, or a press anywhere, means they have moved on from the close. The
  // closed tab unmounting moves no focus (it drops to the body), so it does not trip these.
  useEffect(() => {
    const moveOn = () => {
      pendingFocus.current = null;
    };
    document.addEventListener("focusin", moveOn);
    document.addEventListener("pointerdown", moveOn, true);
    return () => {
      document.removeEventListener("focusin", moveOn);
      document.removeEventListener("pointerdown", moveOn, true);
    };
  }, []);

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    // The tab is still here: the host may close it later, or not at all. Keep waiting.
    if (tabs.some((tab) => tab.id === pending.closedId)) return;
    pendingFocus.current = null;
    const active = document.activeElement;
    // Only when focus was lost with the closed tab: if it is elsewhere, the person has moved on.
    if (active && active !== document.body && active.isConnected) return;
    // Nothing left to land on but the new-session button, which is not on screen while there are no
    // tabs: show it for as long as it holds focus.
    if (tabs.length === 0) {
      setLoneNew(true);
      return;
    }
    const buttons = tabButtons();
    const target =
      buttons.find((button) => button.dataset.tabId === pending.neighbourId) ??
      buttons[Math.min(pending.index, buttons.length - 1)];
    target?.focus();
  }, [tabs]);

  useEffect(() => {
    if (tabs.length > 0) setLoneNew(false);
    else if (loneNew) newRef.current?.focus();
  }, [tabs.length, loneNew]);

  // A tab that is selected, or that a session was just added as, is brought into view if the strip
  // is scrolled past it. (Moving focus to a tab does the same by itself.)
  useEffect(() => {
    const active = tabButtons().find((button) => button.dataset.active === "true");
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedId, tabs.length]);

  // The strip has no visible scrollbar (it would eat into the 40px row), so the wheel scrolls it
  // sideways. A native listener: React's wheel handlers are passive and cannot cancel the scroll.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (strip.scrollWidth <= strip.clientWidth) return;
      event.preventDefault();
      strip.scrollLeft += event.deltaY;
    };
    strip.addEventListener("wheel", onWheel, { passive: false });
    return () => strip.removeEventListener("wheel", onWheel);
  }, [hasTabs]);

  // With no sessions open the strip would be an empty band with a lone "+", so it stays hidden
  // until the first tab exists (new sessions start from the sidebar agent row instead). The one
  // exception is the moment after the last tab was closed under the person's focus.
  if (tabs.length === 0 && !loneNew) return null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Alt+Left and Alt+Right are the browser's Back and Forward, and a chord with Ctrl, Meta or
    // Shift on Delete is not a request to end a session.
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const buttons = tabButtons();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;

    if (event.key === "Delete") {
      if (event.shiftKey) return;
      event.preventDefault();
      closeTab(tabs[current].id);
      return;
    }

    const next = rovingTarget(event.key, current, buttons.length, { orientation: "horizontal" });
    if (next === null) return;
    event.preventDefault();
    buttons[next].focus();
  };

  const closeTab = (tabId: string) => {
    const index = tabs.findIndex((tab) => tab.id === tabId);
    const active = document.activeElement;
    const focusInStrip =
      !!active && (!!listRef.current?.contains(active) || !!closesRef.current?.contains(active));
    // Nothing to hand focus on from when the host is not told, or focus is not in the strip to lose.
    if (index !== -1 && focusInStrip && events.includes("OnClose")) {
      const neighbour = tabs[index + 1] ?? tabs[index - 1];
      pendingFocus.current = { closedId: tabId, neighbourId: neighbour?.id ?? null, index };
    }
    fire("OnClose", [tabId]);
  };

  return (
    <div className="tsh-tabs">
      {tabs.length > 0 && (
        <div ref={stripRef} className="tsh-tabstrip">
          <div
            ref={listRef}
            className="tsh-tablist"
            role="tablist"
            aria-label="Agent sessions"
            aria-orientation="horizontal"
            onKeyDown={handleKeyDown}
          >
            {tabs.map((tab) => {
              const active = tab.id === selectedId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className="tsh-tab-main"
                  title={tab.title}
                  data-tab-id={tab.id}
                  data-active={active}
                  data-close-hover={tab.id === closeHoverId || undefined}
                  aria-selected={active}
                  aria-keyshortcuts="Delete"
                  tabIndex={tab.id === stopId ? 0 : -1}
                  onFocus={() => setFocusedId(tab.id)}
                  onBlur={() => setFocusedId(null)}
                  onClick={() => fire("OnSelect", [tab.id])}
                  onAuxClick={(e) => {
                    if (e.button === 1) closeTab(tab.id);
                  }}
                >
                  <SquareTerminal size={16} className="tsh-tab-icon" aria-hidden="true" />
                  <span className="tsh-tab-label">{tab.title}</span>
                </button>
              );
            })}
          </div>
          {/* The close buttons sit over the tabs' right edges in a layer of their own: a tablist
              may only own tabs, and a button inside a tab is hidden from assistive technology.
              Both layers use the same column widths, so each button lands on its tab. */}
          <div ref={closesRef} className="tsh-tab-closes">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="tsh-tab-close"
                aria-label={`Close ${tab.title}`}
                tabIndex={-1}
                onClick={() => closeTab(tab.id)}
                onPointerEnter={() => setCloseHoverId(tab.id)}
                onPointerLeave={() => setCloseHoverId(null)}
              >
                <X size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        ref={newRef}
        type="button"
        className="tsh-tab-new"
        aria-label="New agent session"
        onClick={() => fire("OnNew")}
        onBlur={() => setLoneNew(false)}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
};
