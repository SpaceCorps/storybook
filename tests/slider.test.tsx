import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { Slider } from "../src/components/ui/slider";
import { formatBytes } from "../src/lib/formatters";

describe("Slider component and formatters", () => {
  it("renders with default values and slider role", () => {
    const { container } = render(<Slider defaultValue={[40]} max={100} step={1} />);
    const slider = container.querySelector('[role="slider"]');
    expect(slider).toBeDefined();
    expect(slider?.getAttribute("aria-valuenow")).toBe("40");
  });

  it("formats bytes accurately", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(1048576)).toBe("1.00 MB");
  });
});

describe("Slider thumbs and names", () => {
  const thumbs = () => screen.getAllByRole("slider");

  it("renders one named thumb for a single value, defaulting to 'Slider'", () => {
    render(<Slider defaultValue={[30]} />);
    expect(thumbs()).toHaveLength(1);
    expect(screen.getByRole("slider", { name: "Slider" })).toBeDefined();
  });

  it("names the thumb from aria-label and keeps the label off the plain root span", () => {
    const { container } = render(<Slider defaultValue={[30]} aria-label="Volume" />);
    expect(screen.getByRole("slider", { name: "Volume" })).toBeDefined();
    const root = container.firstElementChild as HTMLElement;
    expect(root.hasAttribute("aria-label")).toBe(false);
    expect(root.hasAttribute("role")).toBe(false);
  });

  it("renders one thumb per value and names the ends of a range apart", () => {
    render(<Slider defaultValue={[20, 80]} aria-label="Price" />);
    expect(thumbs()).toHaveLength(2);
    expect(
      screen.getByRole("slider", { name: "Price minimum" }).getAttribute("aria-valuenow"),
    ).toBe("20");
    expect(
      screen.getByRole("slider", { name: "Price maximum" }).getAttribute("aria-valuenow"),
    ).toBe("80");
  });

  it("groups a range under the slider's own label", () => {
    render(<Slider defaultValue={[20, 80]} aria-label="Price" />);
    expect(screen.getByRole("group", { name: "Price" })).toBeDefined();
  });

  it("numbers the thumbs of a slider with more than two values", () => {
    render(<Slider defaultValue={[10, 40, 70]} aria-label="Split" />);
    expect(screen.getByRole("slider", { name: "Split 2 of 3" })).toBeDefined();
  });

  it("lets thumbLabels name each thumb", () => {
    render(<Slider defaultValue={[20, 80]} thumbLabels={["From", "To"]} />);
    expect(screen.getByRole("slider", { name: "From" })).toBeDefined();
    expect(screen.getByRole("slider", { name: "To" })).toBeDefined();
  });

  it("names a thumb from aria-labelledby, and a range thumb from it plus its own suffix", () => {
    render(
      <>
        <span id="lbl">Budget</span>
        <Slider defaultValue={[50]} aria-labelledby="lbl" />
        <Slider defaultValue={[10, 90]} aria-labelledby="lbl" />
      </>,
    );
    expect(screen.getByRole("slider", { name: "Budget" })).toBeDefined();
    expect(screen.getByRole("slider", { name: "Budget minimum" })).toBeDefined();
    expect(screen.getByRole("slider", { name: "Budget maximum" })).toBeDefined();
  });
});

describe("Slider value text", () => {
  it("leaves aria-valuetext unset for a plain number", () => {
    render(<Slider defaultValue={[40]} />);
    expect(screen.getByRole("slider").hasAttribute("aria-valuetext")).toBe(false);
  });

  it("speaks currency values with their symbol", () => {
    render(<Slider defaultValue={[1250]} max={5000} currency="USD" />);
    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toBe("$1,250");
  });

  it("speaks byte values with their unit", () => {
    render(<Slider defaultValue={[1048576]} max={4194304} isBytesFormat />);
    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toBe("1.00 MB");
  });

  it("lets getValueText speak any value, per thumb", () => {
    render(
      <Slider
        defaultValue={[2, 8]}
        max={10}
        getValueText={(value, index) => `${value} hours ${index === 0 ? "from" : "to"}`}
      />,
    );
    const [first, second] = screen.getAllByRole("slider");
    expect(first.getAttribute("aria-valuetext")).toBe("2 hours from");
    expect(second.getAttribute("aria-valuetext")).toBe("8 hours to");
  });
});

describe("Slider keyboard", () => {
  it("moves only the focused thumb of a range and keeps the tooltips in step", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Slider defaultValue={[20, 80]} aria-label="Price" onValueChange={onValueChange} />);

    const maximum = screen.getByRole("slider", { name: "Price maximum" });
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(maximum);

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(maximum.getAttribute("aria-valuenow")).toBe("78");
    expect(
      screen.getByRole("slider", { name: "Price minimum" }).getAttribute("aria-valuenow"),
    ).toBe("20");
    expect(onValueChange).toHaveBeenLastCalledWith([20, 78]);
    // The tooltip above the thumb tracks the live value of an uncontrolled slider.
    expect(maximum.textContent).toBe("78");
  });

  it("reaches both thumbs of a range with Tab", async () => {
    const user = userEvent.setup();
    render(<Slider defaultValue={[20, 80]} aria-label="Price" />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("slider", { name: "Price minimum" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("slider", { name: "Price maximum" }));
  });

  it("follows a controlled value", () => {
    const { rerender } = render(<Slider value={[10]} aria-label="Level" />);
    expect(screen.getByRole("slider").textContent).toBe("10");
    rerender(<Slider value={[60]} aria-label="Level" />);
    expect(screen.getByRole("slider").textContent).toBe("60");
  });
});
