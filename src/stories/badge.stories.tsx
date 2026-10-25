import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "@/components/ui/badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: "Badge",
    variant: "primary",
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge variant="primary">Primary</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  ),
};

const STATUS_VARIANTS = [
  "primary",
  "secondary",
  "destructive",
  "outline",
  "success",
  "warning",
  "info",
] as const;

/**
 * Every variant on the surface it sits on in each theme. The dark panel carries its own `.dark`
 * scope, so both themes can be checked at once without flipping the toolbar.
 */
export const BothThemes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(["light", "dark"] as const).map((theme) => (
        <div
          key={theme}
          className={`${theme === "dark" ? "dark " : ""}flex flex-wrap items-center gap-3 rounded-box border border-border bg-background p-4 text-foreground`}
        >
          <span className="w-12 text-xs text-muted-foreground">{theme}</span>
          {STATUS_VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      ))}
    </div>
  ),
};

/** A badge never wraps its label, even when the row around it is too narrow to hold everything. */
export const StaysOnOneLine: Story = {
  render: () => (
    <div className="flex w-56 items-center gap-2 rounded-box border border-border p-3">
      <span className="min-w-0 truncate text-sm">Consulting, October</span>
      <Badge variant="secondary">excl. VAT</Badge>
    </div>
  ),
};
