import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { StarRating } from "@/components/StarRating";
import { Densities } from "@/types/density";

const meta: Meta<typeof StarRating> = {
  title: "Domain/StarRating",
  component: StarRating,
  tags: ["autodocs"],
  argTypes: {
    value: { control: "number" },
    disabled: { control: "boolean" },
    density: {
      control: "select",
      options: [Densities.Small, Densities.Medium, Densities.Large],
    },
  },
};

export default meta;
type Story = StoryObj<typeof StarRating>;

export const Default: Story = {
  args: {
    value: 3.5,
  },
};

/** Nothing rated yet: the empty stars are an outline you can see, not a pale fill. */
export const Unrated: Story = {
  parameters: {
    // New story: no baseline image yet.
    visual: { disable: true },
  },
  args: {
    value: 0,
  },
};

function HalfStarsDemo() {
  const [value, setValue] = useState(3.5);
  return (
    <div className="flex flex-col gap-2">
      <StarRating allowHalf value={value} onRate={setValue} aria-label="Service quality" />
      <p className="text-sm text-muted-foreground">
        Rated {value} out of 5. Tab to the rating, then use the arrow keys (half a star), Page Up
        and Page Down (a whole star), Home (clear) and End.
      </p>
    </div>
  );
}

/** With half stars the rating is one slider: every value is reachable from the keyboard. */
export const HalfStars: Story = {
  parameters: {
    // New story: no baseline image yet.
    visual: { disable: true },
  },
  render: () => <HalfStarsDemo />,
};
