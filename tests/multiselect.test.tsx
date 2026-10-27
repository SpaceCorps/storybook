import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Field } from "../src/components/ui/field";
import { MultiSelect, type Option } from "../src/components/ui/multiselect";

describe("MultipleSelector component", () => {
  const sampleOptions: Option[] = [
    { value: "react", label: "React" },
    { value: "vue", label: "Vue" },
    { value: "svelte", label: "Svelte" },
    { value: "react-native", label: "React Native" },
  ];

  it("filters options when searchable is true and user types in input", () => {
    render(
      <MultiSelect
        defaultOptions={sampleOptions}
        placeholder="Select options..."
        searchable={true}
      />,
    );

    const input = screen.getByPlaceholderText("Select options...");
    fireEvent.focus(input);

    expect(screen.getByText("React")).toBeDefined();
    expect(screen.getByText("Vue")).toBeDefined();

    fireEvent.change(input, { target: { value: "vue" } });

    expect(screen.getByText("Vue")).toBeDefined();
    expect(screen.queryByText("React")).toBeNull();
    expect(screen.queryByText("Svelte")).toBeNull();
  });

  it("does not filter options when searchable is false even if user types in input", () => {
    render(
      <MultiSelect
        defaultOptions={sampleOptions}
        placeholder="Select options..."
        searchable={false}
      />,
    );

    const input = screen.getByPlaceholderText("Select options...");
    fireEvent.focus(input);

    fireEvent.change(input, { target: { value: "vue" } });

    expect(screen.getByText("React")).toBeDefined();
    expect(screen.getByText("Vue")).toBeDefined();
    expect(screen.getByText("Svelte")).toBeDefined();
  });

  it("filters according to searchMode (CaseInsensitive, CaseSensitive, Fuzzy)", () => {
    const { unmount } = render(
      <MultiSelect
        defaultOptions={sampleOptions}
        placeholder="CaseSensitive selector"
        searchMode="CaseSensitive"
      />,
    );

    let input = screen.getByPlaceholderText("CaseSensitive selector");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "react" } });

    // Lowercase "react" should not match "React" in CaseSensitive mode
    expect(screen.queryByText("React")).toBeNull();

    fireEvent.change(input, { target: { value: "React" } });
    expect(screen.getByText("React")).toBeDefined();
    expect(screen.getByText("React Native")).toBeDefined();
    expect(screen.queryByText("Vue")).toBeNull();

    unmount();

    // Fuzzy mode test
    render(
      <MultiSelect
        defaultOptions={sampleOptions}
        placeholder="Fuzzy selector"
        searchMode="Fuzzy"
      />,
    );

    input = screen.getByPlaceholderText("Fuzzy selector");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "rn" } });

    // "rn" matches "React Native"
    expect(screen.getByText("React Native")).toBeDefined();
    expect(screen.queryByText("Vue")).toBeNull();
    expect(screen.queryByText("Svelte")).toBeNull();
  });

  it("renders emptyMessage or default message when no options match", () => {
    const { unmount } = render(
      <MultiSelect
        defaultOptions={sampleOptions}
        placeholder="Custom empty message"
        emptyMessage="Custom empty state: nothing here"
      />,
    );

    let input = screen.getByPlaceholderText("Custom empty message");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "nonexistent query" } });

    expect(screen.getByText("Custom empty state: nothing here")).toBeDefined();

    unmount();

    // Default message test
    render(<MultiSelect defaultOptions={sampleOptions} placeholder="Default empty message" />);

    input = screen.getByPlaceholderText("Default empty message");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "nonexistent query" } });

    expect(screen.getByText("No options available")).toBeDefined();
  });

  it("confirms CommandItem values match option.value", () => {
    render(<MultiSelect defaultOptions={sampleOptions} placeholder="Select options..." />);

    const input = screen.getByPlaceholderText("Select options...");
    fireEvent.focus(input);

    const items = document.body.querySelectorAll("[cmdk-item]");
    expect(items.length).toBe(sampleOptions.length);

    sampleOptions.forEach((option, index) => {
      const item = items[index];
      const attrValue =
        item.getAttribute("data-value") ??
        item.getAttribute("value") ??
        item.getAttribute("cmdk-value");
      expect(attrValue).toBe(option.value);
    });
  });

  it("supports keyboard navigation with ArrowDown and Enter selection", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <MultiSelect
        defaultOptions={sampleOptions}
        placeholder="Select options..."
        onValueChange={onValueChange}
      />,
    );

    const input = screen.getByPlaceholderText("Select options...");
    fireEvent.focus(input);

    const items = document.body.querySelectorAll("[cmdk-item]");
    // Initial active option is index 0 ("React")
    expect(items[0].getAttribute("data-selected")).toBe("true");

    const root = container.querySelector("[cmdk-root]")!;

    // Navigate with ArrowDown to index 1 ("Vue")
    fireEvent.keyDown(root, { key: "ArrowDown" });
    expect(items[1].getAttribute("data-selected")).toBe("true");

    // Select highlighted item with Enter
    fireEvent.keyDown(root, { key: "Enter" });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith([sampleOptions[1]]);
  });
});

describe("MultipleSelector keyboard and accessibility", () => {
  const options: Option[] = [
    { value: "react", label: "React" },
    { value: "vue", label: "Vue" },
    { value: "svelte", label: "Svelte" },
  ];

  const Controlled = (props: Partial<React.ComponentProps<typeof MultiSelect>>) => {
    const [selected, setSelected] = React.useState<Option[]>(props.value ?? []);
    return (
      <>
        <MultiSelect
          defaultOptions={options}
          placeholder="Pick"
          aria-label="Frameworks"
          {...props}
          value={selected}
          onValueChange={setSelected}
        />
        <button type="button">After</button>
      </>
    );
  };

  const boxOf = (container: HTMLElement) =>
    container.querySelector("[cmdk-input]")!.closest("div[class*=focus-within]")!;

  it("reports aria-expanded for both states", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const input = screen.getByRole("combobox", { name: "Frameworks" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-controls");

    await user.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input.getAttribute("aria-controls")).toBeTruthy();

    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-controls");

    // And the list can come back after having been closed.
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input.getAttribute("aria-controls")).toBeTruthy();
  });

  it("closes on Escape but keeps focus and the typed text; a second Escape clears it", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const input = screen.getByRole("combobox", { name: "Frameworks" }) as HTMLInputElement;

    await user.click(input);
    await user.keyboard("re");
    await user.keyboard("{Escape}");
    expect(input).toHaveFocus();
    expect(input.value).toBe("re");
    expect(document.querySelector("[cmdk-list]")).toBeNull();

    await user.keyboard("{Escape}");
    expect(input).toHaveFocus();
    expect(input.value).toBe("");
  });

  it("does not trap Tab: no modal page lock, and Tab reaches the next control", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(screen.getByRole("combobox", { name: "Frameworks" }));

    expect(document.body.style.pointerEvents).not.toBe("none");
    expect(document.querySelector("[data-aria-hidden]")).toBeNull();

    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("makes the chevron a mouse-only decoration, not a tab stop", () => {
    const { container } = render(<Controlled />);
    const chevron = container.querySelector("svg.lucide-chevron-down")!;
    expect(chevron).toHaveAttribute("aria-hidden", "true");
    expect(chevron).not.toHaveAttribute("tabindex");
    expect(chevron).not.toHaveAttribute("role");
  });

  it("puts the focus ring on the box around the input", () => {
    const { container } = render(<Controlled />);
    const box = boxOf(container);
    expect(box.className).toContain("focus-within:ring-1");
    expect(box.className).toContain("focus-within:ring-ring");
    expect(box.className).not.toContain("focus-within:ring-0");
  });

  it("names each chip's remove button after its option", () => {
    render(<Controlled value={[options[0], options[1]]} maxVisibleBadges={2} />);
    expect(screen.getByRole("button", { name: "Remove React" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Vue" })).toBeInTheDocument();
  });

  it("reaches the chips with ArrowLeft, removes with Backspace, and announces it", async () => {
    const user = userEvent.setup();
    render(<Controlled value={[options[0], options[1]]} maxVisibleBadges={2} />);
    const input = screen.getByRole("combobox", { name: "Frameworks" });

    await user.click(input);
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Remove Vue" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Remove React" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Remove Vue" })).toHaveFocus();

    await user.keyboard("{Backspace}");
    expect(screen.queryByRole("button", { name: "Remove Vue" })).toBeNull();
    // Focus moved to the neighbouring chip before the removal, so it was not lost.
    expect(screen.getByRole("button", { name: "Remove React" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Removed Vue");
  });

  it("removes the focused chip on Enter and hands focus to the input after the last one", async () => {
    const user = userEvent.setup();
    render(<Controlled value={[options[0]]} maxVisibleBadges={1} />);
    const input = screen.getByRole("combobox", { name: "Frameworks" });

    await user.click(input);
    await user.keyboard("{ArrowLeft}{Enter}");
    expect(screen.queryByRole("button", { name: "Remove React" })).toBeNull();
    expect(input).toHaveFocus();
  });

  it("removes only the last chip with Backspace from the input", async () => {
    const user = userEvent.setup();
    render(<Controlled value={[options[0], options[1]]} maxVisibleBadges={2} />);
    await user.click(screen.getByRole("combobox", { name: "Frameworks" }));
    await user.keyboard("{Backspace}");
    expect(screen.queryByRole("button", { name: "Remove Vue" })).toBeNull();
    expect(screen.getByRole("button", { name: "Remove React" })).toBeInTheDocument();
  });

  it("submits the selection under name as one hidden input per value", () => {
    const { container } = render(
      <Controlled name="frameworks" value={[options[0], options[2]]} maxVisibleBadges={2} />,
    );
    const hidden = Array.from(
      container.querySelectorAll<HTMLInputElement>("input[type=hidden][name=frameworks]"),
    );
    expect(hidden.map((input) => input.value)).toEqual(["react", "svelte"]);
  });

  it("takes aria-describedby, aria-invalid and aria-required onto the combobox", () => {
    render(
      <>
        <p id="help">Help</p>
        <Controlled aria-describedby="help" aria-invalid required />
      </>,
    );
    const input = screen.getByRole("combobox", { name: "Frameworks" });
    expect(input).toHaveAccessibleDescription("Help");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-required", "true");
  });

  it("shows a border when invalid, whichever variant it is", () => {
    // `selectTriggerBase` carries `aria-invalid:border-destructive`, so a substring check is always
    // true; the exact token is only there for an invalid box, and the ghost one's transparent border
    // is replaced.
    const tokens = (element: Element) => Array.from(element.classList);
    const valid = render(<Controlled />);
    expect(tokens(boxOf(valid.container))).not.toContain("border-destructive");
    // A valid field keeps the control edge it inherits from the trigger base; it was `border-0`.
    expect(tokens(boxOf(valid.container))).toContain("border-input");
    expect(tokens(boxOf(valid.container))).not.toContain("border-0");
    valid.unmount();

    const { container, rerender } = render(<Controlled invalid />);
    expect(tokens(boxOf(container))).toContain("border-destructive");
    expect(tokens(boxOf(container))).not.toContain("border-0");
    expect(tokens(boxOf(container))).toContain("dark:border-red");
    expect(tokens(boxOf(container))).toContain("dark:focus-within:ring-red");

    rerender(<Controlled invalid ghost />);
    expect(tokens(boxOf(container))).toContain("border-destructive");
    expect(tokens(boxOf(container))).not.toContain("border-transparent");
  });
});

describe("MultipleSelector leaving, scrolling and assistive technology", () => {
  const options: Option[] = [
    { value: "react", label: "React" },
    { value: "vue", label: "Vue" },
    { value: "svelte", label: "Svelte" },
  ];

  it("reports onBlur once when focus leaves through a chip", async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    render(
      <>
        <button type="button">Before</button>
        <MultiSelect
          aria-label="Frameworks"
          defaultOptions={options}
          value={[options[0], options[1]]}
          maxVisibleBadges={2}
          onBlur={onBlur}
        />
      </>,
    );
    await user.click(screen.getByRole("combobox", { name: "Frameworks" }));
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Remove Vue" })).toHaveFocus();

    // Focus is still in the control, so nothing has left it.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onBlur).not.toHaveBeenCalled();

    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
    await waitFor(() => expect(onBlur).toHaveBeenCalledTimes(1));
    expect(document.querySelector("[cmdk-list]")).toBeNull();
  });

  it("keeps wheel and touch moves on the list from reaching the document", async () => {
    // A modal dialog's scroll lock listens on the document and swallows these, and the list is
    // portalled out of the dialog, so stopping them at the list is what lets it scroll.
    const user = userEvent.setup();
    render(<MultiSelect aria-label="Frameworks" defaultOptions={options} value={[]} />);
    await user.click(screen.getByRole("combobox", { name: "Frameworks" }));
    const list = document.querySelector("[cmdk-list]")!;

    const seen = vi.fn();
    document.addEventListener("wheel", seen);
    document.addEventListener("touchmove", seen);
    try {
      fireEvent.wheel(list);
      fireEvent.touchMove(list);
      expect(seen).not.toHaveBeenCalled();

      // The listener works, so the silence above is the list's doing.
      fireEvent.wheel(document.body);
      expect(seen).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener("wheel", seen);
      document.removeEventListener("touchmove", seen);
    }
  });

  it("does not leave aria-activedescendant pointing at an option once the list has closed", async () => {
    const user = userEvent.setup();
    render(<MultiSelect aria-label="Frameworks" defaultOptions={options} value={[]} />);
    const input = screen.getByRole("combobox", { name: "Frameworks" });

    await user.click(input);
    await user.keyboard("{ArrowDown}");
    expect(input.getAttribute("aria-activedescendant")).toBeTruthy();

    await user.keyboard("{Escape}");
    expect(document.querySelector("[cmdk-list]")).toBeNull();
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("exposes which options are chosen, not only which is highlighted", async () => {
    const user = userEvent.setup();
    render(<MultiSelect aria-label="Frameworks" defaultOptions={options} value={[options[1]]} />);
    await user.click(screen.getByRole("combobox", { name: "Frameworks" }));

    expect(screen.getByRole("listbox")).toHaveAttribute("aria-multiselectable", "true");
    expect(screen.getByRole("option", { name: "Vue" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("option", { name: "React" })).toHaveAttribute("aria-checked", "false");
  });

  it("announces an option when it is added", async () => {
    const user = userEvent.setup();
    render(<MultiSelect aria-label="Frameworks" defaultOptions={options} value={[]} />);
    await user.click(screen.getByRole("combobox", { name: "Frameworks" }));

    await user.click(screen.getByRole("option", { name: "Vue" }));

    expect(screen.getByRole("status")).toHaveTextContent("Added Vue");
  });

  it("names the selections hidden behind the +N badge", () => {
    render(
      <MultiSelect
        aria-label="Frameworks"
        defaultOptions={options}
        value={options}
        maxVisibleBadges={1}
      />,
    );
    expect(screen.getByText("+2")).toHaveTextContent("+2 more selected: Vue, Svelte");
  });

  it("names its popup after the combobox, or after the field's label", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <MultiSelect aria-label="Frameworks" defaultOptions={options} value={[]} />,
    );
    await user.click(screen.getByRole("combobox", { name: "Frameworks" }));
    expect(screen.getByRole("dialog", { name: "Frameworks options" })).toBeInTheDocument();
    unmount();

    render(
      <Field label="Tags">
        <MultiSelect defaultOptions={options} value={[]} />
      </Field>,
    );
    await user.click(screen.getByRole("combobox", { name: "Tags" }));
    expect(screen.getByRole("dialog", { name: "Tags" })).toBeInTheDocument();
  });

  describe("bulk actions", () => {
    it("reaches Select All with the arrow keys and runs it with Enter", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <MultiSelect
          aria-label="Frameworks"
          defaultOptions={options}
          value={[]}
          showActions
          onValueChange={onValueChange}
        />,
      );
      await user.click(screen.getByRole("combobox", { name: "Frameworks" }));

      // Three options, then the actions.
      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
      expect(screen.getByRole("option", { name: "Select All" })).toHaveAttribute(
        "data-selected",
        "true",
      );
      await user.keyboard("{Enter}");

      expect(onValueChange).toHaveBeenCalledWith(options);
    });

    it("runs Clear All from the keyboard, and has it disabled while nothing is chosen", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const { rerender } = render(
        <MultiSelect
          aria-label="Frameworks"
          defaultOptions={options}
          value={[]}
          showActions
          onValueChange={onValueChange}
        />,
      );
      await user.click(screen.getByRole("combobox", { name: "Frameworks" }));
      expect(screen.getByRole("option", { name: "Clear All" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );

      rerender(
        <MultiSelect
          aria-label="Frameworks"
          defaultOptions={options}
          value={[options[0]]}
          showActions
          onValueChange={onValueChange}
        />,
      );
      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
      await user.keyboard("{Enter}");

      expect(onValueChange).toHaveBeenCalledWith([]);
    });

    it("still shows the empty message, and the actions, when the search matches nothing", async () => {
      const user = userEvent.setup();
      render(
        <MultiSelect
          aria-label="Frameworks"
          defaultOptions={options}
          value={[options[0]]}
          showActions
          emptyMessage="Nothing here"
        />,
      );
      await user.type(screen.getByRole("combobox", { name: "Frameworks" }), "zzz");

      expect(screen.getByText("Nothing here")).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Clear All" })).toBeInTheDocument();
    });
  });
});
