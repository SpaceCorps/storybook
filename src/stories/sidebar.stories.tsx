import type { Meta, StoryObj } from "@storybook/react";
import { AppShell } from "@/components/ui/app-shell";
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
  SidebarMenuItem,
  SidebarProvider,
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

/** The declarative form: pass navigation, a title and the page as props. */
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
