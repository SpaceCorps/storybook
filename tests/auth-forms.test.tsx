import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as React from "react";
import { describe, expect, it } from "vite-plus/test";
import {
  ChangePassword,
  EmailField,
  Login,
  LoginWithPasskey,
  SignUp,
  TwoFactor,
} from "../src/stories/auth-forms.stories";

type Story = { render?: unknown };

function renderStory(story: Story) {
  const Render = story.render as React.FC;
  return render(<Render />);
}

const inputs = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLInputElement>("input"));
const tokensOf = (container: HTMLElement) => inputs(container).map((i) => i.autocomplete);
const countToken = (container: HTMLElement, token: string) =>
  tokensOf(container).filter((t) => t.split(" ").includes(token)).length;

describe("auth form patterns", () => {
  const stories = {
    Login,
    LoginWithPasskey,
    SignUp,
    ChangePassword,
    TwoFactor,
    EmailField,
  };

  it.each(Object.entries(stories))(
    "%s: every input is named and the form has one submit",
    (_n, story) => {
      const { container } = renderStory(story);
      // The hidden username and Radix's form-only checkbox are aria-hidden on purpose.
      for (const input of inputs(container).filter(
        (i) => i.getAttribute("aria-hidden") !== "true",
      )) {
        expect(input, input.outerHTML).toHaveAccessibleName();
      }
      const form = container.querySelector("form")!;
      expect(form.querySelectorAll('button[type="submit"]')).toHaveLength(1);
      // The eye is never a submit button.
      for (const eye of screen.queryAllByRole("button", { name: "Show password" })) {
        expect(eye).toHaveAttribute("type", "button");
      }
    },
  );

  it("Login has one username and one current-password", () => {
    const { container } = renderStory(Login);
    expect(countToken(container, "username")).toBe(1);
    expect(countToken(container, "current-password")).toBe(1);
    expect(inputs(container)).toHaveLength(2);
    const password = container.querySelector<HTMLInputElement>('input[name="password"]')!;
    expect(password.type).toBe("password");
    expect(password).not.toHaveAttribute("data-1p-ignore");
    const username = container.querySelector<HTMLInputElement>('input[name="username"]')!;
    expect(username).toHaveAttribute("spellcheck", "false");
    expect(username).toHaveAttribute("autocapitalize", "none");
    expect(username).not.toHaveAttribute("data-1p-ignore");
  });

  it("LoginWithPasskey adds webauthn to the username token", () => {
    const { container } = renderStory(LoginWithPasskey);
    expect(tokensOf(container)).toContain("username webauthn");
  });

  it("SignUp has the login id and two new-password fields", () => {
    const { container } = renderStory(SignUp);
    expect(countToken(container, "username")).toBe(1);
    expect(countToken(container, "new-password")).toBe(2);
    expect(countToken(container, "current-password")).toBe(0);
  });

  it("ChangePassword has a hidden username, one current-password and two new-password", () => {
    const { container } = renderStory(ChangePassword);
    expect(countToken(container, "username")).toBe(1);
    expect(countToken(container, "current-password")).toBe(1);
    expect(countToken(container, "new-password")).toBe(2);
    const username = container.querySelector<HTMLInputElement>('input[name="username"]')!;
    expect(username).toHaveAttribute("aria-hidden", "true");
    expect(username).toHaveAttribute("tabindex", "-1");
    expect(username).toHaveAttribute("readonly");
    expect(username).toHaveClass("sr-only");
  });

  it("TwoFactor is a numeric one-time-code field", () => {
    const { container } = renderStory(TwoFactor);
    const code = container.querySelector<HTMLInputElement>('input[name="code"]')!;
    expect(code).toHaveAttribute("autocomplete", "one-time-code");
    expect(code).toHaveAttribute("inputmode", "numeric");
    expect(code).toHaveAttribute("maxlength", "6");
    expect(code).toHaveAttribute("pattern", "[0-9]*");
    expect(code).toHaveAttribute("spellcheck", "false");
  });

  it("EmailField is an email address that is not the login", () => {
    const { container } = renderStory(EmailField);
    const email = container.querySelector<HTMLInputElement>("input")!;
    expect(email.type).toBe("email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(email).toHaveAttribute("inputmode", "email");
  });

  it("Login submits on Enter in the password field and shows who signed in", async () => {
    const user = userEvent.setup();
    renderStory(Login);
    await user.type(screen.getByLabelText("Username"), "ada");
    await user.type(screen.getByLabelText("Password"), "engine{Enter}");
    expect(await screen.findByRole("status")).toHaveTextContent("Signed in as ada");
  });

  it("Login shows an error on the password field when a value is missing", async () => {
    const user = userEvent.setup();
    renderStory(Login);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAccessibleDescription("Enter your username and password.");
  });

  it("SignUp reveals both password fields with one click", async () => {
    const user = userEvent.setup();
    const { container } = renderStory(SignUp);
    await user.click(screen.getAllByRole("button", { name: "Show password" })[0]);
    const passwords = container.querySelectorAll<HTMLInputElement>(
      'input[autocomplete="new-password"]',
    );
    expect(Array.from(passwords).map((p) => p.type)).toEqual(["text", "text"]);
  });
});
