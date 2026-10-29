import type { Meta, StoryObj } from "@storybook/react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

const sampleMarkdown = `
# Markdown Renderer

This is an **interactive demonstration** of the Ivy markdown rendering engine.

> [!NOTE]
> Helpful note callout with custom icon and border styling.

> [!WARNING]
> Important warning callout block.

## Features
- GitHub Flavored Markdown (GFM)
- Mathematical equations via KaTeX: $E = mc^2$
- Code syntax highlighting with Prism
- Tables and task lists:
  - [x] Task completed
  - [ ] Pending task

| Feature | Status | Notes |
| :--- | :---: | :--- |
| KaTeX | Supported | Inline & Block |
| Mermaid | Supported | In code fence |

\`\`\`typescript
interface User {
  id: string;
  name: string;
  roles: string[];
}

const user: User = {
  id: "u-123",
  name: "Alice",
  roles: ["admin"],
};
\`\`\`
`;

const meta: Meta<typeof MarkdownRenderer> = {
  title: "Renderers/MarkdownRenderer",
  component: MarkdownRenderer,
  tags: ["autodocs"],
  argTypes: {
    content: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof MarkdownRenderer>;

export const Default: Story = {
  args: {
    content: sampleMarkdown,
  },
};

// Storybook serves its own logo from every host it runs on, so the image needs no network. The
// renderer only passes http(s) image URLs through, which rules out a data: URI.
const sampleImageUrl = () =>
  `${typeof window === "undefined" ? "" : window.location.origin}/sb-common-assets/favicon.svg`;

const imagesAndPopoverLinks = (
  imageUrl: string,
) => `Open a picture or a hint from the keyboard: Tab to it, then press Enter or Space.

A [popover link](## "This hint opens from the keyboard too, and Escape gives focus back to the link.") sits inside a sentence.

![The Storybook logo](${imageUrl})

![](${imageUrl})
`;

export const ImagesAndPopoverLinks: Story = {
  parameters: {
    // The viewer and popover portal out of the screenshotted root.
    visual: { disable: true },
  },
  render: () => <MarkdownRenderer content={imagesAndPopoverLinks(sampleImageUrl())} />,
};
