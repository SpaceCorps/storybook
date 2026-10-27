import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
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

describe("AppShell semantics", () => {
  it("marks only the current page's link with aria-current", () => {
    render(
      <AppShell nav={nav} title="Home">
        x
      </AppShell>,
    );

    expect(document.querySelector('a[href="#/"]')?.getAttribute("aria-current")).toBe("page");
    expect(document.querySelector('a[href="#/time"]')?.hasAttribute("aria-current")).toBe(false);
  });

  it("marks the current page on a custom link too", () => {
    render(
      <AppShell nav={nav} renderLink={(item, props) => <button data-route={item.id} {...props} />}>
        x
      </AppShell>,
    );

    expect(document.querySelector('[data-route="home"]')?.getAttribute("aria-current")).toBe(
      "page",
    );
    expect(document.querySelector('[data-route="time"]')?.hasAttribute("aria-current")).toBe(false);
  });

  it("wraps the links in a labelled navigation landmark", () => {
    render(
      <AppShell nav={nav} title="Home">
        x
      </AppShell>,
    );

    const landmark = screen.getByRole("navigation", { name: "Main" });
    expect(within(landmark).getByRole("link", { name: "Time" })).toBeTruthy();
  });

  it("names the landmark from navLabel", () => {
    render(
      <AppShell nav={nav} navLabel="Bookkeeping">
        x
      </AppShell>,
    );

    expect(screen.getByRole("navigation", { name: "Bookkeeping" })).toBeTruthy();
  });

  it("renders one main landmark, so the page inside must not add another", () => {
    render(
      <AppShell nav={nav}>
        <div>page</div>
      </AppShell>,
    );

    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("has no skip link unless asked", () => {
    render(<AppShell nav={nav}>x</AppShell>);

    expect(screen.queryByRole("link", { name: "Skip to content" })).toBeNull();
  });

  it("makes the skip link the first tab stop, and it moves focus to the page", async () => {
    const user = userEvent.setup();
    render(
      <AppShell nav={nav} skipLink>
        <button type="button">In page</button>
      </AppShell>,
    );

    await user.tab();
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(document.activeElement).toBe(skip);
    await user.keyboard("{Enter}");

    const target = document.querySelector('[data-sidebar="inset-content"]');
    expect(document.activeElement).toBe(target);
    expect(target?.getAttribute("tabindex")).toBe("-1");
  });

  it("does not touch the URL, which would change the route of a hash-routed app", async () => {
    const user = userEvent.setup();
    window.location.hash = "#/time";
    render(
      <AppShell nav={nav} skipLink>
        x
      </AppShell>,
    );

    await user.click(screen.getByRole("link", { name: "Skip to content" }));

    expect(window.location.hash).toBe("#/time");
  });

  it("takes its label from skipLink when that is a string", () => {
    render(
      <AppShell nav={nav} skipLink="Jump to the ledger">
        x
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Jump to the ledger" })).toBeTruthy();
  });
});

/**
 * jsdom lays nothing out, so a scroller never overflows there. These stand in for the browser: the
 * island's scroller reports a page taller than itself while `layout.overflowing` is true.
 */
const layout = { overflowing: false };

function isIslandScroller(element: Element) {
  return element.getAttribute("data-sidebar") === "inset-content";
}

class FakeResizeObserver {
  static all = new Set<FakeResizeObserver>();
  private watching = false;
  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.all.add(this);
  }
  observe() {
    this.watching = true;
  }
  unobserve() {}
  disconnect() {
    this.watching = false;
  }
  fire() {
    if (this.watching) this.callback([], this as unknown as ResizeObserver);
  }
}

function pageGrows() {
  layout.overflowing = true;
  act(() => FakeResizeObserver.all.forEach((observer) => observer.fire()));
}

beforeEach(() => {
  layout.overflowing = false;
  vi.spyOn(Element.prototype, "scrollHeight", "get").mockImplementation(function (this: Element) {
    return isIslandScroller(this) && layout.overflowing ? 2000 : 0;
  });
  vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(function (this: Element) {
    return isIslandScroller(this) ? 600 : 0;
  });
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  FakeResizeObserver.all.clear();
});

const scroller = () => document.querySelector<HTMLElement>('[data-sidebar="inset-content"]')!;

describe("AppShell page area and the keyboard", () => {
  it("is not a tab stop of its own when the page fits, whatever the skip link", () => {
    render(
      <AppShell nav={nav}>
        <p>Short page</p>
      </AppShell>,
    );

    expect(scroller().hasAttribute("tabindex")).toBe(false);
    expect(scroller().hasAttribute("role")).toBe(false);
  });

  it("becomes a labelled tab stop when the page scrolls and has nothing a keyboard could reach", async () => {
    const user = userEvent.setup();
    layout.overflowing = true;
    render(
      <AppShell nav={nav}>
        <p>A long report with no link or field in it</p>
      </AppShell>,
    );

    // With tabindex -1 on the scroller, as it was, a keyboard could not scroll this page at all.
    expect(scroller().getAttribute("tabindex")).toBe("0");
    expect(scroller().getAttribute("role")).toBe("region");
    expect(scroller().getAttribute("aria-label")).toBe("Page content");
    expect(screen.getByRole("region", { name: "Page content" })).toBe(scroller());

    const reached: Array<Element | null> = [];
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      reached.push(document.activeElement);
    }
    expect(reached).toContain(scroller());
  });

  it("takes its name from contentLabel", () => {
    layout.overflowing = true;
    render(
      <AppShell nav={nav} contentLabel="Ledger report">
        <p>Long</p>
      </AppShell>,
    );

    expect(screen.getByRole("region", { name: "Ledger report" })).toBe(scroller());
  });

  it("stays out of the tab order when the page holds a link, which is the way in", () => {
    layout.overflowing = true;
    render(
      <AppShell nav={nav}>
        <a href="#/elsewhere">A link in the page</a>
      </AppShell>,
    );

    expect(scroller().hasAttribute("tabindex")).toBe(false);
  });

  it("counts a control that is hidden or disabled as no way in", () => {
    layout.overflowing = true;
    render(
      <AppShell nav={nav}>
        <button type="button" disabled>
          Disabled
        </button>
        <button type="button" hidden>
          Hidden
        </button>
        <button type="button" tabIndex={-1}>
          Skipped by Tab
        </button>
      </AppShell>,
    );

    expect(scroller().getAttribute("tabindex")).toBe("0");
  });

  it("follows the page: a tab stop once it outgrows the island, and not before", () => {
    render(
      <AppShell nav={nav}>
        <p>Grows</p>
      </AppShell>,
    );
    expect(scroller().hasAttribute("tabindex")).toBe(false);

    pageGrows();

    expect(scroller().getAttribute("tabindex")).toBe("0");
  });

  it("gives the skip link a target without taking it out of the tab order when it is needed there", () => {
    layout.overflowing = true;
    render(
      <AppShell nav={nav} skipLink>
        <p>Long</p>
      </AppShell>,
    );

    // A scroller that has to be reachable is 0, not the -1 the skip link alone would make it.
    expect(scroller().getAttribute("tabindex")).toBe("0");
  });

  it("uses tabindex -1 for the skip link only while the page does not need to be a tab stop", () => {
    render(
      <AppShell nav={nav} skipLink>
        <p>Short</p>
      </AppShell>,
    );

    expect(scroller().getAttribute("tabindex")).toBe("-1");
  });

  it("draws focus inside the island with a ring, and only while it is focused", () => {
    layout.overflowing = true;
    render(
      <AppShell nav={nav}>
        <p>Long</p>
      </AppShell>,
    );
    const classes = scroller().className.split(/\s+/);

    // `outline-hidden` on its own paints a permanent 2px frame in forced-colors mode.
    expect(classes).not.toContain("outline-hidden");
    expect(classes).toContain("focus-visible:outline-hidden");
    expect(classes).toContain("focus-visible:ring-2");
    expect(classes).toContain("focus-visible:ring-inset");
  });
});

describe("AppShell landmarks", () => {
  it("puts the brand, the navigation and the footer inside one named sidebar landmark", () => {
    render(
      <AppShell nav={nav} brandName="Acme" footer={<span>signed in as me</span>}>
        <p>Page</p>
      </AppShell>,
    );

    const sidebar = screen.getByRole("complementary", { name: "Sidebar" });
    expect(within(sidebar).getByText("Acme")).toBeTruthy();
    expect(within(sidebar).getByRole("navigation", { name: "Main" })).toBeTruthy();
    expect(within(sidebar).getByText("signed in as me")).toBeTruthy();
  });

  it("names the sidebar from sidebarLabel", () => {
    render(
      <AppShell nav={nav} sidebarLabel="Bookkeeping menu">
        x
      </AppShell>,
    );

    expect(screen.getByRole("complementary", { name: "Bookkeeping menu" })).toBeTruthy();
  });

  it("keeps the page outside the sidebar, in the one main landmark", () => {
    render(
      <AppShell nav={nav}>
        <p>Page</p>
      </AppShell>,
    );

    const main = screen.getByRole("main");
    expect(within(main).getByText("Page")).toBeTruthy();
    expect(within(screen.getByRole("complementary")).queryByText("Page")).toBeNull();
  });
});

describe("AppShell skip link styling", () => {
  it("rounds the focused skip link with a value that compiles", () => {
    render(
      <AppShell nav={nav} skipLink>
        x
      </AppShell>,
    );
    const classes = screen.getByRole("link", { name: "Skip to content" }).className.split(/\s+/);

    // `rounded-field` is a plain class in the stylesheet, not a utility, so `focus:rounded-field`
    // generated nothing and the focused link had square corners.
    expect(classes).toContain("focus:rounded-[var(--radius-fields)]");
    expect(classes).not.toContain("focus:rounded-field");
  });

  it("has no variant-prefixed rounded-field, rounded-box or rounded-selector anywhere in src", () => {
    const offenders: string[] = [];
    const visit = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const full = join(directory, entry.name);
        if (entry.isDirectory()) visit(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.|\.stories\./.test(entry.name)) {
          const source = readFileSync(full, "utf-8");
          if (/[\w-]+:!?rounded-(field|box|selector)\b/.test(source)) offenders.push(full);
        }
      }
    };
    visit(resolve(__dirname, "..", "src"));

    expect(offenders).toEqual([]);
  });
});

describe("AppShell nav tooltips", () => {
  it("opens none while the sidebar is expanded, so a link is not described by its own name", async () => {
    const user = userEvent.setup();
    render(
      <AppShell nav={nav}>
        <p>Page</p>
      </AppShell>,
    );
    const link = screen.getByRole("link", { name: "Time" });

    await user.hover(link);
    link.focus();

    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(link.hasAttribute("aria-describedby")).toBe(false);
    expect(link.getAttribute("data-state")).not.toBe("delayed-open");
    expect(link.getAttribute("data-state")).not.toBe("instant-open");
  });

  it("shows the label as a tooltip on the collapsed rail, where the text is hidden", async () => {
    render(
      <AppShell nav={nav} defaultCollapsed>
        <p>Page</p>
      </AppShell>,
    );
    const link = screen.getByRole("link", { name: "Time" });

    act(() => link.focus());

    expect((await screen.findAllByRole("tooltip")).length).toBeGreaterThan(0);
    expect(link.hasAttribute("aria-describedby")).toBe(true);
  });

  it("keeps the focused link, not a copy of it, when Ctrl+B collapses the sidebar", async () => {
    const user = userEvent.setup();
    render(
      <AppShell nav={nav}>
        <p>Page</p>
      </AppShell>,
    );
    const link = screen.getByRole("link", { name: "Time" });
    act(() => link.focus());

    await user.keyboard("{Control>}b{/Control}");

    expect(document.querySelector("[data-variant]")?.getAttribute("data-state")).toBe("collapsed");
    // A tooltip that comes and goes around the link would remount it and drop keyboard focus.
    expect(screen.getByRole("link", { name: "Time" })).toBe(link);
    expect(document.activeElement).toBe(link);
  });
});
