import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const meta: Meta<typeof Checkbox> = {
  title: "UI/Checkbox",
  component: Checkbox,
};

export default meta;

export const Default: StoryObj<typeof Checkbox> = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center space-x-2">
        <Checkbox id="terms" />
        <Label htmlFor="terms">Accept terms and conditions</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="checked" defaultChecked />
        <Label htmlFor="checked">Pre-checked</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="indeterminate" nullable checked={null} />
        <Label htmlFor="indeterminate">Indeterminate</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="disabled" disabled />
        <Label htmlFor="disabled">Disabled</Label>
      </div>
    </div>
  ),
};

/** `aria-invalid` (a Field sets it from its error) turns the border and a checked fill red. */
export const Invalid: StoryObj<typeof Checkbox> = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center space-x-2">
        <Checkbox id="terms-invalid" aria-invalid />
        <Label htmlFor="terms-invalid">Accept terms and conditions</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="terms-invalid-checked" aria-invalid defaultChecked />
        <Label htmlFor="terms-invalid-checked">Accepted, but invalid</Label>
      </div>
    </div>
  ),
};
