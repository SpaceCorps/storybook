import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../src/components/ui/tabs";

describe("Tabs component", () => {
  it("activates tabs and switches panels", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    );

    expect(screen.getByText("Content 1")).toBeDefined();
    const tab2 = screen.getByRole("tab", { name: "Tab 2" });
    fireEvent.click(tab2);
    expect(screen.getByText("Content 2")).toBeDefined();
  });

  it("renders correct accessibility attributes", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
      </Tabs>,
    );
    const tab = screen.getByRole("tab", { name: "A" });
    expect(tab.getAttribute("aria-selected")).toBe("true");
  });

  // Hover and selection are tints of the foreground, not a fill from muted/accent/secondary: each of
  // those is the colour of some surface a list gets put on, and there the selected tab vanished
  // (`hover:bg-muted/50` on a `bg-muted` list changed nothing at all). A tint reads on all of them.
  it("gives a hovered tab and the selected tab a fill that shows on the list", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
      </Tabs>,
    );
    const tab = screen.getByRole("tab", { name: "B" });
    expect(tab.className).toContain("hover:bg-foreground/5");
    expect(tab.className).toContain("hover:text-foreground");
    expect(tab.className).toContain("data-[state=active]:bg-foreground/10");
  });

  // The border artefact came from `-ml-px -mt-px py-2` on a tab taller than the list's content box.
  // jsdom cannot measure, so this pins the classes; the stories measure the gutters in a browser.
  it("keeps the tabs inside the list: stretched to its content box, with no negative margins", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const tab = screen.getByRole("tab", { name: "A" });
    expect(tab.className).toContain("self-stretch");
    expect(tab.className).not.toMatch(/(^|\s)-m[a-z]?-/);
    expect(tab.className).not.toMatch(/(^|\s)py-/);
  });

  // Nothing stretches a tab to the height of a vertical list (the stretch is across, so it gives the
  // width), so a tab there needs the padding the horizontal list leaves to the list's own.
  it("gives a tab in a vertical list its own vertical padding", () => {
    render(
      <Tabs defaultValue="a" orientation="vertical">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const tab = screen.getByRole("tab", { name: "A" });
    expect(tab.getAttribute("data-orientation")).toBe("vertical");
    expect(tab.className).toContain("data-[orientation=vertical]:py-2");
  });

  // The tab sits inside a list the colour of a card, so the gap between it and its ring is that colour
  // too: the page's would show as a dark halo wherever a card is a step above the page.
  it("offsets the focus ring in the list's own surface", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    expect(screen.getByRole("tablist").className).toContain("bg-card");
    expect(screen.getByRole("tab", { name: "A" }).className).toContain("ring-offset-card");
  });

  // The mechanism that keeps a long list from widening its container, which jsdom cannot see work.
  it("lets the tabs scroll inside the list rather than widen it or the container", () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const list = screen.getByRole("tablist");
    expect(list.className).toContain("max-w-full");
    expect(list.className).toContain("overflow-x-auto");
    expect(list.className).toContain("snap-mandatory");
    // A flex or grid item stretches to its widest child unless told it may shrink.
    expect(container.firstElementChild?.className).toContain("min-w-0");
  });

  // What follows are tests of classes because the class is the whole behaviour: jsdom draws no
  // scrollbar, snaps nothing and has no forced-colors mode, so the rule that does the work can only
  // be pinned where it is written. The play functions in src/stories/tabs.stories.tsx read the same
  // things back from a real browser's computed styles.
  it("hides the scrollbar in both engine families, since it would double the height of the list", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const classes = screen.getByRole("tablist").className.split(/\s+/);
    expect(classes).toContain("[scrollbar-width:none]");
    expect(classes).toContain("[&::-webkit-scrollbar]:hidden");
  });

  it("snaps to the start of a tab, with a margin as wide as the fade so a tab clears it", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const list = screen.getByRole("tablist").className.split(/\s+/);
    expect(list).toContain("snap-x");
    expect(list).toContain("snap-mandatory");
    // The margin and the fade are one variable, so they cannot drift apart.
    expect(list).toContain("scroll-px-(--tabs-fade)");
    expect(list).toContain("[--tabs-fade:1.5rem]");
    expect(list.some((name) => name.includes("var(--tabs-fade)"))).toBe(true);
    expect(screen.getByRole("tab", { name: "A" }).className.split(/\s+/)).toContain("snap-start");
  });

  it("draws the list as an outlined surface, which is what the tabs are inset from", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const list = screen.getByRole("tablist").className.split(/\s+/);
    expect(list).toContain("border");
    expect(list).toContain("border-border");
    expect(list).toContain("p-[4px]");
  });

  // The tint that marks the selected tab is a background, and forced colors flatten backgrounds: the
  // underline is all that is left to say which tab is selected.
  it("underlines the selected tab where forced colors flatten its tint", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const tab = screen.getByRole("tab", { name: "A" }).className.split(/\s+/);
    expect(tab).toContain("forced-colors:data-[state=active]:underline");
    expect(tab).toContain("forced-colors:data-[state=active]:decoration-2");
    expect(tab).toContain("forced-colors:data-[state=active]:underline-offset-4");
  });

  it("keeps a consumer's own classes on the list and the root, winning over the defaults", () => {
    const { container } = render(
      <Tabs defaultValue="a" className="w-96 min-w-fit">
        <TabsList className="grid w-full grid-cols-2 h-auto">
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const list = screen.getByRole("tablist");
    expect(list.className).toContain("grid");
    expect(list.className).toContain("grid-cols-2");
    expect(list.className).toContain("h-auto");
    expect(list.className).not.toContain("h-9");
    expect(container.firstElementChild?.className).toContain("min-w-fit");
    expect(container.firstElementChild?.className).not.toContain("min-w-0");
  });
});

function ThreeTabs(props: React.ComponentProps<typeof Tabs>) {
  return (
    <Tabs defaultValue="a" {...props}>
      <TabsList aria-label="Sections">
        <TabsTrigger value="a">Alpha</TabsTrigger>
        <TabsTrigger value="b">Beta</TabsTrigger>
        <TabsTrigger value="c">Gamma</TabsTrigger>
      </TabsList>
      <TabsContent value="a">Panel A</TabsContent>
      <TabsContent value="b">Panel B</TabsContent>
      <TabsContent value="c">Panel C</TabsContent>
    </Tabs>
  );
}

describe("Tabs keyboard support", () => {
  it("makes the tablist a single tab stop, then the panel", async () => {
    const user = userEvent.setup();
    render(<ThreeTabs />);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Alpha" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("tabpanel"));
  });

  it("uses a roving tabindex: only the tab in focus is tabbable", async () => {
    const user = userEvent.setup();
    render(<ThreeTabs />);

    await user.tab();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Alpha" }).getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("tab", { name: "Beta" }).getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("tab", { name: "Gamma" }).getAttribute("tabindex")).toBe("-1");
  });

  it("moves focus and selection with the arrow keys, wrapping at the ends", async () => {
    const user = userEvent.setup();
    render(<ThreeTabs />);

    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Beta" }));
    expect(screen.getByRole("tab", { name: "Beta" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Panel B")).toBeDefined();

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Gamma" }));
    expect(screen.getByText("Panel C")).toBeDefined();

    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Alpha" }));
  });

  it("jumps to the first and last tab with Home and End", async () => {
    const user = userEvent.setup();
    render(<ThreeTabs defaultValue="b" />);

    await user.tab();
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Gamma" }));
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Alpha" }));
    expect(screen.getByText("Panel A")).toBeDefined();
  });

  it("skips a disabled tab", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Alpha</TabsTrigger>
          <TabsTrigger value="b" disabled>
            Beta
          </TabsTrigger>
          <TabsTrigger value="c">Gamma</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="c">Panel C</TabsContent>
      </Tabs>,
    );

    await user.tab();
    await user.keyboard("{ArrowRight}");

    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Gamma" }));
  });

  it("links each tab to its panel in both directions", () => {
    render(<ThreeTabs />);
    const tab = screen.getByRole("tab", { name: "Alpha" });
    const panel = screen.getByRole("tabpanel");

    expect(document.getElementById(tab.getAttribute("aria-controls")!)).toBe(panel);
    expect(document.getElementById(panel.getAttribute("aria-labelledby")!)).toBe(tab);
    expect(panel.getAttribute("tabindex")).toBe("0");
  });

  it("reports exactly one selected tab", async () => {
    const user = userEvent.setup();
    render(<ThreeTabs />);

    await user.click(screen.getByRole("tab", { name: "Gamma" }));

    const selected = screen
      .getAllByRole("tab")
      .filter((t) => t.getAttribute("aria-selected") === "true");
    expect(selected.map((t) => t.textContent)).toEqual(["Gamma"]);
  });

  it("still selects on a bare click event, which is all assistive technology sends", () => {
    render(<ThreeTabs />);

    fireEvent.click(screen.getByRole("tab", { name: "Beta" }));

    expect(screen.getByRole("tab", { name: "Beta" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Panel B")).toBeDefined();
  });

  it("calls onValueChange once per change, not once per event that selects", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ThreeTabs onValueChange={onValueChange} />);

    await user.click(screen.getByRole("tab", { name: "Beta" }));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("b");
  });

  it("asks a parent that vetoes the change once for a mouse click", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ThreeTabs value="a" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("tab", { name: "Beta" }));

    // Mouse down, the focus it brings and the click all say "Beta"; the parent hears it once.
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("b");
  });

  it("asks a parent that vetoes the change once for Enter, and once for Space", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ThreeTabs value="a" onValueChange={onValueChange} />);
    const beta = screen.getByRole("tab", { name: "Beta" });
    // Focus alone asks (Radix activates on focus); the keys below are what is measured.
    beta.focus();

    onValueChange.mockClear();
    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledTimes(1);

    onValueChange.mockClear();
    await user.keyboard(" ");
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("asks a parent that applies the change a moment later once per click", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    function Async() {
      const [value, setValue] = React.useState("a");
      return (
        <ThreeTabs
          value={value}
          onValueChange={(next) => {
            calls.push(next);
            setTimeout(() => setValue(next), 50);
          }}
        />
      );
    }
    render(<Async />);

    await user.click(screen.getByRole("tab", { name: "Gamma" }));

    expect(calls).toEqual(["c"]);
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Gamma" }).getAttribute("aria-selected")).toBe("true"),
    );
  });

  it("asks once for a bare click against a vetoing parent, and once more for the next", () => {
    const onValueChange = vi.fn();
    render(<ThreeTabs value="a" onValueChange={onValueChange} />);
    const beta = screen.getByRole("tab", { name: "Beta" });

    fireEvent.click(beta);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    fireEvent.click(beta);
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  it("asks again for a second mouse click on the same tab, since that is a new interaction", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ThreeTabs value="a" onValueChange={onValueChange} />);
    const beta = screen.getByRole("tab", { name: "Beta" });

    await user.click(beta);
    await user.click(beta);

    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  it("follows the value when controlled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(<ThreeTabs value="a" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("tab", { name: "Beta" }));
    // The parent has not accepted the change, so nothing moves.
    expect(screen.getByRole("tab", { name: "Alpha" }).getAttribute("aria-selected")).toBe("true");

    rerender(<ThreeTabs value="b" onValueChange={onValueChange} />);
    expect(screen.getByRole("tab", { name: "Beta" }).getAttribute("aria-selected")).toBe("true");
  });

  it("accepts and ignores the old useRadix prop on every part", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="a" useRadix>
        <TabsList useRadix>
          <TabsTrigger value="a" useRadix>
            Alpha
          </TabsTrigger>
          <TabsTrigger value="b" useRadix>
            Beta
          </TabsTrigger>
        </TabsList>
        <TabsContent value="a" useRadix>
          Panel A
        </TabsContent>
        <TabsContent value="b" useRadix>
          Panel B
        </TabsContent>
      </Tabs>,
    );

    await user.tab();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Beta" }).getAttribute("aria-selected")).toBe("true");
    expect(document.querySelector("[useradix]")).toBeNull();
  });

  it("forwards its ref to the root element", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<ThreeTabs ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.contains(screen.getByRole("tablist"))).toBe(true);
  });
});
