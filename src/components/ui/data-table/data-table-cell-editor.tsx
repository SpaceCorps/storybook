import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface DataTableCellEditorProps {
  /** Initial text. The editor is uncontrolled from there — it never writes back to the row. */
  value: string;
  /**
   * Enter, Tab, or focus leaving the editor. Only the last passes the second argument: the blur
   * event, whose `relatedTarget` says where focus went (`null` when it went nowhere in particular).
   */
  onCommit: (value: string, blurEvent?: React.FocusEvent<HTMLInputElement>) => void;
  /** Escape. The draft is discarded. */
  onCancel: () => void;
  /**
   * Called right after Tab or Shift+Tab has committed the draft, with the key event. Call
   * `preventDefault()` on it to take over the move (e.g. to the next editable cell); otherwise the
   * browser moves focus on as it would from any other control.
   */
  onNavigate?: (
    direction: "next" | "previous",
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => void;
  "aria-label"?: string;
  className?: string;
}

/**
 * The inline editor for one cell. Enter commits and Escape discards. Tab and Shift+Tab commit too and
 * then hand the move to `onNavigate`, which may take it over; if it does not, the browser moves focus
 * on as from any control. Focus leaving the editor in any other way commits as well, so a draft is
 * never lost half-typed. Releasing focus back to the cell wrapper is `useInlineCellEdit`'s job, once
 * the session closes.
 *
 * Escape is caught on `window` in the capture phase rather than on the input. An overlay such as a
 * Radix dialog or sheet listens for Escape on the document, in the capture phase too, and it is first
 * in line there; a handler on the input only ever runs after it has closed the overlay and taken the
 * draft with it. Here the key belongs to the editor for as long as the editor has focus.
 */
const DataTableCellEditor = React.forwardRef<HTMLInputElement, DataTableCellEditorProps>(
  ({ value, onCommit, onCancel, onNavigate, className, "aria-label": ariaLabel }, ref) => {
    const [draft, setDraft] = React.useState(value);
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    // Enter, Tab and Escape all settle the session; the guard keeps the trailing blur from
    // committing a second time.
    const settledRef = React.useRef(false);
    const onCancelRef = React.useRef(onCancel);
    onCancelRef.current = onCancel;

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    React.useLayoutEffect(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    }, []);

    React.useEffect(() => {
      const cancelOnEscape = (event: KeyboardEvent) => {
        // Escape during IME composition dismisses the candidate list, not the edit.
        if (event.key !== "Escape" || event.isComposing) return;
        if (event.target !== inputRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        settledRef.current = true;
        onCancelRef.current();
      };
      window.addEventListener("keydown", cancelOnEscape, true);
      return () => window.removeEventListener("keydown", cancelOnEscape, true);
    }, []);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        settledRef.current = true;
        onCommit(draft);
        return;
      }
      if (event.key === "Tab") {
        settledRef.current = true;
        onCommit(draft);
        onNavigate?.(event.shiftKey ? "previous" : "next", event);
      }
    };

    return (
      <Input
        ref={inputRef}
        aria-label={ariaLabel}
        className={cn("h-7 w-full min-w-0 px-1 py-0", className)}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          if (settledRef.current) return;
          settledRef.current = true;
          onCommit(draft, event);
        }}
      />
    );
  },
);
DataTableCellEditor.displayName = "DataTableCellEditor";

export { DataTableCellEditor };
