import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const meta: Meta<typeof Tabs> = {
  title: "UI/Tabs",
  component: Tabs,
};

export default meta;

/** What a dark story must prove: Storybook ignores `parameters.globals`, so a typo renders light. */
const expectDark = async () => {
  await expect(document.documentElement.classList.contains("dark")).toBe(true);
};

const NO_BASELINE = { visual: { disable: true } } as const;

export const Default: StoryObj<typeof Tabs> = {
  // The list is a grid here, so its tabs fill it edge to edge: the same gutters as an inline list.
  play: async ({ canvasElement }) => {
    await expectEvenGutters(canvasElement);
    await expectActiveVisible(canvasElement);
  },
  render: () => (
    <Tabs defaultValue="account" className="w-full max-w-[400px]">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <p className="p-4 text-sm text-muted-foreground">Manage your account settings here.</p>
      </TabsContent>
      <TabsContent value="password">
        <p className="p-4 text-sm text-muted-foreground">Change your password here.</p>
      </TabsContent>
    </Tabs>
  ),
};

/** The same list in the dark theme, where the selected tab used to be the colour of the page. */
export const DefaultDark: StoryObj<typeof Tabs> = {
  ...Default,
  globals: { theme: "dark" },
  // No baseline yet: dark has none, and the container that renders them is Linux.
  parameters: NO_BASELINE,
  play: async (context) => {
    await expectDark();
    await Default.play?.(context);
  },
};

const px = (value: string) => Number.parseFloat(value);

/**
 * The list is a segmented control with even gutters and concentric corners: the tabs sit 5px inside
 * the list on every side (1px border and 4px of padding) and a tab's radius is the list's minus
 * those 5px. The top and bottom are read off the selected tab, the sides off the first and last tab
 * at whichever end the list is scrolled to.
 */
const expectEvenGutters = async (canvasElement: HTMLElement) => {
  const list = within(canvasElement).getByRole("tablist");
  const tabs = within(list).getAllByRole("tab");
  const active = within(list).getByRole("tab", { selected: true });
  const l = list.getBoundingClientRect();
  const a = active.getBoundingClientRect();
  const style = getComputedStyle(list);
  // Read back rather than assumed, so a list that lost its outline or its padding cannot pass by
  // measuring a gutter of nothing against itself. The outline is 1px, or the whole device pixel that
  // fits when the display is scaled (0.8px at 125%).
  await expect(style.borderTopStyle).toBe("solid");
  await expect(px(style.borderTopWidth)).toBeGreaterThan(0);
  await expect(px(style.borderTopWidth)).toBeLessThanOrEqual(1);
  await expect(px(style.paddingTop)).toBe(4);
  const gutter = px(style.borderTopWidth) + px(style.paddingTop);

  await expect(Math.abs(a.top - l.top - gutter)).toBeLessThan(0.5);
  await expect(Math.abs(l.bottom - a.bottom - gutter)).toBeLessThan(0.5);
  // A side can only be read where the list is scrolled to it.
  if (list.scrollLeft <= 0.5) {
    await expect(Math.abs(tabs[0]!.getBoundingClientRect().left - l.left - gutter)).toBeLessThan(
      0.5,
    );
  }
  if (list.scrollLeft >= list.scrollWidth - list.clientWidth - 0.5) {
    await expect(
      Math.abs(l.right - tabs[tabs.length - 1]!.getBoundingClientRect().right - gutter),
    ).toBeLessThan(0.5);
  }
  const listRadius = px(getComputedStyle(list).borderTopLeftRadius);
  await expect(
    Math.abs(px(getComputedStyle(active).borderTopLeftRadius) - (listRadius - gutter)),
  ).toBeLessThan(0.5);
};

/**
 * The selected tab is not the colour of the list. In dark it used to be the colour of the page, a hole
 * in the list rather than a segment of it. (The hover cannot be asserted here: a script cannot make
 * `:hover` match.)
 */
const expectActiveVisible = async (canvasElement: HTMLElement) => {
  const list = within(canvasElement).getByRole("tablist");
  const active = within(list).getByRole("tab", { selected: true });
  await expect(getComputedStyle(active).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
};

/** A list that fits is a plain segmented control: no fade, no scrolling, the shape it always was. */
const expectFits = async (canvasElement: HTMLElement) => {
  const list = within(canvasElement).getByRole("tablist");
  await expect(list.scrollWidth - list.clientWidth).toBeLessThanOrEqual(1);
  await expect(list.hasAttribute("data-overflow-left")).toBe(false);
  await expect(list.hasAttribute("data-overflow-right")).toBe(false);
  await expect(getComputedStyle(list).maskImage).toBe("none");
};

/**
 * For a list whose width depends on the viewport: whether it needs the fade is whether it overflows,
 * and nothing else. (A story with a fixed width asserts `expectFits` or the overflow itself.)
 */
const expectFadeFollowsOverflow = async (canvasElement: HTMLElement) => {
  const list = within(canvasElement).getByRole("tablist");
  const overflows = list.scrollWidth - list.clientWidth > 1;
  const flagged =
    list.hasAttribute("data-overflow-left") || list.hasAttribute("data-overflow-right");
  await expect(flagged).toBe(overflows);
  await expect(getComputedStyle(list).maskImage === "none").toBe(!overflows);
};

const InlineTabs = () => (
  <Tabs defaultValue="entries">
    <TabsList aria-label="Ledger">
      <TabsTrigger value="entries">Entries</TabsTrigger>
      <TabsTrigger value="projects">Projects</TabsTrigger>
      <TabsTrigger value="activity" disabled>
        Activity types
      </TabsTrigger>
    </TabsList>
    <TabsContent value="entries">
      <p className="p-4 text-sm text-muted-foreground">Every entry in the period.</p>
    </TabsContent>
    <TabsContent value="projects">
      <p className="p-4 text-sm text-muted-foreground">Time per project.</p>
    </TabsContent>
  </Tabs>
);

/** The list as it sits on a page: as wide as its tabs, one of them disabled. */
export const Inline: StoryObj<typeof Tabs> = {
  // No baseline yet.
  parameters: NO_BASELINE,
  play: async ({ canvasElement }) => {
    await expectEvenGutters(canvasElement);
    await expectFits(canvasElement);
    await expectActiveVisible(canvasElement);
  },
  render: () => <InlineTabs />,
};

export const InlineDark: StoryObj<typeof Tabs> = {
  globals: { theme: "dark" },
  // No baseline yet.
  parameters: NO_BASELINE,
  play: async ({ canvasElement }) => {
    await expectDark();
    await expectEvenGutters(canvasElement);
    await expectFits(canvasElement);
    await expectActiveVisible(canvasElement);
  },
  render: () => <InlineTabs />,
};

const InCardTabs = () => (
  <Card className="w-full max-w-[440px]">
    <CardHeader>
      <CardTitle>Time</CardTitle>
      <CardDescription>The same list on the surface of a card.</CardDescription>
    </CardHeader>
    <CardContent>
      <Tabs defaultValue="projects">
        <TabsList aria-label="Time views">
          <TabsTrigger value="entries">Entries</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="activity">Activity types</TabsTrigger>
        </TabsList>
        <TabsContent value="entries">
          <p className="pt-3 text-sm text-muted-foreground">Every entry in the period.</p>
        </TabsContent>
        <TabsContent value="projects">
          <p className="pt-3 text-sm text-muted-foreground">Time per project.</p>
        </TabsContent>
        <TabsContent value="activity">
          <p className="pt-3 text-sm text-muted-foreground">Time per activity type.</p>
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
);

/** On a card, where the list's surface is the card's: only its outline and the selected tab set it apart. */
export const InCard: StoryObj<typeof Tabs> = {
  // No baseline yet.
  parameters: NO_BASELINE,
  play: async ({ canvasElement }) => {
    await expectEvenGutters(canvasElement);
    await expectFadeFollowsOverflow(canvasElement);
  },
  render: () => <InCardTabs />,
};

export const InCardDark: StoryObj<typeof Tabs> = {
  globals: { theme: "dark" },
  // No baseline yet.
  parameters: NO_BASELINE,
  play: async ({ canvasElement }) => {
    await expectDark();
    await expectEvenGutters(canvasElement);
    await expectFadeFollowsOverflow(canvasElement);
  },
  render: () => <InCardTabs />,
};

const VerticalTabs = () => (
  <Tabs
    defaultValue="profile"
    orientation="vertical"
    className="flex w-full max-w-[420px] items-start gap-4"
  >
    <TabsList aria-label="Settings" className="h-auto flex-col items-stretch justify-start">
      <TabsTrigger value="profile" className="justify-start">
        Profile
      </TabsTrigger>
      <TabsTrigger value="security" className="justify-start">
        Security
      </TabsTrigger>
      <TabsTrigger value="billing" className="justify-start">
        Billing
      </TabsTrigger>
    </TabsList>
    <TabsContent value="profile" className="mt-0 flex-1">
      <p className="text-sm text-muted-foreground">Your name and photo.</p>
    </TabsContent>
    <TabsContent value="security" className="mt-0 flex-1">
      <p className="text-sm text-muted-foreground">Password and sign-in methods.</p>
    </TabsContent>
    <TabsContent value="billing" className="mt-0 flex-1">
      <p className="text-sm text-muted-foreground">Plan and invoices.</p>
    </TabsContent>
  </Tabs>
);

/**
 * A vertical list is a stack, not a scroller: nothing clips it (so the focus ring is whole), it has
 * no fade, and each tab is as wide as the list and as tall as it was before the list became a
 * scroller.
 */
const verticalPlay: NonNullable<StoryObj<typeof Tabs>["play"]> = async ({ canvasElement }) => {
  const list = within(canvasElement).getByRole("tablist");
  const tabs = within(list).getAllByRole("tab");
  await expect(list.getAttribute("aria-orientation")).toBe("vertical");
  await expect(getComputedStyle(list).overflowX).toBe("visible");
  await expect(getComputedStyle(list).overflowY).toBe("visible");
  await expect(list.hasAttribute("data-overflow-left")).toBe(false);
  await expect(list.hasAttribute("data-overflow-right")).toBe(false);
  await expect(getComputedStyle(list).maskImage).toBe("none");

  const l = list.getBoundingClientRect();
  const gutter =
    px(getComputedStyle(list).borderLeftWidth) + px(getComputedStyle(list).paddingLeft);
  for (const tab of tabs) {
    const t = tab.getBoundingClientRect();
    await expect(Math.abs(t.left - l.left - gutter)).toBeLessThan(0.5);
    await expect(Math.abs(l.right - t.right - gutter)).toBeLessThan(0.5);
    // Not the 20px of a bare line of text: a tab in a stack keeps its own padding.
    await expect(t.height).toBeGreaterThan(30);
  }

  // Up and Down walk a vertical list, and select as they go.
  await userEvent.tab();
  await expect(document.activeElement).toBe(tabs[0]);
  await userEvent.keyboard("{ArrowDown}");
  await expect(document.activeElement).toBe(tabs[1]);
  await expect(tabs[1]!.getAttribute("aria-selected")).toBe("true");
};

/** Orientation vertical: the tabs stack, and the list does not scroll or fade. */
export const Vertical: StoryObj<typeof Tabs> = {
  // No baseline yet.
  parameters: NO_BASELINE,
  play: verticalPlay,
  render: () => <VerticalTabs />,
};

export const VerticalDark: StoryObj<typeof Tabs> = {
  globals: { theme: "dark" },
  // No baseline yet.
  parameters: NO_BASELINE,
  play: async (context) => {
    await expectDark();
    await verticalPlay(context);
  },
  render: () => <VerticalTabs />,
};

const LABELS = [
  "Overview",
  "Entries",
  "Projects",
  "Activity types",
  "Invoices",
  "Customers",
  "Suppliers",
  "Bank accounts",
  "VAT",
  "Reports",
  "Fiscal years",
  "Settings",
];

const slug = (label: string) => label.toLowerCase().replace(/\s+/g, "-");

/** Twelve tabs (or the first few of them), each with a panel. */
const TwelveTabs = ({
  defaultValue = "overview",
  labels = LABELS,
  ...props
}: Omit<React.ComponentProps<typeof Tabs>, "children"> & { labels?: readonly string[] }) => (
  <Tabs defaultValue={defaultValue} {...props}>
    <TabsList aria-label="Accounting">
      {labels.map((label) => (
        <TabsTrigger key={label} value={slug(label)}>
          {label}
        </TabsTrigger>
      ))}
    </TabsList>
    {LABELS.map((label) => (
      <TabsContent key={label} value={slug(label)}>
        <p className="p-4 text-sm text-muted-foreground">{label}</p>
      </TabsContent>
    ))}
  </Tabs>
);

/**
 * Twelve tabs in a box as wide as a phone. The box is a width rather than the viewport so the story
 * looks the same in CI (`max-w`, so a real phone viewport narrows it instead of widening the page),
 * and it has `data-testid="box"` so the play functions can ask whether the list pushed it wider.
 * The box is a flex container, so the tab set is a flex item: the case `min-w-0` on it exists for.
 */
const OverflowingTabs = (props: React.ComponentProps<typeof TwelveTabs>) => (
  <div data-testid="box" className="flex w-full max-w-[360px]">
    <TwelveTabs {...props} />
  </div>
);

/**
 * The tab is whole, and clear of the fade, inside the list. Rectangles are in screen pixels and the
 * border and the scroll padding in layout pixels, so under a scaled ancestor those are scaled to match.
 */
const expectInView = async (list: HTMLElement, tab: HTMLElement) => {
  const l = list.getBoundingClientRect();
  const t = tab.getBoundingClientRect();
  const scale = list.offsetWidth > 0 ? l.width / list.offsetWidth : 1;
  const inset = (px(getComputedStyle(list).scrollPaddingLeft) || 0) * scale;
  const border = px(getComputedStyle(list).borderLeftWidth) * scale;
  await expect(t.left).toBeGreaterThanOrEqual(l.left + border - 0.5);
  await expect(t.right).toBeLessThanOrEqual(l.right - border + 0.5);
  // Not under a fade that is showing on that side.
  if (list.hasAttribute("data-overflow-left")) {
    await expect(t.left).toBeGreaterThanOrEqual(l.left + border + inset - 1);
  }
  if (list.hasAttribute("data-overflow-right")) {
    await expect(t.right).toBeLessThanOrEqual(l.right - border - inset + 1);
  }
};

/** The focus ring reaches 2px (offset) plus 2px (ring) out of the tab, and the list clips at its padding box. */
const expectRingNotClipped = async (list: HTMLElement, tab: HTMLElement) => {
  const reach = 4;
  const l = list.getBoundingClientRect();
  const t = tab.getBoundingClientRect();
  const border = px(getComputedStyle(list).borderLeftWidth);
  await expect(t.left - reach).toBeGreaterThanOrEqual(l.left + border - 0.5);
  await expect(t.right + reach).toBeLessThanOrEqual(l.right - border + 0.5);
  await expect(t.top - reach).toBeGreaterThanOrEqual(l.top + border - 0.5);
  await expect(t.bottom + reach).toBeLessThanOrEqual(l.bottom - border + 0.5);
};

/**
 * What makes the list a scroller worth using, read back from the browser: no scrollbar, a snap to the
 * start of a tab, and a margin the tab is brought to that is as wide as the fade. Each is a class, so
 * dropping it changes nothing a layout assertion would notice.
 */
const expectScrollerSetup = async (list: HTMLElement) => {
  const style = getComputedStyle(list);
  // Headless Chromium draws no scrollbars at all, so the height of the list below says nothing there.
  await expect(style.scrollbarWidth).toBe("none");
  await expect(style.scrollSnapType).toBe("x mandatory");
  await expect(getComputedStyle(within(list).getAllByRole("tab")[0]!).scrollSnapAlign).toBe(
    "start",
  );
  // The width of the fade, whatever unit it is written in: laid out by an element that asks for it.
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;width:var(--tabs-fade)";
  list.appendChild(probe);
  const fade = probe.offsetWidth;
  probe.remove();
  await expect(fade).toBeGreaterThan(0);
  await expect(px(style.scrollPaddingLeft)).toBe(fade);
  await expect(px(style.scrollPaddingRight)).toBe(fade);
};

const expectContained = async (canvasElement: HTMLElement) => {
  const box = within(canvasElement).getByTestId("box");
  const list = within(box).getByRole("tablist");
  // It really overflows, and still did not widen the box or the page.
  await expect(list.scrollWidth).toBeGreaterThan(list.clientWidth + 100);
  await expect(list.getBoundingClientRect().width).toBeLessThanOrEqual(
    box.getBoundingClientRect().width + 0.5,
  );
  await expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
  await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
    document.documentElement.clientWidth,
  );
  // The scrollbar would double the height of the list. (Only where there is one to see: a headless
  // browser has none whatever the styles say, which is why `expectScrollerSetup` reads them.)
  await expect(list.offsetHeight).toBe(list.clientHeight + 2);
};

const expectFadeOnTheFarSideOnly = async (list: HTMLElement) => {
  await expect(list.hasAttribute("data-overflow-left")).toBe(false);
  await expect(list.hasAttribute("data-overflow-right")).toBe(true);
  await expect(getComputedStyle(list).maskImage).not.toBe("none");
};

const overflowingPlay: NonNullable<StoryObj<typeof Tabs>["play"]> = async ({ canvasElement }) => {
  await expectContained(canvasElement);
  const list = within(canvasElement).getByRole("tablist");
  await expectScrollerSetup(list);
  await expectEvenGutters(canvasElement);
  await waitFor(() => expectFadeOnTheFarSideOnly(list));

  // The fade follows the scroll: at the far end it is the near side that has more.
  list.scrollTo({ left: list.scrollWidth, behavior: "instant" });
  await waitFor(async () => {
    await expect(list.hasAttribute("data-overflow-left")).toBe(true);
    await expect(list.hasAttribute("data-overflow-right")).toBe(false);
  });
  list.scrollTo({ left: 0, behavior: "instant" });
  await waitFor(() => expectFadeOnTheFarSideOnly(list));
};

/**
 * More tabs than fit: the list scrolls inside itself, never widens its box, and fades on the side
 * that has more. Touch or trackpad scroll it, or Tab to a tab and use the arrow keys.
 */
export const Overflowing: StoryObj<typeof Tabs> = {
  // No baseline yet.
  parameters: NO_BASELINE,
  play: overflowingPlay,
  render: () => <OverflowingTabs />,
};

export const OverflowingDark: StoryObj<typeof Tabs> = {
  globals: { theme: "dark" },
  // No baseline yet.
  parameters: NO_BASELINE,
  play: async (context) => {
    await expectDark();
    await overflowingPlay(context);
  },
  render: () => <OverflowingTabs />,
};

const OverflowingInCardTabs = () => (
  <Card data-testid="card" className="w-full max-w-[360px]">
    <CardHeader>
      <CardTitle>Accounting</CardTitle>
      <CardDescription>Twelve tabs on a card as wide as a phone.</CardDescription>
    </CardHeader>
    <CardContent>
      <OverflowingTabs />
    </CardContent>
  </Card>
);

const overflowingInCardPlay: NonNullable<StoryObj<typeof Tabs>["play"]> = async ({
  canvasElement,
}) => {
  const canvas = within(canvasElement);
  const card = canvas.getByTestId("card");
  const list = canvas.getByRole("tablist");
  await expect(list.scrollWidth).toBeGreaterThan(list.clientWidth + 100);
  // The card keeps its width, and the list stays inside the card's content box.
  await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
  const inner = within(card).getByTestId("box").getBoundingClientRect();
  await expect(list.getBoundingClientRect().right).toBeLessThanOrEqual(inner.right + 0.5);
  await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
    document.documentElement.clientWidth,
  );
  await waitFor(() => expectFadeOnTheFarSideOnly(list));
};

/** On a card, whose padding is part of what the list must fit inside. */
export const OverflowingInCard: StoryObj<typeof Tabs> = {
  // No baseline yet.
  parameters: NO_BASELINE,
  play: overflowingInCardPlay,
  render: () => <OverflowingInCardTabs />,
};

export const OverflowingInCardDark: StoryObj<typeof Tabs> = {
  globals: { theme: "dark" },
  // No baseline yet.
  parameters: NO_BASELINE,
  play: async (context) => {
    await expectDark();
    await overflowingInCardPlay(context);
  },
  render: () => <OverflowingInCardTabs />,
};

const activeOffscreenPlay: NonNullable<StoryObj<typeof Tabs>["play"]> = async ({
  canvasElement,
}) => {
  const list = within(canvasElement).getByRole("tablist");
  const active = within(list).getByRole("tab", { selected: true });
  await expect(active.textContent).toBe("Settings");
  // Placed before the first paint, so there is nothing to wait for.
  await expectInView(list, active);
  await expect(list.hasAttribute("data-overflow-left")).toBe(true);
  await expect(list.hasAttribute("data-overflow-right")).toBe(false);
};

/** The selected tab is the last of twelve: it is already in view when the page first shows. */
export const ActiveOffscreen: StoryObj<typeof Tabs> = {
  // No baseline yet.
  parameters: NO_BASELINE,
  play: activeOffscreenPlay,
  render: () => <OverflowingTabs defaultValue="settings" />,
};

export const ActiveOffscreenDark: StoryObj<typeof Tabs> = {
  globals: { theme: "dark" },
  // No baseline yet.
  parameters: NO_BASELINE,
  play: async (context) => {
    await expectDark();
    await activeOffscreenPlay(context);
  },
  render: () => <OverflowingTabs defaultValue="settings" />,
};

/** The same list read right to left: the tabs start at the right edge and "Settings" is the far left one. */
export const ActiveOffscreenRtl: StoryObj<typeof Tabs> = {
  // No baseline yet.
  parameters: NO_BASELINE,
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("tablist");
    const active = within(list).getByRole("tab", { selected: true });
    await expect(active.textContent).toBe("Settings");
    await expectInView(list, active);
    // Scrolled to the end, which is the left: there is more to the right, and none past the left.
    await expect(list.hasAttribute("data-overflow-right")).toBe(true);
    await expect(list.hasAttribute("data-overflow-left")).toBe(false);
  },
  render: () => <OverflowingTabs defaultValue="settings" dir="rtl" />,
};

const ValueFromOutsideTabs = ({
  initial = "overview",
  className,
}: {
  initial?: string;
  className?: string;
}) => {
  const [value, setValue] = React.useState(initial);
  return (
    <div className={className}>
      <div className="flex flex-col gap-3">
        <OverflowingTabs value={value} onValueChange={setValue} />
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-field border px-3 py-1 text-sm"
            onClick={() => setValue("settings")}
          >
            Go to Settings
          </button>
          <button
            type="button"
            className="rounded-field border px-3 py-1 text-sm"
            onClick={() => setValue("overview")}
          >
            Back to Overview
          </button>
        </div>
      </div>
    </div>
  );
};

/** The value is changed by the page, not by a click on a tab: the list follows it, in both directions. */
export const ValueChangedFromOutside: StoryObj<typeof Tabs> = {
  // An interaction story: the list looks the same as in Overflowing, which has no baseline yet either.
  parameters: NO_BASELINE,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole("tablist");
    // A web font that arrives half way through a scroll changes every tab's width under it, and the
    // scroll lands where the old layout said. That is the page's business, not what is tested here.
    await document.fonts.ready;
    // A smooth scroll takes a few hundred milliseconds.
    const settled = { timeout: 4000 };

    await userEvent.click(canvas.getByRole("button", { name: "Go to Settings" }));
    await waitFor(
      () => expectInView(list, within(list).getByRole("tab", { name: "Settings", selected: true })),
      settled,
    );
    await waitFor(() => expect(list.hasAttribute("data-overflow-right")).toBe(false), settled);

    await userEvent.click(canvas.getByRole("button", { name: "Back to Overview" }));
    await waitFor(
      () => expectInView(list, within(list).getByRole("tab", { name: "Overview", selected: true })),
      settled,
    );
    await waitFor(() => expect(list.scrollLeft).toBe(0), settled);
  },
  render: () => <ValueFromOutsideTabs />,
};

const activeTab = (list: HTMLElement) => within(list).getByRole("tab", { selected: true });

const ResizableTabs = () => {
  const [width, setWidth] = React.useState(360);
  return (
    <div className="flex flex-col gap-3">
      <div data-testid="box" className="flex max-w-full" style={{ width }}>
        <TwelveTabs defaultValue="entries" />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-field border px-3 py-1 text-sm"
          onClick={() => setWidth(140)}
        >
          Narrow the box
        </button>
        <button
          type="button"
          className="rounded-field border px-3 py-1 text-sm"
          onClick={() => setWidth(360)}
        >
          Widen the box
        </button>
      </div>
    </div>
  );
};

/**
 * The box the list sits in gets narrower (a phone turned on its side, a window dragged, a sidebar
 * opened) and the tab in use, which was whole, is cut off: the list brings it back into view, and does
 * so at once. The browser's own re-snap would not: the offset it had is still a snap point.
 */
export const FollowsResize: StoryObj<typeof Tabs> = {
  // No baseline yet.
  parameters: NO_BASELINE,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole("tablist");
    const settled = { timeout: 4000 };
    await document.fonts.ready;

    // The second tab: whole where the list starts in any box wide enough for it and its fade, which
    // is every phone (320px and up). In a narrower one it is placed at its own snap point at the
    // start, and narrowing the box cuts nothing off.
    await expect(activeTab(list).textContent).toBe("Entries");
    await expectInView(list, activeTab(list));
    const before = list.scrollLeft;

    await userEvent.click(canvas.getByRole("button", { name: "Narrow the box" }));
    await waitFor(() => expect(list.clientWidth).toBeLessThan(160), settled);
    // The tab (76px wide) fits the narrower window, but not where the list was left.
    await waitFor(() => expectInView(list, activeTab(list)), settled);
    await expect(list.scrollLeft).not.toBe(before);

    const narrow = list.clientWidth;
    await userEvent.click(canvas.getByRole("button", { name: "Widen the box" }));
    // Wider than it was, though not to a fixed size: on a phone the box is capped by the screen.
    await waitFor(() => expect(list.clientWidth).toBeGreaterThan(narrow + 40), settled);
    await waitFor(() => expectInView(list, activeTab(list)), settled);
  },
  render: () => <ResizableTabs />,
};

/**
 * Inside something that is scaled: a dialog opens at 95% and grows, a page can scale a panel. The
 * rectangles the browser reports are then not in the pixels the scroll offsets are, and a list that
 * trusted them put the tab in the wrong place by the amount of the scale.
 */
export const ScaledAncestor: StoryObj<typeof Tabs> = {
  // No baseline yet.
  parameters: NO_BASELINE,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole("tablist");
    const settled = { timeout: 4000 };
    await document.fonts.ready;

    // The premise: what the browser reports is really 20% smaller than the list is laid out.
    await expect(list.getBoundingClientRect().width / list.offsetWidth).toBeLessThan(0.85);

    // Placed on the first render, with the transform already on.
    await expect(activeTab(list).textContent).toBe("Settings");
    await expectInView(list, activeTab(list));

    await userEvent.click(canvas.getByRole("button", { name: "Back to Overview" }));
    await waitFor(() => expectInView(list, activeTab(list)), settled);
    await waitFor(() => expect(list.scrollLeft).toBe(0), settled);

    await userEvent.click(canvas.getByRole("button", { name: "Go to Settings" }));
    await waitFor(() => expectInView(list, activeTab(list)), settled);
    await waitFor(() => expect(list.hasAttribute("data-overflow-right")).toBe(false), settled);
  },
  render: () => <ValueFromOutsideTabs initial="settings" className="origin-top-left scale-[0.8]" />,
};

const LoadedLaterTabs = () => {
  const [count, setCount] = React.useState(4);
  const [value, setValue] = React.useState("settings");
  return (
    <div className="flex flex-col gap-3">
      <OverflowingTabs value={value} onValueChange={setValue} labels={LABELS.slice(0, count)} />
      <button
        type="button"
        className="w-fit rounded-field border px-3 py-1 text-sm"
        onClick={() => setCount(LABELS.length)}
      >
        Load the rest
      </button>
    </div>
  );
};

/**
 * The value is already "settings" and its tab does not exist yet: the tabs come from a request. When
 * the rest arrive the tab in use is among them, and the list shows it.
 */
export const LoadedLater: StoryObj<typeof Tabs> = {
  // No baseline yet.
  parameters: NO_BASELINE,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole("tablist");
    await document.fonts.ready;

    await expect(within(list).queryByRole("tab", { selected: true })).toBeNull();
    await expect(within(list).getAllByRole("tab")).toHaveLength(4);

    await userEvent.click(canvas.getByRole("button", { name: "Load the rest" }));
    await waitFor(() => expect(within(list).getAllByRole("tab")).toHaveLength(LABELS.length));
    // Placed before the paint that showed it: nothing to wait for.
    await expect(activeTab(list).textContent).toBe("Settings");
    await expectInView(list, activeTab(list));
    await expect(list.scrollLeft).toBeGreaterThan(0);
  },
  render: () => <LoadedLaterTabs />,
};

/**
 * The arrow keys walk the twelve tabs; each one the focus lands on is brought into view with its
 * focus ring whole, and Home and End go to the ends. The Tab sweep checks the ring is visible in
 * both themes and in forced colors.
 */
export const OverflowingKeyboard: StoryObj<typeof Tabs> = {
  parameters: {
    // An interaction story: the list looks the same as in Overflowing.
    visual: { disable: true },
    keyboard: { sweep: true, forcedColors: true },
  },
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("tablist");
    // The first stop is the button before the list, the second the one tab the list offers.
    await userEvent.tab();
    await userEvent.tab();
    await expect(document.activeElement).toBe(within(list).getByRole("tab", { name: "Overview" }));

    for (let step = 0; step < LABELS.length - 1; step += 1) {
      await userEvent.keyboard("{ArrowRight}");
      const focused = document.activeElement as HTMLElement;
      await expect(focused.getAttribute("role")).toBe("tab");
      await waitFor(() => expectInView(list, focused));
      await expectRingNotClipped(list, focused);
    }
    await expect(document.activeElement).toBe(within(list).getByRole("tab", { name: "Settings" }));

    await userEvent.keyboard("{Home}");
    await waitFor(() => expect(list.scrollLeft).toBe(0));
    await expectRingNotClipped(list, document.activeElement as HTMLElement);
    await userEvent.keyboard("{End}");
    await waitFor(() => expect(list.hasAttribute("data-overflow-right")).toBe(false));
    await expectRingNotClipped(list, document.activeElement as HTMLElement);
  },
  render: () => (
    <div className="flex flex-col gap-3">
      <button type="button" className="w-fit rounded-field border px-3 py-1 text-sm">
        Before
      </button>
      <OverflowingTabs />
      <button type="button" className="w-fit rounded-field border px-3 py-1 text-sm">
        After
      </button>
    </div>
  ),
};

/**
 * One Tab stop for the whole tab list, then arrow keys: Left/Right move focus and select (they wrap),
 * Home and End jump to the ends. Tab again goes to the panel, which is focusable.
 */
export const KeyboardNavigation: StoryObj<typeof Tabs> = {
  parameters: {
    // An interaction story: the tabs look the same as in Default, which has the baseline.
    visual: { disable: true },
    keyboard: { sweep: true, forcedColors: true },
  },
  render: () => (
    <div className="flex flex-col gap-3">
      <button type="button" className="w-fit rounded-field border px-3 py-1 text-sm">
        Before
      </button>
      <Tabs defaultValue="open" className="w-full max-w-[480px]">
        <TabsList aria-label="Invoices">
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="draft" disabled>
            Draft
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value="open">
          <p className="p-4 text-sm text-muted-foreground">Invoices waiting for payment.</p>
        </TabsContent>
        <TabsContent value="paid">
          <p className="p-4 text-sm text-muted-foreground">Invoices that have been paid.</p>
        </TabsContent>
        <TabsContent value="draft">
          <p className="p-4 text-sm text-muted-foreground">Invoices not sent yet.</p>
        </TabsContent>
        <TabsContent value="all">
          <p className="p-4 text-sm text-muted-foreground">Every invoice.</p>
        </TabsContent>
      </Tabs>
      <button type="button" className="w-fit rounded-field border px-3 py-1 text-sm">
        After
      </button>
    </div>
  ),
};

const ControlledTabs = () => {
  const [value, setValue] = React.useState("a");
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={value} onValueChange={setValue} className="w-full max-w-[400px]">
        <TabsList aria-label="Sections">
          <TabsTrigger value="a">First</TabsTrigger>
          <TabsTrigger value="b">Second</TabsTrigger>
        </TabsList>
        <TabsContent value="a">
          <p className="p-4 text-sm text-muted-foreground">First panel.</p>
        </TabsContent>
        <TabsContent value="b">
          <p className="p-4 text-sm text-muted-foreground">Second panel.</p>
        </TabsContent>
      </Tabs>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Selected: {value}
      </p>
    </div>
  );
};

/** Controlled: the parent owns the value and hears every change, by mouse, touch or keyboard. */
export const Controlled: StoryObj<typeof Tabs> = {
  // An interaction story: the tabs look the same as in Default, which has the baseline.
  parameters: { visual: { disable: true } },
  render: () => <ControlledTabs />,
};
