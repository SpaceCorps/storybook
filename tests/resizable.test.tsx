import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../src/components/ui/resizable";

/**
 * The handle is a `role="separator"`. A separator is horizontal unless it says otherwise, so a
 * divider between side-by-side panels, which stands upright, has to say `vertical` for assistive
 * technology to describe it right. The panel group knows which way its panels run; the handle does not.
 */
describe("ResizableHandle", () => {
  const handles = () => screen.getAllByRole("separator");

  it("says it is upright when the panels sit side by side", () => {
    render(
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel>a</ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>b</ResizablePanel>
      </ResizablePanelGroup>,
    );
    expect(handles()[0]!.getAttribute("data-panel-group-direction")).toBe("horizontal");
    expect(handles()[0]!.getAttribute("aria-orientation")).toBe("vertical");
  });

  it("says it is horizontal when the panels are stacked", () => {
    render(
      <ResizablePanelGroup direction="vertical">
        <ResizablePanel>a</ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>b</ResizablePanel>
      </ResizablePanelGroup>,
    );
    expect(handles()[0]!.getAttribute("aria-orientation")).toBe("horizontal");
  });

  it("follows the nearest group when groups are nested", () => {
    render(
      <ResizablePanelGroup direction="vertical">
        <ResizablePanel>
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel>left</ResizablePanel>
            <ResizableHandle aria-label="inner" />
            <ResizablePanel>right</ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle aria-label="outer" />
        <ResizablePanel>bottom</ResizablePanel>
      </ResizablePanelGroup>,
    );
    expect(screen.getByRole("separator", { name: "inner" }).getAttribute("aria-orientation")).toBe(
      "vertical",
    );
    expect(screen.getByRole("separator", { name: "outer" }).getAttribute("aria-orientation")).toBe(
      "horizontal",
    );
  });

  it("lets an orientation passed to the handle win", () => {
    render(
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel>a</ResizablePanel>
        <ResizableHandle aria-orientation="horizontal" />
        <ResizablePanel>b</ResizablePanel>
      </ResizablePanelGroup>,
    );
    expect(handles()[0]!.getAttribute("aria-orientation")).toBe("horizontal");
  });

  it("catches the pointer over at least 24px, with the line itself still one pixel", () => {
    // WCAG 2.5.8 asks for a 24px target. The ::after that catches the pointer is `w-6` (25.9px at this
    // library's 0.27rem spacing; `h-6` for a stacked group); the line itself is `w-px` / `h-px`.
    render(
      <>
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel>a</ResizablePanel>
          <ResizableHandle aria-label="upright" />
          <ResizablePanel>b</ResizablePanel>
        </ResizablePanelGroup>
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel>c</ResizablePanel>
          <ResizableHandle aria-label="flat" />
          <ResizablePanel>d</ResizablePanel>
        </ResizablePanelGroup>
      </>,
    );
    const classes = (name: string) =>
      screen.getByRole("separator", { name }).className.split(/\s+/);

    expect(classes("upright")).toContain("w-px");
    expect(classes("upright")).toContain("after:w-6");
    expect(classes("upright")).not.toContain("after:w-1");
    expect(classes("flat")).toContain("data-[panel-group-direction=vertical]:h-px");
    expect(classes("flat")).toContain("data-[panel-group-direction=vertical]:after:h-6");
    expect(classes("flat")).not.toContain("data-[panel-group-direction=vertical]:after:h-1");
  });
});
