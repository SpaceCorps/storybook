import * as React from "react";
import { flushSync } from "react-dom";

import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

/** An overlay that Escape closes, open somewhere under the toasts. */
const OPEN_OVERLAY =
  '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],[role="menu"][data-state="open"],[role="listbox"][data-state="open"]';

/** The Escape events this component sent on itself, so that it never answers one of its own. */
const replays = new WeakSet<Event>();

export function Toaster() {
  const { toasts, remove } = useToast();
  const viewport = React.useRef<HTMLOListElement>(null);
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Toasts that are off the screen for the length of one Escape, while the overlay under them
   * decides what to do with it. They are still in the store, so they can come back.
   */
  const [held, setHeld] = React.useState<ReadonlySet<string> | null>(null);

  /**
   * Radix makes every toast a layer, and only the topmost layer hears Escape. A toast raised while a
   * dialog is open is above it, so the first Escape closed the toast and the dialog stayed: a second
   * press was needed, and one more for every toast on screen. Cancelling the toast's own handling
   * would not help, since the dialog under it is not the topmost layer either and still would not
   * hear the key.
   *
   * So the toasts get out of the way instead, and the key goes on to the layer under them. The
   * original event stops here and a copy of it is sent from the same target, so a listener anywhere
   * else on the page hears Escape once, not twice. Focus on a toast is the exception: there Escape
   * means "close this toast", as it always did.
   *
   * The toasts only go for good if that overlay actually closed. One that vetoed the key (an unsaved
   * changes guard) leaves them where they were.
   */
  const yieldEscape = (event: KeyboardEvent) => {
    if (replays.has(event)) return;
    if (viewport.current?.contains(document.activeElement)) return;
    const openBefore = document.querySelectorAll(OPEN_OVERLAY).length;
    if (openBefore === 0) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const ids = new Set(toasts.map((item) => item.id));
    // Synchronously: the toasts are layers until they unmount, and the copy below is only heard by
    // the overlay once they are not.
    flushSync(() => setHeld(ids));

    const replay = new KeyboardEvent("keydown", event);
    replays.add(replay);
    // From the original target, not <document>: key listeners everywhere assume an element.
    (event.target instanceof Element ? event.target : document.body).dispatchEvent(replay);

    // The overlay closes in React's next commit, so give that a turn before judging it.
    window.setTimeout(() => {
      if (document.querySelectorAll(OPEN_OVERLAY).length < openBefore) {
        ids.forEach((id) => remove(id));
      }
      if (mounted.current) setHeld(null);
    }, 0);
  };

  return (
    <ToastProvider>
      {toasts
        .filter((item) => !held?.has(item.id))
        .map(function ({ id, title, description, action, ...props }) {
          return (
            <Toast
              key={id}
              {...props}
              onEscapeKeyDown={(event) => {
                props.onEscapeKeyDown?.(event);
                if (!event.defaultPrevented) yieldEscape(event);
              }}
            >
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
              {action}
              <ToastClose />
            </Toast>
          );
        })}
      <ToastViewport ref={viewport} />
    </ToastProvider>
  );
}
