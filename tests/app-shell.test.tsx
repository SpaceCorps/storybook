import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { AppShell } from "../src/components/ui/app-shell";

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

const nav = [
  {
    label: "Workspace",
    items: [
      { id: "home", label: "Home", href: "#/", active: true },
      { id: "time", label: "Time", href: "#/time", badge: "3" },
    ],
  },
];

describe("AppShell", () => {
  it("renders the navigation, title, actions and page from props", () => {
    render(
      <AppShell brandName="Acme" nav={nav} title="Home" headerActions={<button>Act</button>}>
        <p>Body text</p>
      </AppShell>,
    );
    expect(screen.getAllByText("Home").length).toBeGreaterThan(0);
    expect(screen.getByText("Time").closest("a")?.getAttribute("href")).toBe("#/time");
    expect(screen.getByText("Body text")).toBeTruthy();
    expect(screen.getByText("Act")).toBeTruthy();
    expect(screen.getByText("Workspace")).toBeTruthy();
  });

  it("marks the active item", () => {
    render(
      <AppShell nav={nav} title="Home">
        x
      </AppShell>,
    );
    const link = document.querySelector('a[href="#/"]');
    expect(link?.getAttribute("data-active")).toBe("true");
  });

  it("gives the footer a collapsed flag that follows the corner toggle", () => {
    const { container } = render(
      <AppShell nav={nav} footer={({ collapsed }) => <span>{collapsed ? "mini" : "full"}</span>}>
        x
      </AppShell>,
    );
    expect(screen.getByText("full")).toBeTruthy();
    fireEvent.click(container.querySelector('[data-sidebar="corner-trigger"]') as HTMLElement);
    expect(screen.getByText("mini")).toBeTruthy();
  });

  it("can start collapsed and use a custom link renderer", () => {
    const { container } = render(
      <AppShell
        nav={nav}
        defaultCollapsed
        renderLink={(item, props) => <button data-route={item.id} {...props} />}
      >
        x
      </AppShell>,
    );
    expect(container.querySelector("[data-variant]")?.getAttribute("data-state")).toBe("collapsed");
    expect(container.querySelector('[data-route="time"]')).toBeTruthy();
  });
});
