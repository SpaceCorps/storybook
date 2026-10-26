import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface PopoverLinkProps {
  content: string;
  children: React.ReactNode;
}

/**
 * A phrase in running text that opens a short explanation.
 *
 * The trigger is a `span` with `role="button"`, not a `<button>`: a button is always an inline-block
 * box, so a phrase that wraps onto a second line would be pulled out of the paragraph's flow as one
 * rectangle. A span keeps flowing with the text around it, and the key handling a native button
 * would give it (Enter and Space open it, which the original span never did) is written out below.
 * The popover is a dialog named by the phrase that opened it.
 */
export const PopoverLink: React.FC<PopoverLinkProps> = ({ content, children }) => {
  const triggerId = React.useId();
  // Space activates on release, as a native button does, and only if its press began here.
  const spaceDown = React.useRef(false);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          id={triggerId}
          className="cursor-pointer rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          style={{
            textDecoration: "underline dotted",
            textUnderlineOffset: "3px",
            textDecorationColor: "var(--primary)",
            color: "var(--primary)",
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" && !event.repeat) {
              event.preventDefault();
              event.currentTarget.click();
            } else if (event.key === " ") {
              // Stops the page scrolling; the popover opens on keyup.
              event.preventDefault();
              spaceDown.current = true;
            }
          }}
          onKeyUp={(event) => {
            if (event.key !== " " || !spaceDown.current) return;
            spaceDown.current = false;
            event.preventDefault();
            event.currentTarget.click();
          }}
          onBlur={() => {
            spaceDown.current = false;
          }}
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        aria-labelledby={triggerId}
        className="w-auto max-w-xs rounded-selector bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md"
      >
        {content}
      </PopoverContent>
    </Popover>
  );
};
