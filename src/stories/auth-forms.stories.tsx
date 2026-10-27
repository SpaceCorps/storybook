import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import * as React from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

/**
 * Sign-in, sign-up, change-password and one-time-code forms wired the way a browser's password
 * manager expects: a real `<form>` with a `type="submit"` button (so Enter submits), a stable `name`
 * on each field, and the right `autocomplete` token. The show/hide button on a password field never
 * submits the form and never takes focus off the field.
 */
const meta: Meta = {
  title: "Patterns/Auth forms",
  parameters: {
    layout: "centered",
    // New stories: no baseline images yet (they can only be rendered in the Linux container).
    visual: { disable: true },
  },
};

export default meta;

const FORM = "flex w-[360px] flex-col gap-4";

const LoginForm = ({ passkey = false }: { passkey?: boolean }) => {
  const [signedInAs, setSignedInAs] = React.useState<string>();
  const [error, setError] = React.useState<string>();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const entry = data.get("username");
    const username = typeof entry === "string" ? entry.trim() : "";
    if (!username || !data.get("password")) {
      setSignedInAs(undefined);
      setError("Enter your username and password.");
      return;
    }
    setError(undefined);
    setSignedInAs(username);
  };

  return (
    <form className={FORM} onSubmit={handleSubmit} aria-label="Sign in">
      <Field label="Username">
        <Input
          name="username"
          autoComplete={passkey ? "username webauthn" : "username"}
          enterKeyHint="next"
        />
      </Field>
      <Field label="Password" error={error}>
        <Input name="password" type="password" autoComplete="current-password" enterKeyHint="go" />
      </Field>
      <Button type="submit">Sign in</Button>
      {signedInAs ? (
        <p role="status" className="text-sm text-muted-foreground">
          Signed in as {signedInAs}
        </p>
      ) : null}
    </form>
  );
};

/** Username and password. Enter in either field submits; Tab goes field, eye, Sign in. */
export const Login: StoryObj = {
  render: () => <LoginForm />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const username = canvas.getByLabelText("Username");
    const password = canvas.getByLabelText("Password");
    const toggle = canvas.getByRole("button", { name: "Show password" });

    await userEvent.type(username, "ada");
    await userEvent.tab();
    await expect(password).toHaveFocus();
    await userEvent.type(password, "analytical-engine");

    await userEvent.tab();
    await expect(toggle).toHaveFocus();
    await userEvent.keyboard(" ");
    await expect((password as HTMLInputElement).type).toBe("text");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "Sign in" })).toHaveFocus();

    await userEvent.click(password);
    await userEvent.keyboard("{Enter}");
    await expect(await canvas.findByRole("status")).toHaveTextContent("Signed in as ada");
    // The reveal was undone before the form was submitted.
    await expect((password as HTMLInputElement).type).toBe("password");
  },
};

/** `webauthn` after the username token lets the browser offer a passkey from the same field. */
export const LoginWithPasskey: StoryObj = {
  render: () => <LoginForm passkey />,
};

const SignUpForm = () => {
  const [revealed, setRevealed] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [accepted, setAccepted] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const tooShort = password.length > 0 && password.length < 12;
  const mismatch = confirm.length > 0 && confirm !== password;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(password.length >= 12 && confirm === password && accepted);
  };

  return (
    <form className={FORM} onSubmit={handleSubmit} aria-label="Create account">
      <Field label="Email address" hint="You will sign in with this address." required>
        <Input name="email" type="email" autoComplete="username" enterKeyHint="next" />
      </Field>
      <Field
        label="Password"
        hint="At least 12 characters."
        error={tooShort ? "The password is too short." : undefined}
        required
      >
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          enterKeyHint="next"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          revealed={revealed}
          onRevealedChange={setRevealed}
        />
      </Field>
      <Field
        label="Confirm password"
        error={mismatch ? "The passwords do not match." : undefined}
        required
      >
        <Input
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          enterKeyHint="go"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          revealed={revealed}
          onRevealedChange={setRevealed}
        />
      </Field>
      <Field label="I accept the terms of service" orientation="horizontal">
        <Checkbox
          name="terms"
          checked={accepted}
          onCheckedChange={(next) => setAccepted(next === true)}
        />
      </Field>
      <Button type="submit">Create account</Button>
      {submitted ? (
        <p role="status" className="text-sm text-muted-foreground">
          Account created.
        </p>
      ) : null}
    </form>
  );
};

/**
 * Both password fields use `new-password` (the browser treats two of them as a pair and offers a
 * generated password) and share one reveal state, so one click shows both.
 */
export const SignUp: StoryObj = {
  render: () => <SignUpForm />,
};

const ChangePasswordForm = () => {
  const [revealed, setRevealed] = React.useState(false);
  const [done, setDone] = React.useState(false);

  return (
    <form
      className={FORM}
      aria-label="Change password"
      onSubmit={(event) => {
        event.preventDefault();
        setDone(true);
      }}
    >
      {/* Tells the password manager which saved login to update. Visually hidden, not display:none. */}
      <input
        name="username"
        autoComplete="username"
        defaultValue="ada@example.com"
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        aria-label="Username"
        className="sr-only"
      />
      <Field label="Current password">
        <Input
          name="current-password"
          type="password"
          autoComplete="current-password"
          enterKeyHint="next"
          revealed={revealed}
          onRevealedChange={setRevealed}
        />
      </Field>
      <Field label="New password" hint="At least 12 characters.">
        <Input
          name="new-password"
          type="password"
          autoComplete="new-password"
          enterKeyHint="next"
          revealed={revealed}
          onRevealedChange={setRevealed}
        />
      </Field>
      <Field label="Confirm new password">
        <Input
          name="confirm-new-password"
          type="password"
          autoComplete="new-password"
          enterKeyHint="go"
          revealed={revealed}
          onRevealedChange={setRevealed}
        />
      </Field>
      <Button type="submit">Change password</Button>
      {done ? (
        <p role="status" className="text-sm text-muted-foreground">
          Password changed.
        </p>
      ) : null}
    </form>
  );
};

/** A hidden username field names the account, then one current-password and two new-password fields. */
export const ChangePassword: StoryObj = {
  render: () => <ChangePasswordForm />,
};

const TwoFactorForm = () => {
  const [code, setCode] = React.useState("");
  return (
    <form
      className={FORM}
      aria-label="Two-factor code"
      onSubmit={(event) => event.preventDefault()}
    >
      <Field label="Authentication code" hint="Six digits from your authenticator app.">
        <Input
          name="code"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          enterKeyHint="go"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
        />
      </Field>
      <Button type="submit">Verify</Button>
    </form>
  );
};

/** `one-time-code` lets the browser fill a code from SMS; digits only, no spellcheck. */
export const TwoFactor: StoryObj = {
  render: () => <TwoFactorForm />,
};

/** A contact address that is not the login: `email`, not `username`. */
export const EmailField: StoryObj = {
  render: () => (
    <form className={FORM} aria-label="Contact" onSubmit={(event) => event.preventDefault()}>
      <Field label="Contact email">
        <Input name="contact-email" type="email" autoComplete="email" inputMode="email" />
      </Field>
      <Button type="submit">Save</Button>
    </form>
  ),
};

/** Pixels from the bottom edge of `above` to the top edge of `below`. */
const gapBetween = (above: Element, below: Element) =>
  below.getBoundingClientRect().top - above.getBoundingClientRect().bottom;

/**
 * A form is one vertical rhythm: a label sits close to its own control, and every other step down
 * (an alert onto the first label, a control onto the next label, the last control onto the actions)
 * is the larger field gap. A label that looks glued to the control above it, or a button on the
 * input above it, is this going wrong, so the play functions below measure it in the browser.
 */
const expectFormRhythm = async (canvasElement: HTMLElement) => {
  const form = within(canvasElement).getByRole("form", { name: "Sign in" });
  const canvas = within(form);
  const label = (text: string) => canvas.getByText(text, { selector: "label" });
  // A password field wraps its input and eye button, and the wrapper is what the next row clears.
  const control = (text: string) => {
    const input = canvas.getByLabelText(text);
    return input.closest("[data-slot='password-input']") ?? input;
  };

  const labelToControl = gapBetween(label("Username"), control("Username"));
  const fieldToField = gapBetween(control("Username"), label("Password"));
  const alertToField = gapBetween(canvas.getByRole("alert"), label("Username"));
  const controlToActions = gapBetween(
    control("Password"),
    canvas.getByRole("button", { name: "Sign in" }),
  );

  await expect(labelToControl).toBeGreaterThan(2);
  await expect(fieldToField).toBeGreaterThanOrEqual(labelToControl * 2);
  await expect(alertToField).toBeCloseTo(fieldToField, 0);
  await expect(controlToActions).toBeCloseTo(fieldToField, 0);
};

const SignInError = () => (
  <Alert variant="destructive">
    <AlertTitle>Could not sign in</AlertTitle>
    <AlertDescription>Check your username and password.</AlertDescription>
  </Alert>
);

/** An error above the fields, two fields and the submit button: all one `gap-4` stack of `Field`s. */
export const SignInSpacing: StoryObj = {
  render: () => (
    <form className={FORM} aria-label="Sign in" onSubmit={(event) => event.preventDefault()}>
      <SignInError />
      <Field label="Username">
        <Input name="username" autoComplete="username" />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" />
      </Field>
      <Button type="submit">Sign in</Button>
    </form>
  ),
  play: async ({ canvasElement }) => expectFormRhythm(canvasElement),
};

const FormComponentsSignIn = () => {
  const form = useForm({ defaultValues: { username: "", password: "" } });
  return (
    <Form {...form}>
      <form className={FORM} aria-label="Sign in" onSubmit={form.handleSubmit(() => {})}>
        <SignInError />
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input autoComplete="username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Sign in</Button>
      </form>
    </Form>
  );
};

/** The same form on the react-hook-form components: a `FormItem` spaces its label like a `Field` does. */
export const SignInSpacingWithFormComponents: StoryObj = {
  render: () => <FormComponentsSignIn />,
  play: async ({ canvasElement }) => expectFormRhythm(canvasElement),
};
