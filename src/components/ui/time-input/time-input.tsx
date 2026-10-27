import * as React from "react";
import { Check, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  datePickerButtonVariant,
  datePickerInputVariant,
} from "@/components/ui/date-picker/date-picker-variant";
import { FieldReset, useFieldContext, useFieldControl } from "@/components/ui/field";
import { Input, type InputProps, type PasswordInputOnlyProps } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDensity } from "@/contexts/density-context";
import { useControllableValue } from "@/hooks/use-controllable-value";
import { useMergedRefs } from "@/lib/merge-refs";
import type { Densities } from "@/types/density";
import { timeInputWrapperVariant, timeListVariant, timeOptionVariant } from "./time-input-variant";
import {
  DEFAULT_START_TIME,
  isCompleteTimeText,
  isTimeWithin,
  isUnfinishedTimeText,
  nearestTimeIndex,
  normalizeTimeValue,
  parseTimeText,
  shiftTime,
  stepTime,
  timeOptions,
  timeToMinutes,
  type TimeBounds,
} from "./time-value";

const PLACEHOLDER = "hh:mm";

const DEFAULT_PICKER_LABEL = "Choose time";
const DEFAULT_LIST_LABEL = "Suggested times";

/** The longest text a key press may leave in the field: `09:30`. Pasted text is not held to it. */
const MAX_TYPED_LENGTH = 5;

const defaultDiscardedMessage = (kept: string) =>
  kept ? `Not a valid time, kept ${kept}` : "Not a valid time";

/** PageUp and PageDown in the field move by an hour. */
const PAGE_MINUTES = 60;

/** How far PageUp and PageDown jump in the list when its rows cannot be measured. */
const PAGE_ROWS_FALLBACK = 8;

const stopPropagation = (event: React.SyntheticEvent) => event.stopPropagation();

function useDensityOr(density: Densities | undefined): Densities {
  const contextDensity = useDensity();
  return density ?? contextDensity;
}

function buildOptions(
  suggestions: readonly string[] | undefined,
  suggestionStep: number,
  bounds: TimeBounds,
): string[] {
  if (suggestions) {
    const seen = new Set<string>();
    return suggestions.filter((time) => {
      if (seen.has(time) || !isTimeWithin(time, bounds)) return false;
      seen.add(time);
      return true;
    });
  }
  return suggestionStep > 0 ? timeOptions(suggestionStep, bounds) : [];
}

export interface TimeInputProps extends Omit<
  InputProps,
  | "value"
  | "defaultValue"
  | "onChange"
  | "type"
  | "min"
  | "max"
  | "step"
  | "density"
  | PasswordInputOnlyProps
> {
  /**
   * Controlled value as 24-hour `HH:MM`; `""` or `null` for no time. A time with seconds
   * (`09:30:00`, as a database `TIME` column is serialised) is read as its `HH:MM`. Once a value
   * has been passed the field stays controlled: a later `undefined` means no time, it does not
   * hand the field back its own stale state.
   */
  value?: string | null;
  /** Initial value when uncontrolled. */
  defaultValue?: string;
  /** Called with `HH:MM`, or `""` when the field is cleared. */
  onChange?: (value: string) => void;
  /** Earliest allowed time, `HH:MM`. Typed times before it are ignored and the arrows stop at it. */
  min?: string;
  /** Latest allowed time, `HH:MM`. */
  max?: string;
  /** Minutes the arrow keys move by, snapping to multiples of it. Defaults to 1. */
  step?: number;
  /** Minutes between the options of the suggestion list. Defaults to 30; `0` leaves out the list. */
  suggestionStep?: number;
  /** An explicit list of `HH:MM` options, used instead of `suggestionStep`. */
  suggestions?: readonly string[];
  /**
   * The clock button's name. The field's own name is added after it ("Choose time Start"), so
   * several time fields on a page stay apart. That name is the field's `aria-label`, else the label
   * of the `Field` around it when that is a string. Where it is neither (a bare `<label for>`, an
   * `aria-labelledby`, a label that is not text) nothing is added: give the whole name here.
   * Defaults to "Choose time".
   */
  pickerLabel?: string;
  /** The suggestion list's name, with the field's name added after it. Defaults to "Suggested times". */
  listLabel?: string;
  /**
   * What is announced when text that is not a time (or lies outside `min` and `max`) is discarded
   * on blur or Enter. It gets the time the field went back to, `""` for none.
   */
  discardedMessage?: (kept: string) => string;
  density?: Densities;
}

/**
 * A time field whose value is a 24-hour `HH:MM` string, shown and typed as `HH:MM` whatever the
 * browser's locale (a native `<input type="time">` shows `09:00 AM` to an English browser).
 *
 * Type a time — digits are enough, `930` becomes `09:30` — or step it with the arrow keys. A list
 * of times opens from the clock button, or with Alt+ArrowDown (or ArrowDown in an empty field).
 *
 * Text that is not a time is never guessed at. `9pm`, and a pasted `1:30 PM` (there is no AM/PM),
 * are marked `aria-invalid` while they sit in the field and are discarded, with an announcement,
 * when the field is left. A pasted `09:30` or `930` replaces the whole field and commits at once.
 */
const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>((rawProps, ref) => {
  const {
    value,
    defaultValue = "",
    onChange,
    min,
    max,
    step = 1,
    suggestionStep = 30,
    suggestions,
    pickerLabel = DEFAULT_PICKER_LABEL,
    listLabel = DEFAULT_LIST_LABEL,
    discardedMessage = defaultDiscardedMessage,
    density: propDensity,
    className,
    disabled,
    readOnly,
    name,
    onFocus,
    onBlur,
    onKeyDown,
    onMouseDown,
    onMouseUp,
    onPaste,
    ...props
  } = useFieldControl(rawProps);
  const density = useDensityOr(propDensity);
  const field = useFieldContext();

  // A parent that maps "no time" to `undefined` (`value={entry.time}`) must not turn the field
  // uncontrolled: it would fall back on its own stale state and show the cleared time again. So
  // once a value has been passed the field stays controlled, and `undefined` reads as empty.
  const [controlled, setControlled] = React.useState(value !== undefined);
  if (value !== undefined && !controlled) setControlled(true);
  const [given, setCurrent] = useControllableValue<string>(
    controlled || value !== undefined ? (value ?? "") : undefined,
    defaultValue,
    onChange,
  );
  // `09:30:00` from a database is the time 09:30; the field works in `HH:MM` throughout.
  const current = normalizeTimeValue(given);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const mergedRef = useMergedRefs(ref, inputRef);

  const bounds = React.useMemo<TimeBounds>(() => ({ min, max }), [min, max]);
  const suggestionKey = suggestions?.join("|");
  const options = React.useMemo(
    () => buildOptions(suggestions, suggestionStep, bounds),
    // `suggestionKey` stands in for `suggestions`, so an inline array does not rebuild the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestionKey, suggestionStep, bounds],
  );
  const hasList = options.length > 0;
  const inert = disabled || readOnly;

  // The clock button and the list are named after the field, so the buttons of two fields are not
  // both just "Choose time". The name is spelled out rather than pointed at: an `aria-labelledby`
  // on the button would make it a second match for the label of the field, in screen readers and in
  // `getByLabelText`, and one that pointed at the input would be read as the time in it.
  const listId = `${React.useId()}-list`;
  const fieldName = props["aria-labelledby"]
    ? undefined
    : (props["aria-label"] ?? field?.labelText);
  const nameWith = (base: string) => (fieldName ? `${base} ${fieldName}` : base);

  // What is being typed. It lives in a ref as well as in state so that Enter, which commits it
  // inside the keydown handler, reads what the last keystroke left rather than a stale render.
  const [draft, setDraftState] = React.useState<string | null>(null);
  const draftRef = React.useRef<string | null>(null);
  // The time typing has already handed to `onChange` for the draft that is in the field. A parent
  // that turns it down leaves `current` as it was, and leaving the field must not report it again.
  const reportedRef = React.useRef<string | null>(null);
  const setDraft = (next: string | null) => {
    draftRef.current = next;
    if (next === null) reportedRef.current = null;
    setDraftState(next);
  };

  // Read out when text that is not a time is discarded; cleared once the person is back at it.
  const [announcement, setAnnouncement] = React.useState("");

  // A new committed value (from the list, the arrows or the parent) replaces whatever was typed.
  React.useEffect(() => {
    setDraft(null);
    setAnnouncement("");
  }, [current]);

  /** What `text` commits as, or `null` when it is not a time inside `min` and `max`. */
  const readTime = (text: string): string | null => {
    const parsed = parseTimeText(text);
    return parsed !== null && isTimeWithin(parsed, bounds) ? parsed : null;
  };

  /** The value the field settles on if the draft is committed now. */
  const settledValue = (): string => {
    const text = draftRef.current;
    if (text === null) return current;
    return readTime(text) ?? current;
  };

  const commit = (next: string) => {
    setDraft(null);
    if (next !== current) setCurrent(next);
  };

  // Called from blur and from the Enter keydown. It has to finish before the handler returns, or
  // the form's implicit submit, which follows keydown, would still see the old value. Returns the
  // value the field is left with.
  const flushDraft = (): string => {
    const text = draftRef.current;
    if (text === null) return current;
    const settled = settledValue();
    if (text.trim() !== "" && readTime(text) === null) {
      setAnnouncement(discardedMessage(current));
    }
    if (settled === reportedRef.current) {
      // Typing reported this already and the parent did not take it, so the field goes back.
      setDraft(null);
      return current;
    }
    commit(settled);
    return settled;
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    // A key press never needs more than `09:30`, and React puts the old text back. A paste or a
    // drop is not held to that, or the end of `1:30 PM` would be cut off and the rest read as 01:30.
    const inputType = (event.nativeEvent as Partial<InputEvent>).inputType;
    if (inputType === "insertText" && text.length > MAX_TYPED_LENGTH) return;
    setAnnouncement("");
    reportedRef.current = null;
    setDraft(text);
    if (text.trim() === "") {
      if (current !== "") setCurrent("");
      return;
    }
    // Only a complete time commits while typing, so `1230` never flashes `01:23` on the way.
    if (!isCompleteTimeText(text)) return;
    const parsed = readTime(text);
    if (parsed !== null && parsed !== current) {
      reportedRef.current = parsed;
      setCurrent(parsed);
    }
  };

  // A pasted time is complete, so it replaces the whole field and commits now, wherever the caret
  // was. Anything else takes the ordinary route into the field, where it is marked invalid.
  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    onPaste?.(event);
    if (event.defaultPrevented || inert) return;
    const pasted = readTime(event.clipboardData.getData("text/plain"));
    if (pasted === null) return;
    event.preventDefault();
    setAnnouncement("");
    commit(pasted);
  };

  // Where the arrow keys start: what is typed if it reads as a time, else the committed value.
  const baseTime = (): string | null => {
    const typed = draftRef.current === null ? null : parseTimeText(draftRef.current);
    if (typed !== null) return typed;
    return timeToMinutes(current) === null ? null : current;
  };

  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  // Set when the list closes for a reason that decides where focus goes next.
  const focusAfterClose = React.useRef<"input" | "elsewhere">("input");

  const openList = () => {
    if (inert || !hasList) return;
    focusAfterClose.current = "input";
    // Opens on the value the field settles on, or the nearest row to it.
    const settled = flushDraft();
    const target = timeToMinutes(settled) ?? timeToMinutes(DEFAULT_START_TIME) ?? 0;
    setActive(nearestTimeIndex(options, target));
    setOpen(true);
  };

  const optionAt = (index: number) =>
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`) ?? null;

  const focusOption = (index: number, centre = false) => {
    const list = listRef.current;
    const option = optionAt(index);
    if (!list || !option) return;
    if (centre) {
      // The list is still being positioned when it opens; moving focus the usual way could
      // scroll the page towards where it was before that finished.
      option.focus({ preventScroll: true });
      list.scrollTop = option.offsetTop - (list.clientHeight - option.offsetHeight) / 2;
    } else {
      option.focus();
    }
  };

  const selectOption = (time: string) => {
    commit(time);
    setOpen(false);
  };

  const pageRows = (): number => {
    const row = optionAt(0);
    const list = listRef.current;
    const visible = row && list && row.offsetHeight > 0 ? list.clientHeight / row.offsetHeight : 0;
    return Math.max(1, Math.floor(visible || PAGE_ROWS_FALLBACK) - 1);
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    if (event.key === "Tab") {
      // Leave from the clock button: Tab goes on from there, Shift+Tab lands on the field. The
      // browser takes the key's default step from wherever focus is when this handler returns.
      focusAfterClose.current = "elsewhere";
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const row = (event.target as HTMLElement).closest<HTMLElement>('[role="option"]');
    const index = row ? Number(row.dataset.index) : active;
    const last = options.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = Math.min(index + 1, last);
        break;
      case "ArrowUp":
        next = Math.max(index - 1, 0);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      case "PageDown":
        next = Math.min(index + pageRows(), last);
        break;
      case "PageUp":
        next = Math.max(index - pageRows(), 0);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        selectOption(options[index]);
        return;
      default:
        return;
    }
    event.preventDefault();
    setActive(next);
    focusOption(next);
  };

  // A click on the clock button toggles the list, so it is not counted as leaving it.
  const handleInteractOutside = (event: Event) => {
    const target = event.target as Node | null;
    if (target && (buttonRef.current?.contains(target) || inputRef.current?.contains(target))) {
      return;
    }
    focusAfterClose.current = "elsewhere";
  };

  const handleCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    if (focusAfterClose.current === "input") inputRef.current?.focus();
    focusAfterClose.current = "input";
  };

  // Rewriting the value of the field puts the caret at its end, where the next digit would be a
  // sixth character and be dropped. Selecting the text again once React has written the new time
  // lets that digit replace it, as it does after tabbing in.
  const selectAfterStep = () => {
    queueMicrotask(() => {
      const input = inputRef.current;
      if (input && document.activeElement === input) input.select();
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    // No preventDefault: the Enter that commits must still submit a surrounding form.
    if (event.key === "Enter") {
      flushDraft();
      return;
    }
    if (inert) return;
    if (event.altKey && event.key === "ArrowDown" && hasList) {
      event.preventDefault();
      openList();
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        commit(stepTime(baseTime(), 1, step, bounds));
        selectAfterStep();
        break;
      case "ArrowDown":
        event.preventDefault();
        if (hasList && (draft ?? current).trim() === "") {
          openList();
        } else {
          commit(stepTime(baseTime(), -1, step, bounds));
          selectAfterStep();
        }
        break;
      case "PageUp":
        event.preventDefault();
        commit(shiftTime(baseTime(), PAGE_MINUTES, bounds));
        selectAfterStep();
        break;
      case "PageDown":
        event.preventDefault();
        commit(shiftTime(baseTime(), -PAGE_MINUTES, bounds));
        selectAfterStep();
        break;
    }
  };

  // Focusing the field selects its text so typing replaces it. A click would collapse that
  // selection again on mouseup, so the mouseup that follows a focusing mousedown is cancelled.
  const focusedByPointer = React.useRef(false);

  // Text that cannot be a time is flagged while it is in the field, not only once it is gone. An
  // hour and its separator (`9:`) is a time half typed and is left alone.
  const draftInvalid =
    draft !== null &&
    draft.trim() !== "" &&
    readTime(draft) === null &&
    !isUnfinishedTimeText(draft);

  return (
    <FieldReset>
      <Popover open={open} onOpenChange={(next) => (next ? openList() : setOpen(false))}>
        <PopoverAnchor asChild>
          <div
            className={cn(
              "relative w-full",
              hasList && timeInputWrapperVariant({ density }),
              className,
            )}
          >
            <Input
              ref={mergedRef}
              type="text"
              inputMode="numeric"
              placeholder={PLACEHOLDER}
              autoComplete="off"
              spellCheck={false}
              aria-keyshortcuts={hasList && !inert ? "Alt+ArrowDown" : undefined}
              data-gamepad-step=""
              {...props}
              aria-invalid={draftInvalid ? true : props["aria-invalid"]}
              className={cn(hasList && datePickerInputVariant({ density }), "tabular-nums")}
              density={density}
              disabled={disabled}
              readOnly={readOnly}
              value={draft ?? current}
              onChange={handleChange}
              onPaste={handlePaste}
              onFocus={(event) => {
                event.currentTarget.select();
                setAnnouncement("");
                onFocus?.(event);
              }}
              onBlur={(event) => {
                focusedByPointer.current = false;
                flushDraft();
                onBlur?.(event);
              }}
              onMouseDown={(event) => {
                focusedByPointer.current = document.activeElement !== event.currentTarget;
                onMouseDown?.(event);
              }}
              onMouseUp={(event) => {
                if (focusedByPointer.current) event.preventDefault();
                focusedByPointer.current = false;
                onMouseUp?.(event);
              }}
              onKeyDown={handleKeyDown}
            />
            {name ? (
              // Carries the value into a form; like a native control it is left out when disabled.
              <input
                type="hidden"
                name={name}
                form={props.form}
                value={current}
                disabled={disabled}
              />
            ) : null}
            {hasList ? (
              <PopoverTrigger asChild>
                <button
                  ref={buttonRef}
                  type="button"
                  aria-label={nameWith(pickerLabel)}
                  aria-haspopup="listbox"
                  aria-controls={listId}
                  disabled={inert}
                  className={datePickerButtonVariant({ density })}
                >
                  <Clock aria-hidden="true" />
                </button>
              </PopoverTrigger>
            ) : null}
            <span role="status" className="sr-only">
              {announcement}
            </span>
          </div>
        </PopoverAnchor>
        {hasList ? (
          <PopoverContent
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={nameWith(listLabel)}
            align="start"
            className={timeListVariant({ density })}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              focusOption(active, true);
            }}
            onCloseAutoFocus={handleCloseAutoFocus}
            onInteractOutside={handleInteractOutside}
            onKeyDown={handleListKeyDown}
            // A modal dialog locks scrolling outside itself, and this list is portalled out of it,
            // so the lock swallows the wheel and touch moves that should scroll the list. The lock
            // listens on the document; stopping them here keeps them from getting that far.
            onWheel={stopPropagation}
            onTouchMove={stopPropagation}
          >
            {options.map((time, index) => (
              <div
                key={time}
                role="option"
                aria-selected={time === current}
                tabIndex={index === active ? 0 : -1}
                data-index={index}
                className={timeOptionVariant({ density })}
                onFocus={() => setActive(index)}
                onClick={() => selectOption(time)}
              >
                {time}
                {time === current ? <Check aria-hidden="true" /> : null}
              </div>
            ))}
          </PopoverContent>
        ) : null}
      </Popover>
    </FieldReset>
  );
});
TimeInput.displayName = "TimeInput";

export { TimeInput };
