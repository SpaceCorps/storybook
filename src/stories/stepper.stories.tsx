import type { Meta, StoryObj } from "@storybook/react";
import {
  Stepper,
  StepperItem,
  StepperTrigger,
  StepperIndicator,
  StepperTitle,
  StepperDescription,
  StepperSeparator,
} from "@/components/ui/stepper";

const meta: Meta = {
  title: "UI/Stepper",
};

export default meta;

export const Default: StoryObj = {
  render: () => (
    <div className="w-[600px]">
      <Stepper defaultValue={1}>
        <StepperItem step={1}>
          <StepperTrigger>
            <StepperIndicator />
            <div className="flex flex-col text-left">
              <StepperTitle>Account</StepperTitle>
              <StepperDescription>Setup credentials</StepperDescription>
            </div>
          </StepperTrigger>
          <StepperSeparator />
        </StepperItem>
        <StepperItem step={2}>
          <StepperTrigger>
            <StepperIndicator />
            <div className="flex flex-col text-left">
              <StepperTitle>Personal</StepperTitle>
              <StepperDescription>Add personal info</StepperDescription>
            </div>
          </StepperTrigger>
          <StepperSeparator />
        </StepperItem>
        <StepperItem step={3}>
          <StepperTrigger>
            <StepperIndicator />
            <div className="flex flex-col text-left">
              <StepperTitle>Confirm</StepperTitle>
              <StepperDescription>Review details</StepperDescription>
            </div>
          </StepperTrigger>
        </StepperItem>
      </Stepper>
    </div>
  ),
};

export const AsChildLinks: StoryObj = {
  parameters: {
    // New story: no baseline image yet.
    visual: { disable: true },
  },
  render: () => (
    <div className="w-[600px]">
      <Stepper defaultValue={2}>
        {[
          { step: 1, title: "Cart", href: "#cart" },
          { step: 2, title: "Shipping", href: "#shipping" },
          { step: 3, title: "Payment", href: "#payment" },
        ].map(({ step, title, href }) => (
          <StepperItem key={step} step={step}>
            <StepperTrigger asChild>
              <a href={href} className="inline-flex items-center gap-3">
                <StepperIndicator />
                <StepperTitle>{title}</StepperTitle>
              </a>
            </StepperTrigger>
            {step < 3 && <StepperSeparator />}
          </StepperItem>
        ))}
      </Stepper>
    </div>
  ),
};

/** A disabled step used as a link looks unavailable and is skipped by Tab, like a disabled button. */
export const AsChildDisabledStep: StoryObj = {
  parameters: {
    // New story: no baseline image yet.
    visual: { disable: true },
  },
  render: () => (
    <div className="w-[600px]">
      <Stepper defaultValue={1}>
        {[
          { step: 1, title: "Cart", href: "#cart" },
          { step: 2, title: "Shipping", href: "#shipping" },
          { step: 3, title: "Payment", href: "#payment" },
        ].map(({ step, title, href }) => (
          <StepperItem key={step} step={step} disabled={step === 3}>
            <StepperTrigger asChild>
              <a href={href} className="inline-flex items-center gap-3">
                <StepperIndicator />
                <StepperTitle>{title}</StepperTitle>
              </a>
            </StepperTrigger>
            {step < 3 && <StepperSeparator />}
          </StepperItem>
        ))}
      </Stepper>
    </div>
  ),
};
