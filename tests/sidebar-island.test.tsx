import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarInsetContent,
  SidebarInsetHeader,
  SidebarProvider,
} from "../src/components/ui/sidebar";

// jsdom has no matchMedia; the sidebar's mobile hook reads it.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

function Shell(props: { showTrigger?: boolean; collapsible?: "icon" | "offcanvas" }) {
  return (
    <SidebarProvider>
      <Sidebar showTrigger={props.showTrigger} collapsible={props.collapsible}>
        <SidebarHeader>Brand</SidebarHeader>
        <SidebarContent>Nav</SidebarContent>
      </Sidebar>
      <SidebarInset>
        <SidebarInsetHeader>Title</SidebarInsetHeader>
        <SidebarInsetContent>Page</SidebarInsetContent>
      </SidebarInset>
    </SidebarProvider>
  );
}

describe("floating island sidebar", () => {
  it("is the default layout and collapses to an icon rail", () => {
    const { container } = render(<Shell />);
    const root = container.querySelector("[data-variant]");
    expect(root?.getAttribute("data-variant")).toBe("inset");
    expect(root?.getAttribute("data-state")).toBe("expanded");
  });

  it("puts the collapse toggle inside the sidebar panel", () => {
    const { container } = render(<Shell />);
    const trigger = container.querySelector('[data-sidebar="corner-trigger"]');
    expect(trigger).toBeTruthy();
    expect(trigger?.closest('[data-sidebar="sidebar"]')).toBeTruthy();
  });

  it("the corner toggle collapses and expands the sidebar", () => {
    const { container } = render(<Shell />);
    const trigger = container.querySelector('[data-sidebar="corner-trigger"]') as HTMLElement;
    fireEvent.click(trigger);
    expect(container.querySelector("[data-variant]")?.getAttribute("data-state")).toBe("collapsed");
    expect(container.querySelector('[data-sidebar="corner-trigger"]')).toBeTruthy();
    fireEvent.click(container.querySelector('[data-sidebar="corner-trigger"]') as HTMLElement);
    expect(container.querySelector("[data-variant]")?.getAttribute("data-state")).toBe("expanded");
  });

  it("can hide the corner toggle", () => {
    const { container } = render(<Shell showTrigger={false} />);
    expect(container.querySelector('[data-sidebar="corner-trigger"]')).toBeNull();
  });

  it("an offcanvas sidebar gets a floating toggle once collapsed", () => {
    const { container } = render(<Shell collapsible="offcanvas" />);
    expect(container.querySelector('[data-sidebar="floating-trigger"]')).toBeNull();
    fireEvent.click(container.querySelector('[data-sidebar="corner-trigger"]') as HTMLElement);
    expect(container.querySelector('[data-sidebar="floating-trigger"]')).toBeTruthy();
  });

  it("renders the island header and scrolling content", () => {
    render(<Shell />);
    expect(screen.getByText("Title").getAttribute("data-sidebar")).toBe("inset-header");
    expect(screen.getByText("Page").getAttribute("data-sidebar")).toBe("inset-content");
  });
});

describe("the island's height", () => {
  // jsdom does no layout, so the sum is checked where it is written: the margin and the height are
  // classes, and the height has to take off exactly what the margin adds. A fixed `1rem` against an
  // `m-2` was 1.28px short in this theme (0.27rem per unit) and made the whole document scroll; the
  // real measurement is the `InsetFitsViewport` stories.
  function islandClasses() {
    const { container } = render(<Shell />);
    const main = container.querySelector("main");
    return (main?.className ?? "").split(/\s+/);
  }

  it("takes the margin off the viewport in the unit the margin is written in", () => {
    const classes = islandClasses();
    const margin = classes
      .map((name) => /^md:peer-data-\[variant=inset\]:m-(\d+)$/.exec(name)?.[1])
      .find(Boolean);
    const taken = classes
      .map(
        (name) =>
          /^md:peer-data-\[variant=inset\]:h-\[calc\(100svh-(\d+)\*var\(--spacing\)\)\]$/.exec(
            name,
          )?.[1],
      )
      .find(Boolean);
    expect(margin, "the inset margin class").toBeDefined();
    expect(taken, "the inset height class").toBeDefined();
    // A margin above and below.
    expect(Number(taken)).toBe(2 * Number(margin));
  });

  it("does not subtract a fixed length from the viewport", () => {
    expect(islandClasses().filter((name) => /100[sdl]?vh-\d*\.?\d*(rem|px)/.test(name))).toEqual(
      [],
    );
  });
});
