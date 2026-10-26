import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Input } from "../src/components/ui/input";
import { splitLayoutClasses } from "../src/components/ui/input/layout-classes";

afterEach(() => {
  vi.restoreAllMocks();
});

const toggleOf = () => screen.getByRole("button", { name: "Show password" });

describe("Input password toggle", () => {
  it("renders a Show password button on a password input", () => {
    render(<Input type="password" aria-label="Password" autoComplete="current-password" />);
    const toggle = toggleOf();
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAttribute("type", "button");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("renders no button for other types or when opted out", () => {
    render(
      <>
        <Input aria-label="Text" />
        <Input type="email" aria-label="Email" />
        <Input type="password" aria-label="PIN" autoComplete="off" passwordToggle={false} />
      </>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByLabelText("PIN")).toHaveAttribute("type", "password");
  });

  it("makes any type a toggling password input with passwordToggle", () => {
    render(<Input type="text" passwordToggle aria-label="Token" autoComplete="off" />);
    expect(screen.getByLabelText("Token")).toHaveAttribute("type", "password");
    expect(toggleOf()).toBeInTheDocument();
  });

  it("uses the label prop for the button's name", () => {
    render(
      <Input
        type="password"
        aria-label="Lösenord"
        autoComplete="current-password"
        passwordToggleLabel="Visa lösenord"
      />,
    );
    expect(screen.getByRole("button", { name: "Visa lösenord" })).toBeInTheDocument();
  });

  it("swaps the type on the same node when clicked, and back", async () => {
    const user = userEvent.setup();
    render(<Input type="password" aria-label="Password" autoComplete="current-password" />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    const toggle = toggleOf();

    await user.click(toggle);
    expect(input.type).toBe("text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    // The name stays "Show password": a pressed toggle button, not one that renames itself.
    expect(toggle).toHaveAccessibleName("Show password");
    expect(screen.getByLabelText("Password")).toBe(input);
    expect(input.isConnected).toBe(true);

    await user.click(toggle);
    expect(input.type).toBe("password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the value and the focus in the field when the button is clicked", async () => {
    const user = userEvent.setup();
    render(<Input type="password" aria-label="Password" defaultValue="hunter2" />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;

    await user.click(input);
    await user.click(toggleOf());

    expect(input).toHaveFocus();
    expect(input.value).toBe("hunter2");
  });

  it("does not take focus when the field was not focused", async () => {
    const user = userEvent.setup();
    render(
      <>
        <input aria-label="Username" />
        <Input type="password" aria-label="Password" />
      </>,
    );
    await user.click(screen.getByLabelText("Username"));
    await user.click(toggleOf());
    expect(screen.getByLabelText("Username")).toHaveFocus();
    expect((screen.getByLabelText("Password") as HTMLInputElement).type).toBe("text");
  });

  it("tabs from the field to the button to the next control", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <Input type="password" aria-label="Password" />
        <button type="submit">Sign in</button>
      </form>,
    );
    await user.click(screen.getByLabelText("Password"));
    await user.tab();
    expect(toggleOf()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveFocus();
  });

  it("toggles with Space and Enter without submitting the form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Input type="password" aria-label="Password" />
        <button type="submit">Sign in</button>
      </form>,
    );
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    await user.click(input);
    await user.tab();
    await user.keyboard(" ");
    expect(input.type).toBe("text");
    await user.keyboard("{Enter}");
    expect(input.type).toBe("password");
    expect(toggleOf()).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits once on Enter in the field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Input type="password" aria-label="Password" />
        <button type="submit">Sign in</button>
      </form>,
    );
    await user.type(screen.getByLabelText("Password"), "x{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("puts the type back before the form's submit handler runs", async () => {
    const user = userEvent.setup();
    let typeSeenBySubmit = "";
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          typeSeenBySubmit = (
            event.currentTarget.elements.namedItem("password") as HTMLInputElement
          ).type;
        }}
      >
        <Input type="password" name="password" aria-label="Password" />
        <button type="submit">Sign in</button>
      </form>,
    );
    await user.click(toggleOf());
    expect((screen.getByLabelText("Password") as HTMLInputElement).type).toBe("text");

    await user.type(screen.getByLabelText("Password"), "x{Enter}");

    expect(typeSeenBySubmit).toBe("password");
    expect(toggleOf()).toHaveAttribute("aria-pressed", "false");
  });

  it("hides when the page is left and when the form is reset", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <Input type="password" aria-label="Password" />
      </form>,
    );
    const input = screen.getByLabelText("Password") as HTMLInputElement;

    await user.click(toggleOf());
    expect(input.type).toBe("text");
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(input.type).toBe("password");
    expect(toggleOf()).toHaveAttribute("aria-pressed", "false");

    await user.click(toggleOf());
    expect(input.type).toBe("text");
    act(() => {
      input.form!.dispatchEvent(new Event("reset", { bubbles: true }));
    });
    expect(input.type).toBe("password");
  });

  it("keeps the button but disables it, and hides the text, when the field is disabled", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Input type="password" aria-label="Password" />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    await user.click(toggleOf());
    expect(input.type).toBe("text");

    rerender(<Input type="password" aria-label="Password" disabled />);
    expect(screen.getByLabelText("Password")).toBe(input);
    expect(input.type).toBe("password");
    expect(toggleOf()).toBeDisabled();

    // Re-enabling must not reveal the secret again.
    rerender(<Input type="password" aria-label="Password" />);
    expect(input.type).toBe("password");
    expect(toggleOf()).toHaveAttribute("aria-pressed", "false");
  });

  it("still reveals a read-only field", async () => {
    const user = userEvent.setup();
    render(<Input type="password" aria-label="Generated" readOnly defaultValue="s3cret" />);
    await user.click(toggleOf());
    expect((screen.getByLabelText("Generated") as HTMLInputElement).type).toBe("text");
  });

  it("can be controlled with revealed and onRevealedChange", async () => {
    const user = userEvent.setup();
    const onRevealedChange = vi.fn();
    const { rerender } = render(
      <Input
        type="password"
        aria-label="Password"
        revealed={false}
        onRevealedChange={onRevealedChange}
      />,
    );
    await user.click(toggleOf());
    expect(onRevealedChange).toHaveBeenCalledWith(true);
    // Controlled: nothing changes until the parent says so.
    expect((screen.getByLabelText("Password") as HTMLInputElement).type).toBe("password");

    rerender(
      <Input type="password" aria-label="Password" revealed onRevealedChange={onRevealedChange} />,
    );
    expect((screen.getByLabelText("Password") as HTMLInputElement).type).toBe("text");
  });

  it("shares one reveal state across fields", async () => {
    const user = userEvent.setup();
    const Shared = () => {
      const [revealed, setRevealed] = React.useState(false);
      return (
        <>
          <Input
            type="password"
            aria-label="New"
            autoComplete="new-password"
            revealed={revealed}
            onRevealedChange={setRevealed}
          />
          <Input
            type="password"
            aria-label="Confirm"
            autoComplete="new-password"
            revealed={revealed}
            onRevealedChange={setRevealed}
          />
        </>
      );
    };
    render(<Shared />);
    await user.click(screen.getAllByRole("button", { name: "Show password" })[0]);
    expect((screen.getByLabelText("New") as HTMLInputElement).type).toBe("text");
    expect((screen.getByLabelText("Confirm") as HTMLInputElement).type).toBe("text");
  });

  it("forwards the ref to the input and puts layout classes on the wrapper", () => {
    const ref = React.createRef<HTMLInputElement>();
    const { container } = render(
      <Input
        ref={ref}
        type="password"
        aria-label="Password"
        className="w-40 text-lg"
        containerClassName="max-w-sm"
      />,
    );
    expect(ref.current).toBe(screen.getByLabelText("Password"));
    const wrapper = container.firstElementChild!;
    expect(wrapper).toHaveAttribute("data-slot", "password-input");
    // The wrapper is what the parent lays out, so the width goes there and the button stays with the field.
    expect(wrapper).toHaveClass("w-40", "max-w-sm");
    expect(wrapper).not.toHaveClass("w-full");
    expect(ref.current).not.toHaveClass("w-40");
    expect(ref.current).toHaveClass("w-full", "text-lg");
  });

  it("keeps the classes that style the control, and breakpoint-only ones for the wrapper", () => {
    const { container } = render(
      <Input
        type="password"
        aria-label="Password"
        autoComplete="current-password"
        className="md:w-60 flex-1 mt-2 hover:w-80 focus:ring-4 font-mono [&>svg]:w-3"
      />,
    );
    const wrapper = container.firstElementChild!;
    expect(wrapper).toHaveClass("md:w-60", "flex-1", "mt-2");
    const input = screen.getByLabelText("Password");
    expect(input).toHaveClass("hover:w-80", "focus:ring-4", "font-mono", "[&>svg]:w-3");
    expect(input).not.toHaveClass("md:w-60");
  });
});

describe("splitLayoutClasses", () => {
  it("moves what sizes or places the element and leaves what styles it", () => {
    expect(
      splitLayoutClasses(
        "w-40 max-w-xs min-w-0 flex-1 grow shrink-0 basis-1/2 col-span-2 self-end order-1 -mt-2 mx-auto !w-full",
      ),
    ).toEqual({
      layout:
        "w-40 max-w-xs min-w-0 flex-1 grow shrink-0 basis-1/2 col-span-2 self-end order-1 -mt-2 mx-auto !w-full",
      rest: "",
    });
    expect(
      splitLayoutClasses("text-lg font-mono h-12 flex flex-row rounded-none px-2 min-h-9"),
    ).toEqual({
      layout: "",
      rest: "text-lg font-mono h-12 flex flex-row rounded-none px-2 min-h-9",
    });
  });

  it("moves breakpoint variants and keeps state and arbitrary variants", () => {
    expect(
      splitLayoutClasses(
        "sm:w-40 md:max-w-sm @lg:flex-1 hover:w-20 focus:mt-2 aria-invalid:w-8 [&>svg]:w-3 w-[12rem]",
      ),
    ).toEqual({
      layout: "sm:w-40 md:max-w-sm @lg:flex-1 w-[12rem]",
      rest: "hover:w-20 focus:mt-2 aria-invalid:w-8 [&>svg]:w-3",
    });
  });

  it("handles no class list", () => {
    expect(splitLayoutClasses(undefined)).toEqual({ layout: "", rest: "" });
    expect(splitLayoutClasses("  ")).toEqual({ layout: "", rest: "" });
  });
});

describe("Input password toggle, more", () => {
  it("does not reset a reveal state shared with a field that is disabled from the start", async () => {
    const user = userEvent.setup();
    const onRevealedChange = vi.fn();
    const Shared = () => {
      const [revealed, setRevealed] = React.useState(false);
      return (
        <>
          <Input
            type="password"
            aria-label="New"
            autoComplete="new-password"
            revealed={revealed}
            onRevealedChange={(next) => {
              onRevealedChange(next);
              setRevealed(next);
            }}
          />
          <Input
            type="password"
            aria-label="Confirm"
            autoComplete="new-password"
            disabled
            revealed={revealed}
            onRevealedChange={(next) => {
              onRevealedChange(next);
              setRevealed(next);
            }}
          />
        </>
      );
    };
    render(<Shared />);

    await user.click(screen.getAllByRole("button", { name: "Show password" })[0]);

    expect((screen.getByLabelText("New") as HTMLInputElement).type).toBe("text");
    expect(onRevealedChange).toHaveBeenCalledTimes(1);
    expect(onRevealedChange).toHaveBeenCalledWith(true);
    // Its own text stays hidden: a disabled field never shows its secret.
    expect((screen.getByLabelText("Confirm") as HTMLInputElement).type).toBe("password");
  });

  it("keeps the same input, its text and its focus when the caller flips type itself", async () => {
    const user = userEvent.setup();
    const Flip = () => {
      const [show, setShow] = React.useState(false);
      return (
        <>
          <Input
            type={show ? "text" : "password"}
            passwordToggle={false}
            autoComplete="current-password"
            aria-label="Secret"
          />
          <button type="button" onClick={() => setShow((value) => !value)}>
            flip
          </button>
        </>
      );
    };
    render(<Flip />);
    const before = screen.getByLabelText("Secret");
    await user.type(before, "hunter2");

    await user.click(screen.getByRole("button", { name: "flip" }));

    const after = screen.getByLabelText("Secret") as HTMLInputElement;
    expect(after).toBe(before);
    expect(after.type).toBe("text");
    expect(after.value).toBe("hunter2");
  });

  it("does not remount the input either when the built-in toggle is left on and type is flipped", async () => {
    const user = userEvent.setup();
    const Flip = () => {
      const [show, setShow] = React.useState(false);
      return (
        <>
          <Input
            type={show ? "text" : "password"}
            autoComplete="current-password"
            aria-label="Secret"
          />
          <button type="button" onClick={() => setShow((value) => !value)}>
            flip
          </button>
        </>
      );
    };
    render(<Flip />);
    const before = screen.getByLabelText("Secret");
    await user.type(before, "hunter2");
    expect(screen.getAllByRole("button", { name: "Show password" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "flip" }));

    // It is the caller's type now, so the input is text; the node and its text survive the flip.
    const after = screen.getByLabelText("Secret") as HTMLInputElement;
    expect(after).toBe(before);
    expect(after.type).toBe("text");
    expect(after.value).toBe("hunter2");
    expect(screen.queryByRole("button", { name: "Show password" })).toBeNull();
  });
});

describe("Input credential attributes", () => {
  it("passes current-password through and leaves out autocomplete=off and data-1p-ignore", () => {
    render(<Input type="password" aria-label="Password" autoComplete="current-password" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("autocomplete", "current-password");
    expect(input).not.toHaveAttribute("data-1p-ignore");
  });

  it("warns, and renders no autocomplete attribute, for a password with no token", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<Input type="password" aria-label="Password" />);
    const input = screen.getByLabelText("Password");
    expect(input).not.toHaveAttribute("autocomplete");
    expect(input).not.toHaveAttribute("data-1p-ignore");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("autoComplete"));
  });

  it("does not warn when the token is there", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<Input type="password" aria-label="Password" autoComplete="new-password" />);
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps spellcheck, capitalisation and autocorrect off, even while revealed", async () => {
    const user = userEvent.setup();
    render(<Input type="password" aria-label="Password" autoComplete="current-password" />);
    const input = screen.getByLabelText("Password");
    const expectVerbatim = () => {
      expect(input).toHaveAttribute("spellcheck", "false");
      expect(input).toHaveAttribute("autocapitalize", "none");
      expect(input).toHaveAttribute("autocorrect", "off");
    };
    expectVerbatim();
    await user.click(toggleOf());
    expect((input as HTMLInputElement).type).toBe("text");
    expectVerbatim();
  });

  it("hides Edge's own reveal control", () => {
    render(<Input type="password" aria-label="Password" autoComplete="current-password" />);
    expect(screen.getByLabelText("Password").className).toContain("[&::-ms-reveal]:hidden");

    render(<Input type="password" aria-label="PIN" autoComplete="off" passwordToggle={false} />);
    expect(screen.getByLabelText("PIN").className).toContain("[&::-ms-reveal]:hidden");
  });

  it("makes a username field verbatim and visible to password managers", () => {
    render(<Input aria-label="Username" name="username" autoComplete="username" />);
    const input = screen.getByLabelText("Username");
    expect(input).toHaveAttribute("autocomplete", "username");
    expect(input).not.toHaveAttribute("data-1p-ignore");
    expect(input).toHaveAttribute("spellcheck", "false");
    expect(input).toHaveAttribute("autocapitalize", "none");
    expect(input).toHaveAttribute("autocorrect", "off");
  });

  it("forwards the mobile-keyboard attributes untouched", () => {
    render(
      <Input
        aria-label="Code"
        autoComplete="one-time-code"
        inputMode="numeric"
        enterKeyHint="go"
        pattern="[0-9]*"
        maxLength={6}
        name="code"
      />,
    );
    const input = screen.getByLabelText("Code");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("enterkeyhint", "go");
    expect(input).toHaveAttribute("pattern", "[0-9]*");
    expect(input).toHaveAttribute("name", "code");
  });

  it("derives the numeric keyboard for one-time-code and the email keyboard for email", () => {
    render(
      <>
        <Input aria-label="Code" autoComplete="one-time-code" />
        <Input aria-label="Mail" type="email" autoComplete="email" />
      </>,
    );
    expect(screen.getByLabelText("Code")).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByLabelText("Mail")).toHaveAttribute("inputmode", "email");
  });

  it("verbatim turns the three attributes on for a plain field", () => {
    render(<Input aria-label="Reference" verbatim />);
    const input = screen.getByLabelText("Reference");
    expect(input).toHaveAttribute("spellcheck", "false");
    expect(input).toHaveAttribute("autocapitalize", "none");
    expect(input).toHaveAttribute("autocorrect", "off");
  });
});

describe("Input back-compat", () => {
  it("keeps autocomplete=off and data-1p-ignore on a plain text input", () => {
    render(<Input aria-label="Name" />);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("data-1p-ignore", "true");
    expect(input).not.toHaveAttribute("spellcheck");
  });

  it("treats autoComplete={undefined} as the default rather than removing the attribute", () => {
    render(<Input aria-label="Name" autoComplete={undefined} />);
    expect(screen.getByLabelText("Name")).toHaveAttribute("autocomplete", "off");
  });

  it("lets an explicit token replace the default", () => {
    render(<Input aria-label="Phone" autoComplete="tel" />);
    const input = screen.getByLabelText("Phone");
    expect(input).toHaveAttribute("autocomplete", "tel");
    expect(input).not.toHaveAttribute("data-1p-ignore");
  });

  it("renders a bare input, with no wrapper, for text", () => {
    const { container } = render(<Input aria-label="Name" />);
    expect(container.firstElementChild?.tagName).toBe("INPUT");
  });

  it("still forwards ordinary events", () => {
    const onChange = vi.fn();
    render(<Input aria-label="Name" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "a" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
