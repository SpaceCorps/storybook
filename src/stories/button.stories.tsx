import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "destructive",
        "outline",
        "secondary",
        "ghost",
        "link",
        "success",
        "warning",
        "info",
      ],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon", "icon-sm", "icon-lg"],
    },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: "Button",
    variant: "default",
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
      <Button variant="success">Success</Button>
      <Button variant="warning">Warning</Button>
      <Button variant="info">Info</Button>
    </div>
  ),
};

export const Densities: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="default">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex gap-4">
      <Button disabled>Disabled Default</Button>
      <Button variant="outline" disabled>
        Disabled Outline
      </Button>
    </div>
  ),
};

const DISABLED_VARIANTS = [
  "default",
  "secondary",
  "destructive",
  "success",
  "warning",
  "info",
  "outline",
  "ghost",
] as const;

/** Every variant, live above its disabled twin, on both themes' surfaces side by side. */
export const DisabledBothThemes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(["light", "dark"] as const).map((theme) => (
        <div
          key={theme}
          className={`${theme === "dark" ? "dark " : ""}flex flex-col gap-3 rounded-box border border-border bg-background p-4 text-foreground`}
        >
          {[false, true].map((disabled) => (
            <div key={String(disabled)} className="flex flex-wrap items-center gap-3">
              <span className="w-24 text-xs text-muted-foreground">
                {theme} {disabled ? "disabled" : "live"}
              </span>
              {DISABLED_VARIANTS.map((variant) => (
                <Button key={variant} variant={variant} disabled={disabled}>
                  {variant}
                </Button>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
};
