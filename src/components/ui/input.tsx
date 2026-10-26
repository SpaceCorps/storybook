import * as React from "react";
import type { VariantProps } from "class-variance-authority";
import { Eye, EyeOff } from "lucide-react";

import { useFieldControl } from "@/components/ui/field/field-context";
import { useDensity } from "@/contexts/density-context";
import { useControllableValue } from "@/hooks/use-controllable-value";
import { useMergedRefs } from "@/lib/merge-refs";
import { cn } from "@/lib/utils";
import { splitLayoutClasses } from "./input/layout-classes";
import { resolveInputSemantics } from "./input/semantics";
import {
  normalizeInputDensity,
  textInputPasswordPaddingVariant,
  textInputTrailingIconButtonClasses,
  textInputTrailingIconSizeVariant,
  textInputTrailingOverlayClasses,
} from "./input/text-input-variant";
import { inputVariant } from "./input/variant";

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">, VariantProps<typeof inputVariant> {
  /**
   * Whether a `type="password"` input gets a show/hide button. On by default for passwords; turn it
   * off for a PIN or where policy forbids revealing, or when you flip `type` yourself with a button
   * of your own (otherwise the field has two). `true` makes the input a toggling password input
   * whatever `type` says, so a caller that used to flip `type` itself can hand that over.
   */
  passwordToggle?: boolean;
  /** The button's accessible name. It stays the same whichever way the input is showing. */
  passwordToggleLabel?: string;
  /** Controlled reveal state, to share one toggle across several password fields. */
  revealed?: boolean;
  defaultRevealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
  /**
   * Classes for the wrapper a toggling input renders. `className` lands on the `<input>`, except the
   * utilities that size or place it in its parent (`w-*`, `max-w-*`, `flex-1`, `col-span-*`,
   * `self-*`, `order-*`, margins), which move to the wrapper so the show/hide button stays with the field.
   */
  containerClassName?: string;
  /** Spellcheck, auto-capitalisation and autocorrect off: for ids, codes and anything read by a machine. */
  verbatim?: boolean;
}

/** The `Input` props that only mean something on a password field; a date or time field omits them. */
export type PasswordInputOnlyProps =
  | "passwordToggle"
  | "passwordToggleLabel"
  | "revealed"
  | "defaultRevealed"
  | "onRevealedChange"
  | "containerClassName"
  | "verbatim";

const DEFAULT_TOGGLE_LABEL = "Show password";

const Input = React.forwardRef<HTMLInputElement, InputProps>((props, forwardedRef) => {
  const {
    className,
    containerClassName,
    type,
    density,
    verbatim,
    autoComplete,
    spellCheck,
    autoCapitalize,
    autoCorrect,
    inputMode,
    passwordToggle,
    passwordToggleLabel = DEFAULT_TOGGLE_LABEL,
    revealed,
    defaultRevealed = false,
    onRevealedChange,
    ...rest
  } = useFieldControl(props);

  const contextDensity = useDensity();
  const effectiveDensity = density ?? contextDensity;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const ref = useMergedRefs(forwardedRef, inputRef);

  const hasToggle = passwordToggle ?? type === "password";
  const isPassword = hasToggle || type === "password";
  const disabled = rest.disabled === true;

  // Once the input has been inside the wrapper it stays there. A caller that flips `type` between
  // "password" and "text" itself would otherwise swap `div > input` for a bare `input` on every flip,
  // which remounts the field and loses its text and its focus.
  const wrappedRef = React.useRef(false);
  if (hasToggle) wrappedRef.current = true;
  const wrapped = wrappedRef.current;
  const { layout: layoutClassName, rest: inputClassName } = wrapped
    ? splitLayoutClasses(className)
    : { layout: "", rest: className };

  const [isRevealed, setRevealed] = useControllableValue<boolean>(
    revealed,
    defaultRevealed,
    onRevealedChange,
  );
  const shown = hasToggle && isRevealed && !disabled;

  const semantics = resolveInputSemantics({
    type: isPassword ? "password" : type,
    autoComplete,
    verbatim,
    spellCheck,
    autoCapitalize,
    autoCorrect,
    inputMode,
  });

  React.useEffect(() => {
    if (semantics.missingPasswordToken && import.meta.env.DEV) {
      console.warn(
        'Input type="password" needs autoComplete="current-password" or "new-password" so the browser can offer or save a password.',
      );
    }
  }, [semantics.missingPasswordToken]);

  // A disabled field cannot show its secret, and re-enabling it must not suddenly do so. Only the
  // moment of becoming disabled resets it: with one reveal state shared by several fields, a sibling
  // that is simply disabled must not switch the others' reveal off every time it is turned on.
  const wasDisabledRef = React.useRef(false);
  React.useEffect(() => {
    if (disabled && !wasDisabledRef.current && isRevealed) setRevealed(false);
    wasDisabledRef.current = disabled;
  }, [disabled, isRevealed, setRevealed]);

  // The browser's password manager decides what a form is when it is submitted, and a revealed field
  // is a plain text one. Put the type back before the submit handlers run (capture phase), and when the
  // page is left or the form is reset, so a revealed secret is never what gets remembered or restored.
  React.useEffect(() => {
    const input = inputRef.current;
    if (!shown || !input) return;
    const form = input.form;
    const hide = () => {
      input.type = "password";
      setRevealed(false);
    };
    form?.addEventListener("submit", hide, true);
    form?.addEventListener("reset", hide);
    window.addEventListener("pagehide", hide);
    return () => {
      form?.removeEventListener("submit", hide, true);
      form?.removeEventListener("reset", hide);
      window.removeEventListener("pagehide", hide);
    };
  }, [shown, setRevealed]);

  const control = (
    <input
      data-1p-ignore={semantics.ignorePasswordManagers ? true : undefined}
      {...rest}
      ref={ref}
      type={hasToggle ? (shown ? "text" : "password") : type}
      autoComplete={semantics.autoComplete}
      spellCheck={semantics.spellCheck}
      autoCapitalize={semantics.autoCapitalize}
      autoCorrect={semantics.autoCorrect}
      inputMode={semantics.inputMode}
      className={cn(
        inputVariant({ density: effectiveDensity }),
        hasToggle && textInputPasswordPaddingVariant({ density: effectiveDensity }),
        // Edge draws its own reveal eye on a password field once it has text; ours replaces it.
        isPassword && "[&::-ms-reveal]:hidden",
        inputClassName,
      )}
    />
  );

  if (!wrapped) return control;

  const density_ = normalizeInputDensity(effectiveDensity);
  const EyeIcon = shown ? EyeOff : Eye;

  return (
    <div
      data-slot="password-input"
      className={cn("relative w-full", layoutClassName, containerClassName)}
    >
      {control}
      {hasToggle ? (
        <div className={textInputTrailingOverlayClasses(density_)}>
          <button
            type="button"
            aria-label={passwordToggleLabel}
            aria-pressed={shown}
            aria-controls={rest.id}
            disabled={disabled}
            // Without this the click moves focus to the button, taking it (and the caret) off the field.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setRevealed(!isRevealed)}
            className={cn(
              textInputTrailingIconButtonClasses(true, density_),
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <EyeIcon
              aria-hidden="true"
              className={textInputTrailingIconSizeVariant({ density: density_ })}
            />
          </button>
        </div>
      ) : null}
    </div>
  );
});
Input.displayName = "Input";

export { Input };
