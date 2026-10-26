import type { Meta, StoryObj } from "@storybook/react";
import { AppShell } from "@/components/ui/app-shell";
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
import { Home, Inbox, Calendar, Search, Settings } from "lucide-react";

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
