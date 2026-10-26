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

  it("applies hover:bg-muted/50 and hover:text-foreground to tab triggers", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
      </Tabs>,
    );
    const tab = screen.getByRole("tab", { name: "A" });
    expect(tab.className).toContain("hover:bg-muted/50");
    expect(tab.className).toContain("hover:text-foreground");
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
