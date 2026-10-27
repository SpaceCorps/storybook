import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { AppShell } from "../src/components/ui/app-shell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../src/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "../src/components/ui/sidebar";

/** matchMedia whose `change` listeners the test can fire after it moves `innerWidth`. */
const mediaListeners = new Set<() => void>();
const originalInnerWidth = window.innerWidth;
const originalMatchMedia = window.matchMedia;

function setViewport(width: number, notify = false) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true, writable: true });
  if (notify) act(() => mediaListeners.forEach((listener) => listener()));
}

beforeEach(() => {
  mediaListeners.clear();
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => mediaListeners.delete(listener),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  setViewport(375);
});

afterEach(() => {
  setViewport(originalInnerWidth);
  window.matchMedia = originalMatchMedia;
});

const onSelect = vi.fn();

const nav = [{ items: [{ id: "home", label: "Home", href: "#/", active: true }] }];

function Shell(props: { skipLink?: boolean | string; navLabel?: string }) {
  return (
    <AppShell
      brandName="Acme"
      title="Home"
      nav={[
        {
          label: "Workspace",
          items: [
            { id: "home", label: "Home", href: "#/", active: true },
            { id: "time", label: "Time", href: "#/time", onSelect },
          ],
        },
      ]}
      {...props}
    >
      <p>Page body</p>
    </AppShell>
  );
}

const trigger = () => screen.getByRole("button", { name: "Toggle Sidebar" });

describe("mobile sidebar drawer", () => {
  it("is closed on load and announces that on its toggle", () => {
    render(<Shell />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("opens as a named modal dialog with the current page's link focused", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    const toggle = trigger();

    await user.click(toggle);

    const drawer = await screen.findByRole("dialog", { name: "Navigation" });
    expect(drawer.getAttribute("data-mobile")).toBe("true");
    expect(within(drawer).getByRole("link", { name: "Time" })).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(within(drawer).getByRole("link", { name: "Home" })),
    );
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes on Escape and hands focus back to the toggle that opened it", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    const toggle = trigger();

    await user.click(toggle);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(toggle));
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes when a click lands outside it", async () => {
    const user = userEvent.setup();
    render(<Shell />);

    await user.click(trigger());
    await screen.findByRole("dialog");
    await user.click(document.querySelector("[data-state='open'].fixed.inset-0")!);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes on the Close button", async () => {
    const user = userEvent.setup();
    render(<Shell />);

    await user.click(trigger());
    await user.click(await screen.findByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes when a destination is chosen, and still runs the item's own handler", async () => {
    const user = userEvent.setup();
    onSelect.mockClear();
    render(<Shell />);

    await user.click(trigger());
    await user.click(await screen.findByRole("link", { name: "Time" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps Tab inside the open drawer and hides the page behind it", async () => {
    const user = userEvent.setup();
    render(<Shell />);

    await user.click(trigger());
    const drawer = await screen.findByRole("dialog");
    for (let press = 0; press < 6; press++) {
      await user.tab();
      expect(drawer.contains(document.activeElement)).toBe(true);
    }
    // Radix marks everything outside the dialog aria-hidden, so the page is out of reach.
    expect(screen.queryByRole("main")).toBeNull();
  });

  it("toggles with Ctrl+B", async () => {
    render(<Shell />);

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(await screen.findByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("does not open again when the window grows and shrinks back", async () => {
    const user = userEvent.setup();
    render(<Shell />);

    await user.click(trigger());
    await screen.findByRole("dialog");
    setViewport(1200, true);
    setViewport(375, true);

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

/** A bare sidebar, so a test can put any kind of control in the drawer. */
function Drawer(props: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>{props.children}</SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <SidebarTrigger />
      </SidebarInset>
    </SidebarProvider>
  );
}

async function openDrawer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(trigger());
  return screen.findByRole("dialog", { name: "Navigation" });
}

/** Give a close a few frames to happen: a drawer that was going to shut has by then. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 60)));

describe("what closes the mobile drawer", () => {
  it("keeps the drawer open, and the menu opens, for a dropdown trigger", async () => {
    const user = userEvent.setup();
    render(
      <Drawer>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton>Account</SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Drawer>,
    );
    const drawer = await openDrawer(user);

    await user.click(within(drawer).getByRole("button", { name: "Account" }));
    await settle();

    // Queried by attribute: an open modal menu hides the drawer from the accessibility tree.
    expect(document.querySelector('[data-sidebar="sidebar"][data-mobile="true"]')).toBeTruthy();
    expect(await screen.findByRole("menuitem", { name: "Sign out" })).toBeTruthy();
  });

  it("keeps the drawer open for a button that merely does something", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Drawer>
        <SidebarMenuButton onClick={onClick}>Expand</SidebarMenuButton>
      </Drawer>,
    );
    const drawer = await openDrawer(user);

    await user.click(within(drawer).getByRole("button", { name: "Expand" }));
    await settle();

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeTruthy();
  });

  it("closes for a button that says it navigates, with closeOnSelect", async () => {
    const user = userEvent.setup();
    render(
      <Drawer>
        <SidebarMenuButton closeOnSelect>Go</SidebarMenuButton>
      </Drawer>,
    );
    const drawer = await openDrawer(user);

    await user.click(within(drawer).getByRole("button", { name: "Go" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes for a link, the way navigation does", async () => {
    const user = userEvent.setup();
    render(
      <Drawer>
        <SidebarMenuButton asChild>
          <a href="#/time">Time</a>
        </SidebarMenuButton>
      </Drawer>,
    );
    const drawer = await openDrawer(user);

    await user.click(within(drawer).getByRole("link", { name: "Time" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("stays open for a link whose own click handler cancelled the navigation", async () => {
    const user = userEvent.setup();
    render(
      <Drawer>
        <SidebarMenuButton asChild onClick={(event) => event.preventDefault()}>
          <a href="#/time">Time</a>
        </SidebarMenuButton>
      </Drawer>,
    );
    const drawer = await openDrawer(user);

    await user.click(within(drawer).getByRole("link", { name: "Time" }));
    await settle();

    expect(screen.queryByRole("dialog")).toBeTruthy();
  });

  it("stays open for a link that opts out with closeOnSelect={false}", async () => {
    const user = userEvent.setup();
    render(
      <Drawer>
        <SidebarMenuButton asChild closeOnSelect={false}>
          <a href="#/time">Time</a>
        </SidebarMenuButton>
      </Drawer>,
    );
    const drawer = await openDrawer(user);

    await user.click(within(drawer).getByRole("link", { name: "Time" }));
    await settle();

    expect(screen.queryByRole("dialog")).toBeTruthy();
  });

  it("applies the same rule to a sub-menu link and a sub-menu button", async () => {
    const user = userEvent.setup();
    render(
      <Drawer>
        <SidebarMenuSub>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild>
              <button type="button">Fold</button>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton href="#/sub">Sub page</SidebarMenuSubButton>
          </SidebarMenuSubItem>
        </SidebarMenuSub>
      </Drawer>,
    );
    const drawer = await openDrawer(user);

    await user.click(within(drawer).getByRole("button", { name: "Fold" }));
    await settle();
    expect(screen.queryByRole("dialog")).toBeTruthy();

    await user.click(within(drawer).getByRole("link", { name: "Sub page" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes for every AppShell nav item, even one rendered as a button", async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        nav={[{ items: [{ id: "time", label: "Time", onSelect }] }]}
        renderLink={(item, props) => <button type="button" data-route={item.id} {...props} />}
      >
        x
      </AppShell>,
    );
    const drawer = await openDrawer(user);

    await user.click(within(drawer).getByRole("button", { name: "Time" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("the footer inside the mobile drawer", () => {
  const footer = ({ collapsed }: { collapsed: boolean }) => (
    <span>{collapsed ? "avatar only" : "full card"}</span>
  );

  it("is never told it is collapsed, because the drawer is always full width", async () => {
    const user = userEvent.setup();
    render(
      <AppShell nav={nav} defaultCollapsed footer={footer}>
        x
      </AppShell>,
    );
    const drawer = await openDrawer(user);

    expect(within(drawer).getByText("full card")).toBeTruthy();
    expect(within(drawer).queryByText("avatar only")).toBeNull();
  });

  it("still gets the collapsed rail state on a desktop viewport", () => {
    setViewport(1200);
    render(
      <AppShell nav={nav} defaultCollapsed footer={footer}>
        x
      </AppShell>,
    );

    expect(screen.getByText("avatar only")).toBeTruthy();
  });
});

describe("Ctrl+B guard", () => {
  it("leaves the chord to a text field, where it means bold", () => {
    render(
      <>
        <input aria-label="Notes" />
        <Shell />
      </>,
    );

    fireEvent.keyDown(screen.getByLabelText("Notes"), { key: "b", ctrlKey: true });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves the chord to a contenteditable region", () => {
    render(
      <>
        <div contentEditable suppressContentEditableWarning data-testid="rich">
          text
        </div>
        <Shell />
      </>,
    );

    fireEvent.keyDown(screen.getByTestId("rich"), { key: "b", ctrlKey: true });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ignores a chord something else already handled", () => {
    const swallow = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener("keydown", swallow);
    render(<Shell />);

    fireEvent.keyDown(document.body, { key: "b", ctrlKey: true });
    document.removeEventListener("keydown", swallow);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("survives a keydown with no key, which browser autofill dispatches", () => {
    render(<Shell />);

    expect(() => window.dispatchEvent(new Event("keydown"))).not.toThrow();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ignores Ctrl+Shift+B and Ctrl+Alt+B", () => {
    render(<Shell />);

    fireEvent.keyDown(window, { key: "B", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: "b", ctrlKey: true, altKey: true });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("accepts Cmd+B and a capital B from caps lock", async () => {
    render(<Shell />);

    fireEvent.keyDown(window, { key: "B", metaKey: true });

    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});
