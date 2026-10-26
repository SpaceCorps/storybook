import * as React from "react";
import { X, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useFieldContext, useFieldControl } from "@/components/ui/field/field-context";
import { cn } from "@/lib/utils";
import {
  computeClearAllValues,
  computeSelectAllValues,
  filterOptionsBySearch,
  type SearchMode,
} from "@/components/ui/select/utils";
import { cva } from "class-variance-authority";
import { Densities } from "@/types/density";
import { useDensity } from "@/contexts/density-context";
import { xIconVariant } from "@/components/ui/input/text-input-variant";
import {
  selectMultiTriggerVariant,
  selectTriggerEndActionsVariant,
} from "@/components/ui/select/variant";

// Variants for menu items
const menuItemVariant = cva("cursor-pointer", {
  variants: {
    density: {
      Small: "px-2 py-1 text-xs",
      Medium: "px-3 py-2 text-sm",
      Large: "px-4 py-3 text-base",
    },
  },
  defaultVariants: {
    density: "Medium",
  },
});

// Variants for Badge components
const badgeVariant = cva("hover:bg-secondary", {
  variants: {
    density: {
      Small: "text-xs",
      Medium: "text-sm",
      Large: "text-base",
    },
  },
  defaultVariants: {
    density: "Medium",
  },
});

/**
 * The list is portalled out of whatever modal surrounds the field, so that surface's scroll lock
 * swallows the wheel and touch moves meant for the list. The lock listens on the document; stopping
 * the events here keeps them from getting that far.
 */
const stopPropagation = (event: React.SyntheticEvent) => event.stopPropagation();

export interface Option {
  label: string;
  value: string;
  disable?: boolean;
  tooltip?: string;
}

export interface MultipleSelectorProps {
  /** Accepted for symmetry with the other controls and ignored: cmdk owns the id of its input. */
  id?: string;
  /** The form field name: one hidden input per selected value, so `FormData.getAll(name)` lists them. */
  name?: string;
  /** The accessible name of the combobox (cmdk renders it as a visually hidden label). */
  label?: string;
  "aria-label"?: string;
  /** Names the combobox by reference. Inside a `Field` or `FormItem` the field's label is used. */
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean | "true" | "false";
  required?: boolean;
  value?: Option[];
  defaultOptions?: Option[];
  onValueChange?: (value: Option[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  commandProps?: {
    label?: string;
  };
  hidePlaceholderWhenSelected?: boolean;
  emptyIndicator?: React.ReactNode;
  invalid?: boolean;
  density?: Densities;
  maxVisibleBadges?: number;
  ghost?: boolean;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  showActions?: boolean;
  maxSelections?: number;
  minSelections?: number;
  onNullableClear?: () => void;
  autoFocus?: boolean;
  rightSlot?: React.ReactNode;
  searchable?: boolean;
  searchMode?: SearchMode;
  emptyMessage?: string;
}

const MultipleSelector = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  MultipleSelectorProps
>(
  (
    {
      value = [],
      defaultOptions = [],
      onValueChange,
      placeholder = "Select options...",
      disabled: disabledProp,
      className,
      commandProps,
      hidePlaceholderWhenSelected = false,
      emptyIndicator,
      invalid: invalidProp,
      density,
      maxVisibleBadges,
      ghost = false,
      onBlur,
      onFocus,
      showActions = false,
      maxSelections,
      minSelections,
      onNullableClear,
      autoFocus = false,
      rightSlot,
      searchable = true,
      searchMode = "CaseInsensitive",
      emptyMessage,
      id,
      name,
      label,
      required,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      "aria-required": ariaRequired,
    },
    ref,
  ) => {
    const field = useFieldContext();
    const control = useFieldControl({
      id,
      name,
      disabled: disabledProp,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      "aria-required": required ? true : ariaRequired,
    });
    const disabled = control.disabled ?? false;
    const invalid =
      invalidProp ?? (control["aria-invalid"] === true || control["aria-invalid"] === "true");
    const accessibleName = ariaLabel ?? label ?? commandProps?.label;
    // A field's visible label names the combobox by reference, so it works whatever the label holds
    // (a node, not just a string) and inside the library's `FormItem`, which has no label text.
    const labelledBy =
      ariaLabelledBy ?? (!accessibleName && field?.hasLabel ? field.labelId : undefined);
    const contextDensity = useDensity();
    const effectiveDensity = density ?? contextDensity;

    const inputRef = React.useRef<HTMLInputElement>(null);
    const containerRef = React.useRef<HTMLSpanElement>(null);
    const triggerWrapperRef = React.useRef<HTMLDivElement>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const [open, setOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState("");
    const measureRef = React.useRef<HTMLDivElement>(null);
    const [visibleCount, setVisibleCount] = React.useState(maxVisibleBadges ?? 1);
    const hasAutoFocusedRef = React.useRef(false);
    const listControlsRef = React.useRef<string | null>(null);
    const cmdkLabelledByRef = React.useRef<string | null>(null);
    const [announcement, setAnnouncement] = React.useState("");

    const closeDropdown = React.useCallback(() => {
      setOpen(false);
      setInputValue("");
      if (containerRef.current) {
        containerRef.current.scrollLeft = 0;
      }
    }, []);

    React.useEffect(() => {
      if (autoFocus && !disabled && !hasAutoFocusedRef.current) {
        hasAutoFocusedRef.current = true;
        inputRef.current?.focus();
      }
    }, [autoFocus, disabled]);

    React.useEffect(() => {
      if (open && dropdownRef.current) {
        requestAnimationFrame(() => {
          const scrollableElement =
            dropdownRef.current?.querySelector("[cmdk-list]") ??
            dropdownRef.current?.querySelector("[cmdk-group]");
          if (scrollableElement) {
            scrollableElement.scrollTop = 0;
          }
        });
      }
    }, [open]);

    // cmdk hard-codes aria-expanded and aria-controls on its input, and only ever as "open", so both
    // are kept in step by hand: collapsed while the list is closed (its id would dangle), restored after.
    React.useLayoutEffect(() => {
      const input = inputRef.current;
      if (!input) return;
      if (listControlsRef.current === null) {
        listControlsRef.current = input.getAttribute("aria-controls");
      }
      input.setAttribute("aria-expanded", String(open));
      if (open && listControlsRef.current) {
        input.setAttribute("aria-controls", listControlsRef.current);
      } else {
        input.removeAttribute("aria-controls");
      }
    }, [open]);

    // cmdk sets the input's aria-labelledby to its own visually hidden label, after any prop passed
    // through, so a name taken from a visible label is applied by hand and cmdk's put back without one.
    React.useLayoutEffect(() => {
      const input = inputRef.current;
      if (!input) return;
      if (cmdkLabelledByRef.current === null) {
        cmdkLabelledByRef.current = input.getAttribute("aria-labelledby") ?? "";
      }
      const next = labelledBy ?? cmdkLabelledByRef.current;
      if (next) input.setAttribute("aria-labelledby", next);
      else input.removeAttribute("aria-labelledby");
    }, [labelledBy]);

    // cmdk keeps pointing aria-activedescendant at the last highlighted option, which is gone once
    // the list closes.
    React.useLayoutEffect(() => {
      if (!open) inputRef.current?.removeAttribute("aria-activedescendant");
    });

    // cmdk owns the input's id and looks the input up by it, so the id stays; the field's label is
    // pointed at it instead.
    const setFieldControlId = field?.setControlId;
    React.useLayoutEffect(() => {
      const inputId = inputRef.current?.id;
      if (!setFieldControlId || !inputId) return;
      setFieldControlId(inputId);
      return () => setFieldControlId(undefined);
    }, [setFieldControlId]);

    React.useEffect(() => {
      if (!announcement) return;
      const timer = setTimeout(() => setAnnouncement(""), 1500);
      return () => clearTimeout(timer);
    }, [announcement]);

    const setupBadgeCalculation = React.useCallback(() => {
      if (maxVisibleBadges !== undefined) {
        setVisibleCount(maxVisibleBadges);
        return;
      }

      if (value.length === 0) {
        setVisibleCount(0);
        return;
      }

      const container = containerRef.current;
      const measureContainer = measureRef.current;
      if (!container || !measureContainer) return;

      const gap = parseFloat(getComputedStyle(container).gap) || 4;
      const input = container.querySelector("input");
      const inputReserve = input
        ? (parseFloat(getComputedStyle(input).minWidth) || 0) +
          (parseFloat(getComputedStyle(input).marginLeft) || 0)
        : 0;

      const calculate = () => {
        const containerWidth = container.clientWidth;
        if (containerWidth === 0) return;

        const badges = Array.from(measureContainer.children) as HTMLElement[];
        const availableWidth = containerWidth - inputReserve;

        if (availableWidth <= 0 || badges.length === 0) {
          setVisibleCount(1);
          return;
        }

        const overflowBadge = badges[value.length];
        const overflowBadgeWidth = overflowBadge ? overflowBadge.offsetWidth : 40;

        let usedWidth = 0;
        let count = 0;

        for (let i = 0; i < value.length && i < badges.length; i++) {
          const badgeWidth = badges[i].offsetWidth;
          const gapWidth = count > 0 ? gap : 0;
          const newTotal = usedWidth + badgeWidth + gapWidth;

          const remainingItems = value.length - count - 1;
          const needsOverflow = remainingItems > 0;
          const maxAllowed = needsOverflow
            ? availableWidth - overflowBadgeWidth - gap
            : availableWidth;

          if (newTotal > maxAllowed && count > 0) break;

          usedWidth = newTotal;
          count++;
        }

        setVisibleCount(Math.max(1, count));
      };

      requestAnimationFrame(calculate);

      const observer = new ResizeObserver(calculate);
      observer.observe(container);

      return () => observer.disconnect();
    }, [value, maxVisibleBadges]);

    React.useEffect(() => {
      return setupBadgeCalculation();
    }, [setupBadgeCalculation, effectiveDensity]);

    const handleUnselect = React.useCallback(
      (option: Option) => {
        setAnnouncement(`Removed ${option.label}`);
        onValueChange?.(value.filter((item) => item.value !== option.value));
      },
      [onValueChange, value],
    );

    const chipButtons = React.useCallback(
      () =>
        Array.from(
          containerRef.current?.querySelectorAll<HTMLButtonElement>("button[data-chip-remove]") ??
            [],
        ),
      [],
    );

    const handleChipKeyDown = (
      e: React.KeyboardEvent<HTMLButtonElement>,
      option: Option,
      index: number,
    ) => {
      const chips = chipButtons();
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          chips[index - 1]?.focus();
          break;
        case "ArrowRight":
          e.preventDefault();
          (chips[index + 1] ?? inputRef.current)?.focus();
          break;
        case "Backspace":
        case "Delete":
        case "Enter":
        case " ":
          e.preventDefault();
          // Focus moves first, to a chip or the input that survives the removal.
          (chips[index + 1] ?? chips[index - 1] ?? inputRef.current)?.focus();
          handleUnselect(option);
          break;
      }
    };

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const input = inputRef.current;
        if (!input) return;
        const fromInput = e.target === input;
        if (fromInput && (e.key === "Delete" || e.key === "Backspace")) {
          if (input.value === "" && value.length > 0) {
            handleUnselect(value[value.length - 1]);
          }
        }
        if (
          fromInput &&
          e.key === "ArrowLeft" &&
          input.selectionStart === 0 &&
          input.selectionEnd === 0
        ) {
          const chips = chipButtons();
          if (chips.length > 0) {
            e.preventDefault();
            chips[chips.length - 1].focus();
          }
        }
        if (fromInput && !open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          e.preventDefault();
          setOpen(true);
        }
        // An open list closes in onEscapeKeyDown, which marks the event handled. Closed, Escape
        // empties the text, so a second press is how you start over.
        if (e.key === "Escape" && !e.defaultPrevented && !open && inputValue) {
          setInputValue("");
        }
      },
      [value, handleUnselect, chipButtons, open, inputValue],
    );

    const isSelected = React.useCallback(
      (option: Option) => value.some((item) => item.value === option.value),
      [value],
    );

    const toggleOption = React.useCallback(
      (option: Option) => {
        if (isSelected(option)) {
          handleUnselect(option);
        } else {
          setAnnouncement(`Added ${option.label}`);
          onValueChange?.([...value, option]);
        }
      },
      [isSelected, handleUnselect, onValueChange, value],
    );

    const selectedValueStrings = React.useMemo(() => value.map((v) => v.value), [value]);

    const filteredOptions = React.useMemo(() => {
      if (searchable === false || !inputValue) return defaultOptions;
      return filterOptionsBySearch(defaultOptions, inputValue, searchMode);
    }, [defaultOptions, inputValue, searchable, searchMode]);

    const visibleEnabledForBulk = React.useMemo(() => {
      return filteredOptions.filter((o) => !o.disable);
    }, [filteredOptions]);

    const bulkSelectAllDisabled = visibleEnabledForBulk.every((o) =>
      selectedValueStrings.includes(o.value),
    );

    const bulkClearAllDisabled = selectedValueStrings.length <= (minSelections ?? 0);

    const handleBulkSelectAll = React.useCallback(() => {
      const merged = computeSelectAllValues(
        selectedValueStrings,
        visibleEnabledForBulk.map((o) => ({
          value: o.value,
          disabled: !!o.disable,
        })),
        maxSelections,
      );
      const newOptions: Option[] = merged.map((v: string | number) => {
        const s = v.toString();
        const o = defaultOptions.find((d) => d.value === s);
        return o ?? { label: s, value: s };
      });
      setAnnouncement(`${newOptions.length} of ${defaultOptions.length} selected`);
      onValueChange?.(newOptions);
    }, [selectedValueStrings, visibleEnabledForBulk, maxSelections, defaultOptions, onValueChange]);

    const handleBulkClearAll = React.useCallback(() => {
      const cleared = computeClearAllValues(selectedValueStrings, minSelections);
      setAnnouncement(cleared.length === 0 ? "Selection cleared" : `${cleared.length} selected`);
      if (cleared.length === 0 && onNullableClear) {
        onNullableClear();
        return;
      }
      const newOptions: Option[] = cleared.map((v: string | number) => {
        const s = v.toString();
        const existing = value.find((item) => item.value === s);
        const o = defaultOptions.find((d) => d.value === s);
        return existing ?? o ?? { label: s, value: s };
      });
      onValueChange?.(newOptions);
    }, [
      selectedValueStrings,
      minSelections,
      onNullableClear,
      value,
      defaultOptions,
      onValueChange,
    ]);

    // Focus has left the control once it is on neither the field nor the list. Both the input and the
    // chip buttons report it, so leaving through a chip (ArrowLeft, then Tab away) still counts.
    const handleFocusLeave = (e: React.FocusEvent<HTMLElement>) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (triggerWrapperRef.current?.contains(document.activeElement)) return;
          if (dropdownRef.current?.contains(document.activeElement)) return;
          closeDropdown();
          onBlur?.(e as React.FocusEvent<HTMLInputElement>);
        });
      });
    };

    return (
      <Command
        ref={ref}
        onKeyDown={handleKeyDown}
        className={cn(
          "overflow-visible bg-transparent h-auto flex-row rounded-none border-0 shadow-none p-0",
          className,
        )}
        {...commandProps}
        label={accessibleName}
        shouldFilter={false}
      >
        {/* Not modal: a modal popover traps Tab between invisible focus guards and hides the page from assistive technology. */}
        <Popover
          open={open}
          onOpenChange={(next) => (next ? setOpen(true) : closeDropdown())}
          modal={false}
        >
          <PopoverAnchor asChild>
            <div ref={triggerWrapperRef} className="relative w-full">
              {control.name
                ? value.map((option) => (
                    <input
                      key={`field-${option.value}`}
                      type="hidden"
                      name={control.name}
                      value={option.value}
                      disabled={disabled}
                    />
                  ))
                : null}
              <span role="status" aria-live="polite" className="sr-only">
                {announcement}
              </span>
              {maxVisibleBadges === undefined && value.length > 0 && (
                <div
                  ref={measureRef}
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    visibility: "hidden",
                    pointerEvents: "none",
                    display: "flex",
                    gap: "4px",
                    top: 0,
                    left: 0,
                  }}
                >
                  {value.map((option) => (
                    <Badge
                      key={`measure-${option.value}`}
                      variant="secondary"
                      className={cn(badgeVariant({ density: effectiveDensity }), "shrink-0")}
                    >
                      {option.label}
                      <span className="ml-1 p-1 h-3" style={{ display: "inline-flex" }}>
                        <X className={xIconVariant({ density: effectiveDensity })} />
                      </span>
                    </Badge>
                  ))}
                  <Badge
                    variant="outline"
                    className={cn(
                      badgeVariant({ density: effectiveDensity }),
                      "bg-muted text-muted-foreground shrink-0",
                    )}
                  >
                    +{Math.max(1, value.length - 1)}
                  </Badge>
                </div>
              )}
              <div
                className={cn(
                  selectMultiTriggerVariant({ density: effectiveDensity }),
                  disabled && "cursor-not-allowed opacity-50",
                  (!value || value.length === 0) && "text-muted-foreground",
                  // The input inside is outline-less, so the ring goes on the box that holds it.
                  "focus-within:ring-1 focus-within:ring-ring",
                  !ghost && "border-0 bg-transparent shadow-none dark:bg-transparent",
                  ghost &&
                    "border-transparent shadow-none bg-transparent hover:bg-accent hover:text-accent-foreground dark:border-transparent dark:bg-transparent dark:hover:bg-accent dark:hover:text-accent-foreground",
                  // Last, so it beats the borderless and transparent borders above and is actually seen.
                  invalid &&
                    "border border-destructive focus-within:border-destructive focus-within:ring-destructive dark:border-red dark:focus-within:border-red dark:focus-within:ring-red",
                )}
              >
                <span
                  ref={containerRef}
                  className="flex gap-1 items-center flex-1 min-w-0 overflow-hidden"
                >
                  {value.slice(0, visibleCount).map((option, index) => (
                    <Badge
                      key={option.value}
                      variant="secondary"
                      className={cn(
                        badgeVariant({ density: effectiveDensity }),
                        "shrink-0",
                        invalid && "bg-destructive/10 border-destructive text-destructive",
                      )}
                    >
                      {option.label}
                      <button
                        type="button"
                        tabIndex={-1}
                        data-chip-remove=""
                        aria-label={`Remove ${option.label}`}
                        disabled={disabled}
                        className="ml-1 p-0.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring cursor-pointer flex items-center justify-center opacity-70 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                        onKeyDown={(e) => handleChipKeyDown(e, option, index)}
                        onBlur={handleFocusLeave}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={() => handleUnselect(option)}
                      >
                        <X className={xIconVariant({ density: effectiveDensity })} />
                      </button>
                    </Badge>
                  ))}
                  {value.length > visibleCount && (
                    <Badge
                      variant="outline"
                      className={cn(
                        badgeVariant({ density: effectiveDensity }),
                        "bg-muted text-muted-foreground shrink-0",
                      )}
                    >
                      +{value.length - visibleCount}
                      <span className="sr-only">
                        {" "}
                        more selected:{" "}
                        {value
                          .slice(visibleCount)
                          .map((option) => option.label)
                          .join(", ")}
                      </span>
                    </Badge>
                  )}
                  <CommandPrimitive.Input
                    ref={inputRef}
                    value={inputValue}
                    onValueChange={(next) => {
                      setInputValue(next);
                      setOpen(true);
                    }}
                    aria-describedby={control["aria-describedby"]}
                    aria-invalid={control["aria-invalid"]}
                    aria-required={control["aria-required"]}
                    onBlur={handleFocusLeave}
                    onClick={() => !disabled && setOpen(true)}
                    onFocus={(e) => {
                      setOpen(true);
                      requestAnimationFrame(() => {
                        if (containerRef.current) {
                          containerRef.current.scrollLeft = 0;
                        }
                      });
                      onFocus?.(e);
                    }}
                    placeholder={
                      hidePlaceholderWhenSelected && value.length > 0 ? undefined : placeholder
                    }
                    disabled={disabled}
                    className="ml-2 bg-transparent outline-hidden placeholder:text-muted-foreground flex-1 min-w-[120px] cursor-pointer"
                  />
                </span>
                <div className={selectTriggerEndActionsVariant()}>
                  {rightSlot}
                  {/* The input is the control (ArrowDown opens, Escape closes); this is a mouse convenience. */}
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "size-4 opacity-50 shrink-0 cursor-pointer pointer-events-auto",
                      disabled && "cursor-not-allowed opacity-50",
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      if (disabled) return;
                      e.stopPropagation();
                      if (open) {
                        closeDropdown();
                      } else {
                        inputRef.current?.focus();
                        setOpen(true);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </PopoverAnchor>
          <PopoverContent
            ref={dropdownRef}
            className="w-[var(--radix-popover-trigger-width)] p-0 z-50 rounded-box border bg-popover text-popover-foreground shadow-md outline-hidden overflow-hidden"
            sideOffset={4}
            // The popup is a dialog to assistive technology, and an unnamed one is announced as just "dialog".
            aria-labelledby={labelledBy}
            aria-label={
              labelledBy ? undefined : accessibleName ? `${accessibleName} options` : "Options"
            }
            onWheel={stopPropagation}
            onTouchMove={stopPropagation}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            // Escape closes the list and leaves focus, and the text, where they are.
            onEscapeKeyDown={(e) => {
              e.preventDefault();
              setOpen(false);
            }}
            // The field itself is not "outside": the input opens the list and the chevron toggles it.
            onInteractOutside={(e) => {
              if (triggerWrapperRef.current?.contains(e.target as Node)) e.preventDefault();
            }}
          >
            <CommandList
              className="h-full overflow-auto slim-scrollbar"
              style={{ maxHeight: "min(300px, var(--radix-popover-content-available-height))" }}
              aria-multiselectable="true"
            >
              {filteredOptions.length === 0 ? (
                // Not cmdk's Empty, which only shows while the list has no items at all, and the bulk
                // actions below are items.
                <div cmdk-empty="" role="presentation" className="py-6 text-center text-sm">
                  {emptyIndicator ? emptyIndicator : emptyMessage || "No options available"}
                </div>
              ) : (
                <CommandGroup>
                  {filteredOptions.map((option) => {
                    const selected = isSelected(option);
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onSelect={() => {
                          setInputValue("");
                          toggleOption(option);
                        }}
                        className={cn(
                          menuItemVariant({ density: effectiveDensity }),
                          "flex items-center justify-between",
                        )}
                        disabled={option.disable}
                        // cmdk's own aria-selected only says which option is highlighted.
                        aria-checked={selected}
                      >
                        {option.tooltip ? (
                          <TooltipProvider>
                            <Tooltip delayDuration={300}>
                              <TooltipTrigger asChild>
                                <div className="flex items-center justify-between w-full">
                                  <span>{option.label}</span>
                                  {selected && (
                                    <X
                                      className={cn(
                                        xIconVariant({ density: effectiveDensity }),
                                        "text-muted-foreground hover:text-foreground",
                                      )}
                                    />
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>{option.tooltip}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <>
                            <span>{option.label}</span>
                            {selected && (
                              <X
                                className={cn(
                                  xIconVariant({ density: effectiveDensity }),
                                  "text-muted-foreground hover:text-foreground",
                                )}
                              />
                            )}
                          </>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              {showActions &&
                defaultOptions.length > 0 && (
                  // Items of the list, not buttons beside it: the list is in a portal, so the field's
                  // Tab never reaches a button there, while ArrowDown reaches an item.
                  <CommandGroup className="sticky bottom-0 border-t border-border bg-popover [&_[cmdk-group-items]]:flex [&_[cmdk-group-items]]:items-center [&_[cmdk-group-items]]:justify-between">
                    <CommandItem
                      value="__select-all__"
                      disabled={bulkSelectAllDisabled || disabled}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onSelect={handleBulkSelectAll}
                      className={cn(menuItemVariant({ density: effectiveDensity }), "text-primary")}
                    >
                      Select All
                    </CommandItem>
                    <CommandItem
                      value="__clear-all__"
                      disabled={bulkClearAllDisabled || disabled}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onSelect={handleBulkClearAll}
                      className={cn(menuItemVariant({ density: effectiveDensity }), "text-primary")}
                    >
                      Clear All
                    </CommandItem>
                  </CommandGroup>
                )}
            </CommandList>
          </PopoverContent>
        </Popover>
      </Command>
    );
  },
);

MultipleSelector.displayName = "MultipleSelector";

export { MultipleSelector, MultipleSelector as MultiSelect };
