import * as React from "react";

import { useFieldControl } from "@/components/ui/field/field-context";
import { cn } from "@/lib/utils";

import "./textarea.css";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  (props, ref) => {
    const { className, ...rest } = useFieldControl(props);
    return (
      <div className="ivy-textarea-wrapper relative w-full h-full">
        <textarea
          className={cn(
            "ivy-textarea flex min-h-[60px] w-full rounded-field border border-input px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive dark:aria-invalid:border-red dark:aria-invalid:focus-visible:ring-red disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10",
            className,
          )}
          ref={ref}
          {...rest}
        />
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
