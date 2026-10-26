import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperTitle,
  StepperTrigger,
} from "../src/components/ui/stepper";

function Steps({
  asChild = false,
  onClick,
  disabledStep,
  onValueChange,
}: {
  asChild?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  disabledStep?: number;
  onValueChange?: (value: number) => void;
}) {
  return (
    <Stepper defaultValue={2} onValueChange={onValueChange}>
      {[1, 2, 3].map((step) => (
        <StepperItem key={step} step={step} disabled={step === disabledStep}>
          {asChild ? (
            <StepperTrigger asChild onClick={onClick}>
              <a href={`#step-${step}`}>
                <StepperIndicator />
                <StepperTitle>{`Step ${step}`}</StepperTitle>
              </a>
            </StepperTrigger>
          ) : (
            <StepperTrigger onClick={onClick}>
              <StepperIndicator />
              <StepperTitle>{`Step ${step}`}</StepperTitle>
            </StepperTrigger>
          )}
        </StepperItem>
      ))}
    </Stepper>
  );
}

describe("StepperTrigger as a button", () => {
  it("marks only the active step as the current step", () => {
    render(<Steps />);
    const triggers = screen.getAllByRole("button");
    expect(triggers.map((trigger) => trigger.getAttribute("aria-current"))).toEqual([
      null,
      "step",
      null,
    ]);
  });

  it("moves aria-current with the active step", async () => {
    const user = userEvent.setup();
    render(<Steps />);
    await user.click(screen.getByRole("button", { name: /Step 3/ }));
    expect(screen.getByRole("button", { name: /Step 3/ }).getAttribute("aria-current")).toBe(
      "step",
    );
    expect(screen.getByRole("button", { name: /Step 2/ }).hasAttribute("aria-current")).toBe(false);
  });

  it("is reached with Tab and activated with Enter and Space", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Steps onValueChange={onValueChange} />);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Step 1/ }));
    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith(1);

    await user.tab();
    await user.tab();
    await user.keyboard(" ");
    expect(onValueChange).toHaveBeenLastCalledWith(3);
  });

  it("still moves the step when the caller passes its own onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onValueChange = vi.fn();
    render(<Steps onClick={onClick} onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: /Step 3/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(3);
  });

  it("lets the caller veto the step change with preventDefault", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Steps onClick={(event) => event.preventDefault()} onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: /Step 3/ }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("skips a disabled step", async () => {
    const user = userEvent.setup();
    render(<Steps disabledStep={2} />);
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Step 3/ }));
  });
});

describe("StepperTrigger asChild", () => {
  it("renders the child element as the control, not a wrapping div", () => {
    render(<Steps asChild />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0].tagName).toBe("A");
    expect(links[0].getAttribute("href")).toBe("#step-1");
    // The child sits directly in the step item; it used to be wrapped in a bare div that dropped
    // the ref and every handler.
    expect(links[0].parentElement?.getAttribute("data-state")).toBe("completed");
  });

  it("marks the active step's link as the current step", () => {
    render(<Steps asChild />);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("aria-current"))).toEqual([null, "step", null]);
  });

  it("forwards the ref to the child element", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(
      <Stepper defaultValue={1}>
        <StepperItem step={1}>
          <StepperTrigger asChild ref={ref}>
            <a href="#one">One</a>
          </StepperTrigger>
        </StepperItem>
      </Stepper>,
    );
    expect(ref.current).toBe(screen.getByRole("link", { name: "One" }));
  });

  it("moves the step on click and on Enter, keeping the caller's own handler", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(<Steps asChild onClick={onClick} onValueChange={onValueChange} />);

    await user.click(screen.getByRole("link", { name: /Step 3/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(3);

    // A link navigated with preventDefault (client-side routing) must still move the step.
    expect(document.activeElement).toBe(screen.getByRole("link", { name: /Step 3/ }));
    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  it("expresses and enforces a disabled step on a non-button child", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Steps asChild disabledStep={3} onValueChange={onValueChange} />);

    const link = screen.getByRole("link", { name: /Step 3/ });
    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(link.hasAttribute("disabled")).toBe(false);

    await user.click(link);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("StepperTrigger asChild with a disabled step", () => {
  it("does not run the child's own onClick, so a disabled link cannot navigate", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const onValueChange = vi.fn();
    render(
      <Stepper defaultValue={1} onValueChange={onValueChange}>
        <StepperItem step={2} disabled>
          <StepperTrigger asChild>
            <a href="#step-2" onClick={navigate}>
              Step 2
            </a>
          </StepperTrigger>
        </StepperItem>
      </Stepper>,
    );

    await user.click(screen.getByRole("link", { name: "Step 2" }));
    expect(navigate).not.toHaveBeenCalled();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("does not run the caller's onClick on the trigger either", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Stepper defaultValue={1}>
        <StepperItem step={2} disabled>
          <StepperTrigger asChild onClick={onClick}>
            <a href="#step-2">Step 2</a>
          </StepperTrigger>
        </StepperItem>
      </Stepper>,
    );
    await user.click(screen.getByRole("link", { name: "Step 2" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("still runs the child's own onClick, then moves the step, when the step is enabled", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    render(
      <Stepper defaultValue={1} onValueChange={() => calls.push("step")}>
        <StepperItem step={2}>
          <StepperTrigger asChild>
            <a href="#step-2" onClick={() => calls.push("child")}>
              Step 2
            </a>
          </StepperTrigger>
        </StepperItem>
      </Stepper>,
    );
    await user.click(screen.getByRole("link", { name: "Step 2" }));
    expect(calls).toEqual(["child", "step"]);
  });

  it("keeps the child's ref and other props when it has to strip the onClick", () => {
    const ref = React.createRef<HTMLAnchorElement>();
    render(
      <Stepper defaultValue={1}>
        <StepperItem step={2} disabled>
          <StepperTrigger asChild>
            <a ref={ref} href="#step-2" data-kept="yes" onClick={() => {}}>
              Step 2
            </a>
          </StepperTrigger>
        </StepperItem>
      </Stepper>,
    );
    const link = screen.getByRole("link", { name: "Step 2" });
    expect(ref.current).toBe(link);
    expect(link.getAttribute("data-kept")).toBe("yes");
    expect(link.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("StepperTrigger asChild with more than one child", () => {
  function Multi({
    disabled = false,
    onValueChange,
  }: {
    disabled?: boolean;
    onValueChange?: (value: number) => void;
  }) {
    return (
      <Stepper defaultValue={1} onValueChange={onValueChange}>
        <StepperItem step={2} disabled={disabled}>
          <StepperTrigger asChild>
            <StepperIndicator />
            <StepperTitle>Details</StepperTitle>
          </StepperTrigger>
        </StepperItem>
      </Stepper>
    );
  }

  it("renders instead of throwing, as it did before the trigger used Slot", () => {
    expect(() => render(<Multi />)).not.toThrow();
    expect(screen.getByText("Details")).toBeDefined();
  });

  it("wraps the children in one control that moves the step on click", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Multi onValueChange={onValueChange} />);
    const control = screen.getByRole("button", { name: /Details/ });
    expect(control.tagName).toBe("DIV");
    await user.click(screen.getByText("Details"));
    expect(onValueChange).toHaveBeenLastCalledWith(2);
  });

  it("is a tab stop that Enter and Space activate", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Multi onValueChange={onValueChange} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Details/ }));
    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    await user.keyboard(" ");
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  it("is out of the tab order and inert when its step is disabled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Multi disabled onValueChange={onValueChange} />);
    const control = screen.getByRole("button", { name: /Details/ });
    expect(control.getAttribute("aria-disabled")).toBe("true");
    await user.tab();
    expect(document.activeElement).toBe(document.body);
    await user.click(control);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("treats a fragment as several children", () => {
    render(
      <Stepper defaultValue={1}>
        <StepperItem step={2}>
          <StepperTrigger asChild>
            <>
              <StepperIndicator />
              <StepperTitle>Fragment</StepperTitle>
            </>
          </StepperTrigger>
        </StepperItem>
      </Stepper>,
    );
    expect(screen.getByRole("button", { name: /Fragment/ })).toBeDefined();
  });
});

describe("Stepper exposes how far along each step is", () => {
  /** What the control is described by: the text of the elements its aria-describedby names. */
  const description = (control: HTMLElement) =>
    (control.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");

  it("is a list of steps, so a screen reader says how many there are and which this is", () => {
    render(<Steps />);
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("describes a completed step as completed and an upcoming one as upcoming", () => {
    render(<Steps />);
    const [first, second, third] = screen.getAllByRole("button");
    expect(description(first)).toBe("Completed");
    expect(description(third)).toBe("Upcoming");
    // The active step says it with aria-current, so it carries no description of its own.
    expect(second.getAttribute("aria-current")).toBe("step");
    expect(description(second)).toBe("");
    expect(second.hasAttribute("aria-describedby")).toBe(false);
  });

  it("does the same for a link used as the control", () => {
    render(<Steps asChild />);
    const [first, second, third] = screen.getAllByRole("link");
    expect(description(first)).toBe("Completed");
    expect(description(second)).toBe("");
    expect(description(third)).toBe("Upcoming");
  });

  it("follows the step as it moves", async () => {
    const user = userEvent.setup();
    render(<Steps />);
    await user.click(screen.getByRole("button", { name: /Step 3/ }));
    const [first, second, third] = screen.getAllByRole("button");
    expect(description(first)).toBe("Completed");
    expect(description(second)).toBe("Completed");
    expect(description(third)).toBe("");
  });

  it("marks a step that was completed explicitly, ahead of the active one", () => {
    render(
      <Stepper defaultValue={1}>
        <StepperItem step={1}>
          <StepperTrigger>Step 1</StepperTrigger>
        </StepperItem>
        <StepperItem step={2} completed>
          <StepperTrigger>Step 2</StepperTrigger>
        </StepperItem>
      </Stepper>,
    );
    expect(description(screen.getByRole("button", { name: "Step 2" }))).toBe("Completed");
  });

  it("says a step is loading while it is", () => {
    render(
      <Stepper defaultValue={1}>
        <StepperItem step={1} loading>
          <StepperTrigger>Step 1</StepperTrigger>
        </StepperItem>
      </Stepper>,
    );
    expect(description(screen.getByRole("button", { name: /Step 1/ }))).toBe("Loading");
  });

  it("keeps the caller's own description and adds the progress after it", () => {
    render(
      <Stepper defaultValue={2}>
        <StepperItem step={1}>
          <StepperTrigger aria-describedby="hint">Step 1</StepperTrigger>
          <p id="hint">Pick a plan</p>
        </StepperItem>
      </Stepper>,
    );
    expect(description(screen.getByRole("button", { name: /Step 1/ }))).toBe(
      "Pick a plan Completed",
    );
  });

  it("does not put the progress text in the accessible name or in the page as loose text", () => {
    render(<Steps />);
    expect(screen.getByRole("button", { name: /Step 1/ }).textContent).not.toContain("Completed");
    expect(screen.queryByText("Completed")).toHaveProperty("hidden", true);
  });
});

describe("StepperTrigger asChild with a disabled step looks and tabs like a disabled button", () => {
  it("is dimmed and inert to the pointer, as the button variant is", () => {
    render(<Steps asChild disabledStep={3} />);
    const link = screen.getByRole("link", { name: /Step 3/ });
    expect(link.className).toContain("aria-disabled:opacity-50");
    expect(link.className).toContain("aria-disabled:pointer-events-none");
    // The same two declarations the button variant gets from `disabled:`.
    const button = render(<Steps disabledStep={3} />).container.querySelector("button[disabled]");
    expect(button?.className).toContain("disabled:opacity-50");
    expect(button?.className).toContain("disabled:pointer-events-none");
  });

  it("is out of the tab order, as the button and the several-children variants are", async () => {
    const user = userEvent.setup();
    render(<Steps asChild disabledStep={2} />);
    const link = screen.getByRole("link", { name: /Step 2/ });
    expect(link.getAttribute("tabindex")).toBe("-1");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: /Step 1/ }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: /Step 3/ }));
  });

  it("keeps an enabled control's own tabIndex untouched", () => {
    render(
      <Stepper defaultValue={1}>
        <StepperItem step={1}>
          <StepperTrigger asChild>
            <a href="#one" tabIndex={5}>
              One
            </a>
          </StepperTrigger>
        </StepperItem>
        <StepperItem step={2}>
          <StepperTrigger asChild>
            <a href="#two">Two</a>
          </StepperTrigger>
        </StepperItem>
      </Stepper>,
    );
    expect(screen.getByRole("link", { name: "One" }).getAttribute("tabindex")).toBe("5");
    expect(screen.getByRole("link", { name: "Two" }).hasAttribute("tabindex")).toBe(false);
  });
});
