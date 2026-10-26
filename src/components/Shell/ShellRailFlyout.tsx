import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { ShellSectionItemDto } from "./types";
import { ShellSectionItems } from "./ShellSectionItems";
import { IconButton } from "../ui/IconButton";
import "./shell.css";

const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 220;
const MENU_WIDTH = 300;
const MENU_MARGIN = 8;
const MENU_MIN_HEIGHT = 160;
const TABBABLE =
  'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])';

interface MenuPosition {
  top: number;
  left: number;
  maxHeight: number;
}

export interface RailFlyoutTrigger {
  ref: React.RefObject<HTMLButtonElement | null>;
  open: boolean;
  pinned: boolean;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onClick: () => void;
}

interface ShellRailFlyoutProps {
  title?: string;
  items: ShellSectionItemDto[];
  selectedId?: string;
  emptyText?: string;
  onSelect: (itemId: string) => void;
  newLabel?: string;
  onNew?: () => void;
  onRename?: (itemId: string, title: string) => void;
  onDelete?: (itemId: string) => void;
  onTogglePin?: (itemId: string) => void;
  children: (trigger: RailFlyoutTrigger) => React.ReactNode;
}

/**
 * Floats a section list over the content next to a rail button. Hovering the
 * trigger opens the list; clicking pins it open until Escape, a click outside
 * or another click on the trigger dismisses it. The bar's arrows step the
 * selection through the list without leaving the menu.
 */
export const ShellRailFlyout: React.FC<ShellRailFlyoutProps> = ({
  title,
  items,
  selectedId,
  emptyText,
  onSelect,
  newLabel,
  onNew,
  onRename,
  onDelete,
  onTogglePin,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const [rowInteracting, setRowInteracting] = useState(false);
  // Set when the menu is pinned open, so focus moves into it once it has mounted.
  const focusOnOpenRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const measure = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 0;
    setPosition({
      top: Math.max(MENU_MARGIN, rect.top),
      left: rect.right + MENU_MARGIN,
      maxHeight: Math.max(MENU_MIN_HEIGHT, viewportHeight - MENU_MARGIN * 2),
    });
  }, []);

  // The menu opens level with its button, then slides up by however much it
  // overhangs the viewport - a short list stays anchored, a long one grows up.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!open || !menu || !position) return;
    const viewportHeight = window.innerHeight || 0;
    const maxTop = Math.max(MENU_MARGIN, viewportHeight - MENU_MARGIN - menu.offsetHeight);
    if (position.top > maxTop) setPosition({ ...position, top: maxTop });
  }, [open, position, items.length]);

  const openMenu = useCallback(() => {
    clearTimer();
    measure();
    setOpen(true);
  }, [clearTimer, measure]);

  const closeMenu = useCallback(() => {
    clearTimer();
    setPinned(false);
    setOpen(false);
  }, [clearTimer]);

  const scheduleOpen = useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(openMenu, OPEN_DELAY_MS);
  }, [clearTimer, openMenu]);

  const scheduleClose = useCallback(() => {
    clearTimer();
    if (pinned || rowInteracting) return;
    timerRef.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [clearTimer, pinned, rowInteracting]);

  const togglePinned = useCallback(() => {
    if (pinned) {
      closeMenu();
      return;
    }
    focusOnOpenRef.current = true;
    setPinned(true);
    openMenu();
  }, [closeMenu, openMenu, pinned]);

  // The menu is portaled to the end of the body, so a keyboard user who pins it open from the rail
  // button would otherwise be left on the button with the list out of reach: focus goes in.
  useEffect(() => {
    if (!open || !pinned || !focusOnOpenRef.current) return;
    const menu = menuRef.current;
    if (!menu) return;
    focusOnOpenRef.current = false;
    (menu.querySelector<HTMLElement>(TABBABLE) ?? menu).focus();
  }, [open, pinned, position]);

  useEffect(() => clearTimer, [clearTimer]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => measure();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open || !pinned) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Focus goes back to the rail button only if it was in the menu, which is about to vanish.
      const hadFocus = menuRef.current?.contains(document.activeElement) ?? false;
      closeMenu();
      if (hadFocus) buttonRef.current?.focus();
    };
    const onPointerDown = (e: Event) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(".tsh-item-menu")) return;
      closeMenu();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, pinned, closeMenu]);

  const selectedIndex = items.findIndex((item) => item.id === selectedId);
  const canStepBack = items.length > 0 && selectedIndex !== 0;
  const canStepForward = items.length > 0 && selectedIndex !== items.length - 1;

  const step = (delta: number) => {
    if (items.length === 0) return;
    const next = selectedIndex === -1 ? (delta < 0 ? items.length - 1 : 0) : selectedIndex + delta;
    if (next < 0 || next >= items.length) return;
    onSelect(items[next].id);
  };

  // A pinned menu holds focus the way a dialog does: Tab wraps inside it, and Escape leaves.
  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !pinned) return;
    const menu = menuRef.current;
    if (!menu) return;
    const tabbable = Array.from(menu.querySelectorAll<HTMLElement>(TABBABLE));
    if (tabbable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = tabbable[0];
    const last = tabbable[tabbable.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === menu)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const closeUnlessPinned = () => {
    if (pinned) return;
    clearTimer();
    setOpen(false);
  };

  const selectItem = (itemId: string) => {
    onSelect(itemId);
    closeUnlessPinned();
  };

  const createNew = () => {
    onNew?.();
    closeUnlessPinned();
  };

  return (
    <>
      {children({
        ref: buttonRef,
        open,
        pinned,
        onPointerEnter: scheduleOpen,
        onPointerLeave: scheduleClose,
        onClick: togglePinned,
      })}
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            className="tsh-rail-menu"
            style={{
              top: position.top,
              left: position.left,
              width: MENU_WIDTH,
              maxHeight: position.maxHeight,
            }}
            tabIndex={-1}
            onPointerEnter={clearTimer}
            onPointerLeave={scheduleClose}
            onKeyDown={handleMenuKeyDown}
          >
            <div className="tsh-rail-menu-bar">
              <span className="tsh-rail-menu-steps">
                <IconButton
                  label="Previous"
                  size="sm"
                  onClick={() => step(-1)}
                  disabled={!canStepBack}
                >
                  <ChevronLeft size={14} />
                </IconButton>
                <IconButton
                  label="Next"
                  size="sm"
                  onClick={() => step(1)}
                  disabled={!canStepForward}
                >
                  <ChevronRight size={14} />
                </IconButton>
              </span>
              {title && <span className="tsh-rail-menu-title">{title}</span>}
              {newLabel && onNew && (
                <IconButton
                  label={newLabel}
                  size="sm"
                  className="tsh-rail-menu-new"
                  onClick={createNew}
                >
                  <Plus size={14} />
                </IconButton>
              )}
            </div>
            <ShellSectionItems
              items={items}
              selectedId={selectedId}
              emptyText={emptyText}
              className="tsh-rail-menu-list"
              onSelect={selectItem}
              onRename={onRename}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
              onInteractionChange={setRowInteracting}
            />
          </div>,
          document.body,
        )}
    </>
  );
};
