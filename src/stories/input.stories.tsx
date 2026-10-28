import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
};

export default meta;

export const Default: StoryObj<typeof Input> = {
  render: () => (
    <div className="flex flex-col gap-4 w-[350px]">
      <Input placeholder="Default Input" />
      <Input placeholder="Disabled Input" disabled />
      <Input type="email" placeholder="Email" autoComplete="email" />
      <Input type="password" placeholder="Password" autoComplete="current-password" />
    </div>
  ),
};

/**
 * A `type="password"` input gets a show/hide button. It keeps focus in the field when clicked, swaps
 * the type on the same element (so a password manager keeps tracking it) and turns itself off before
 * the form submits.
 */
export const Password: StoryObj<typeof Input> = {
  render: () => (
    <form className="flex w-[350px] flex-col gap-2" onSubmit={(event) => event.preventDefault()}>
      <Label htmlFor="story-password">Password</Label>
      <Input
        id="story-password"
        name="password"
        type="password"
        autoComplete="current-password"
        defaultValue="correct horse battery staple"
      />
    </form>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Password") as HTMLInputElement;
    const toggle = canvas.getByRole("button", { name: "Show password" });

    await userEvent.click(input);
    input.setSelectionRange(3, 8);
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(toggle);
    await expect(input.type).toBe("text");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    // The click did not take focus off the field, and the selection survived the type change.
    await expect(input).toHaveFocus();
    await expect([input.selectionStart, input.selectionEnd]).toEqual([3, 8]);
    await expect(canvas.getByLabelText("Password")).toBe(input);

    await userEvent.click(toggle);
    await expect(input.type).toBe("password");
  },
};

const DensitiesDemo = () => (
  <div className="flex w-[350px] flex-col gap-4">
    {(["Small", "Medium", "Large"] as const).map((density) => (
      <Input
        key={density}
        density={density}
        type="password"
        aria-label={`${density} password`}
        autoComplete="current-password"
        defaultValue="hunter2"
      />
    ))}
  </div>
);

/** The button and the room it needs scale with the field. */
export const PasswordDensities: StoryObj<typeof Input> = {
  render: () => <DensitiesDemo />,
};

/** Disabled keeps the (dimmed) button so the field does not remount; read-only still reveals. */
export const PasswordStates: StoryObj<typeof Input> = {
  render: () => (
    <div className="flex w-[350px] flex-col gap-4">
      <Input
        type="password"
        aria-label="Disabled password"
        autoComplete="current-password"
        defaultValue="hunter2"
        disabled
      />
      <Input
        type="password"
        aria-label="Read-only password"
        autoComplete="new-password"
        defaultValue="generated-secret-9f2c"
        readOnly
      />
      <Input
        type="password"
        aria-label="PIN"
        autoComplete="off"
        inputMode="numeric"
        defaultValue="1234"
        passwordToggle={false}
      />
    </div>
  ),
};

/**
 * A width on the field narrows the whole control, so the show/hide button stays at the field's own
 * edge. `w-*`, `max-w-*`, `flex-*`, `col-*`, `self-*`, `order-*` and margins go to the wrapper;
 * everything else in `className` stays on the input.
 */
export const PasswordNarrow: StoryObj<typeof Input> = {
  render: () => (
    <div className="flex w-[350px] flex-col gap-4">
      <Input
        type="password"
        aria-label="Narrow password"
        className="w-40"
        autoComplete="current-password"
        defaultValue="hunter2"
      />
      <Input
        type="password"
        aria-label="Capped password"
        className="max-w-48"
        autoComplete="current-password"
        defaultValue="hunter2"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const name of ["Narrow password", "Capped password"]) {
      const input = canvas.getByLabelText(name);
      const toggle = input.parentElement!.querySelector("button")!;
      const field = input.getBoundingClientRect();
      const eye = toggle.getBoundingClientRect();
      await expect(field.width).toBeLessThan(250);
      await expect(eye.left).toBeGreaterThanOrEqual(field.left);
      await expect(eye.right).toBeLessThanOrEqual(field.right);
    }
  },
};

const SharedRevealDemo = () => {
  const [revealed, setRevealed] = React.useState(false);
  return (
    <div className="flex w-[350px] flex-col gap-4">
      <Input
        type="password"
        aria-label="New password"
        autoComplete="new-password"
        revealed={revealed}
        onRevealedChange={setRevealed}
      />
      <Input
        type="password"
        aria-label="Confirm new password"
        autoComplete="new-password"
        revealed={revealed}
        onRevealedChange={setRevealed}
      />
    </div>
  );
};

/** One `revealed` state across the fields of a sign-up or change-password form. */
export const SharedReveal: StoryObj<typeof Input> = {
  render: () => <SharedRevealDemo />,
};

/** `aria-invalid="true"` (a Field sets it from its error) turns the border and the focus ring red. */
export const Invalid: StoryObj<typeof Input> = {
  render: () => (
    <div className="flex w-[350px] flex-col gap-4">
      <Input aria-label="Organisation number" aria-invalid defaultValue="556000-01" />
      <Input
        type="password"
        aria-label="Password"
        autoComplete="new-password"
        aria-invalid
        defaultValue="short"
      />
    </div>
  ),
};

/** What the browser is told about each kind of field. Inspect the elements to see the attributes. */
export const Semantics: StoryObj<typeof Input> = {
  render: () => (
    <div className="flex w-[350px] flex-col gap-4">
      <Input aria-label="Plain text (autocomplete off, ignored by password managers)" />
      <Input aria-label="Username" name="username" autoComplete="username" placeholder="username" />
      <Input
        aria-label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="email"
      />
      <Input
        aria-label="One-time code"
        name="code"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
      />
      <Input aria-label="Verbatim code" verbatim placeholder="verbatim" />
    </div>
  ),
};
