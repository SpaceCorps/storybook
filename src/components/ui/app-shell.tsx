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
  /** Called when the item is chosen. The mobile drawer closes after it. */
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
  /**
   * Sidebar footer. Receives whether the sidebar is collapsed to the icon rail so it can shrink to an
   * avatar. It is never collapsed in the mobile drawer, which always has the full width. The rail's
   * navigation buttons are square (about 39px) and centred in it: a `SidebarMenuButton`, or a square
   * control of that size, lines up with the navigation above it.
   */
  footer?: React.ReactNode | ((state: { collapsed: boolean }) => React.ReactNode);
  /** Text or node shown at the start of the island's header. */
  title?: React.ReactNode;
  /** Controls shown at the end of the island's header. */
  headerActions?: React.ReactNode;
  /** A banner shown above the page, inside the island. */
  banner?: React.ReactNode;
  /**
   * The page. It scrolls inside the island while the header stays put. The island is already a
   * `<main>` landmark, so render a `<div>` or `<section>` here, not another `<main>`.
   */
  children: React.ReactNode;
  /** Replace the default `<a>`, for client-side routing. Receives the props the link would get. */
  renderLink?: (
    item: AppShellNavItem,
    props: { className?: string; children: React.ReactNode },
  ) => React.ReactElement;
  /** Start collapsed to the icon rail. */
  defaultCollapsed?: boolean;
  /** The navigation landmark's accessible name. Defaults to "Main". */
  navLabel?: string;
  /**
   * The accessible name of the sidebar itself, a landmark that holds the brand, the navigation and the
   * footer. Defaults to "Sidebar".
   */
  sidebarLabel?: string;
  /**
   * The accessible name of the page area while it is a tab stop. That happens only when the page is
   * longer than the island and has nothing in it that a keyboard can reach, so that the keys can
   * still scroll it. Defaults to "Page content".
   */
  contentLabel?: string;
  /**
   * Add a "skip to content" link as the first tab stop, hidden until focused. `true` uses the label
   * "Skip to content"; a string replaces it. It moves focus without touching the URL, so it is
   * safe in a hash-routed app.
   */
  skipLink?: boolean | string;
  className?: string;
}

function ShellNav({
  nav,
  renderLink,
  label,
}: {
  nav: AppShellNavSection[];
  renderLink: AppShellProps["renderLink"];
  label: string;
}) {
  return (
    <nav aria-label={label} className="flex flex-col gap-2">
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
                      aria-current={item.active ? "page" : undefined}
                      tooltip={item.label}
                      onClick={item.onSelect}
                      // Every nav item is a destination, including one routed by `renderLink` or
                      // handled by `onSelect` alone, whose element is not necessarily an `<a href>`.
                      closeOnSelect
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
    </nav>
  );
}

function ShellFooter({ footer }: { footer: AppShellProps["footer"] }) {
  const { state, isMobile } = useSidebar();
  if (!footer) return null;
  // The mobile drawer is always full width, whatever the desktop rail was left at: a footer told it
  // is collapsed would render its avatar-only form inside a drawer with room for the whole card.
  const collapsed = !isMobile && state === "collapsed";
  const content = typeof footer === "function" ? footer({ collapsed }) : footer;
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
      navLabel = "Main",
      sidebarLabel,
      contentLabel,
      skipLink = false,
      className,
    },
    ref,
  ) => {
    const contentId = React.useId();
    return (
      <SidebarProvider ref={ref} defaultOpen={!defaultCollapsed} className={className}>
        {skipLink ? (
          <a
            href={`#${contentId}`}
            onClick={(event) => {
              // Not a real fragment navigation: in a hash-routed app that would change the route.
              event.preventDefault();
              document.getElementById(contentId)?.focus();
            }}
            className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-[var(--radius-fields)] focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md focus:outline-hidden focus:ring-2 focus:ring-ring"
          >
            {skipLink === true ? "Skip to content" : skipLink}
          </a>
        ) : null}
        <Sidebar label={sidebarLabel}>
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
            <ShellNav nav={nav} renderLink={renderLink} label={navLabel} />
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
          {/* tabIndex -1 is only what the skip link needs to move focus here. The area makes itself a
              tab stop when a keyboard would otherwise have no way to scroll it. */}
          <SidebarInsetContent
            id={contentId}
            tabIndex={skipLink ? -1 : undefined}
            scrollLabel={contentLabel}
          >
            {children}
          </SidebarInsetContent>
        </SidebarInset>
      </SidebarProvider>
    );
  },
);
AppShell.displayName = "AppShell";

export { AppShell };
