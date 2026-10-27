import * as React from "react";

/** The one cell currently being edited. Only a single session exists at a time. */
export interface DataTableEditSession {
  rowId: string;
  column: string;
}

export interface UseInlineCellEditOptions {
  /** Master gate (the table's `editable` prop). When false, no session can be opened. */
  editable?: boolean;
}

export interface UseInlineCellEditResult {
  session: DataTableEditSession | null;
  isEditing: (rowId: string, column: string) => boolean;
  beginEdit: (rowId: string, column: string) => void;
  /**
   * Close the session and return focus to the cell wrapper it was opened from. Pass
   * `{ restoreFocus: false }` when focus has already gone somewhere the user chose, so the cell does
   * not pull it back.
   */
  endEdit: (options?: { restoreFocus?: boolean }) => void;
  /**
   * Send the focus that `endEdit` releases to `element` instead of the cell that was edited. Call it
   * in the same handler as `endEdit`, e.g. to move on to the next editable cell.
   */
  redirectFocus: (element: HTMLElement | null) => void;
  /**
   * Stable ref callback for a cell's focusable wrapper, so `endEdit` can release focus back to it.
   * Identity is stable per `rowId`/`column` pair.
   */
  registerCell: (rowId: string, column: string) => (element: HTMLElement | null) => void;
}

const cellKey = (rowId: string, column: string): string => `${rowId}\u0000${column}`;

/**
 * Inline cell editing state. The hook owns *which* cell is open, not the data: committing is the
 * consumer's job, so nothing here mutates rows.
 */
export function useInlineCellEdit({
  editable = false,
}: UseInlineCellEditOptions = {}): UseInlineCellEditResult {
  const [session, setSession] = React.useState<DataTableEditSession | null>(null);
  const cellsRef = React.useRef(new Map<string, HTMLElement>());
  const callbacksRef = React.useRef(new Map<string, (element: HTMLElement | null) => void>());
  const pendingFocusRef = React.useRef<string | null>(null);
  const redirectRef = React.useRef<HTMLElement | null>(null);

  // Closing the session unmounts the editor, so focus can only be released once the cell wrapper is
  // back in the DOM — hence a layout effect rather than a call inside endEdit.
  React.useLayoutEffect(() => {
    if (session !== null) return;
    const key = pendingFocusRef.current;
    const redirect = redirectRef.current;
    pendingFocusRef.current = null;
    redirectRef.current = null;
    if (key === null) return;
    (redirect?.isConnected ? redirect : cellsRef.current.get(key))?.focus();
  }, [session]);

  React.useEffect(() => {
    if (!editable) {
      setSession(null);
    }
  }, [editable]);

  const isEditing = React.useCallback(
    (rowId: string, column: string) => session?.rowId === rowId && session?.column === column,
    [session],
  );

  const beginEdit = React.useCallback(
    (rowId: string, column: string) => {
      if (!editable) return;
      setSession({ rowId, column });
    },
    [editable],
  );

  const endEdit = React.useCallback(
    (options?: { restoreFocus?: boolean }) => {
      if (session && options?.restoreFocus !== false) {
        pendingFocusRef.current = cellKey(session.rowId, session.column);
      }
      setSession(null);
    },
    [session],
  );

  const redirectFocus = React.useCallback((element: HTMLElement | null) => {
    redirectRef.current = element;
  }, []);

  const registerCell = React.useCallback((rowId: string, column: string) => {
    const key = cellKey(rowId, column);
    let callback = callbacksRef.current.get(key);
    if (!callback) {
      callback = (element: HTMLElement | null) => {
        if (element) {
          cellsRef.current.set(key, element);
        } else {
          cellsRef.current.delete(key);
        }
      };
      callbacksRef.current.set(key, callback);
    }
    return callback;
  }, []);

  return { session, isEditing, beginEdit, endEdit, redirectFocus, registerCell };
}
