import { render, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { NumberInput } from "../src/components/NumberInput";
import { Field } from "../src/components/ui/field";

describe("NumberInput", () => {
  it("renders initial value formatted", () => {
    const { container } = render(<NumberInput value={1234.5} />);
    const input = container.querySelector("input")!;
    expect(input).not.toBeNull();
    expect(input.value).toContain("1,234.5");
  });

  it("formats bytes correctly when isBytesFormat is true", () => {
    const { container } = render(<NumberInput value={1048576} isBytesFormat={true} />);
    const input = container.querySelector("input")!;
    expect(input.value).toBe("1.00 MB");
  });

  it("calls onChange with updated numeric value", () => {
    const handleChange = vi.fn();
    const { container } = render(<NumberInput value={10} onChange={handleChange} />);
    const input = container.querySelector("input")!;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "25" } });
    fireEvent.blur(input);
    expect(handleChange).toHaveBeenCalledWith(25);
  });
});

describe("NumberInput stepping", () => {
  it("steps with the arrow keys", async () => {
    const onChange = vi.fn();
    const { container } = render(<NumberInput value={5} onChange={onChange} />);
    const input = container.querySelector<HTMLInputElement>("input[type=text]")!;
    input.focus();
    await userEvent.setup().keyboard("{ArrowUp}");
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("does not step a read-only field with the keys or the wheel", async () => {
    const onChange = vi.fn();
    const { container } = render(<NumberInput value={5} readOnly onChange={onChange} />);
    const input = container.querySelector<HTMLInputElement>("input[type=text]")!;
    input.focus();
    const user = userEvent.setup();
    await user.keyboard("{ArrowUp}{ArrowDown}");
    fireEvent.wheel(input, { deltaY: -100 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not step a disabled field, whether it or the Field around it is disabled", () => {
    const onChange = vi.fn();
    const { container } = render(
      <>
        <NumberInput value={5} disabled onChange={onChange} aria-label="Own" />
        <Field label="Inherited" disabled>
          <NumberInput value={5} onChange={onChange} />
        </Field>
      </>,
    );
    for (const input of container.querySelectorAll<HTMLInputElement>("input[type=text]")) {
      expect(input.disabled).toBe(true);
      fireEvent.keyDown(input, { key: "ArrowUp" });
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it("runs the caller's onKeyDown and still steps", async () => {
    const onChange = vi.fn();
    const onKeyDown = vi.fn();
    const { container } = render(
      <NumberInput value={5} onChange={onChange} onKeyDown={onKeyDown} />,
    );
    const input = container.querySelector<HTMLInputElement>("input[type=text]")!;
    input.focus();
    await userEvent.setup().keyboard("{ArrowUp}");
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("lets the caller's onKeyDown keep a key for itself with preventDefault", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <NumberInput
        value={5}
        onChange={onChange}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") event.preventDefault();
        }}
      />,
    );
    const input = container.querySelector<HTMLInputElement>("input[type=text]")!;
    input.focus();
    const user = userEvent.setup();
    await user.keyboard("{ArrowUp}");
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("runs the caller's onWheel and still steps a focused field", () => {
    const onChange = vi.fn();
    const onWheel = vi.fn();
    const { container } = render(<NumberInput value={5} onChange={onChange} onWheel={onWheel} />);
    const input = container.querySelector<HTMLInputElement>("input[type=text]")!;
    fireEvent.focus(input);
    fireEvent.wheel(input, { deltaY: -100 });
    expect(onWheel).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(6);
  });
});

describe("NumberInput and forms", () => {
  it("submits the number under its name, not the text it shows", () => {
    const { container } = render(
      <form>
        <NumberInput name="amount" value={1234.5} />
      </form>,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    expect(container.querySelector<HTMLInputElement>("input[type=text]")!.value).toBe("1,234.5");
    expect(new FormData(form).get("amount")).toBe("1234.5");
  });

  it("leaves a disabled number out of the form", () => {
    const { container } = render(
      <form>
        <NumberInput name="amount" value={3} disabled />
      </form>,
    );
    expect(new FormData(container.querySelector("form") as HTMLFormElement).has("amount")).toBe(
      false,
    );
  });
});
