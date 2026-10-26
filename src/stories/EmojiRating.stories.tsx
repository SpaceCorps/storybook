import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { EmojiRating } from "@/components/EmojiRating";
import { Densities } from "@/types/density";

const meta: Meta<typeof EmojiRating> = {
  title: "Domain/EmojiRating",
  component: EmojiRating,
  tags: ["autodocs"],
  argTypes: {
    value: { control: "number" },
    totalEmojis: { control: "number" },
    allowHalf: { control: "boolean" },
    disabled: { control: "boolean" },
    density: {
      control: "select",
      options: [Densities.Small, Densities.Medium, Densities.Large],
    },
  },
};

export default meta;
type Story = StoryObj<typeof EmojiRating>;

export const Default: Story = {
  args: {
    value: 4,
    allowHalf: true,
  },
};

/** Nothing rated yet: the faces not reached are grey and circled, not only dimmed. */
export const Unrated: Story = {
  parameters: {
    // New story: no baseline image yet.
    visual: { disable: true },
  },
  args: {
    value: 0,
  },
};

function WholeFacesDemo() {
  const [value, setValue] = useState(2);
  return <EmojiRating value={value} onRate={setValue} aria-label="How was it?" />;
}

/** Without half values each face is its own button. */
export const WholeFaces: Story = {
  parameters: {
    // New story: no baseline image yet.
    visual: { disable: true },
  },
  render: () => <WholeFacesDemo />,
};

function HalfFacesDemo() {
  const [value, setValue] = useState(3.5);
  return (
    <div className="flex flex-col gap-2">
      <EmojiRating allowHalf value={value} onRate={setValue} aria-label="How was it?" />
      <p className="text-sm text-muted-foreground">
        Rated {value} out of 5. Tab to the rating, then use the arrow keys (half a step), Page Up
        and Page Down (a whole step), Home (clear) and End.
      </p>
    </div>
  );
}

/** With half values the rating is one slider: every value is reachable from the keyboard. */
export const HalfFaces: Story = {
  parameters: {
    // New story: no baseline image yet.
    visual: { disable: true },
  },
  render: () => <HalfFacesDemo />,
};
