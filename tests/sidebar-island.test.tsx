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
