"use client";

import { cn } from "@/lib/utils";
import { LoaderCircle } from "lucide-react";
import * as React from "react";
import { createContext, useContext } from "react";
import { Slot } from "@radix-ui/react-slot";
import { Check } from "lucide-react";

// Types
type StepperContextValue = {
  activeStep: number;
  setActiveStep: (step: number) => void;
  orientation: "horizontal" | "vertical";
};

type StepItemContextValue = {
  step: number;
  state: StepState;
  isDisabled: boolean;
  isLoading: boolean;
  /** The element that says, for assistive technology, how far along this step is. */
  stateDescriptionId: string;
  /** What it says: empty for the active step, which has aria-current. */
  stateDescription: string;
};

type StepState = "active" | "completed" | "inactive" | "loading";

/** What the control of a step in each state is described as. The active step says it with aria-current. */
const STEP_STATE_DESCRIPTION: Record<StepState, string> = {
  completed: "Completed",
  inactive: "Upcoming",
  active: "",
  loading: "Loading",
};

const describeStep = (state: StepState, isLoading: boolean): string =>
  STEP_STATE_DESCRIPTION[isLoading ? "loading" : state];

// Contexts
const StepperContext = createContext<StepperContextValue | undefined>(undefined);
const StepItemContext = createContext<StepItemContextValue | undefined>(undefined);

const useStepper = () => {
  const context = useContext(StepperContext);
  if (!context) {
    throw new Error("useStepper must be used within a Stepper");
  }
  return context;
};

const useStepItem = () => {
  const context = useContext(StepItemContext);
  if (!context) {
    throw new Error("useStepItem must be used within a StepperItem");
  }
  return context;
};

// Components
interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: number;
  value?: number;
  onValueChange?: (value: number) => void;
  orientation?: "horizontal" | "vertical";
}

const Stepper = React.forwardRef<HTMLDivElement, StepperProps>(
  (
    { defaultValue = 0, value, onValueChange, orientation = "horizontal", className, ...props },
    ref,
  ) => {
    const [activeStep, setInternalStep] = React.useState(defaultValue);

    const setActiveStep = React.useCallback(
      (step: number) => {
        if (value === undefined) {
          setInternalStep(step);
        }
        onValueChange?.(step);
      },
      [value, onValueChange],
    );

    const currentStep = value ?? activeStep;

    return (
      <StepperContext.Provider
        value={{
          activeStep: currentStep,
          setActiveStep,
          orientation,
        }}
      >
        <div
          ref={ref}
          // The steps are a list: a screen reader says how many there are and which one this is.
          role="list"
          className={cn(
            "group/stepper inline-flex data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col",
            className,
          )}
          data-orientation={orientation}
          {...props}
        />
      </StepperContext.Provider>
    );
  },
);
Stepper.displayName = "Stepper";

// StepperItem
interface StepperItemProps extends React.HTMLAttributes<HTMLDivElement> {
  step: number;
  completed?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

const StepperItem = React.forwardRef<HTMLDivElement, StepperItemProps>(
  (
    { step, completed = false, disabled = false, loading = false, className, children, ...props },
    ref,
  ) => {
    const { activeStep } = useStepper();

    const state: StepState =
      completed || step < activeStep ? "completed" : activeStep === step ? "active" : "inactive";

    const isLoading = loading && step === activeStep;
    const stateDescriptionId = React.useId();
    const stateDescription = describeStep(state, isLoading);

    return (
      <StepItemContext.Provider
        value={{
          step,
          state,
          isDisabled: disabled,
          isLoading,
          stateDescriptionId,
          stateDescription,
        }}
      >
        <div
          ref={ref}
          role="listitem"
          className={cn(
            "group/step flex items-center group-data-[orientation=horizontal]/stepper:flex-row group-data-[orientation=vertical]/stepper:flex-col",
            className,
          )}
          data-state={state}
          {...(isLoading ? { "data-loading": true } : {})}
          {...props}
        >
          {children}
          {/* The check mark and the dimmed number are the only sighted cues for a step that is done
              or still to come, and the active step alone has aria-current. This says the rest, as
              the description of the step's control. `hidden`: it is read through aria-describedby
              and never as loose text beside it. */}
          <span id={stateDescriptionId} hidden>
            {stateDescription}
          </span>
        </div>
      </StepItemContext.Provider>
    );
  },
);
StepperItem.displayName = "StepperItem";

// StepperTrigger
/**
 * `onClick` runs first and then the step changes, unless the handler called `preventDefault()` (on
 * a button; a link or other control always moves the step, so that a client-side router can
 * `preventDefault` to navigate). Earlier versions replaced the step change with the caller's
 * handler, so a handler that relied on the step *not* moving now has to call `preventDefault()`.
 */
interface StepperTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Render the child as the control instead of a button, so a link or a router anchor keeps its
   * own element, ref and handlers and gains the step wiring. Pass exactly one element. Several
   * children (or a fragment) have no single element to become the control, so they are wrapped in
   * a `div` that acts as the button.
   */
  asChild?: boolean;
}

const StepperTrigger = React.forwardRef<HTMLButtonElement, StepperTriggerProps>(
  ({ asChild = false, className, children, ...props }, ref) => {
    const { setActiveStep } = useStepper();
    const { step, state, isDisabled, stateDescriptionId, stateDescription } = useStepItem();
    const current = state === "active" ? "step" : undefined;
    const { onClick, "aria-describedby": callerDescribedBy, ...rest } = props;
    // The caller's own description, then how far along the step is.
    const describedBy =
      [callerDescribedBy, stateDescription ? stateDescriptionId : undefined]
        .filter(Boolean)
        .join(" ") || undefined;

    if (asChild) {
      // Whatever the control turns out to be, it is not a button: the button-only attributes and
      // the button-typed handlers do not describe it.
      const { type: _type, disabled: _disabled, ...attributes } = rest;
      const elementProps = attributes as unknown as React.HTMLAttributes<HTMLElement>;
      // The control is not a button, so it cannot take `disabled`: the disabled state is expressed
      // with aria-disabled and enforced here. A link that `preventDefault`s to navigate
      // client-side must still move the step, so unlike the button below this does not honour
      // `defaultPrevented`.
      const control: React.HTMLAttributes<HTMLElement> & { "data-disabled"?: string } = {
        // Looks as unavailable as the button below does, and the same Tab policy: a disabled step is
        // not a stop. (A native `disabled` does both on a button; an anchor has neither for free.)
        className: cn("aria-disabled:pointer-events-none aria-disabled:opacity-50", className),
        // Only when disabled, so an enabled control keeps whatever tabIndex it was given.
        ...(isDisabled ? { tabIndex: -1 } : {}),
        "aria-current": current,
        "aria-describedby": describedBy,
        "aria-disabled": isDisabled || undefined,
        "data-disabled": isDisabled ? "" : undefined,
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          if (isDisabled) {
            event.preventDefault();
            return;
          }
          onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
          setActiveStep(step);
        },
      };

      if (
        React.isValidElement<{ onClick?: unknown }>(children) &&
        children.type !== React.Fragment
      ) {
        // Slot runs the child's own handler before ours, so a disabled step has to take it off the
        // child: a disabled link must not navigate.
        return (
          <Slot ref={ref} {...elementProps} {...control}>
            {isDisabled ? React.cloneElement(children, { onClick: undefined }) : children}
          </Slot>
        );
      }

      const { onKeyDown, ...divProps } = elementProps;
      return (
        <div
          ref={ref as React.Ref<HTMLDivElement>}
          role="button"
          tabIndex={isDisabled ? -1 : 0}
          {...divProps}
          {...control}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.defaultPrevented || isDisabled || event.target !== event.currentTarget)
              return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.currentTarget.click();
            }
          }}
        >
          {children}
        </div>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center gap-3 disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        disabled={isDisabled}
        aria-current={current}
        aria-describedby={describedBy}
        {...rest}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setActiveStep(step);
        }}
      >
        {children}
      </button>
    );
  },
);
StepperTrigger.displayName = "StepperTrigger";

// StepperIndicator
interface StepperIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

const StepperIndicator = React.forwardRef<HTMLDivElement, StepperIndicatorProps>(
  ({ asChild = false, className, children, ...props }, ref) => {
    const { state, step, isLoading } = useStepItem();

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground data-[state=active]:bg-primary data-[state=completed]:bg-primary data-[state=active]:text-primary-foreground data-[state=completed]:text-primary-foreground",
          className,
        )}
        data-state={state}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            <span className="transition-all group-data-[loading=true]/step:scale-0 group-data-[state=completed]/step:scale-0 group-data-[loading=true]/step:opacity-0 group-data-[state=completed]/step:opacity-0 group-data-[loading=true]/step:transition-none">
              {step}
            </span>
            <Check
              className="absolute scale-0 opacity-0 transition-all group-data-[state=completed]/step:scale-100 group-data-[state=completed]/step:opacity-100"
              size={16}
              strokeWidth={2}
              aria-hidden="true"
            />
            {isLoading && (
              <span className="absolute transition-all">
                <LoaderCircle
                  className="animate-spin"
                  size={14}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </span>
            )}
          </>
        )}
      </div>
    );
  },
);
StepperIndicator.displayName = "StepperIndicator";

// StepperTitle
const StepperTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-sm font-medium", className)} {...props}>
      {props.children}
    </h3>
  ),
);
StepperTitle.displayName = "StepperTitle";

// StepperDescription
const StepperDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
StepperDescription.displayName = "StepperDescription";

// StepperSeparator
const StepperSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "m-0.5 bg-muted group-data-[orientation=horizontal]/stepper:h-0.5 group-data-[orientation=vertical]/stepper:h-12 group-data-[orientation=horizontal]/stepper:w-full group-data-[orientation=vertical]/stepper:w-0.5 group-data-[orientation=horizontal]/stepper:flex-1 group-data-[state=completed]/step:bg-primary",
          className,
        )}
        {...props}
      />
    );
  },
);
StepperSeparator.displayName = "StepperSeparator";

export {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
};
