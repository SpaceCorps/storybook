import * as React from "react";
import { GripVertical } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

/** The direction the panels of the nearest group run, so a handle can say which way it divides. */
const ResizableDirectionContext = React.createContext<"horizontal" | "vertical" | null>(null);

const ResizablePanelGroup = ({
  className,
  direction,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizableDirectionContext.Provider value={direction}>
    <ResizablePrimitive.PanelGroup
      direction={direction}
      className={cn("flex h-full w-full data-[panel-group-direction=vertical]:flex-col", className)}
      {...props}
    />
  </ResizableDirectionContext.Provider>
);

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isActive, setIsActive] = React.useState(false);
  const direction = React.useContext(ResizableDirectionContext);

  return (
    <ResizablePrimitive.PanelResizeHandle
      // A separator divides the way its panels do not run: side by side panels are parted by an upright
      // divider, which assistive technology has to be told because the default is a horizontal one.
      aria-orientation={
        direction === null ? undefined : direction === "horizontal" ? "vertical" : "horizontal"
      }
      // The line is 1px, but the ::after that catches the pointer is 24px or more across (WCAG 2.5.8).
      className={cn(
        "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-6 after:-translate-x-1/2 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-6 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      onPointerDown={() => setIsActive(true)}
      onPointerUp={() => setIsActive(false)}
      {...props}
    >
      {withHandle && (
        <div
          className={cn(
            "z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border transition-opacity",
            isHovered || isActive ? "opacity-100" : "opacity-0",
          )}
        >
          <GripVertical className="h-2.5 w-2.5" />
        </div>
      )}
    </ResizablePrimitive.PanelResizeHandle>
  );
};

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
