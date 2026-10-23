import * as React from "react";

import { cn } from "@/lib/utils";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarInsetContent,
  SidebarInsetHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./sidebar";
import { useSidebar } from "./sidebar/context";

export interface AppShellNavItem {
  /** Stable key. */
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Link target. Ignored when `renderLink` is given. */
  href?: string;
  /** Highlights the item as the current page. */
  active?: boolean;
  /** A small count or status shown at the end of the row (hidden when collapsed). */
  badge?: React.ReactNode;
  /** Called when the item is chosen. */
  onSelect?: () => void;
}

export interface AppShellNavSection {
  /** Optional heading above the items. */
  label?: string;
  items: AppShellNavItem[];
}

export interface AppShellProps {
  /** The mark shown in the sidebar header, kept when the sidebar is collapsed to the icon rail. */
  brandIcon?: React.ReactNode;
  /** The product name beside the mark, hidden when collapsed. */
  brandName?: React.ReactNode;
  /** Navigation sections, rendered in order. */
  nav: AppShellNavSection[];
  /** Sidebar footer. Receives whether the sidebar is collapsed so it can shrink to an avatar. */
  footer?: React.ReactNode | ((state: { collapsed: boolean }) => React.ReactNode);
  /** Text or node shown at the start of the island's header. */
  title?: React.ReactNode;
  /** Controls shown at the end of the island's header. */
  headerActions?: React.ReactNode;
  /** A banner shown above the page, inside the island. */
  banner?: React.ReactNode;
  /** The page. It scrolls inside the island while the header stays put. */
  children: React.ReactNode;
  /** Replace the default `<a>`, for client-side routing. Receives the props the link would get. */
  renderLink?: (
    item: AppShellNavItem,
    props: { className?: string; children: React.ReactNode },
  ) => React.ReactElement;
  /** Start collapsed to the icon rail. */
  defaultCollapsed?: boolean;
  className?: string;
}

function ShellNav({
  nav,
  renderLink,
}: {
  nav: AppShellNavSection[];
  renderLink: AppShellProps["renderLink"];
}) {
  return (
    <>
      {nav.map((section, i) => (
        <SidebarGroup key={section.label ?? i}>
          {section.label ? <SidebarGroupLabel>{section.label}</SidebarGroupLabel> : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => {
                const content = (
                  <>
                    {item.icon}
                    <span>{item.label}</span>
                  </>
                );
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={item.active}
                      tooltip={item.label}
                      onClick={item.onSelect}
                    >
                      {renderLink ? (
                        renderLink(item, { children: content })
                      ) : (
                        <a href={item.href ?? "#"}>{content}</a>
                      )}
                    </SidebarMenuButton>
                    {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

function ShellFooter({ footer }: { footer: AppShellProps["footer"] }) {
  const { state } = useSidebar();
  if (!footer) return null;
  const content =
    typeof footer === "function" ? footer({ collapsed: state === "collapsed" }) : footer;
  return <SidebarFooter>{content}</SidebarFooter>;
}

/**
 * The floating island app shell. The sidebar sits on the shell background with its collapse toggle
 * in its top corner, and collapses to an icon rail. The page (`children`) lives in a rounded,
 * bordered panel beside it with a fixed header and its own scroll.
 *
 * ```tsx
 * <AppShell
 *   brandIcon={<Logo />}
 *   brandName="Acme"
 *   nav={[{ items: [{ id: "home", label: "Home", icon: <Home />, href: "#/", active: true }] }]}
 *   title="Home"
 * >
 *   <Page />
 * </AppShell>
 * ```
 */
const AppShell = React.forwardRef<HTMLDivElement, AppShellProps>(
  (
    {
      brandIcon,
      brandName,
      nav,
      footer,
      title,
      headerActions,
      banner,
      children,
      renderLink,
      defaultCollapsed = false,
      className,
    },
    ref,
  ) => (
    <SidebarProvider ref={ref} defaultOpen={!defaultCollapsed} className={className}>
      <Sidebar>
        {brandIcon || brandName ? (
          <SidebarHeader>
            <div className="flex items-center gap-2.5 p-2 font-semibold group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
              {brandIcon ? <span className="flex shrink-0 items-center">{brandIcon}</span> : null}
              {brandName ? (
                <span className="truncate group-data-[collapsible=icon]:hidden">{brandName}</span>
              ) : null}
            </div>
          </SidebarHeader>
        ) : null}
        <SidebarContent>
          <ShellNav nav={nav} renderLink={renderLink} />
        </SidebarContent>
        <ShellFooter footer={footer} />
      </Sidebar>
      <SidebarInset>
        <SidebarInsetHeader>
          <SidebarTrigger className="md:hidden" />
          {title ? <span className="font-semibold">{title}</span> : null}
          {headerActions ? (
            <div className={cn("ml-auto flex shrink-0 items-center gap-2")}>{headerActions}</div>
          ) : null}
        </SidebarInsetHeader>
        {banner}
        <SidebarInsetContent>{children}</SidebarInsetContent>
      </SidebarInset>
    </SidebarProvider>
  ),
);
AppShell.displayName = "AppShell";

export { AppShell };
