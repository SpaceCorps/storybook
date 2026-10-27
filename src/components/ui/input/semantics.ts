import type * as React from "react";

type InputMode = React.HTMLAttributes<HTMLInputElement>["inputMode"];
type SpellCheck = React.HTMLAttributes<HTMLInputElement>["spellCheck"];

/** Tokens that mean the field carries an identity or a secret, which no one wants autocorrected. */
const CREDENTIAL_TOKENS = new Set([
  "username",
  "email",
  "current-password",
  "new-password",
  "one-time-code",
  "webauthn",
]);

/** Types whose value is machine-read text: a spellcheck squiggle or a capital letter is a bug. */
const VERBATIM_TYPES = new Set(["email", "url", "password"]);

export interface InputSemanticsInput {
  type?: string;
  autoComplete?: string;
  /** Turns off spellcheck, auto-capitalisation and autocorrect whatever the type or token. */
  verbatim?: boolean;
  /** The caller's own values. Each one wins over the derived default; `undefined` falls back. */
  spellCheck?: SpellCheck;
  autoCapitalize?: string;
  autoCorrect?: string;
  inputMode?: InputMode;
}

export interface InputSemantics {
  /** `undefined` means leave the attribute off and let the browser decide. */
  autoComplete: string | undefined;
  spellCheck: SpellCheck;
  autoCapitalize: string | undefined;
  autoCorrect: string | undefined;
  inputMode: InputMode;
  /** True for fields a password manager should skip; false for anything it should offer to fill. */
  ignorePasswordManagers: boolean;
  /** A password field with no autocomplete token, so the browser cannot tell sign-in from sign-up. */
  missingPasswordToken: boolean;
}

function tokensOf(autoComplete: string | undefined): string[] {
  return (autoComplete ?? "").toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Works out the attributes an Input renders besides the ones the caller set. Plain text fields keep
 * what they always had (`autocomplete="off"` and `data-1p-ignore`, so a form of invoice lines does
 * not get a password manager's suggestions). Anything credential-shaped drops both, because
 * `autocomplete="off"` on a username suppresses its saved suggestions and `data-1p-ignore` hides the
 * field from 1Password, and gains the verbatim attributes so the browser leaves the text alone.
 */
export function resolveInputSemantics(input: InputSemanticsInput): InputSemantics {
  const tokens = tokensOf(input.autoComplete);
  const explicit = input.autoComplete !== undefined;
  const isPassword = input.type === "password";
  const credential = isPassword || tokens.some((token) => CREDENTIAL_TOKENS.has(token));
  const verbatim =
    input.verbatim === true || credential || VERBATIM_TYPES.has(input.type ?? "text");

  const derivedInputMode: InputMode = tokens.includes("email")
    ? "email"
    : tokens.includes("one-time-code")
      ? "numeric"
      : undefined;

  return {
    autoComplete: explicit ? input.autoComplete : isPassword ? undefined : "off",
    spellCheck: input.spellCheck ?? (verbatim ? false : undefined),
    autoCapitalize: input.autoCapitalize ?? (verbatim ? "none" : undefined),
    autoCorrect: input.autoCorrect ?? (verbatim ? "off" : undefined),
    inputMode: input.inputMode ?? derivedInputMode,
    ignorePasswordManagers: explicit ? tokens.includes("off") : !isPassword,
    missingPasswordToken: isPassword && !explicit,
  };
}
