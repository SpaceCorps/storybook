"use client";

import * as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

// How many toasts may be open at once. A closed one is only waiting out its exit animation, so it
// does not count: it used to, and three quick toasts that had already gone could push a live error
// out of the list long before its time was up.
const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 300000;

// Radix pauses the timer while the pointer or keyboard focus is on the viewport, so these are a
// floor for someone who is not looking at it. An error, or a toast with a button to press, has to
// outlast the time it takes to read it and reach for the mouse.
const TOAST_DURATION = 5000;
const TOAST_DURATION_LONG = 12000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

type ActionType = {
  ADD_TOAST: "ADD_TOAST";
  UPDATE_TOAST: "UPDATE_TOAST";
  DISMISS_TOAST: "DISMISS_TOAST";
  REMOVE_TOAST: "REMOVE_TOAST";
};

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: ToasterToast["id"];
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: ToasterToast["id"];
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST": {
      // Newest first. Keep the newest TOAST_LIMIT open toasts; closed ones ride along untouched.
      let open = 0;
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].filter((t) => {
          if (t.open === false) return true;
          open += 1;
          return open <= TOAST_LIMIT;
        }),
      };
    }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;

      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, "id">;

/** How long a toast stays when the caller did not say: an error, or a button to press, outlasts the rest. */
function defaultDuration({ variant, action }: Pick<Toast, "variant" | "action">): number {
  return variant === "destructive" || action ? TOAST_DURATION_LONG : TOAST_DURATION;
}

function toast({ ...props }: Toast) {
  const id = genId();
  // What the toast looks like now, so an update can tell whether the default length still fits.
  let current: Pick<Toast, "variant" | "action"> = props;
  let explicitDuration = props.duration !== undefined;
  const duration = props.duration ?? defaultDuration(props);

  const update = (patch: Partial<ToasterToast>) => {
    if ("variant" in patch) current = { ...current, variant: patch.variant };
    if ("action" in patch) current = { ...current, action: patch.action };
    // A number is the caller choosing a length; `undefined` hands the choice back to the default.
    if ("duration" in patch) explicitDuration = patch.duration !== undefined;
    dispatch({
      type: "UPDATE_TOAST",
      toast: {
        ...patch,
        id,
        // A progress toast promoted to an error must stay as long as one that began as an error.
        // Radix restarts the timer when the duration changes, so the new length counts from now.
        ...(explicitDuration ? {} : { duration: defaultDuration(current) }),
      },
    });
  };
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      duration,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);

    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
    /**
     * Take a toast (or, with no id, every toast) off the screen at once, with no exit animation.
     * `dismiss` is the one to use; this is for the moment a toast has to stop being the topmost
     * layer, which a toast animating out still is.
     */
    remove: (toastId?: string) => dispatch({ type: "REMOVE_TOAST", toastId }),
  };
}

export { useToast, toast };
