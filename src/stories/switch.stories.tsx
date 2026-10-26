import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const meta: Meta<typeof Switch> = {
  title: "UI/Switch",
  component: Switch,
};

export default meta;

export const Default: StoryObj<typeof Switch> = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Switch id="airplane-mode" />
      <Label htmlFor="airplane-mode">Airplane Mode</Label>
    </div>
  ),
};

/** `aria-invalid` outlines the track in red; checked, the fill turns red too. */
export const Invalid: StoryObj<typeof Switch> = {
  parameters: {
    // New story: no baseline image yet.
    visual: { disable: true },
  },
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center space-x-2">
        <Switch id="consent-invalid" aria-invalid />
        <Label htmlFor="consent-invalid">Send reminders</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Switch id="consent-invalid-checked" aria-invalid defaultChecked />
        <Label htmlFor="consent-invalid-checked">Send reminders (on)</Label>
      </div>
    </div>
  ),
};
