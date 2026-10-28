import type { Meta, StoryObj } from "@storybook/react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const meta: Meta<typeof RadioGroup> = {
  title: "UI/RadioGroup",
  component: RadioGroup,
};

export default meta;

export const Default: StoryObj<typeof RadioGroup> = {
  render: () => (
    <RadioGroup defaultValue="comfortable">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="default" id="r1" />
        <Label htmlFor="r1">Default</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="comfortable" id="r2" />
        <Label htmlFor="r2">Comfortable</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="compact" id="r3" />
        <Label htmlFor="r3">Compact</Label>
      </div>
    </RadioGroup>
  ),
};

/** `aria-invalid` on the group turns every item's border red. */
export const Invalid: StoryObj<typeof RadioGroup> = {
  render: () => (
    <RadioGroup aria-label="Plan" aria-invalid>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="free" id="plan-free" />
        <Label htmlFor="plan-free">Free</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="pro" id="plan-pro" />
        <Label htmlFor="plan-pro">Pro</Label>
      </div>
    </RadioGroup>
  ),
};
