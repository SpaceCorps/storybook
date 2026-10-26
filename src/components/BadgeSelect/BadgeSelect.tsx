import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  Flag,
  Folder,
  Plus,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { findByTypeahead, isTypeaheadKey, useTypeahead } from "../keyboard/typeahead";
import "./badge-select.css";

type IvyEventHandler = (eventName: string, widgetId: string, args: unknown[]) => void;

export interface BadgeSelectOption {
  value: string;
  label: string;
  icon?: string | null;
  removable?: boolean;
}

export interface BadgeSelectProps {
  id: string;
  options?: BadgeSelectOption[];
  value?: string[];
  placeholder?: string;
  icon?: string;
  multiple?: boolean;
  tooltip?: string;
  width?: string;
  actions?: BadgeSelectOption[];
  events?: string[];
  eventHandler?: IvyEventHandler;
}

const EMPTY_OPTIONS: BadgeSelectOption[] = [];
const EMPTY_ACTIONS: BadgeSelectOption[] = [];
const EMPTY_VALUE: string[] = [];
const EMPTY_EVENTS: string[] = [];
const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 240;
const PAGE_STEP = 10;

const ICONS: Record<string, LucideIcon> = {
  ChevronDown,
  Flag,
  Folder,
  Plus,
  WandSparkles,
  X,
};

function NamedIcon({
  name,
  size = 14,
  className,
}: {
  name?: string | null;
  size?: number;
  className?: string;
}) {
  if (!name) return null;
  const Cmp = ICONS[name];
  return Cmp ? <Cmp size={size} className={className} aria-hidden /> : null;
}

function parseWidth(width?: string): React.CSSProperties {
  if (!width) return {};
  const [wanted, min, max] = width.split(",");
  const style: React.CSSProperties = {};
  const apply = (part: string | undefined, key: "width" | "minWidth" | "maxWidth") => {
    if (!part) return;
    const [type, raw] = part.split(":");
    const value = raw ? parseFloat(raw) : undefined;
    switch (type.toLowerCase()) {
      case "fraction":
        style[key] = `${(value ?? 0) * 100}%`;
        break;
      case "full":
        style[key] = "100%";
        break;
      case "px":
        style[key] = `${value}px`;
        break;
      case "rem":
        style[key] = `${value}rem`;
        break;
      case "units":
        style[key] = `${(value ?? 0) * 0.25}rem`;
        break;
      case "fit":
        style[key] = "fit-content";
        break;
      case "grow":
        style.flexGrow = value || 1;
        style.minWidth = 0;
        break;
      default:
        break;
    }
  };
  apply(wanted, "width");
  apply(min, "minWidth");
  apply(max, "maxWidth");
  return style;
}

function sameStyle(a: React.CSSProperties, b: React.CSSProperties): boolean {
  const keys = Object.keys(b) as Array<keyof React.CSSProperties>;
  return Object.keys(a).length === keys.length && keys.every((key) => a[key] === b[key]);
}

/** One stop in the open popup: a selectable option or an action row, in the order they are listed. */
interface NavItem {
  kind: "option" | "action";
  opt: BadgeSelectOption;
}

/**
 * A select that shows its value as badges. The one control is a select-only `combobox` button laid
 * over the field, whether or not anything is selected (an empty one used to be a plain button), and
 * the remove buttons on the badges are its siblings rather than interactive content inside it.
 *
 * Behaviour a caller or a test might have relied on: pressing a badge's remove button while the
 * list is open closes the list, since focus moves; Escape closes the list and nothing around it (a
 * Dialog or Sheet stays open); Alt chords other than Alt+ArrowDown and Alt+ArrowUp are left to the
 * browser; Tab and Alt+ArrowUp leave a single-select on the option they were on.
 */
export function BadgeSelect({
  id,
  options = EMPTY_OPTIONS,
  value = EMPTY_VALUE,
  placeholder = "Select...",
  icon,
  multiple = true,
  tooltip,
  width,
  actions = EMPTY_ACTIONS,
  events = EMPTY_EVENTS,
  eventHandler,
}: BadgeSelectProps) {
  const [open, setOpen] = useState(false);
  // Index into the options followed by the actions; -1 until the pointer or an arrow picks one.
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [visibleCount, setVisibleCount] = useState(Number.MAX_SAFE_INTEGER);
  const [containerWidth, setContainerWidth] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Set when the keyboard moves the highlight, read once by the effect that brings the row into
  // view. A highlight that follows the pointer is already under it and must never scroll the list.
  const revealRef = useRef(false);
  const badgesRef = useRef<HTMLDivElement>(null);
  const typeahead = useTypeahead();
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const actionsId = `${baseId}-actions`;
  const itemId = (index: number) => `${baseId}-item-${index}`;
  const selected = Array.isArray(value) ? value : [];
  const selectedKey = selected.join("\u0000");

  const navItems: NavItem[] = [
    ...options.map((opt): NavItem => ({ kind: "option", opt })),
    ...actions.map((opt): NavItem => ({ kind: "action", opt })),
  ];
  const activeItem = open && activeIndex >= 0 ? navItems[activeIndex] : undefined;

  const updateMenuPosition = () => {
    const trigger = rootRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    const spaceAbove = rect.top - MENU_GAP;
    const openUp = spaceBelow < Math.min(MENU_MAX_HEIGHT, 160) && spaceAbove > spaceBelow;
    const maxHeight = Math.min(MENU_MAX_HEIGHT, Math.max(120, openUp ? spaceAbove : spaceBelow));

    const next: React.CSSProperties = {
      position: "fixed",
      left: rect.left,
      width: rect.width,
      maxHeight,
      top: openUp ? undefined : rect.bottom + MENU_GAP,
      bottom: openUp ? window.innerHeight - rect.top + MENU_GAP : undefined,
      zIndex: 1000,
      pointerEvents: "auto",
    };
    // A scroll anywhere on the page asks for this; an unchanged position is not a new render.
    setMenuStyle((prev) => (sameStyle(prev, next) ? prev : next));
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, options.length, selected.length, actions.length]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const container = badgesRef.current;
    if (!container || selected.length === 0) return;
    const badges = Array.from(container.querySelectorAll<HTMLElement>("[data-badge]"));
    badges.forEach((b) => (b.style.display = ""));
    const gap = 4;
    const counterReserve = 40;
    const avail = container.clientWidth;
    let used = 0;
    let count = 0;
    for (let i = 0; i < badges.length; i++) {
      const w = badges[i].offsetWidth + (i > 0 ? gap : 0);
      const hasMore = i < badges.length - 1;
      const reserve = hasMore ? counterReserve + gap : 0;
      if (used + w + reserve <= avail) {
        used += w;
        count++;
      } else {
        break;
      }
    }
    count = Math.max(1, count);
    badges.forEach((b, i) => (b.style.display = i < count ? "" : "none"));
    setVisibleCount(count);
  }, [selectedKey, containerWidth]);

  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;
    const stop = (e: Event) => e.stopPropagation();
    menu.addEventListener("wheel", stop, { passive: false });
    menu.addEventListener("touchmove", stop, { passive: false });
    return () => {
      menu.removeEventListener("wheel", stop);
      menu.removeEventListener("touchmove", stop);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setActiveIndex(-1);
    };
    const onReposition = (e: Event) => {
      // The list scrolling inside the popup does not move the popup.
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return;
      updateMenuPosition();
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  // Focus stays on the combobox and the highlighted row is announced through
  // aria-activedescendant, so the row only has to be brought into view. That happens when the
  // keyboard moves the highlight and at no other time: the pointer highlights what is already
  // under it, and a list the person has scrolled by hand must stay where they put it.
  useEffect(() => {
    const reveal = revealRef.current;
    revealRef.current = false;
    if (!open || activeIndex < 0 || !reveal) return;
    document.getElementById(itemId(activeIndex))?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const emit = (next: string[]) => {
    if (eventHandler && events.includes("OnChange")) {
      eventHandler("OnChange", id, [next]);
    }
  };

  const closeMenu = () => {
    // A search belongs to one opening of the list.
    typeahead.reset();
    setOpen(false);
    setActiveIndex(-1);
  };

  // Escape while the list is open closes the list and nothing else. A Dialog, Sheet or Popover
  // around the control listens for Escape on the document in the capture phase, ahead of the
  // combobox's own handler, and would dismiss itself along with the list (losing its form, and
  // dropping focus to the page). A capture listener on the window runs before the document's, so
  // this is the one place that can claim the key; the event stops here and never reaches them.
  useEffect(() => {
    if (!open) return;
    const claimEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    };
    window.addEventListener("keydown", claimEscape, true);
    return () => window.removeEventListener("keydown", claimEscape, true);
    // closeMenu only touches state setters and the typeahead ref holder, which are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runAction = (actionValue: string) => {
    if (eventHandler && events.includes("OnAction")) {
      eventHandler("OnAction", id, [actionValue]);
    }
    closeMenu();
  };

  const toggle = (optionValue: string) => {
    if (multiple) {
      if (selected.includes(optionValue)) {
        const opt = options.find((o) => o.value === optionValue);
        if (opt?.removable === false) return;
        emit(selected.filter((v) => v !== optionValue));
        return;
      }
      emit([...selected, optionValue]);
      return;
    }
    emit([optionValue]);
    closeMenu();
  };

  const choose = (item: NavItem) => {
    if (item.kind === "action") runAction(item.opt.value);
    else toggle(item.opt.value);
  };

  /**
   * Leaving the list by Tab or Alt+ArrowUp. Only a single-select commits, and only an option that
   * is not already the value: an action row or a multi-select toggle is something the person
   * passed over, not something they asked for.
   */
  const commitOnLeave = () => {
    if (!multiple && activeItem?.kind === "option" && !selected.includes(activeItem.opt.value)) {
      toggle(activeItem.opt.value);
    }
    closeMenu();
  };

  const remove = (optionValue: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const opt = options.find((o) => o.value === optionValue);
    if (opt?.removable === false) return;
    emit(selected.filter((v) => v !== optionValue));
    // The button that was just used is about to unmount; keep focus in the control.
    triggerRef.current?.focus();
  };

  /** The row the popup opens on from the keyboard: the first selected option, else the first row. */
  const initialIndex = () => {
    const firstSelected = options.findIndex((o) => selected.includes(o.value));
    if (firstSelected !== -1) return firstSelected;
    return navItems.length > 0 ? 0 : -1;
  };

  /** Moves the highlight from the keyboard, so the row is scrolled into view. */
  const moveTo = (index: number) => {
    if (index !== activeIndex) revealRef.current = true;
    setActiveIndex(index);
  };

  const openAt = (index: number) => {
    if (index >= 0) revealRef.current = true;
    setActiveIndex(index);
    setOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.ctrlKey || e.metaKey) return;
    // Alt is the browser's and the window's (Alt+Left is Back, Alt+Home is the home page). The
    // combobox pattern's own Alt chords are Alt+ArrowDown to open and Alt+ArrowUp to close.
    if (e.altKey && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const last = navItems.length - 1;
    const key = e.key;

    // A space is part of a search already under way, otherwise it is the select key.
    if (isTypeaheadKey(e, typeahead.searching)) {
      const found = findByTypeahead(
        navItems.map((item) => item.opt.label),
        typeahead.push(key),
        open ? activeIndex : initialIndex() - 1,
      );
      e.preventDefault();
      if (found !== -1) openAt(found);
      return;
    }

    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
        e.preventDefault();
        openAt(initialIndex());
      } else if (key === "Home") {
        e.preventDefault();
        openAt(last >= 0 ? 0 : -1);
      } else if (key === "End") {
        e.preventDefault();
        openAt(last);
      }
      return;
    }

    switch (key) {
      case "ArrowDown":
        e.preventDefault();
        moveTo(Math.min(activeIndex + 1, last));
        break;
      case "ArrowUp":
        e.preventDefault();
        // Alt+Up closes, and a single-select keeps the row it was on, as the native select does.
        if (e.altKey) commitOnLeave();
        else moveTo(activeIndex < 0 ? last : Math.max(activeIndex - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        moveTo(last >= 0 ? 0 : -1);
        break;
      case "End":
        e.preventDefault();
        moveTo(last);
        break;
      case "PageDown":
        e.preventDefault();
        moveTo(Math.min(activeIndex + PAGE_STEP, last));
        break;
      case "PageUp":
        e.preventDefault();
        moveTo(Math.max(activeIndex - PAGE_STEP, 0));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (activeItem) choose(activeItem);
        else if (key === "Enter") closeMenu();
        break;
      case "Tab":
        // Focus moves on as usual; commitOnLeave says what the list keeps of the visit.
        commitOnLeave();
        break;
      default:
        break;
    }
  };

  const triggerIcon =
    icon ||
    (selected.length === 0
      ? undefined
      : options.find((o) => o.value === selected[0])?.icon || undefined);

  const label = placeholder || tooltip || "Select";
  const selectedLabels = selected.map((v) => options.find((o) => o.value === v)?.label ?? v);
  const controls = [listboxId, actions.length > 0 ? actionsId : null].filter(Boolean).join(" ");

  const menu =
    open &&
    createPortal(
      <div
        ref={menuRef}
        className="bselect-menu bselect-menu-portal"
        style={menuStyle}
        // The popup is part of the combobox, so a press anywhere in it (its padding, its border,
        // the separator, not only the rows) must not take focus off the combobox.
        onMouseDown={(e) => e.preventDefault()}
      >
        <div id={listboxId} role="listbox" aria-label={label} aria-multiselectable={multiple}>
          {options.map((opt, index) => {
            const isSelected = selected.includes(opt.value);
            const showRemove = isSelected && opt.removable !== false;
            return (
              <div
                key={opt.value}
                id={itemId(index)}
                role="option"
                aria-selected={isSelected}
                className={`bselect-item${isSelected ? " bselect-item-selected" : ""}${index === activeIndex ? " bselect-item-active" : ""}`}
                onClick={() => toggle(opt.value)}
                onMouseMove={() => {
                  if (index === activeIndex) return;
                  revealRef.current = false;
                  setActiveIndex(index);
                }}
              >
                <NamedIcon name={opt.icon} />
                <span className="bselect-item-label">{opt.label}</span>
                {showRemove && <X size={14} className="bselect-item-x" aria-hidden />}
                {/* A tint alone is too faint to show what is selected: an option that cannot be
                    removed has no X to say so, so it gets a check. */}
                {isSelected && !showRemove && (
                  <Check size={14} className="bselect-item-x" aria-hidden />
                )}
              </div>
            );
          })}
        </div>
        {actions.length > 0 && (
          <>
            <div className="bselect-separator" role="separator" />
            <div id={actionsId} role="group" aria-label="Actions">
              {actions.map((action, index) => {
                const navIndex = options.length + index;
                return (
                  <button
                    key={action.value}
                    id={itemId(navIndex)}
                    type="button"
                    // Reached with the arrow keys from the combobox, not with Tab.
                    tabIndex={-1}
                    className={`bselect-item bselect-action${navIndex === activeIndex ? " bselect-item-active" : ""}`}
                    onClick={() => runAction(action.value)}
                    onMouseMove={() => {
                      if (navIndex === activeIndex) return;
                      revealRef.current = false;
                      setActiveIndex(navIndex);
                    }}
                  >
                    <NamedIcon name={action.icon} />
                    <span className="bselect-item-label">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>,
      document.body,
    );

  return (
    <div ref={rootRef} className="bselect" style={parseWidth(width)} title={tooltip}>
      <div className="bselect-field">
        {/* The one persistent control: a button laid over the whole field, so the badges and their
            remove buttons are its siblings rather than interactive children inside a combobox. */}
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-label={label}
          className="bselect-trigger"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? controls : undefined}
          aria-activedescendant={activeItem ? itemId(activeIndex) : undefined}
          onClick={() => {
            // Safari does not focus a button when it is clicked, and the keys only reach it if it
            // has focus.
            triggerRef.current?.focus();
            if (open) closeMenu();
            else openAt(-1);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (open) closeMenu();
          }}
        >
          {selected.length > 0 && (
            <span className="bselect-value-text">{selectedLabels.join(", ")}</span>
          )}
        </button>
        <NamedIcon name={triggerIcon} className="bselect-trigger-icon" />
        <div ref={badgesRef} className="bselect-badges">
          {selected.length === 0 ? (
            <span className="bselect-placeholder" aria-hidden="true">
              {placeholder}
            </span>
          ) : (
            <>
              {selected.map((v, i) => {
                const opt = options.find((o) => o.value === v);
                const canRemove = multiple && opt?.removable !== false;
                return (
                  <span
                    key={v}
                    data-badge
                    className="bselect-badge"
                    style={{ display: i < visibleCount ? undefined : "none" }}
                  >
                    <span className="bselect-badge-label" aria-hidden="true">
                      {opt?.label ?? v}
                    </span>
                    {canRemove && (
                      <button
                        type="button"
                        className="bselect-badge-x"
                        aria-label={`Remove ${opt?.label ?? v}`}
                        onClick={(e) => remove(v, e)}
                      >
                        <X size={12} aria-hidden />
                      </button>
                    )}
                  </span>
                );
              })}
              {visibleCount < selected.length && (
                <span className="bselect-count" aria-hidden="true">
                  +{selected.length - visibleCount}
                </span>
              )}
            </>
          )}
        </div>
        <ChevronDown size={14} className="bselect-chevron" aria-hidden />
      </div>
      {menu}
    </div>
  );
}
