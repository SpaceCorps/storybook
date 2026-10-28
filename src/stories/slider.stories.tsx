import type { Meta, StoryObj } from "@storybook/react";
import { Slider } from "@/components/ui/slider";

const meta: Meta<typeof Slider> = {
  title: "UI/Slider",
  component: Slider,
};

export default meta;

export const Default: StoryObj<typeof Slider> = {
  render: () => (
    <div className="w-[300px]">
      <Slider defaultValue={[50]} max={100} step={1} aria-label="Volume slider" />
    </div>
  ),
};

export const Range: StoryObj<typeof Slider> = {
  render: () => (
    <div className="w-[300px] pt-8">
      <Slider defaultValue={[20, 80]} max={100} step={1} aria-label="Price range" />
    </div>
  ),
};

export const CurrencyWithSpokenValues: StoryObj<typeof Slider> = {
  render: () => (
    <div className="w-[300px] pt-8">
      <Slider
        defaultValue={[250, 1200]}
        max={5000}
        step={50}
        currency="USD"
        aria-label="Budget"
        thumbLabels={["Minimum budget", "Maximum budget"]}
      />
    </div>
  ),
};
