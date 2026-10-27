import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

const SoftForm = () => {
  const [name, setName] = React.useState("");
  const [sent, setSent] = React.useState("Nothing sent yet.");
  return (
    <form
      className="flex w-[360px] flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setSent(`Sent ${name}.`);
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="soft-name">Name</Label>
        <Input id="soft-name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={name.trim() === ""}
          focusableWhenDisabled
          disabledReason="Enter a name first"
        >
          Send
        </Button>
        <Button type="button" variant="outline" disabled>
          Native disabled
        </Button>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {sent}
      </p>
    </form>
  );
};

/**
 * A disabled button the keyboard can still find. "Send" stays in the Tab order while the field is
 * empty, announces why it is unavailable, and ignores click, Enter, Space and Enter in the field.
 * "Native disabled" is the unchanged default: skipped by Tab, unreachable.
 */
export const FocusableWhenDisabled: Story = {
  // The disabled look is the Disabled story's; this one is about reaching the button.
  parameters: { visual: { disable: true }, keyboard: { sweep: true, forcedColors: true } },
  render: () => <SoftForm />,
};

/** Every variant soft-disabled, live twin above, on both themes' surfaces: the same look as `disabled`. */
export const FocusableWhenDisabledBothThemes: Story = {
  // The surfaces are the DisabledBothThemes story's; a baseline for this one cannot be made here.
  parameters: { visual: { disable: true } },
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
                {theme} {disabled ? "soft" : "live"}
              </span>
              {DISABLED_VARIANTS.map((variant) => (
                <Button
                  key={variant}
                  variant={variant}
                  disabled={disabled}
                  focusableWhenDisabled
                  disabledReason="Not available yet"
                >
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

/**
 * The icon button's soft-disabled form: focusable, and its tooltip carries the reason on focus. Save
 * is an ordinary icon button beside it, for comparing the two focus rings.
 */
export const IconButtonFocusableWhenDisabled: Story = {
  // Needs a hover or focus to show the tooltip, so there is nothing static to compare.
  parameters: { visual: { disable: true }, keyboard: { sweep: true, forcedColors: true } },
  render: () => (
    <div className="flex items-center gap-3">
      <IconButton label="Delete" disabled focusableWhenDisabled disabledReason="Select a row first">
        <span aria-hidden="true">x</span>
      </IconButton>
      <IconButton label="Archive" disabled>
        <span aria-hidden="true">a</span>
      </IconButton>
      <IconButton label="Save">
        <span aria-hidden="true">s</span>
      </IconButton>
    </div>
  ),
};
