import { describe, expect, it } from "vite-plus/test";
import { resolveInputSemantics } from "../src/components/ui/input/semantics";

const VERBATIM = { spellCheck: false, autoCapitalize: "none", autoCorrect: "off" };
const UNTOUCHED = { spellCheck: undefined, autoCapitalize: undefined, autoCorrect: undefined };

describe("resolveInputSemantics", () => {
  it.each([
    // [description, input, expected]
    [
      "a plain text field keeps autocomplete off and is ignored by password managers",
      {},
      { autoComplete: "off", ignorePasswordManagers: true, inputMode: undefined, ...UNTOUCHED },
    ],
    [
      "type=text is the same as no type",
      { type: "text" },
      { autoComplete: "off", ignorePasswordManagers: true, ...UNTOUCHED },
    ],
    [
      "an explicit off stays off",
      { autoComplete: "off" },
      { autoComplete: "off", ignorePasswordManagers: true, ...UNTOUCHED },
    ],
    [
      "type=email without a token is verbatim but still off (nothing says it is a login)",
      { type: "email" },
      { autoComplete: "off", ignorePasswordManagers: true, ...VERBATIM },
    ],
    [
      "type=url is verbatim",
      { type: "url" },
      { autoComplete: "off", ignorePasswordManagers: true, ...VERBATIM },
    ],
    [
      "a password with no token omits the attribute, is verbatim and is offered to managers",
      { type: "password" },
      {
        autoComplete: undefined,
        ignorePasswordManagers: false,
        missingPasswordToken: true,
        ...VERBATIM,
      },
    ],
    [
      "a password with a token passes it through",
      { type: "password", autoComplete: "current-password" },
      {
        autoComplete: "current-password",
        ignorePasswordManagers: false,
        missingPasswordToken: false,
        ...VERBATIM,
      },
    ],
    [
      "new-password is verbatim and not ignored",
      { type: "password", autoComplete: "new-password" },
      { autoComplete: "new-password", ignorePasswordManagers: false, ...VERBATIM },
    ],
    [
      "a password the caller turned autocomplete off on is still verbatim and still ignored",
      { type: "password", autoComplete: "off" },
      { autoComplete: "off", ignorePasswordManagers: true, ...VERBATIM },
    ],
    [
      "username on a text field is verbatim and not ignored",
      { autoComplete: "username" },
      { autoComplete: "username", ignorePasswordManagers: false, ...VERBATIM },
    ],
    [
      "username webauthn keeps both tokens",
      { autoComplete: "username webauthn" },
      { autoComplete: "username webauthn", ignorePasswordManagers: false, ...VERBATIM },
    ],
    [
      "email asks for the email keyboard",
      { type: "email", autoComplete: "email" },
      { autoComplete: "email", ignorePasswordManagers: false, inputMode: "email", ...VERBATIM },
    ],
    [
      "one-time-code asks for the numeric keyboard",
      { autoComplete: "one-time-code" },
      {
        autoComplete: "one-time-code",
        ignorePasswordManagers: false,
        inputMode: "numeric",
        ...VERBATIM,
      },
    ],
    [
      "tokens are matched case-insensitively and with a section prefix",
      { autoComplete: "section-login Username" },
      { autoComplete: "section-login Username", ignorePasswordManagers: false, ...VERBATIM },
    ],
    [
      "another real token (tel) is passed through and un-ignored but leaves spellcheck alone",
      { autoComplete: "tel" },
      { autoComplete: "tel", ignorePasswordManagers: false, ...UNTOUCHED },
    ],
    [
      "on means the browser default",
      { autoComplete: "on" },
      { autoComplete: "on", ignorePasswordManagers: false, ...UNTOUCHED },
    ],
    [
      "verbatim switches the three attributes on a plain field",
      { verbatim: true },
      { autoComplete: "off", ignorePasswordManagers: true, ...VERBATIM },
    ],
  ])("%s", (_name, input, expected) => {
    expect(resolveInputSemantics(input)).toMatchObject(expected);
  });

  it("lets the caller's own values win over the derived ones", () => {
    expect(
      resolveInputSemantics({
        type: "password",
        autoComplete: "current-password",
        spellCheck: true,
        autoCapitalize: "words",
        autoCorrect: "on",
        inputMode: "text",
      }),
    ).toMatchObject({
      spellCheck: true,
      autoCapitalize: "words",
      autoCorrect: "on",
      inputMode: "text",
    });
    expect(
      resolveInputSemantics({ autoComplete: "one-time-code", inputMode: "tel" }).inputMode,
    ).toBe("tel");
  });

  it("treats an explicit undefined like a missing value", () => {
    expect(
      resolveInputSemantics({
        autoComplete: undefined,
        spellCheck: undefined,
        inputMode: undefined,
      }),
    ).toMatchObject({ autoComplete: "off", ignorePasswordManagers: true, ...UNTOUCHED });
  });
});
