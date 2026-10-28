import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import * as React from "react";
import { AppShell } from "@/components/ui/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarInsetContent,
  SidebarInsetHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarFooter,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Bell,
  Calendar,
  FileText,
  Home,
  Inbox,
  Landmark,
  Receipt,
  Search,
  Settings,
  Users,
} from "lucide-react";

const items = [
  { title: "Home", url: "#", icon: Home },
  { title: "Inbox", url: "#", icon: Inbox },
  { title: "Calendar", url: "#", icon: Calendar },
  { title: "Search", url: "#", icon: Search },
  { title: "Settings", url: "#", icon: Settings },
];

const meta: Meta = {
  title: "UI/Sidebar",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Application</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <a href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  ),
};

/** The default layout: the sidebar sits on the shell background and the page lives in a rounded,
 *  bordered panel. The collapse toggle is inside the sidebar, in its top corner. */
export const IslandShell: StoryObj = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2 font-semibold group-data-[collapsible=icon]:hidden">
            Workspace
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Application</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <a href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <SidebarInsetHeader>
          <span className="font-semibold">Dashboard</span>
        </SidebarInsetHeader>
        <SidebarInsetContent>
          <div className="space-y-4 p-6">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="rounded-lg border p-4 text-sm text-muted-foreground">
                Card {i + 1}. The header stays put while this area scrolls inside the island.
              </div>
            ))}
          </div>
        </SidebarInsetContent>
      </SidebarInset>
    </SidebarProvider>
  ),
};

/**
 * The declarative form: pass navigation, a title and the page as props. The page is longer than the
 * island and has nothing in it to focus, so the scrolling area is a tab stop of its own: Tab past the
 * sidebar, then scroll it with the arrow and page keys.
 */
export const AppShellDefault: StoryObj = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <AppShell
      brandIcon={<span className="block size-3.5 rounded bg-primary" />}
      brandName="Workspace"
      nav={[
        {
          label: "Application",
          items: items.map((item, i) => ({
            id: item.title,
            label: item.title,
            icon: <item.icon />,
            href: item.url,
            active: i === 0,
          })),
        },
      ]}
      footer={({ collapsed }) => (
        <div className="px-2 text-xs text-muted-foreground">
          {collapsed ? "me" : "signed in as me"}
        </div>
      )}
      title="Home"
    >
      <div className="space-y-4 p-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="rounded-lg border p-4 text-sm text-muted-foreground">
            Card {i + 1}
          </div>
        ))}
      </div>
    </AppShell>
  ),
};

/**
 * The shell's keyboard and screen reader surface. Tab once: a "Skip to content" link appears and
 * moves focus to the page without touching the URL. The links sit in a labelled navigation landmark
 * and the current one carries `aria-current="page"`. Ctrl+B (Cmd+B) toggles the sidebar, except
 * inside a text field.
 *
 * Narrow the window below 768px and the sidebar becomes a drawer: the header toggle opens it as a
 * modal with focus on the current page, Escape, the Close button, a tap outside or choosing a link
 * closes it, and focus goes back to the toggle.
 */
export const AppShellKeyboard: StoryObj = {
  parameters: {
    layout: "fullscreen",
    // The skip link is hidden until it has focus and the drawer needs a narrow window, so the
    // resting shell is AppShellDefault's, which is already compared.
    visual: { disable: true },
    keyboard: { sweep: true, forcedColors: true },
  },
  render: () => (
    <AppShell
      brandIcon={<span className="block size-3.5 rounded bg-primary" />}
      brandName="Workspace"
      navLabel="Workspace"
      skipLink
      nav={[
        {
          label: "Application",
          items: items.map((item, i) => ({
            id: item.title,
            label: item.title,
            icon: <item.icon />,
            href: item.url,
            active: i === 0,
          })),
        },
      ]}
      title="Home"
      headerActions={
        <button
          type="button"
          className="rounded-field border px-3 py-1 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          Action
        </button>
      }
    >
      <div className="space-y-4 p-6">
        <label className="grid max-w-xs gap-1 text-sm">
          Notes (Ctrl+B is left alone in here)
          <input className="rounded-field border bg-background px-2 py-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="rounded-lg border p-4 text-sm text-muted-foreground">
            Card {i + 1}
          </div>
        ))}
      </div>
    </AppShell>
  ),
};

/**
 * Narrow the window below 768px and open the drawer with the toggle in the header. Choosing "Inbox"
 * (a link) closes it; "Account" opens a menu and the drawer stays, since a control that opens
 * something else is not a destination. A button that routes in script can pass `closeOnSelect`.
 */
export const DrawerWithAMenu: StoryObj = {
  parameters: {
    layout: "fullscreen",
    // The drawer needs a narrow window and portals out of #storybook-root.
    visual: { disable: true },
  },
  render: () => (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Application</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.slice(0, 2).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <a href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton>
                    <Settings />
                    <span>Account</span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top">
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <SidebarInsetHeader>
          <SidebarTrigger />
          <span className="font-semibold">Dashboard</span>
        </SidebarInsetHeader>
        <SidebarInsetContent>
          <p className="p-6 text-sm text-muted-foreground">Open the drawer from the header.</p>
        </SidebarInsetContent>
      </SidebarInset>
    </SidebarProvider>
  ),
};

/**
 * Started collapsed to the icon rail. The footer is told it is collapsed on a wide window and
 * shows the short form; in the mobile drawer, which always has room, it shows the full one.
 */
export const AppShellCollapsedFooter: StoryObj = {
  parameters: { layout: "fullscreen", visual: { disable: true } },
  render: () => (
    <AppShell
      brandName="Workspace"
      defaultCollapsed
      nav={[
        {
          label: "Application",
          items: items.map((item, i) => ({
            id: item.title,
            label: item.title,
            icon: <item.icon />,
            href: item.url,
            active: i === 0,
          })),
        },
      ]}
      footer={({ collapsed }) => (
        <div className="px-2 text-xs text-muted-foreground" data-testid="shell-footer">
          {collapsed ? "me" : "signed in as me"}
        </div>
      )}
      title="Home"
    >
      <p className="p-6 text-sm text-muted-foreground">Narrow the window and open the drawer.</p>
    </AppShell>
  ),
};

// ---------------------------------------------------------------------------------------------
// The collapsed icon rail
//
// None of these stories has a baseline yet, so each opts out of the screenshot pass. Their play
// functions measure the rail in the real browser instead, which is what a baseline would have been
// compared against.
// ---------------------------------------------------------------------------------------------

/**
 * The global decorator pads every story and makes it `min-h-screen`, which pulls the `fixed` panel of a
 * full-screen shell away from the in-flow gap that is meant to sit beside it. A transformed box is the
 * containing block of a fixed descendant, so the shell lays out inside this frame, which is the whole
 * window, whatever surrounds it.
 */
function ShellFrame({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 transform-gpu overflow-hidden">{children}</div>;
}

const railNav = [
  {
    label: "Application",
    items: items.map((item, i) => ({
      id: item.title,
      label: item.title,
      icon: <item.icon />,
      href: item.url,
      active: i === 0,
      badge: item.title === "Inbox" ? "3" : undefined,
    })),
  },
];

/** The accounting app's shape: several labelled sections, which is what stacks one group over the next. */
const sectionNav = [
  {
    label: "Overview",
    items: [
      { id: "home", label: "Home", icon: <Home />, href: "#", active: true },
      { id: "inbox", label: "Inbox", icon: <Inbox />, href: "#", badge: "3" },
    ],
  },
  {
    label: "Books",
    items: [
      { id: "calendar", label: "Calendar", icon: <Calendar />, href: "#" },
      { id: "bank", label: "Bank", icon: <Landmark />, href: "#" },
      { id: "invoices", label: "Invoices", icon: <FileText />, href: "#" },
      { id: "receipts", label: "Receipts", icon: <Receipt />, href: "#" },
    ],
  },
  {
    label: "Admin",
    items: [
      { id: "people", label: "People", icon: <Users />, href: "#" },
      { id: "search", label: "Search", icon: <Search />, href: "#" },
      { id: "settings", label: "Settings", icon: <Settings />, href: "#" },
    ],
  },
];

/** More items than any window is tall, so the rail has to scroll. */
const longNav = [
  { label: "Overview", icons: [Home, Inbox, Bell] },
  { label: "Books", icons: [Calendar, Landmark, FileText, Receipt, Search, Users] },
  { label: "Reports", icons: [FileText, Receipt, Landmark, Calendar, Bell, Search] },
  { label: "Admin", icons: [Users, Settings, Bell, Inbox, Home, Search, FileText, Calendar] },
].map(({ label, icons }) => ({
  label,
  items: icons.map((Icon, i) => ({
    id: `${label}-${i}`,
    label: `${label} ${i + 1}`,
    icon: <Icon />,
    href: "#",
    active: label === "Overview" && i === 0,
  })),
}));

/** A footer that is an avatar in the rail and a row when expanded: the same button either way. */
function accountFooter() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" tooltip="Mika Rinne" type="button">
          <Avatar aria-hidden className="size-8">
            <AvatarFallback className="bg-primary text-xs text-primary-foreground">
              MR
            </AvatarFallback>
          </Avatar>
          <span className="truncate">Mika Rinne</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function RailShell({
  defaultCollapsed = true,
  nav = railNav,
}: {
  defaultCollapsed?: boolean;
  nav?: React.ComponentProps<typeof AppShell>["nav"];
}) {
  return (
    <ShellFrame>
      <AppShell
        brandIcon={<span data-testid="brand-mark" className="block size-3.5 rounded bg-primary" />}
        brandName="Workspace"
        defaultCollapsed={defaultCollapsed}
        nav={nav}
        footer={accountFooter}
        title="Home"
      >
        <p className="p-6 text-sm text-muted-foreground">
          The sidebar is collapsed to the icon rail. Hover or focus an icon for its label.
        </p>
      </AppShell>
    </ShellFrame>
  );
}

/**
 * The variants that are built from the primitives rather than AppShell, collapsed on load. The header
 * is not decoration: the corner toggle is absolutely positioned over the top of the sidebar, and the
 * header is what keeps the navigation below it (the collapsed header is padded to clear it).
 */
function PrimitiveRailShell({ variant }: { variant: "sidebar" | "floating" }) {
  return (
    <ShellFrame>
      <SidebarProvider defaultOpen={false}>
        <Sidebar variant={variant}>
          <SidebarHeader>
            <div className="flex items-center gap-2.5 p-2 font-semibold group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
              <span className="block size-3.5 shrink-0 rounded bg-primary" />
              <span className="truncate group-data-[collapsible=icon]:hidden">Workspace</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Application</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item, i) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={i === 0} tooltip={item.title}>
                        <a href={item.url} aria-current={i === 0 ? "page" : undefined}>
                          <item.icon />
                          <span>{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <SidebarInsetHeader>
            <span className="font-semibold">Dashboard</span>
          </SidebarInsetHeader>
          <SidebarInsetContent>
            <p className="p-6 text-sm text-muted-foreground">The {variant} variant, collapsed.</p>
          </SidebarInsetContent>
        </SidebarInset>
      </SidebarProvider>
    </ShellFrame>
  );
}

type Rgb = [number, number, number];

/** The colour a CSS colour makes when painted over an opaque one. A canvas reads any syntax the browser does (oklab, color-mix). */
function paint(css: string, over: Rgb): Rgb {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("No canvas to read a colour with");
  context.fillStyle = `rgb(${over.join(",")})`;
  context.fillRect(0, 0, 1, 1);
  context.fillStyle = css;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** How far a button's fill is from the sidebar surface it sits on, as a contrast ratio. 1 means invisible. */
function fillContrast(button: HTMLElement, surface: HTMLElement): number {
  const ground = paint(getComputedStyle(surface).backgroundColor, [255, 255, 255]);
  return contrast(ground, paint(getComputedStyle(button).backgroundColor, ground));
}

function check(ok: boolean, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

function near(actual: number, expected: number, tolerance: number, what: string) {
  check(
    Math.abs(actual - expected) <= tolerance,
    `${what}: ${actual.toFixed(2)} is not within ${tolerance}px of ${expected.toFixed(2)}`,
  );
}

/** The width of the rail and the room a focus ring has, measured on the real layout. */
function measureRail(root: HTMLElement) {
  const aside = root.querySelector<HTMLElement>("aside[data-variant]");
  const main = root.querySelector<HTMLElement>("main");
  const surface = root.querySelector<HTMLElement>('[data-sidebar="sidebar"]');
  const content = root.querySelector<HTMLElement>('[data-sidebar="content"]');
  check(!!aside && !!main && !!surface && !!content, "The shell did not render its parts");
  const [gap, panel] = Array.from(aside.children) as HTMLElement[];
  const contentBox = content.getBoundingClientRect();
  return {
    aside,
    surface,
    gapBox: gap.getBoundingClientRect(),
    panelBox: panel.getBoundingClientRect(),
    contentBox,
    mainBox: main.getBoundingClientRect(),
    // Icons, brand and footer are all judged against the middle of what the sidebar clips to.
    axis: contentBox.left + contentBox.width / 2,
  };
}

function describeNode(node: Element | null): string {
  if (!node) return "nothing";
  const part = node.getAttribute("data-sidebar");
  return part ? `${node.tagName.toLowerCase()}[data-sidebar=${part}]` : node.tagName.toLowerCase();
}

/**
 * Every button can be pointed at along its whole height, and none lies under the corner toggle.
 * Geometry alone does not show either: a label that is invisible still takes the pointer, and the
 * toggle is drawn over the sidebar rather than in its flow. Buttons scrolled out of the rail's view
 * are left to the stories that scroll it.
 */
function assertButtonsReachable(root: HTMLElement) {
  const trigger = root.querySelector('[data-sidebar="corner-trigger"]')?.getBoundingClientRect();
  const buttons = Array.from(root.querySelectorAll<HTMLElement>('[data-sidebar="menu-button"]'));
  for (const button of buttons) {
    const box = button.getBoundingClientRect();
    const name = button.textContent?.trim() || button.getAttribute("aria-label") || "a button";
    const view = button.closest('[data-sidebar="content"]')?.getBoundingClientRect();
    if (view && (box.top < view.top - 0.5 || box.bottom > view.bottom + 0.5)) continue;
    if (trigger) {
      const apart =
        box.right <= trigger.left ||
        box.left >= trigger.right ||
        box.bottom <= trigger.top ||
        box.top >= trigger.bottom;
      check(apart, `${name} lies under the sidebar toggle`);
    }
    const x = box.left + box.width / 2;
    for (const [where, y] of [
      ["top", box.top + 2],
      ["middle", box.top + box.height / 2],
      ["bottom", box.bottom - 2],
    ] as const) {
      const hit = document.elementFromPoint(x, y);
      check(
        !!hit && button.contains(hit),
        `The ${where} of ${name} is covered by ${describeNode(hit)}, so it cannot be clicked there`,
      );
    }
  }
}

/**
 * What a compact rail has to be, whichever variant: a width in 48 to 56px; the island starting exactly
 * where the rail ends; every button a 36px target on the centre axis, with its icon, that can be
 * pointed at all over; and room around each for the focus ring (`minAir` px: 4 holds the forced-colors
 * outline as well as the 2px ring).
 */
function assertCompactRail(root: HTMLElement, minAir = 4) {
  const rail = measureRail(root);
  check(rail.aside.dataset.state === "collapsed", "The sidebar is not collapsed");
  const width = rail.panelBox.width;
  check(width >= 48 && width <= 56, `The rail is ${width.toFixed(2)}px wide, not 48 to 56px`);
  near(rail.gapBox.width, width, 0.5, "The gap beside the island and the fixed rail differ");
  near(rail.mainBox.left, rail.gapBox.right, 0.5, "The island does not start where the rail ends");

  const buttons = Array.from(root.querySelectorAll<HTMLElement>('[data-sidebar="menu-button"]'));
  check(buttons.length >= 5, "Expected the five navigation buttons");
  for (const button of buttons) {
    const box = button.getBoundingClientRect();
    const name = button.textContent?.trim() || button.getAttribute("aria-label") || "a button";
    check(box.width >= 36 && box.height >= 36, `${name} is ${box.width}x${box.height}, under 36px`);
    near(box.left + box.width / 2, rail.axis, 0.5, `${name} is off the centre axis`);
    const air = Math.min(box.left - rail.contentBox.left, rail.contentBox.right - box.right);
    check(
      air >= minAir,
      `${name} leaves ${air.toFixed(2)}px for its focus ring, under ${minAir}px`,
    );
    const icon = button.querySelector("svg");
    if (icon) {
      const iconBox = icon.getBoundingClientRect();
      near(iconBox.left + iconBox.width / 2, rail.axis, 0.5, `${name}'s icon is off the axis`);
    }
  }
  assertButtonsReachable(root);
  return rail;
}

/** The `md` breakpoint, below which the shell has no island and the page itself scrolls. */
const MD_PX = 768;

/**
 * Whether there is a rail to measure. Below `md` the sidebar is an off-canvas sheet, so a story about
 * the rail has nothing to assert at a phone's width: its play function returns, where throwing would
 * be logged as a console error.
 */
const hasRail = (): boolean => window.innerWidth >= MD_PX;

/** Everything on the rail that is not a navigation link keeps to the same axis. */
function assertRailChrome(root: HTMLElement, rail: ReturnType<typeof measureRail>) {
  const centre = (element: Element) => {
    const box = element.getBoundingClientRect();
    return box.left + box.width / 2;
  };
  const trigger = root.querySelector('[data-sidebar="corner-trigger"]');
  check(!!trigger, "No corner trigger");
  near(centre(trigger), rail.axis, 0.5, "The corner trigger is off the axis");
  const mark = root.querySelector('[data-testid="brand-mark"]');
  check(!!mark, "No brand mark");
  near(centre(mark), rail.axis, 0.5, "The brand mark is off the axis");
  const account = root.querySelector('[data-sidebar="footer"] [data-sidebar="menu-button"]');
  check(!!account, "No footer button");
  near(centre(account), rail.axis, 0.5, "The footer button is off the axis");
  const avatar = account.querySelector("span");
  check(!!avatar, "No avatar");
  near(centre(avatar), rail.axis, 0.5, "The avatar is off the axis");
  const badge = root.querySelector('[data-sidebar="menu-badge"]');
  check(!!badge, "No badge");
  const badgeBox = badge.getBoundingClientRect();
  check(
    badgeBox.left >= rail.contentBox.left && badgeBox.right <= rail.contentBox.right,
    "The badge is clipped by the rail",
  );
}

/** The current page is the only item filled at rest, and its fill can be seen against the rail. */
function assertCurrentPageFilled(root: HTMLElement, rail: ReturnType<typeof measureRail>) {
  const current = root.querySelector<HTMLElement>(
    '[data-sidebar="menu-button"][data-active="true"]',
  );
  check(!!current, "No current page");
  const filled = fillContrast(current, rail.surface);
  check(filled >= 1.2, `The current page's fill is ${filled.toFixed(2)}:1 against the rail`);
}

/** Lets an enter animation finish, so an element is measured where it comes to rest. */
async function settled(element: Element) {
  await Promise.all(element.getAnimations({ subtree: true }).map((a) => a.finished));
}

/** The visible tooltip's box: Radix also renders a visually hidden copy for assistive technology. */
async function visibleTooltip(text: string) {
  const hidden = await within(document.body).findByRole("tooltip");
  await expect(hidden).toHaveTextContent(text);
  const popper = document.querySelector<HTMLElement>("[data-radix-popper-content-wrapper]");
  check(!!popper, "The tooltip has no positioned box");
  await settled(popper);
  return popper.getBoundingClientRect();
}

/**
 * Collapsed to the icon rail on load, as the accounting app shows it: 52px wide, icons on one axis,
 * the current page filled, a count on Inbox and an avatar in the footer. The play function measures
 * all of it, and the Tab sweep checks the focus ring on every stop, also in forced-colors mode.
 */
export const CompactRail: StoryObj = {
  parameters: {
    layout: "fullscreen",
    keyboard: { sweep: true, forcedColors: true },
  },
  render: () => <RailShell />,
  play: async ({ canvasElement }) => {
    if (!hasRail()) return;
    const rail = assertCompactRail(canvasElement);
    assertRailChrome(canvasElement, rail);
    assertCurrentPageFilled(canvasElement, rail);
  },
};

/** The same rail in the dark theme, where the sidebar surface and the old accent fill were one colour. */
export const CompactRailDark: StoryObj = {
  globals: { theme: "dark" },
  parameters: {
    layout: "fullscreen",
    keyboard: { sweep: true, forcedColors: true },
  },
  render: () => <RailShell />,
  play: async ({ canvasElement }) => {
    await expect(document.documentElement.classList.contains("dark")).toBe(true);
    if (!hasRail()) return;
    const rail = assertCompactRail(canvasElement);
    assertRailChrome(canvasElement, rail);
    assertCurrentPageFilled(canvasElement, rail);
  },
};

/**
 * An item under the pointer: its label appears to the right of the rail, level with it and inside the
 * viewport. The hover fill is not asserted here, since a script's pointer events do not set `:hover`.
 */
export const CompactRailHovered: StoryObj = {
  parameters: {
    layout: "fullscreen",
  },
  render: () => <RailShell />,
  play: async ({ canvasElement }) => {
    if (!hasRail()) return;
    const rail = assertCompactRail(canvasElement);
    const link = within(canvasElement).getByRole("link", { name: "Calendar" });
    // Only the current page is filled at rest.
    const resting = fillContrast(link, rail.surface);
    check(resting < 1.05, `The resting button already has a fill (${resting.toFixed(2)}:1)`);
    await userEvent.hover(link);
    const tooltip = await visibleTooltip("Calendar");
    const box = link.getBoundingClientRect();
    check(tooltip.left >= box.right, "The tooltip is not to the right of the button");
    check(tooltip.right <= window.innerWidth, "The tooltip runs off the viewport");
    near(tooltip.top + tooltip.height / 2, box.top + box.height / 2, 1, "The tooltip is not level");
  },
};

/** An item reached by keyboard, in the dark theme: the ring is drawn inside the rail's clip, and the label shows. */
export const CompactRailFocused: StoryObj = {
  globals: { theme: "dark" },
  parameters: {
    layout: "fullscreen",
  },
  render: () => <RailShell />,
  play: async ({ canvasElement }) => {
    await expect(document.documentElement.classList.contains("dark")).toBe(true);
    if (!hasRail()) return;
    const rail = assertCompactRail(canvasElement);
    const link = within(canvasElement).getByRole("link", { name: "Inbox" });
    for (let presses = 0; presses < 12 && document.activeElement !== link; presses++) {
      await userEvent.tab();
    }
    await expect(link).toHaveFocus();
    const tooltip = await visibleTooltip("Inbox");
    const box = link.getBoundingClientRect();
    check(tooltip.left >= box.right, "The tooltip is not to the right of the button");
    const ring = getComputedStyle(link).boxShadow;
    check(/0px 0px 0px 2px/.test(ring), `No 2px focus ring on the button: ${ring}`);
    check(
      box.left - 2 >= rail.contentBox.left && box.right + 2 <= rail.contentBox.right,
      "The focus ring does not fit inside the rail",
    );
  },
};

/** The plain bordered sidebar, collapsed: the same width, with its border inside it. */
export const CompactRailPlain: StoryObj = {
  parameters: {
    layout: "fullscreen",
  },
  render: () => <PrimitiveRailShell variant="sidebar" />,
  play: async ({ canvasElement }) => {
    if (!hasRail()) return;
    assertCompactRail(canvasElement);
  },
};

/**
 * The floating sidebar, collapsed: a bordered, rounded card. It keeps a sliver of gutter for its
 * border and shadow, so the ring has its own 2px and a little more, not the full 4px.
 */
export const CompactRailFloating: StoryObj = {
  parameters: {
    layout: "fullscreen",
  },
  render: () => <PrimitiveRailShell variant="floating" />,
  play: async ({ canvasElement }) => {
    if (!hasRail()) return;
    assertCompactRail(canvasElement, 2.5);
  },
};

/**
 * Three labelled sections, as the accounting app has them. In the rail each section's label is
 * hidden, but it is still a box: it is pulled up over the end of the section above, and unless it
 * lets the pointer through it covers the bottom fifth of that section's last button, which then
 * cannot be clicked there and loses its hover fill and tooltip. The play function points at the
 * bottom edge of every button, which is where it shows.
 */
export const CompactRailSections: StoryObj = {
  parameters: {
    layout: "fullscreen",
  },
  render: () => <RailShell nav={sectionNav} />,
  play: async ({ canvasElement }) => {
    if (!hasRail()) return;
    const rail = assertCompactRail(canvasElement);
    assertRailChrome(canvasElement, rail);
    assertCurrentPageFilled(canvasElement, rail);
    const labels = Array.from(
      canvasElement.querySelectorAll<HTMLElement>('[data-sidebar="group-label"]'),
    );
    check(labels.length === 3, `Expected three section labels, found ${labels.length}`);
    for (const label of labels) {
      check(
        getComputedStyle(label).pointerEvents === "none",
        `The hidden "${label.textContent}" label still takes the pointer`,
      );
    }
  },
};

/**
 * A nav taller than the window. The rail clips to its width, so it must scroll in the one direction
 * it can, with the scrollbar hidden: a 15px bar would take a third of the 52px rail and push the
 * icons off their axis. Without it the lower items cannot be reached with a mouse or a wheel (a
 * keyboard still scrolls them into view).
 */
export const CompactRailOverflow: StoryObj = {
  parameters: {
    layout: "fullscreen",
  },
  render: () => <RailShell nav={longNav} />,
  play: async ({ canvasElement }) => {
    if (!hasRail()) return;
    assertCompactRail(canvasElement);
    const content = canvasElement.querySelector<HTMLElement>('[data-sidebar="content"]');
    check(!!content, "No sidebar content");
    check(
      content.scrollHeight > content.clientHeight + 1,
      `Expected the nav to overflow the rail, ${content.scrollHeight}px in ${content.clientHeight}px`,
    );
    const style = getComputedStyle(content);
    check(
      style.overflowY === "auto" || style.overflowY === "scroll",
      `The rail's overflow is ${style.overflowY}, so a wheel or a drag cannot reach the lower items`,
    );
    check(style.overflowX === "hidden", `The rail scrolls sideways (${style.overflowX})`);
    // A headless browser draws no scrollbar at all, so the width alone would pass whatever the style says.
    const scrollbar = style.getPropertyValue("scrollbar-width");
    check(
      scrollbar === "none",
      `The rail's scrollbar is not hidden (scrollbar-width: ${scrollbar})`,
    );
    check(
      content.offsetWidth === content.clientWidth,
      `A ${content.offsetWidth - content.clientWidth}px scrollbar takes room from the rail`,
    );

    const links = within(content).getAllByRole("link");
    const last = links[links.length - 1];
    const view = content.getBoundingClientRect();

    // Tabbing to an item scrolls it just into view, to the nearest edge (script focus would centre it).
    // Its 2px ring must still be whole there.
    last.focus({ preventScroll: true });
    last.scrollIntoView({ block: "nearest" });
    const focused = last.getBoundingClientRect();
    check(
      focused.top - 2 >= view.top - 0.5 && focused.bottom + 2 <= view.bottom + 0.5,
      `The ring of the last item is cut off by the edge of the rail (${(focused.bottom + 2 - view.bottom).toFixed(2)}px)`,
    );

    content.scrollTop = content.scrollHeight;
    const box = last.getBoundingClientRect();
    check(
      box.top >= view.top - 0.5 && box.bottom <= view.bottom + 0.5,
      "The last item is still out of view at the end of the scroll",
    );
    // Scrolled, the same rail still has every button on the axis and pointable.
    assertCompactRail(canvasElement);
  },
};

/**
 * Collapsing animates the gap and the panel together. This pauses their transitions and seeks through
 * them, so the rail, its gap and the island's left edge can be compared part of the way, where a
 * mismatch would show as a strip of background or an overlap.
 */
export const CompactRailTransition: StoryObj = {
  parameters: {
    layout: "fullscreen",
  },
  render: () => <RailShell defaultCollapsed={false} />,
  play: async ({ canvasElement }) => {
    if (!hasRail()) return;
    const before = measureRail(canvasElement);
    check(
      before.panelBox.width > 200,
      `Expected the expanded sidebar, ${before.panelBox.width}px wide`,
    );
    const trigger = canvasElement.querySelector<HTMLElement>('[data-sidebar="corner-trigger"]');
    check(!!trigger, "No corner trigger");
    await userEvent.click(trigger);
    await waitFor(() => expect(before.aside.dataset.state).toBe("collapsed"));

    const moving = document
      .getAnimations()
      .filter((a): a is CSSTransition => a instanceof CSSTransition)
      .filter((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        return target instanceof Node && canvasElement.contains(target);
      });
    // With reduced motion there is nothing to seek through: the rail is already where it ends.
    if (moving.length > 0) {
      const widths: number[] = [];
      for (const fraction of [0, 0.25, 0.5, 0.75]) {
        for (const animation of moving) {
          animation.pause();
          animation.currentTime = fraction * 200;
        }
        const rail = measureRail(canvasElement);
        near(rail.gapBox.width, rail.panelBox.width, 0.5, `The gap and the rail at ${fraction}`);
        near(rail.mainBox.left, rail.gapBox.right, 0.5, `The island's edge at ${fraction}`);
        widths.push(rail.panelBox.width);
      }
      check(
        widths.every((width, i) => i === 0 || width < widths[i - 1]),
        `The rail does not narrow steadily: ${widths.map((w) => w.toFixed(1)).join(", ")}`,
      );
      for (const animation of moving) animation.finish();
    }
    assertCompactRail(canvasElement);
  },
};

/** The browser lays out in 1/64 px, so a computed length and a measured box can differ by 0.016. */
const SUBPIXEL = 0.05;

/**
 * What a user sees as "the page scrolls twice". The inset shell must be exactly one viewport tall, so
 * a long page scrolls inside the island and the document does not scroll as well.
 *
 * The preview wraps every story in `p-6 min-h-screen` (also the fullscreen ones), which makes the
 * document taller than the window whatever the shell does. That wrapper is taken out of the
 * measurement and put back afterwards; the shell's own box is measured as well, because it is the
 * cause and the document is the symptom.
 */
async function expectShellFitsViewport(canvasElement: HTMLElement) {
  const wrapper = canvasElement.querySelector<HTMLElement>('[class~="group/sidebar-wrapper"]');
  const main = canvasElement.querySelector<HTMLElement>("main");
  const frame = canvasElement.firstElementChild as HTMLElement | null;
  const scroller = document.scrollingElement;
  if (!wrapper || !main || !frame || !scroller) throw new Error("the shell did not render");
  await expect(window.innerWidth).toBeGreaterThanOrEqual(MD_PX);

  // The island's margin and height are written in the same spacing unit, so they cancel out.
  const box = main.getBoundingClientRect();
  const style = getComputedStyle(main);
  const shell = wrapper.getBoundingClientRect();
  await expect(Math.abs(shell.height - window.innerHeight)).toBeLessThan(0.5);
  await expect(box.top - parseFloat(style.marginTop)).toBeGreaterThanOrEqual(shell.top - SUBPIXEL);
  await expect(box.bottom + parseFloat(style.marginBottom)).toBeLessThanOrEqual(
    shell.bottom + SUBPIXEL,
  );

  // The page is longer than the island and scrolls inside it.
  const content = main.querySelector<HTMLElement>('[data-sidebar="inset-content"]');
  await expect(content).not.toBeNull();
  await expect(content!.scrollHeight).toBeGreaterThan(content!.clientHeight);

  const { padding, minHeight } = frame.style;
  frame.style.padding = "0";
  frame.style.minHeight = "0";
  try {
    await expect(scroller.scrollHeight).toBeLessThanOrEqual(scroller.clientHeight);
  } finally {
    frame.style.padding = padding;
    frame.style.minHeight = minHeight;
  }
}

function LongPageShell() {
  return (
    <AppShell
      brandName="Workspace"
      nav={[
        {
          label: "Application",
          items: items.map((item, i) => ({
            id: item.title,
            label: item.title,
            icon: <item.icon />,
            href: item.url,
            active: i === 0,
          })),
        },
      ]}
      title="Home"
    >
      <div className="space-y-4 p-6">
        {Array.from({ length: 40 }, (_, i) => (
          <div key={i} className="rounded-lg border p-4 text-sm text-muted-foreground">
            Card {i + 1}
          </div>
        ))}
      </div>
    </AppShell>
  );
}

/**
 * The inset shell is one viewport tall and no taller: a long page scrolls inside the island and the
 * browser shows no second scrollbar. It used to be 1.28px too tall, because the island's height took
 * a fixed `1rem` off the viewport for a margin that is `m-2`, and this theme's spacing unit is 0.27rem
 * and not 0.25rem. The height now subtracts four of the unit the margin is written in.
 */
export const InsetFitsViewport: StoryObj = {
  parameters: { layout: "fullscreen", visual: { disable: true } },
  render: () => <LongPageShell />,
  play: async ({ canvasElement }) => {
    await expectShellFitsViewport(canvasElement);
  },
};

/** The same check in the dark theme, where the document background shows if it ever scrolls. */
export const InsetFitsViewportDark: StoryObj = {
  globals: { theme: "dark" },
  parameters: { layout: "fullscreen", visual: { disable: true } },
  render: () => <LongPageShell />,
  play: async ({ canvasElement }) => {
    await expectShellFitsViewport(canvasElement);
  },
};
