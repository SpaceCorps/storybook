import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Check,
  Ellipsis,
  ExternalLink,
  FileCheck2,
  FileQuestion,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import { TuiBadge, StatusDot } from "../ui/TuiBadge";
import { IconButton } from "../ui/IconButton";
import { TuiKbd } from "../ui/TuiKbd";
import { Tooltip } from "../ui/TuiTooltip";
import { useOutsideClick } from "../../hooks/use-outside-click";
import { rovingTarget } from "../keyboard/roving";
import { findByTypeahead, isTypeaheadKey, useTypeahead } from "../keyboard/typeahead";
import { ActionIcon } from "./icons";
import { shortcutKeys, useActionShortcuts } from "./shortcuts";
import type { ShortcutBinding } from "./shortcuts";
import {
  clampChatWidth,
  maxChatWidth,
  MIN_CHAT_WIDTH,
  readStoredChatWidth,
  writeStoredChatWidth,
} from "./chatWidth";
import { hasNodes } from "./types";
import type { PlanActionDto, PlanWorkspaceProps } from "./types";
import "./plan-workspace.css";

export type { PlanActionDto, PlanTabDto, PlanWorkspaceProps } from "./types";

/** Below this the chat panel stacks under the plan instead of sitting beside it. */
const NARROW_WIDTH = 760;
/** Below this the icon actions fold into the overflow menu. */
const COMPACT_WIDTH = 560;

const EMPTY_ACTIONS: PlanActionDto[] = [];
const EMPTY_EVENTS: string[] = [];

const TOOL_OPEN_DELAY_MS = 120;
const TOOL_CLOSE_DELAY_MS = 220;

/** Pixels the chat divider moves per arrow key, and per arrow key with Shift held. */
const RESIZE_STEP = 10;
const RESIZE_STEP_LARGE = 50;

const IconAction: React.FC<{ action: PlanActionDto; onFire: (tag: string) => void }> = ({
  action,
  onFire,
}) => (
  <IconButton
    className="pws-icon-btn"
    label={action.label}
    shortcut={action.shortcut ? shortcutKeys(action.shortcut) : undefined}
    tooltipSide="bottom"
    active={!!action.active}
    data-tag={action.tag}
    aria-pressed={action.active ? true : undefined}
    disabled={action.disabled || action.loading}
    onClick={() => onFire(action.tag)}
  >
    {action.loading ? (
      <LoaderCircle size={16} className="pws-spin" />
    ) : (
      <ActionIcon icon={action.icon} />
    )}
    {action.badge && (
      <TuiBadge numeric className="pws-icon-badge">
        {action.badge}
      </TuiBadge>
    )}
  </IconButton>
);

const LabeledButton: React.FC<{
  action: PlanActionDto;
  primary?: boolean;
  onFire: (tag: string) => void;
}> = ({ action, primary = false, onFire }) => (
  <button
    type="button"
    className={`pws-btn ${primary ? "pws-btn--primary" : "pws-btn--secondary"}`}
    data-tag={action.tag}
    disabled={action.disabled || action.loading}
    aria-busy={action.loading || undefined}
    onClick={() => onFire(action.tag)}
  >
    {action.loading ? (
      <LoaderCircle size={16} className="pws-spin" />
    ) : (
      <ActionIcon icon={action.icon} />
    )}
    <span className="pws-btn-label">{action.label}</span>
    {action.badge && (
      <TuiBadge numeric className="pws-btn-badge">
        {action.badge}
      </TuiBadge>
    )}
    {action.shortcut && (
      <TuiKbd keys={shortcutKeys(action.shortcut)} variant="bare" className="pws-btn-kbd" />
    )}
  </button>
);

interface OverflowMenuProps {
  items: PlanActionDto[];
  onFire: (tag: string) => void;
}

/** Where focus lands when the menu opens: an item for the keyboard, the menu itself for a click. */
type MenuEntry = "first" | "last" | "menu";

const OverflowMenu: React.FC<OverflowMenuProps> = ({ items, onFire }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const entryRef = useRef<MenuEntry>("menu");
  const typeahead = useTypeahead();
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  useOutsideClick(open, [wrapRef], close);

  // Items a person can land on: a disabled one is skipped, as in a native menu. An action that
  // carries a pressed state is a menuitemcheckbox, the rest are plain menuitems.
  const enabledItems = () =>
    Array.from(
      // One selector, not a list of two: the results of a list are not always in document order.
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)') ??
        [],
    );

  useEffect(() => {
    if (!open) return;
    const available = enabledItems();
    const entry = entryRef.current;
    // With every item disabled there is nothing to land on, so the menu holds focus itself: it
    // keeps Escape and Tab working instead of leaving them on a trigger that no longer owns them.
    const target =
      entry === "first"
        ? available[0]
        : entry === "last"
          ? available[available.length - 1]
          : undefined;
    (target ?? menuRef.current)?.focus();
  }, [open]);

  const openWith = (entry: MenuEntry) => {
    entryRef.current = entry;
    typeahead.reset();
    setOpen(true);
  };

  // Escape and choosing an item both hand focus back to the button that opened the menu, which
  // would otherwise be lost with the menu that held it.
  const closeAndReturn = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    openWith(e.key === "ArrowDown" ? "first" : "last");
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeAndReturn();
      return;
    }
    if (e.key === "Tab") {
      // Focus is put back on the button first, so Tab carries on from there instead of from a
      // menu that is about to disappear.
      closeAndReturn();
      return;
    }
    const available = enabledItems();
    const current = available.indexOf(document.activeElement as HTMLButtonElement);
    const next = rovingTarget(e.key, current, available.length, { orientation: "vertical" });
    if (next !== null) {
      e.preventDefault();
      available[next].focus();
      return;
    }
    if (isTypeaheadKey(e.nativeEvent, typeahead.searching)) {
      e.preventDefault();
      const found = findByTypeahead(
        available.map((item) => item.textContent ?? ""),
        typeahead.push(e.key),
        current,
      );
      if (found !== -1) available[found].focus();
    }
  };

  return (
    <div className="pws-menu-wrap" ref={wrapRef}>
      <IconButton
        ref={triggerRef}
        label="More actions"
        tooltip="More"
        tooltipSide="bottom"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        active={open}
        onKeyDown={handleTriggerKeyDown}
        onClick={(e) => {
          if (open) {
            setOpen(false);
            return;
          }
          // Enter and Space arrive as a click with no pointer (detail 0): they land on the first
          // item, a mouse click leaves the choice to the pointer.
          openWith(e.detail === 0 ? "first" : "menu");
        }}
      >
        <Ellipsis size={16} />
      </IconButton>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          className="pws-menu"
          role="menu"
          aria-label="More actions"
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item) => {
            // The same three things the icon button shows in the top bar: a pressed state, a count
            // and a busy spinner. Folded into the menu they must not be dropped.
            const toggle = !!item.active;
            return (
              <button
                key={item.tag}
                type="button"
                role={toggle ? "menuitemcheckbox" : "menuitem"}
                aria-checked={toggle ? true : undefined}
                aria-busy={item.loading || undefined}
                // Reached with the arrow keys, so the menu is one place to Tab out of, not many.
                tabIndex={-1}
                className="pws-menu-item"
                data-danger={!!item.danger}
                data-tag={item.tag}
                disabled={item.disabled || item.loading}
                onClick={() => {
                  closeAndReturn();
                  onFire(item.tag);
                }}
              >
                <span className="pws-menu-item-icon">
                  {item.loading ? (
                    <LoaderCircle size={14} className="pws-spin" />
                  ) : (
                    <ActionIcon icon={item.icon} size={14} />
                  )}
                </span>
                <span className="pws-menu-item-label">{item.label}</span>
                {item.badge && (
                  <TuiBadge numeric className="pws-menu-item-badge">
                    {item.badge}
                  </TuiBadge>
                )}
                {toggle && <Check size={14} className="pws-menu-item-check" aria-hidden="true" />}
                {item.shortcut && (
                  <TuiKbd
                    keys={shortcutKeys(item.shortcut)}
                    variant="bare"
                    className="pws-menu-kbd"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface TabToolProps {
  icon: LucideIcon;
  label: string;
  panel: React.ReactNode;
  open: boolean;
  pinned?: boolean;
  indicator?: boolean;
  onHoverOpen: () => void;
  onClick: () => void;
  onClose: () => void;
}

/** Plans whose Questions dropdown was opened in this page session; the dot stays off for them. */
const seenQuestionPlans = new Set<string>();

/** One of the two icons in the tab strip's far corner; its panel drops down beneath it. */
const TabTool: React.FC<TabToolProps> = ({
  icon: Icon,
  label,
  panel,
  open,
  pinned = false,
  indicator = false,
  onHoverOpen,
  onClick,
  onClose,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  // Set by a press anywhere in this tool's React subtree, see the outside-press effect below.
  const pressedInsideRef = useRef(false);
  const panelId = useId();
  const [tipOpen, setTipOpen] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const scheduleOpen = useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      onHoverOpen();
    }, TOOL_OPEN_DELAY_MS);
  }, [clearTimer, onHoverOpen]);

  const scheduleClose = useCallback(() => {
    clearTimer();
    if (pinned) return;
    timerRef.current = window.setTimeout(() => {
      onClose();
    }, TOOL_CLOSE_DELAY_MS);
  }, [clearTimer, pinned, onClose]);

  const handleClick = useCallback(() => {
    clearTimer();
    onClick();
  }, [clearTimer, onClick]);

  useEffect(() => clearTimer, [clearTimer]);

  // A press outside closes the panel. "Outside" is a question about the React tree, not the DOM:
  // a popover, select or dialog opened from inside the panel is portaled to the body, so its DOM
  // is outside the wrapper while it is still the panel's own content. React runs the capture
  // handler on the wrapper for such a press before this document listener sees it.
  useEffect(() => {
    if (!open) return;
    // A press that opened the panel (or one from an earlier opening) is not a press inside it.
    pressedInsideRef.current = false;
    const handle = (e: MouseEvent) => {
      const inside = pressedInsideRef.current || !!wrapRef.current?.contains(e.target as Node);
      pressedInsideRef.current = false;
      if (!inside) onClose();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // A layer opened from inside the panel (a popover, a select, a dialog) has already used this
      // Escape to close itself and says so with preventDefault. The panel stays, and the layer has
      // put focus back on what opened it.
      if (e.defaultPrevented) return;
      // Focus inside the panel would be lost with the panel, so it goes back to the button that
      // opened it. A panel opened by hover while focus is elsewhere leaves focus where it is.
      if (wrapRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
      onClose();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open, onClose]);

  return (
    <div
      className="pws-tool-wrap"
      ref={wrapRef}
      onMouseDownCapture={() => {
        pressedInsideRef.current = true;
      }}
    >
      <IconButton
        ref={buttonRef}
        size="sm"
        className="pws-tool-btn"
        label={label}
        tooltipSide="bottom"
        tooltipOpen={open ? false : tipOpen}
        onTooltipOpenChange={setTipOpen}
        // A disclosure, not a popup: the panel is not a dialog, and focus stays where it was when
        // it opens. aria-expanded and aria-controls say where its content is.
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        active={open}
        data-indicator={indicator}
        onClick={handleClick}
        onPointerEnter={scheduleOpen}
        onPointerLeave={scheduleClose}
      >
        <Icon size={16} />
        {indicator && <StatusDot tone="warning" className="pws-tool-dot" />}
      </IconButton>
      {open && (
        <div
          id={panelId}
          className="pws-dropdown"
          role="group"
          aria-label={label}
          onPointerEnter={clearTimer}
          onPointerLeave={scheduleClose}
        >
          <div className="pws-dropdown-title">{label}</div>
          <div className="pws-dropdown-body">{panel}</div>
        </div>
      )}
    </div>
  );
};

export const PlanWorkspace: React.FC<PlanWorkspaceProps> = ({
  id,
  planId = "",
  title = "",
  meta,
  sourceUrl,
  sourceLabel,
  persona,
  personaInitials,
  actions = EMPTY_ACTIONS,
  menuItems = EMPTY_ACTIONS,
  primary,
  secondary = EMPTY_ACTIONS,
  shortcuts = EMPTY_ACTIONS,
  tabs = [],
  selectedTab,
  chatWidth = 420,
  verificationsLabel = "Verifications",
  questionsLabel = "Questions",
  unansweredQuestions = 0,
  events = EMPTY_EVENTS,
  eventHandler,
  slots,
}) => {
  type ToolKey = "verifications" | "questions";
  const rootRef = useRef<HTMLDivElement>(null);
  const tabsId = useId();
  const tabListRef = useRef<HTMLDivElement>(null);
  const [rootWidth, setRootWidth] = useState<number | null>(null);
  const [width, setWidth] = useState(() => readStoredChatWidth() ?? chatWidth);
  const [dragging, setDragging] = useState(false);
  const [openTool, setOpenTool] = useState<{ tool: ToolKey; pinned: boolean } | null>(null);
  const [, setSeenVersion] = useState(0);
  const questionsSeen = seenQuestionPlans.has(planId);

  useEffect(() => {
    if (openTool?.tool !== "questions" || !planId) return;
    seenQuestionPlans.add(planId);
    setSeenVersion((value) => value + 1);
  }, [openTool?.tool, planId]);

  const emit = useCallback(
    (eventName: string, ...args: unknown[]) => {
      if (eventHandler && events.includes(eventName)) eventHandler(eventName, id, args);
    },
    [eventHandler, events, id],
  );
  const focusChat = useCallback(() => {
    const composer = rootRef.current?.querySelector<HTMLTextAreaElement>(".pws-chat textarea");
    composer?.focus();
  }, []);

  const focusChatTags = useMemo(
    () =>
      new Set(
        [...actions, ...menuItems, ...secondary, ...(primary ? [primary] : [])]
          .filter((a) => a.focusChat)
          .map((a) => a.tag),
      ),
    [actions, menuItems, secondary, primary],
  );

  const fire = useCallback(
    (tag: string) => {
      if (focusChatTags.has(tag)) focusChat();
      emit("OnAction", tag);
    },
    [emit, focusChat, focusChatTags],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const measured = root.getBoundingClientRect().width;
    if (measured > 0) setRootWidth(measured);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) setRootWidth(entry.contentRect.width);
      }
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const narrow = rootWidth != null && rootWidth < NARROW_WIDTH;
  const compact = rootWidth != null && rootWidth < COMPACT_WIDTH;

  const iconActions = compact ? EMPTY_ACTIONS : actions;
  const menu = useMemo(
    () => (compact ? [...actions, ...menuItems] : menuItems),
    [compact, actions, menuItems],
  );

  const bindings = useMemo<ShortcutBinding[]>(
    () => [...actions, ...menuItems, ...secondary, ...(primary ? [primary] : []), ...shortcuts],
    [actions, menuItems, secondary, primary, shortcuts],
  );
  useActionShortcuts(bindings, fire, events.includes("OnAction"), rootRef);

  const tabElementId = (tabId: string) => `${tabsId}-tab-${tabId}`;
  const panelId = `${tabsId}-panel`;
  // The one tab in the tab order is the selected one (the first when none is): arrows then move
  // focus within the strip, and Tab leaves it.
  const tabStopId = tabs.some((tab) => tab.id === selectedTab) ? selectedTab : tabs[0]?.id;

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Alt+Left and Alt+Right are the browser's Back and Forward; Ctrl and Meta chords are the
    // document's. Only the bare keys move between tabs.
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const buttons = Array.from(
      tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
    );
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;
    const next = rovingTarget(e.key, current, buttons.length, { orientation: "horizontal" });
    if (next === null) return;
    e.preventDefault();
    buttons[next].focus();
  };

  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root || e.button !== 0) return;
    e.preventDefault();
    const rect = root.getBoundingClientRect();
    setDragging(true);
    let latest = width;
    const move = (ev: PointerEvent) => {
      latest = clampChatWidth(rect.right - ev.clientX, rect.width);
      setWidth(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDragging(false);
      writeStoredChatWidth(latest);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const resetWidth = () => {
    setWidth(chatWidth);
    writeStoredChatWidth(null);
  };

  const shownWidth = Math.max(width, MIN_CHAT_WIDTH);
  const maxWidth = rootWidth != null ? maxChatWidth(rootWidth) : shownWidth;

  const measuredRootWidth = () => rootRef.current?.getBoundingClientRect().width || rootWidth || 0;

  const resizeTo = (next: number) => {
    const rootBox = measuredRootWidth();
    const clamped = rootBox > 0 ? clampChatWidth(next, rootBox) : Math.max(next, MIN_CHAT_WIDTH);
    setWidth(clamped);
    writeStoredChatWidth(clamped);
  };

  // The divider sits on the chat's left edge, so moving it left (ArrowLeft) widens the chat.
  const handleResizerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const step = e.shiftKey ? RESIZE_STEP_LARGE : RESIZE_STEP;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        resizeTo(shownWidth + step);
        break;
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        resizeTo(shownWidth - step);
        break;
      case "Home":
        e.preventDefault();
        resizeTo(MIN_CHAT_WIDTH);
        break;
      case "End":
        e.preventDefault();
        // Without a measured workspace there is no widest width to go to.
        if (measuredRootWidth() > 0) resizeTo(maxChatWidth(measuredRootWidth()));
        break;
      case "Enter":
        e.preventDefault();
        resetWidth();
        break;
      default:
        break;
    }
  };

  const hasVerifications = hasNodes(slots?.Verifications);
  const hasQuestions = hasNodes(slots?.Questions);
  const hasToolbar = hasNodes(slots?.Toolbar);
  const hasProjectBadges = hasNodes(slots?.ProjectBadges);
  const showChat = hasNodes(slots?.Chat);

  const rootStyle = {
    "--pws-chat-width": `${Math.max(width, MIN_CHAT_WIDTH)}px`,
  } as React.CSSProperties;

  return (
    <div
      ref={rootRef}
      className="pws-root remove-parent-padding"
      style={rootStyle}
      data-narrow={narrow}
      data-compact={compact}
      data-dragging={dragging}
    >
      <header className="pws-topbar">
        <div className="pws-title-wrap">
          <div className="pws-title-main">
            {planId && <span className="pws-plan-id">{planId}</span>}
            <span className="pws-title" title={title}>
              {title}
            </span>
          </div>
          {sourceUrl && (
            <a
              className="pws-source"
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              title={sourceUrl}
            >
              <ExternalLink size={14} />
              <span>{sourceLabel || "Source"}</span>
            </a>
          )}
          {meta && <span className="pws-meta">{meta}</span>}
        </div>
        <div className="pws-topbar-right">
          {hasProjectBadges && <div className="pws-project-badges">{slots?.ProjectBadges}</div>}
          {persona && (
            <div className="pws-persona" title={persona}>
              <span className="pws-avatar" aria-hidden="true">
                {personaInitials || persona.charAt(0).toUpperCase()}
              </span>
              <span className="pws-persona-name">{persona}</span>
            </div>
          )}
          {(iconActions.length > 0 || menu.length > 0) && (
            <div className="pws-icon-group">
              {iconActions.map((action) => (
                <IconAction key={action.tag} action={action} onFire={fire} />
              ))}
              {menu.length > 0 && <OverflowMenu items={menu} onFire={fire} />}
            </div>
          )}
          {secondary.map((action) => (
            <LabeledButton key={action.tag} action={action} onFire={fire} />
          ))}
          {primary && <LabeledButton action={primary} primary onFire={fire} />}
        </div>
      </header>

      <div className="pws-body">
        <section className="pws-main">
          {hasToolbar && <div className="pws-toolbar">{slots?.Toolbar}</div>}
          {(tabs.length > 0 || hasVerifications || hasQuestions) && (
            <div className="pws-tabs-row">
              <div
                ref={tabListRef}
                className="pws-tabs"
                role="tablist"
                aria-label="Views"
                onKeyDown={handleTabKeyDown}
              >
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    id={tabElementId(tab.id)}
                    type="button"
                    role="tab"
                    className="pws-tab"
                    aria-selected={tab.id === selectedTab}
                    aria-controls={tab.id === selectedTab ? panelId : undefined}
                    tabIndex={tab.id === tabStopId ? 0 : -1}
                    onClick={() => emit("OnTabSelect", tab.id)}
                  >
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <TuiBadge numeric className="pws-tab-badge">
                        {tab.badge}
                      </TuiBadge>
                    )}
                  </button>
                ))}
              </div>
              {(hasVerifications || hasQuestions) && (
                <div className="pws-tab-tools">
                  {hasVerifications && (
                    <TabTool
                      icon={FileCheck2}
                      label={verificationsLabel}
                      panel={slots?.Verifications}
                      open={openTool?.tool === "verifications"}
                      pinned={openTool?.tool === "verifications" ? openTool.pinned : false}
                      onHoverOpen={() => setOpenTool({ tool: "verifications", pinned: false })}
                      onClick={() => {
                        if (!openTool) {
                          setOpenTool({ tool: "verifications", pinned: true });
                        } else if (openTool.tool === "verifications") {
                          if (openTool.pinned) {
                            setOpenTool(null);
                          } else {
                            setOpenTool({ tool: "verifications", pinned: true });
                          }
                        } else {
                          setOpenTool({ tool: "verifications", pinned: true });
                        }
                      }}
                      onClose={() => setOpenTool(null)}
                    />
                  )}
                  {hasQuestions && (
                    <TabTool
                      icon={FileQuestion}
                      label={questionsLabel}
                      panel={slots?.Questions}
                      open={openTool?.tool === "questions"}
                      pinned={openTool?.tool === "questions" ? openTool.pinned : false}
                      indicator={unansweredQuestions > 0 && !questionsSeen}
                      onHoverOpen={() => setOpenTool({ tool: "questions", pinned: false })}
                      onClick={() => {
                        if (!openTool) {
                          setOpenTool({ tool: "questions", pinned: true });
                        } else if (openTool.tool === "questions") {
                          if (openTool.pinned) {
                            setOpenTool(null);
                          } else {
                            setOpenTool({ tool: "questions", pinned: true });
                          }
                        } else {
                          setOpenTool({ tool: "questions", pinned: true });
                        }
                      }}
                      onClose={() => setOpenTool(null)}
                    />
                  )}
                </div>
              )}
            </div>
          )}
          <div
            id={panelId}
            className="pws-content"
            role={tabs.length > 0 ? "tabpanel" : undefined}
            aria-labelledby={
              tabs.some((tab) => tab.id === selectedTab) && selectedTab
                ? tabElementId(selectedTab)
                : undefined
            }
          >
            {slots?.Content}
          </div>
        </section>

        {showChat && (
          <>
            <Tooltip
              content="Drag or use the arrow keys to resize, double-click or press Enter to reset"
              side="left"
            >
              <div
                className="pws-resizer"
                role="separator"
                tabIndex={0}
                aria-orientation="vertical"
                aria-label="Resize chat"
                aria-valuenow={shownWidth}
                aria-valuemin={MIN_CHAT_WIDTH}
                aria-valuemax={Math.max(maxWidth, shownWidth)}
                aria-valuetext={`${shownWidth} pixels wide`}
                onPointerDown={startResize}
                onDoubleClick={resetWidth}
                onKeyDown={handleResizerKeyDown}
              />
            </Tooltip>
            <aside className="pws-chat" aria-label="Plan chat">
              {slots?.Chat}
            </aside>
          </>
        )}
      </div>
    </div>
  );
};
