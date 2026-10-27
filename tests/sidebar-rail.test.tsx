import "@testing-library/jest-dom";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { AppShell } from "../src/components/ui/app-shell";
import { cn } from "../src/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SIDEBAR_WIDTH_ICON,
  sidebarMenuButtonVariant,
} from "../src/components/ui/sidebar";
import { SIDEBAR_HOVER_FILL } from "../src/components/ui/sidebar/variant";

// The jsdom viewport is 1024px wide, which is a desktop. These tests move it for the mobile case.
const originalInnerWidth = window.innerWidth;
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

afterEach(() => {
  Object.defineProperty(window, "innerWidth", { value: originalInnerWidth, configurable: true });
});

// A spacing utility is `--spacing` times its number, and this library scales `--spacing` to 0.27rem,
// so a `size-9` is 38.88px, not Tailwind's stock 36. The arithmetic below reads the real token.
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = readFileSync(resolve(rootDir, "src/styles/tokens.css"), "utf8");
const REM = 16;
const SPACING_PX = Number.parseFloat(/--spacing:\s*([\d.]+)rem/.exec(tokens)?.[1] ?? "NaN") * REM;
const units = (count: string | number) => Number(count) * SPACING_PX;

/** The value after `prefix` among a class list, e.g. `!size-` gives "9" for `group-data-[collapsible=icon]:!size-9`. */
function railUtility(classes: string, prefix: string): string | undefined {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)group-data-\\[collapsible=icon\\]:${escaped}([\\d.]+)(?:\\s|$)`).exec(
    classes,
  )?.[1];
}

function Rail(props: { variant: "sidebar" | "floating" | "inset"; side?: "left" | "right" }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <Sidebar variant={props.variant} side={props.side}>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Home">Home</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>page</SidebarInset>
    </SidebarProvider>
  );
}

/** The in-flow gap that holds the island's place, and the fixed panel that is drawn over it. */
function parts(container: HTMLElement) {
  const aside = container.querySelector("aside") as HTMLElement;
  const [gap, panel] = Array.from(aside.children) as HTMLElement[];
  return { aside, gap, panel, surface: panel.firstElementChild as HTMLElement };
}

const ICON_RAIL_PX = Number.parseFloat(SIDEBAR_WIDTH_ICON) * REM;

/**
 * The collapsed width a class list asks for, in px: `w-[var(--sidebar-width-icon)]` is the rail itself
 * and `w-[calc(var(--sidebar-width-icon)+Nrem)]` is the rail and a gutter of N rem.
 */
function collapsedColumn(classes: string): number {
  const rule = /(?:^|\s)group-data-\[collapsible=icon\]:w-\[([^\]]+)\](?:\s|$)/.exec(classes)?.[1];
  if (rule === "var(--sidebar-width-icon)") return ICON_RAIL_PX;
  const gutter = /^calc\(var\(--sidebar-width-icon\)\+([\d.]+)rem\)$/.exec(rule ?? "")?.[1];
  return gutter === undefined ? Number.NaN : ICON_RAIL_PX + Number.parseFloat(gutter) * REM;
}

describe("the icon rail's width", () => {
  it("keeps --sidebar-width-icon as the rail's own width, 3rem, as the provider has always published it", () => {
    // A patch release does not change what an exported constant, or a variable an app may set, means.
    expect(SIDEBAR_WIDTH_ICON).toBe("3rem");
  });

  it("is what the provider publishes as --sidebar-width-icon, and a consumer can override it", () => {
    const { container, rerender } = render(<SidebarProvider>x</SidebarProvider>);
    const root = () => container.firstElementChild as HTMLElement;
    expect(root().style.getPropertyValue("--sidebar-width-icon")).toBe(SIDEBAR_WIDTH_ICON);

    rerender(
      <SidebarProvider style={{ "--sidebar-width-icon": "4rem" } as React.CSSProperties}>
        x
      </SidebarProvider>,
    );
    expect(root().style.getPropertyValue("--sidebar-width-icon")).toBe("4rem");
  });

  it.each([
    // The island and floating columns are the rail and a 0.25rem gutter, 52px, where they were 64.
    ["inset", "left", 52],
    ["inset", "right", 52],
    ["floating", "left", 52],
    // The plain sidebar is the rail alone, as it was.
    ["sidebar", "left", 48],
  ] as const)(
    "is a compact column in the %s variant on the %s, %spx, with the gap and the panel in step",
    (variant, side, px) => {
      const { container } = render(<Rail variant={variant} side={side} />);
      const { gap, panel } = parts(container);
      // A gap and a panel of different widths would leave a strip beside the island, or overlap it.
      expect(collapsedColumn(gap.className)).toBeCloseTo(px, 5);
      expect(collapsedColumn(panel.className)).toBeCloseTo(px, 5);
    },
  );

  it("builds the column on the variable, so an app that sets --sidebar-width-icon moves the rail with it", () => {
    for (const variant of ["sidebar", "floating", "inset"] as const) {
      const { container, unmount } = render(<Rail variant={variant} />);
      const { gap, panel } = parts(container);
      expect(gap.className, variant).toContain("var(--sidebar-width-icon)");
      expect(panel.className, variant).toContain("var(--sidebar-width-icon)");
      unmount();
    }
  });

  // jsdom has no layout, so this is the arithmetic of the classes against the real tokens. The play
  // functions of the CompactRail stories measure the same things on a real layout.
  describe("leaves a button its room", () => {
    // Merged the way the component merges them, where the large size's padding replaces the base's.
    const button = (size: "default" | "sm" | "lg") => cn(sidebarMenuButtonVariant({ size }));

    it("makes a button a 36px target or larger", () => {
      for (const size of ["default", "sm", "lg"] as const) {
        const side = units(railUtility(button(size), "!size-") ?? "NaN");
        expect(side).toBeGreaterThanOrEqual(36);
      }
    });

    it("pads the icon so that only the icon fits inside, which is what hides the label and centres the icon", () => {
      const icon = units(/\[&>svg\]:size-([\d.]+)/.exec(button("default"))?.[1] ?? "NaN");
      for (const size of ["default", "sm"] as const) {
        const side = units(railUtility(button(size), "!size-") ?? "NaN");
        const padding = units(railUtility(button(size), "!p-") ?? "NaN");
        expect(side - 2 * padding).toBeCloseTo(icon, 5);
      }
      // The large button holds an avatar or logo tile of size-8 rather than a bare icon.
      const side = units(railUtility(button("lg"), "!size-") ?? "NaN");
      const padding = units(railUtility(button("lg"), "!p-") ?? "NaN");
      expect(side - 2 * padding).toBeCloseTo(units(8), 5);
    });

    it.each([
      // air = what is left either side of the button inside what the sidebar clips to. A focus ring is
      // 2px, and in forced-colors mode it is a 2px outline 2px away, so 4px keeps both whole.
      ["inset", 4],
      ["sidebar", 4],
      // The floating card keeps a sliver of gutter and its own border, so it gets the ring but not the
      // forced-colors outline's offset in full.
      ["floating", 2.5],
    ] as const)("leaves the focus ring %s air in the %s variant", (variant, minimum) => {
      const { container } = render(<Rail variant={variant} />);
      const { panel, surface } = parts(container);
      // The rail's own side padding where there is one, otherwise the panel's padding all round.
      const allRound = /(?:^|\s)p-([\d.]+)(?:\s|$)/.exec(panel.className)?.[1];
      const padX = units(railUtility(panel.className, "px-") ?? allRound ?? 0);
      // `border-r` on the panel is one side of the plain sidebar; the floating card has both sides.
      const border =
        (/group-data-\[side=left\]:border-r/.test(panel.className) ? 1 : 0) +
        (variant === "floating" &&
        /group-data-\[variant=floating\]:border(\s|$)/.test(surface.className)
          ? 2
          : 0);
      const side = units(railUtility(button("default"), "!size-") ?? "NaN");
      const air = (collapsedColumn(panel.className) - 2 * padX - border - side) / 2;
      expect(air).toBeGreaterThanOrEqual(minimum);
    });
  });
});

describe("the rail's content", () => {
  function content() {
    const { container } = render(<Rail variant="inset" />);
    return container.querySelector('[data-sidebar="content"]') as HTMLElement;
  }

  it("scrolls down, so a nav taller than the window can be reached, and clips sideways", () => {
    const classes = content().className.split(/\s+/);
    expect(classes).toContain("group-data-[collapsible=icon]:overflow-y-auto");
    expect(classes).toContain("group-data-[collapsible=icon]:overflow-x-hidden");
    // The rail used to clip both ways, which left the lower items out of a mouse's reach.
    expect(classes).not.toContain("group-data-[collapsible=icon]:overflow-hidden");
  });

  it("hides its scrollbar, which would otherwise take a third of the rail and push the icons off their axis", () => {
    const classes = content().className.split(/\s+/);
    expect(classes).toContain("group-data-[collapsible=icon]:[scrollbar-width:none]");
    expect(classes).toContain("group-data-[collapsible=icon]:[&::-webkit-scrollbar]:hidden");
  });

  it("keeps scroll padding, so a button scrolled into view by focus leaves room for its ring", () => {
    expect(content().className.split(/\s+/)).toContain("group-data-[collapsible=icon]:scroll-py-1");
  });

  it("scrolls both ways while the sidebar is expanded, as it did", () => {
    expect(content().className.split(/\s+/)).toContain("overflow-auto");
  });

  it("lets the pointer through its hidden section labels, which are pulled up over the section above", () => {
    const { container } = render(
      <SidebarProvider defaultOpen={false}>
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>One</SidebarGroupLabel>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <a href="#two">Two</a>
              </SidebarGroupLabel>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    );
    const labels = Array.from(container.querySelectorAll('[data-sidebar="group-label"]'));
    expect(labels).toHaveLength(2);
    for (const label of labels) {
      expect(label.className.split(/\s+/)).toContain(
        "group-data-[collapsible=icon]:pointer-events-none",
      );
    }
  });

  it("pads the header clear of the corner toggle in the rail, and only when there is a toggle", () => {
    const surfaceClasses = (showTrigger: boolean) => {
      const { container, unmount } = render(
        <SidebarProvider defaultOpen={false}>
          <Sidebar showTrigger={showTrigger}>
            <SidebarHeader>Brand</SidebarHeader>
          </Sidebar>
        </SidebarProvider>,
      );
      const surface = container.querySelector('[data-sidebar="sidebar"]') as HTMLElement;
      const classes = surface.className.split(/\s+/);
      unmount();
      return classes;
    };
    const clearsToggle = "group-data-[collapsible=icon]:[&_[data-sidebar=header]]:pt-12";
    expect(surfaceClasses(true)).toContain(clearsToggle);
    expect(surfaceClasses(false)).not.toContain(clearsToggle);
  });
});

/** One of every part a person can point at or tab to, so a rule about all of them is checked on all. */
function renderParts() {
  const { container } = render(
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Group</SidebarGroupLabel>
            <SidebarGroupAction>+</SidebarGroupAction>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive>Home</SidebarMenuButton>
                <SidebarMenuAction>…</SidebarMenuAction>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton href="#" isActive>
                      Sub
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>,
  );
  const get = (part: string) => container.querySelector(`[data-sidebar="${part}"]`) as HTMLElement;
  return {
    label: get("group-label"),
    button: get("menu-button"),
    sub: get("menu-sub-button"),
    menuAction: get("menu-action"),
    groupAction: get("group-action"),
  };
}

describe("fills that can be seen", () => {
  // The sidebar and the island's shell are bg-secondary and --accent is the same colour, so a fill
  // from either token is the surface itself and paints nothing. The rail has no label to carry the
  // current page, which made that visible.
  const INVISIBLE =
    /(?:^|\s)(?:[a-z-]+:)*(?:hover|active|data-\[active=true\]|data-\[state=open\]):(?:[a-z-]+:)*bg-(?:accent|secondary|sidebar-accent)(?:\s|$)/;

  const fills = renderParts;

  it("fills the hovered, pressed and current button with a tint of the foreground", () => {
    const { button } = fills();
    const classes = button.className.split(/\s+/);
    expect(classes).toContain("hover:bg-foreground/8");
    expect(classes).toContain("active:bg-foreground/12");
    expect(classes).toContain("data-[active=true]:bg-foreground/12");
    // The current page does not lose its fill when it is hovered.
    expect(classes).toContain("data-[active=true]:hover:bg-foreground/12");
  });

  it("uses no accent or secondary fill, which would be the colour of the sidebar, on any part", () => {
    const { button, sub, menuAction, groupAction } = fills();
    for (const element of [button, sub, menuAction, groupAction]) {
      expect(element.className, element.dataset.sidebar).not.toMatch(INVISIBLE);
    }
    expect(sidebarMenuButtonVariant({ variant: "outline" })).not.toMatch(INVISIBLE);
  });

  it("gives the sub-link and the row actions the same visible hover", () => {
    const { sub, menuAction, groupAction } = fills();
    for (const element of [sub, menuAction, groupAction]) {
      expect(element.className.split(/\s+/), element.dataset.sidebar).toContain(
        "hover:bg-foreground/8",
      );
    }
    expect(sub.className.split(/\s+/)).toContain("data-[active=true]:bg-foreground/12");
  });

  it("marks the current page in system colours too, since forced-colors mode drops every fill", () => {
    const { button } = fills();
    const classes = button.className.split(/\s+/);
    expect(classes).toContain("forced-colors:data-[active=true]:bg-[Highlight]");
    expect(classes).toContain("forced-colors:data-[active=true]:text-[HighlightText]");
  });

  describe("under a pen", () => {
    // `:hover` is not reliable for a pen, so the sub-link tracks it by hand and applies the hover fill as a
    // plain class. That class has to be the one `:hover` paints, or a pen shows a different fill (or, with
    // a token that is the sidebar's own colour, none).
    const penFill = SIDEBAR_HOVER_FILL.replace(/^hover:/, "");
    const filled = (element: HTMLElement) => element.className.split(/\s+/).includes(penFill);

    it("fills the sub-link with the hover fill while the pen is over it, and only then", () => {
      const { sub } = fills();
      expect(filled(sub)).toBe(false);

      fireEvent.pointerEnter(sub, { pointerType: "pen" });
      expect(filled(sub)).toBe(true);

      fireEvent.pointerLeave(sub, { pointerType: "pen" });
      expect(filled(sub)).toBe(false);
    });

    it("leaves a mouse to :hover, which paints the fill by itself", () => {
      const { sub } = fills();
      fireEvent.pointerEnter(sub, { pointerType: "mouse" });
      expect(filled(sub)).toBe(false);
    });
  });
});

describe("focus and motion", () => {
  it("draws the outline only on focus, on every part that takes focus, so forced-colors mode does not box them", () => {
    // Bare `outline-hidden` is `outline: 2px solid transparent`, which forced-colors mode turns into a
    // visible box around the part for as long as it is on the page.
    const { label, button, sub, menuAction, groupAction } = renderParts();
    const named = { label, button, sub, menuAction, groupAction };
    for (const [name, element] of Object.entries(named)) {
      const classes = element.className.split(/\s+/);
      expect(classes, name).toContain("focus-visible:outline-hidden");
      expect(classes, name).not.toContain("outline-hidden");
      expect(classes, name).toContain("focus-visible:ring-2");
    }
  });

  it("stops animating the width when the person asked for less motion", () => {
    const { container } = render(<Rail variant="inset" />);
    const { gap, panel } = parts(container);
    const button = container.querySelector('[data-sidebar="menu-button"]') as HTMLElement;
    for (const element of [gap, panel, button]) {
      expect(element.className.split(/\s+/)).toContain("motion-reduce:transition-none");
    }
  });

  it("stops animating the section label, which slides away as the sidebar collapses", () => {
    const { label } = renderParts();
    expect(label.className.split(/\s+/)).toContain("motion-reduce:transition-none");
  });

  it("animates the panel's padding along with its width, so the content does not jump sideways", () => {
    const { container } = render(<Rail variant="inset" />);
    const { panel } = parts(container);
    expect(panel.className.split(/\s+/)).toContain("transition-[left,right,width,padding]");
  });
});

describe("tooltips on the rail", () => {
  const nav = [
    {
      items: [
        { id: "home", label: "Home", href: "#/", active: true },
        { id: "time", label: "Time", href: "#/time" },
      ],
    },
  ];

  /** Tab to a link; the corner toggle and the other links come first, in an order that is not the point. */
  async function focusLink(user: ReturnType<typeof userEvent.setup>, name: string) {
    const link = screen.getByRole("link", { name });
    for (let presses = 0; presses < 10 && document.activeElement !== link; presses++) {
      await user.tab();
    }
    expect(link).toHaveFocus();
    return link;
  }

  it("names a collapsed item in a tooltip when keyboard focus reaches it", async () => {
    const user = userEvent.setup();
    render(
      <AppShell nav={nav} defaultCollapsed>
        x
      </AppShell>,
    );

    await focusLink(user, "Time");

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Time");
  });

  it("names a collapsed item in a tooltip under the pointer", async () => {
    const user = userEvent.setup();
    render(
      <AppShell nav={nav} defaultCollapsed>
        x
      </AppShell>,
    );

    await user.hover(screen.getByRole("link", { name: "Time" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Time");
  });

  it("shows no tooltip while the sidebar is expanded, where the label is already there", async () => {
    const user = userEvent.setup();
    render(<AppShell nav={nav}>x</AppShell>);

    await user.hover(screen.getByRole("link", { name: "Time" }));
    await focusLink(user, "Time");
    // Radix would have opened it by now.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("gives the tooltip to the item that is collapsed into the rail, not the mobile drawer", async () => {
    Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
    const user = userEvent.setup();
    render(
      <AppShell nav={nav} defaultCollapsed>
        x
      </AppShell>,
    );
    await user.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
    const drawer = await screen.findByRole("dialog");
    await waitFor(() => expect(drawer).toBeVisible());

    await user.hover(screen.getByRole("link", { name: "Time" }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
