import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

/**
 * A static scan of `src` for focus styling that quietly paints nothing. Two halves:
 *
 * Class strings (every .ts and .tsx file outside tests and stories):
 * - `outline-none` removes the outline with `outline-style: none` only. `outline-hidden` keeps a
 *   transparent 2px outline inside `@media (forced-colors: active)`, which is the only focus
 *   indicator Windows High Contrast leaves, because it flattens every box-shadow ring to nothing.
 * - `focus-visible:outline-hidden` is only safe when something else draws the focus: a ring or an
 *   outline under a focus variant, in the same class string. `ring-0` and the offset and style
 *   utilities do not count, since they draw nothing. A border colour does not count either: forced
 *   colors mode keeps borders but not the colour change, and the Tab sweep in the Storybook test
 *   runner (which looks at outlines and box-shadows) would not see it.
 * - `outline-hidden` with no variant at all, where nothing in the string draws a focus ring, paints
 *   the same 2px outline on the element focused or not in forced-colors mode (see the rule below).
 *
 * Stylesheets (every .css file): a rule that removes the outline (`outline: none`) needs an outline
 * back under a focus selector for the same element, see the section on CSS below.
 *
 * There is no TypeScript compiler API to lean on here (the installed typescript is the native
 * port), so a small lexer pulls the string literals out of each file, skipping comments and regex
 * literals and recursing into template-literal expressions.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(repoRoot, "src");

interface Literal {
  text: string;
  line: number;
}

/** Characters after which a `/` starts a regular expression rather than dividing or closing JSX. */
const REGEX_PRECEDERS = new Set([
  "(",
  ",",
  "=",
  ":",
  "[",
  "!",
  "&",
  "|",
  "?",
  "{",
  ";",
  "+",
  "-",
  "*",
  "%",
  "~",
  "^",
]);

/** Every string and template-literal chunk in `source`, with its 1-based start line. */
function extractStringLiterals(source: string): Literal[] {
  const literals: Literal[] = [];
  let line = 1;

  /** Scans code from `start`; inside a template expression, returns just after its closing brace. */
  function scanCode(start: number, inTemplateExpression: boolean): number {
    let i = start;
    let depth = 0;
    let previous = "";

    while (i < source.length) {
      const ch = source[i]!;
      const next = source[i + 1];

      if (ch === "\n") {
        line += 1;
        i += 1;
      } else if (ch === "/" && next === "/") {
        while (i < source.length && source[i] !== "\n") {
          i += 1;
        }
      } else if (ch === "/" && next === "*") {
        i += 2;
        while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
          if (source[i] === "\n") {
            line += 1;
          }
          i += 1;
        }
        i += 2;
      } else if (ch === '"' || ch === "'") {
        // Single-line by definition: an unmatched quote (an apostrophe in JSX text) stops at the line end.
        const startLine = line;
        let text = "";
        i += 1;
        while (i < source.length && source[i] !== ch && source[i] !== "\n") {
          if (source[i] === "\\") {
            text += source[i]! + (source[i + 1] ?? "");
            i += 2;
          } else {
            text += source[i];
            i += 1;
          }
        }
        if (source[i] === ch) {
          i += 1;
        }
        literals.push({ text, line: startLine });
        previous = ch;
      } else if (ch === "`") {
        i = scanTemplate(i + 1);
        previous = ch;
      } else if (ch === "/" && (previous === "" || REGEX_PRECEDERS.has(previous))) {
        i += 1;
        let inClass = false;
        while (i < source.length && source[i] !== "\n" && (inClass || source[i] !== "/")) {
          if (source[i] === "\\") {
            i += 1;
          } else if (source[i] === "[") {
            inClass = true;
          } else if (source[i] === "]") {
            inClass = false;
          }
          i += 1;
        }
        i += 1;
        previous = "/";
      } else {
        if (inTemplateExpression) {
          if (ch === "{") {
            depth += 1;
          } else if (ch === "}") {
            if (depth === 0) {
              return i + 1;
            }
            depth -= 1;
          }
        }
        if (!/\s/.test(ch)) {
          previous = ch;
        }
        i += 1;
      }
    }
    return i;
  }

  /** Scans a template literal's body from just after the opening backtick; returns just after the closing one. */
  function scanTemplate(start: number): number {
    let i = start;
    let text = "";
    let startLine = line;

    while (i < source.length && source[i] !== "`") {
      if (source[i] === "\\") {
        text += source[i]! + (source[i + 1] ?? "");
        i += 2;
      } else if (source[i] === "$" && source[i + 1] === "{") {
        literals.push({ text, line: startLine });
        text = "";
        i = scanCode(i + 2, true);
        startLine = line;
      } else {
        if (source[i] === "\n") {
          line += 1;
        }
        text += source[i];
        i += 1;
      }
    }
    literals.push({ text, line: startLine });
    return i + 1;
  }

  scanCode(0, false);
  return literals;
}

interface ClassToken {
  raw: string;
  variants: string[];
  utility: string;
}

/** Splits `a:b:[&_svg]:size-4!` into variants and the utility, ignoring colons inside brackets. */
function parseToken(raw: string): ClassToken {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of raw) {
    if (ch === "[" || ch === "(") {
      depth += 1;
    } else if (ch === "]" || ch === ")") {
      depth -= 1;
    }
    if (ch === ":" && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  const utility = current.replace(/^!/, "").replace(/!$/, "");
  return { raw, variants: parts, utility };
}

const tokensOf = (text: string): ClassToken[] => text.split(/\s+/).filter(Boolean).map(parseToken);

const hasFocusVariant = (token: ClassToken) =>
  token.variants.some((variant) => variant.includes("focus"));

/** `ring`, `ring-2`, `ring-ring`, `ring-[3px]`, `inset-ring-2`; not `ring-0`, `ring-inset` or `ring-offset-2`. */
function isRing(utility: string): boolean {
  const match = /^(?:inset-)?ring(?:-(.+))?$/.exec(utility);
  if (!match) {
    return false;
  }
  const rest = match[1];
  return rest === undefined || !(rest === "0" || rest === "inset" || rest.startsWith("offset"));
}

/** `outline`, `outline-2`, `outline-ring`; not `outline-0`, `outline-hidden`, `outline-offset-2` or a style. */
function isOutline(utility: string): boolean {
  const match = /^outline(?:-(.+))?$/.exec(utility);
  if (!match) {
    return false;
  }
  const rest = match[1];
  return (
    rest === undefined ||
    !(
      rest === "0" ||
      rest === "hidden" ||
      rest === "none" ||
      rest.startsWith("offset") ||
      /^(solid|dashed|dotted|double)$/.test(rest)
    )
  );
}

/**
 * True for a utility that draws something on focus that survives forced-colors mode and that the Tab
 * sweep can see: a ring or outline under a focus variant. A border colour is deliberately not one.
 */
function drawsFocusIndicator(token: ClassToken): boolean {
  return hasFocusVariant(token) && (isRing(token.utility) || isOutline(token.utility));
}

interface Finding {
  rule: "outline-none" | "outline-hidden-without-indicator" | "outline-hidden-unconditional";
  file: string;
  line: number;
  token: string;
  text: string;
}

/** Applies both rules to one class string. */
function checkClassString(text: string): Array<Pick<Finding, "rule" | "token">> {
  const tokens = tokensOf(text);
  const findings: Array<Pick<Finding, "rule" | "token">> = [];

  for (const token of tokens) {
    if (token.utility === "outline-none") {
      findings.push({ rule: "outline-none", token: token.raw });
    }
  }

  const hidden = tokens.filter(
    (token) =>
      token.utility === "outline-hidden" &&
      token.variants.some((variant) => variant === "focus" || variant === "focus-visible"),
  );
  if (hidden.length > 0 && !tokens.some(drawsFocusIndicator)) {
    for (const token of hidden) {
      findings.push({ rule: "outline-hidden-without-indicator", token: token.raw });
    }
  }

  // No variant at all: in forced-colors mode the element carries a 2px outline whether it has focus or
  // not, so the outline says nothing about where focus is unless a focus variant draws its own.
  const unconditional = tokens.filter(
    (token) => token.utility === "outline-hidden" && token.variants.length === 0,
  );
  if (unconditional.length > 0 && !tokens.some(drawsFocusIndicator)) {
    for (const token of unconditional) {
      findings.push({ rule: "outline-hidden-unconditional", token: token.raw });
    }
  }

  return findings;
}

/**
 * Class strings that are allowed to break a rule, each with the reason. A control that shows no focus
 * indicator is a bug to fix, and an entry here is a decision to live with it; the only entries today
 * are for `outline-hidden` that the scan cannot judge, because it reads each string on its own.
 */
interface AllowEntry {
  file: string;
  token: string;
  reason: string;
}
const ALLOWLIST: readonly AllowEntry[] = [
  // Unconditional outline-hidden. The scan reads each string on its own and cannot see a ring that
  // reaches the element through another argument of cn(), a shared constant or another state class.
  {
    file: "src/components/InvalidIcon.tsx",
    token: "outline-hidden",
    reason: "The focus ring is in the next argument of cn(), a separate string.",
  },
  {
    file: "src/components/markdown/ImageOverlay.tsx",
    token: "outline-hidden",
    reason: "A full-viewport backdrop that takes programmatic focus; it is not a control.",
  },
  {
    file: "src/components/ui/command.tsx",
    token: "outline-hidden",
    reason:
      "Rows ring under data-[selected=true], which the scan does not count as a focus variant; the input at the top has no ring of its own, a forced-colors gap for the file's owner.",
  },
  {
    file: "src/components/ui/context-menu.tsx",
    token: "outline-hidden",
    reason: "The item ring is the shared menuItemRing, concatenated outside the string.",
  },
  {
    file: "src/components/ui/dropdown-menu.tsx",
    token: "outline-hidden",
    reason: "The item ring is the shared menuItemRing, concatenated outside the string.",
  },
  {
    file: "src/components/ui/menubar.tsx",
    token: "outline-hidden",
    reason: "The item ring is the shared menuItemRing, concatenated outside the string.",
  },
  {
    file: "src/components/ui/time-input/time-input-variant.ts",
    token: "outline-hidden",
    reason: "The option ring is the shared menuItemRing, the next entry of the array.",
  },
  {
    file: "src/components/ui/multiselect.tsx",
    token: "outline-hidden",
    reason:
      "One site is the popover container, which takes programmatic focus; the other is the search input inside the field, which has no ring of its own, a forced-colors gap for the file's owner.",
  },
  {
    file: "src/components/ui/popover.tsx",
    token: "outline-hidden",
    reason: "The popover container takes programmatic focus when it opens; it is not a control.",
  },
  {
    file: "src/components/ui/sheet.tsx",
    token: "outline-hidden",
    reason: "The sheet container takes programmatic focus when it opens; it is not a control.",
  },
  {
    file: "src/components/ui/input/file-input-variant.ts",
    token: "outline-hidden",
    reason: "This belongs to the isDragging state, whose ring is meant to be on while it applies.",
  },
  {
    file: "src/components/ui/input/text-input-variant.ts",
    token: "outline-hidden",
    reason:
      "A state class of the field frame (focused); whether the frame draws a ring is decided elsewhere in the function and was not reviewed here.",
  },
];

/**
 * Stylesheet rules that remove an outline and put none back under a focus selector. Each is a real
 * gap in forced-colors mode, found by this scan and left for the owner of the stylesheet: the file is
 * not part of the work that added the scan. Fix one and its entry must go (the test below says so).
 */
interface CssAllowEntry {
  file: string;
  selector: string;
  reason: string;
}
const CSS_ALLOWLIST: readonly CssAllowEntry[] = [
  {
    file: "src/components/devtools.css",
    selector: ".ivy-devtools-input",
    reason: "No focus rule at all: focusing the input changes nothing in any mode.",
  },
  {
    file: "src/components/TendrilQuestions/tendril-questions.css",
    selector: ".tq-text-input",
    reason: "Focus only recolours the border, which forced-colors mode does not carry over.",
  },
  {
    file: "src/components/WebViewer/web-viewer.css",
    selector: ".wvr-address-input",
    reason: "The ring is a 1px box-shadow, which forced-colors mode drops; no outline is put back.",
  },
  {
    file: "src/components/WebViewer/web-viewer.css",
    selector: ".wvr-menu-item:focus-visible",
    reason: "Focus only changes the background, which forced-colors mode flattens.",
  },
  {
    file: "src/components/WebViewer/web-viewer.css",
    selector: ".wvr-comment-input",
    reason: "Focus adds a 1px box-shadow, which forced-colors mode drops; no outline is put back.",
  },
];

const isScanned = (relative: string) => {
  const normalised = relative.replaceAll("\\", "/");
  return (
    /\.tsx?$/.test(normalised) &&
    !normalised.endsWith(".d.ts") &&
    !/\.(test|stories)\.tsx?$/.test(normalised) &&
    !normalised.startsWith("stories/")
  );
};

function scanSource(): Finding[] {
  const findings: Finding[] = [];
  for (const relative of readdirSync(srcDir, { recursive: true, encoding: "utf8" })) {
    if (!isScanned(relative)) {
      continue;
    }
    const file = `src/${relative.replaceAll("\\", "/")}`;
    const source = readFileSync(path.join(srcDir, relative), "utf8");
    for (const literal of extractStringLiterals(source)) {
      if (!/focus|outline/.test(literal.text)) {
        continue;
      }
      for (const found of checkClassString(literal.text)) {
        findings.push({ ...found, file, line: literal.line, text: literal.text });
      }
    }
  }
  return findings;
}

const isAllowed = (finding: Finding) =>
  ALLOWLIST.some((entry) => entry.file === finding.file && entry.token === finding.token);

const describeFinding = (finding: Finding) =>
  `${finding.file}:${finding.line} [${finding.rule}] ${finding.token}\n    ${finding.text.trim().slice(0, 200)}`;

// ---------------------------------------------------------------------------------------------
// CSS
//
// Class strings are only half of where a focus outline goes missing. A stylesheet that says
// `outline: none` on a focusable element removes the browser's ring in every mode, and forced-colors
// mode (Windows High Contrast) then has nothing left: it overrides colours, drops box-shadows and
// does not take a changed border colour for a focus cue. A rule that removes the outline is fine only
// when the same element gets an outline back under a focus selector (a transparent one counts, since
// forced-colors paints it in a system colour).
// ---------------------------------------------------------------------------------------------

interface CssDeclaration {
  property: string;
  value: string;
}

interface CssRule {
  /** The comma-separated selectors, whitespace collapsed. */
  selectors: string[];
  declarations: CssDeclaration[];
  /** 1-based line of the first selector. */
  line: number;
  /** True inside `@media (forced-colors: ...)`, where rules adjust forced-colors mode itself. */
  forcedColors: boolean;
}

/** At-rules whose block holds no style rules the scan cares about. */
const OPAQUE_AT_RULES = new Set([
  "@keyframes",
  "@font-face",
  "@property",
  "@page",
  "@counter-style",
]);

/** Splits `text` on `separator` where it is not inside brackets, parentheses or a string. */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let current = "";
  for (const ch of text) {
    if (quote) {
      if (ch === quote) {
        quote = "";
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "(" || ch === "[") {
      depth += 1;
    } else if (ch === ")" || ch === "]") {
      depth -= 1;
    } else if (ch === separator && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

/** Declarations from the text of a rule body; nested blocks are skipped. */
function parseDeclarations(body: string): CssDeclaration[] {
  const declarations: CssDeclaration[] = [];
  let flat = "";
  let depth = 0;
  for (const ch of body) {
    if (ch === "{") {
      if (depth === 0) {
        // A nested rule: what came before the brace was its selector, not a declaration.
        flat = flat.slice(0, flat.lastIndexOf(";") + 1);
      }
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
    } else if (depth === 0) {
      flat += ch;
    }
  }
  for (const part of splitTopLevel(flat, ";")) {
    const colon = part.indexOf(":");
    if (colon > 0) {
      declarations.push({
        property: part.slice(0, colon).trim().toLowerCase(),
        value: part
          .slice(colon + 1)
          .replace(/!important/i, "")
          .trim()
          .toLowerCase(),
      });
    }
  }
  return declarations;
}

/** Every style rule in `source`, with the rules inside `@media`, `@supports` and `@layer` blocks flattened in. */
function extractCssRules(source: string): CssRule[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
  const rules: CssRule[] = [];

  function scan(start: number, end: number, forcedColors: boolean): void {
    let i = start;
    while (i < end) {
      const open = text.indexOf("{", i);
      const semicolon = text.indexOf(";", i);
      if (open === -1 || open >= end) {
        return;
      }
      if (semicolon !== -1 && semicolon < open) {
        // A statement at-rule (`@import`, `@layer a, b;`), or a stray declaration.
        i = semicolon + 1;
        continue;
      }
      let depth = 1;
      let close = open + 1;
      while (close < end && depth > 0) {
        if (text[close] === "{") {
          depth += 1;
        } else if (text[close] === "}") {
          depth -= 1;
        }
        close += 1;
      }
      const prelude = text.slice(i, open);
      const trimmed = prelude.trim();
      if (trimmed.startsWith("@")) {
        const name = /^@[\w-]+/.exec(trimmed)?.[0]?.toLowerCase() ?? "";
        if (!OPAQUE_AT_RULES.has(name)) {
          scan(open + 1, close - 1, forcedColors || /forced-colors/.test(trimmed));
        }
      } else if (trimmed) {
        const lineStart = i + (prelude.length - prelude.trimStart().length);
        rules.push({
          selectors: splitTopLevel(trimmed, ",").map((selector) =>
            selector.replace(/\s+/g, " ").trim(),
          ),
          declarations: parseDeclarations(text.slice(open + 1, close - 1)),
          line: text.slice(0, lineStart).split("\n").length,
          forcedColors,
        });
      }
      i = close;
    }
  }

  scan(0, text.length, false);
  return rules;
}

/** True for `outline: none`, `outline: 0`, `outline-style: none|hidden` and `outline-width: 0`. */
function removesOutline({ property, value }: CssDeclaration): boolean {
  if (property === "outline") {
    return /^(none|0|0px)(\s|$)/.test(value);
  }
  if (property === "outline-style") {
    return value === "none" || value === "hidden";
  }
  return property === "outline-width" && /^0(px)?$/.test(value);
}

/** True for a declaration that paints an outline: a visible style, even in a transparent colour. */
function paintsOutline({ property, value }: CssDeclaration): boolean {
  if (property === "outline") {
    return !/^(none|hidden|0|0px)(\s|$)/.test(value);
  }
  return property === "outline-style" && value !== "none" && value !== "hidden";
}

const FOCUS_PSEUDO = /:focus(?:-visible|-within)?(?![\w-])/;
const STATE_PSEUDO = /:(?:hover|active|focus(?:-visible|-within)?)(?![\w-])/g;

/**
 * The class, tag or id a selector is about, without its state: the last compound selector, state
 * pseudo-classes stripped. `.x:hover` and `.x:focus-visible` are both `.x`.
 */
function selectorSubject(selector: string): string {
  const compounds = splitTopLevel(selector.replace(/\s*([>+~])\s*/g, " "), " ");
  return (compounds.at(-1) ?? selector).replace(STATE_PSEUDO, "");
}

/** True when `selector` mentions `subject` as a whole token (so `.a` is not found in `.a-b`). */
function mentions(selector: string, subject: string): boolean {
  let from = selector.indexOf(subject);
  while (from !== -1) {
    const next = selector[from + subject.length];
    if (next === undefined || !/[\w-]/.test(next)) {
      return true;
    }
    from = selector.indexOf(subject, from + 1);
  }
  return false;
}

interface CssFinding {
  file: string;
  line: number;
  selector: string;
}

/** Rules that remove an outline with nothing under a focus selector to put one back. */
function findOutlineRemovals(file: string, rules: readonly CssRule[]): CssFinding[] {
  const findings: CssFinding[] = [];
  for (const rule of rules) {
    if (rule.forcedColors || !rule.declarations.some(removesOutline)) {
      continue;
    }
    // A selector that only reacts to hover or press is not about focus; one with no state, or a focus one, is.
    const concerned = rule.selectors.filter(
      (selector) => FOCUS_PSEUDO.test(selector) || !/:(?:hover|active)(?![\w-])/.test(selector),
    );
    const unreplaced = concerned.filter((selector) => {
      const subject = selectorSubject(selector);
      return !rules.some(
        (other) =>
          other !== rule &&
          !other.forcedColors &&
          other.declarations.some(paintsOutline) &&
          other.selectors.some(
            (candidate) => FOCUS_PSEUDO.test(candidate) && mentions(candidate, subject),
          ),
      );
    });
    if (unreplaced.length > 0) {
      findings.push({ file, line: rule.line, selector: unreplaced.join(", ") });
    }
  }
  return findings;
}

const cssFiles = () =>
  readdirSync(srcDir, { recursive: true, encoding: "utf8" })
    .map((relative) => relative.replaceAll("\\", "/"))
    .filter((relative) => relative.endsWith(".css"));

describe("focus class scan: the lexer", () => {
  const texts = (source: string) => extractStringLiterals(source).map((literal) => literal.text);

  it("finds double, single and template literals and their line numbers", () => {
    const found = extractStringLiterals("const a = \"one\";\nconst b = 'two';\nconst c = `three`;");
    expect(found).toEqual([
      { text: "one", line: 1 },
      { text: "two", line: 2 },
      { text: "three", line: 3 },
    ]);
  });

  it("splits a template literal around its expressions and scans inside them", () => {
    expect(texts('const c = `a ${cond ? "b c" : "d"} e`;')).toEqual(["a ", "b c", "d", " e"]);
    expect(texts("const c = `a ${`inner ${x}`} b`;")).toEqual(["a ", "inner ", "", " b"]);
  });

  it("keeps braces inside a template expression balanced", () => {
    expect(texts('const c = `a ${fn({ k: "v" })} b`;')).toEqual(["a ", "v", " b"]);
  });

  it("ignores comments", () => {
    expect(
      texts('// "outline-none"\n/* \'focus-visible:outline-none\' */\nconst a = "real";'),
    ).toEqual(["real"]);
  });

  it("handles escapes and JSX text with a stray apostrophe", () => {
    expect(texts('const a = "say \\"hi\\"";')).toEqual(['say \\"hi\\"']);
    expect(texts('const a = <p>Don\'t stop</p>;\nconst b = "after";')).toEqual([
      "t stop</p>;",
      "after",
    ]);
  });

  it("does not read a regular expression or a closing JSX tag as a string", () => {
    expect(texts('const r = /["\'`]/g;\nconst a = "kept";')).toEqual(["kept"]);
    expect(texts('const a = <div className="x"></div>;\nconst b = "y";')).toEqual(["x", "y"]);
  });
});

describe("focus class scan: the rules", () => {
  const rules = (text: string) =>
    checkClassString(text).map((finding) => `${finding.rule}:${finding.token}`);

  it("flags outline-none however it is dressed", () => {
    expect(rules("outline-none")).toEqual(["outline-none:outline-none"]);
    expect(rules("flex focus-visible:outline-none focus-visible:ring-2")).toEqual([
      "outline-none:focus-visible:outline-none",
    ]);
    expect(rules("md:hover:outline-none!")).toEqual(["outline-none:md:hover:outline-none!"]);
  });

  it("does not flag names that merely contain it", () => {
    expect(rules("outline-none-ish my-outline-none")).toEqual([]);
  });

  it("accepts outline-hidden that has a ring or outline beside it", () => {
    for (const text of [
      "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
      "focus:outline-hidden focus:ring",
      "focus-visible:outline-hidden focus-visible:outline-2",
      "focus-visible:outline-hidden focus-visible:inset-ring-2",
      "focus-visible:outline-hidden group-focus-visible:ring-2",
      "focus-visible:outline-hidden focus-visible:ring-[3px]",
      "focus-visible:outline-hidden focus-visible:!ring-2",
    ]) {
      expect(rules(text), text).toEqual([]);
    }
  });

  it("flags outline-hidden with nothing to replace the outline", () => {
    expect(rules("flex focus-visible:outline-hidden")).toEqual([
      "outline-hidden-without-indicator:focus-visible:outline-hidden",
    ]);
    expect(rules("focus:outline-hidden")).toEqual([
      "outline-hidden-without-indicator:focus:outline-hidden",
    ]);
  });

  it("does not count a zero-width ring, offsets, styles or an unrelated variant as a replacement", () => {
    for (const text of [
      "focus:outline-hidden focus:ring-0",
      "focus-visible:outline-hidden focus-visible:ring-offset-2",
      "focus-visible:outline-hidden focus-visible:ring-inset",
      "focus-visible:outline-hidden focus-visible:outline-offset-2",
      "focus-visible:outline-hidden focus-visible:outline-0",
      "focus-visible:outline-hidden focus-visible:outline-solid",
      "focus-visible:outline-hidden hover:ring-2",
      "focus-visible:outline-hidden ring-2",
      "focus-visible:outline-hidden focus-visible:border-0",
      "focus-visible:outline-hidden focus-visible:border-transparent",
      "focus-visible:outline-hidden focus-visible:border-solid",
    ]) {
      expect(rules(text), text).toContain("outline-hidden-without-indicator:" + text.split(" ")[0]);
    }
  });

  it("does not take a changed border colour for a focus indicator", () => {
    // Forced-colors mode keeps a border but not the colour change, and the Tab sweep in the Storybook
    // test runner reads outlines and box-shadows only, so a border colour alone would pass the one
    // and fail the other.
    for (const text of [
      "focus-visible:outline-hidden focus-visible:border-ring",
      "focus-visible:outline-hidden focus-visible:border-2 focus-visible:border-primary",
    ]) {
      expect(rules(text), text).toContain("outline-hidden-without-indicator:" + text.split(" ")[0]);
    }
  });

  it("takes a ring or outline colour as intent, since the width often comes from a base class", () => {
    expect(rules("focus-visible:outline-hidden focus-visible:ring-ring")).toEqual([]);
    expect(rules("focus-visible:outline-hidden focus-visible:outline-ring")).toEqual([]);
  });

  it("ignores outline-hidden that is not a focus variant, for the focus rule", () => {
    expect(rules("hover:outline-hidden")).toEqual([]);
    expect(rules("md:outline-hidden")).toEqual([]);
    expect(rules("outline-hidden").map((rule) => rule.split(":")[0])).not.toContain(
      "outline-hidden-without-indicator",
    );
  });

  it("flags a bare outline-hidden, which paints the same outline focused or not in forced colors", () => {
    expect(rules("flex outline-hidden")).toEqual(["outline-hidden-unconditional:outline-hidden"]);
    expect(rules("outline-hidden!")).toEqual(["outline-hidden-unconditional:outline-hidden!"]);
  });

  it("accepts a bare outline-hidden that has a focus ring of its own to tell focus apart", () => {
    for (const text of [
      "outline-hidden focus-visible:ring-2",
      "outline-hidden focus-visible:outline-2",
      "outline-hidden focus:ring focus:ring-ring",
      "outline-hidden group-focus-visible:ring-2",
    ]) {
      expect(rules(text), text).toEqual([]);
    }
  });

  it("does not take a ring that is always on for one that tells focus apart", () => {
    expect(rules("outline-hidden ring-2 ring-ring")).toEqual([
      "outline-hidden-unconditional:outline-hidden",
    ]);
    expect(rules("outline-hidden hover:ring-2")).toEqual([
      "outline-hidden-unconditional:outline-hidden",
    ]);
  });

  it("leaves a conditional outline-hidden out of the unconditional rule", () => {
    expect(rules("hover:outline-hidden")).toEqual([]);
    expect(rules("data-[state=open]:outline-hidden")).toEqual([]);
  });
});

describe("focus css scan: the parser", () => {
  const rulesOf = (css: string) => extractCssRules(css);

  it("reads selectors, declarations and the line of each rule", () => {
    const [first, second] = rulesOf(
      ".a,\n.b:hover {\n  color: red;\n  outline:none;\n}\n\n.c { margin: 0 }",
    );
    expect(first).toMatchObject({
      selectors: [".a", ".b:hover"],
      line: 1,
      forcedColors: false,
    });
    expect(first!.declarations).toEqual([
      { property: "color", value: "red" },
      { property: "outline", value: "none" },
    ]);
    expect(second).toMatchObject({ selectors: [".c"], line: 7 });
  });

  it("ignores comments, even ones that hold braces and rules", () => {
    const found = rulesOf("/* .x { outline: none } */\n.y { color: red } /* } */");
    expect(found.map((rule) => rule.selectors)).toEqual([[".y"]]);
    expect(found[0]!.line).toBe(2);
  });

  it("flattens the rules inside @media, @supports and @layer, and notes forced-colors blocks", () => {
    const found = rulesOf(
      "@layer base { .a { color: red } }\n@media (min-width: 40rem) { .b { color: red } }\n@media (forced-colors: active) { .c { outline: none } }",
    );
    expect(found.map((rule) => [rule.selectors[0], rule.forcedColors])).toEqual([
      [".a", false],
      [".b", false],
      [".c", true],
    ]);
  });

  it("skips @keyframes and @font-face blocks and statement at-rules", () => {
    const found = rulesOf(
      '@import "x.css";\n@layer a, b;\n@keyframes spin { from { outline: none } to { outline: none } }\n@font-face { font-family: x }\n.z { color: red }',
    );
    expect(found.map((rule) => rule.selectors)).toEqual([[".z"]]);
  });

  it("keeps commas, colons and semicolons inside parentheses and strings together", () => {
    const [rule] = rulesOf(
      '.a:is(.b, .c) { background: url("a;b.png"); outline: none !important }',
    );
    expect(rule!.selectors).toEqual([".a:is(.b, .c)"]);
    expect(rule!.declarations).toEqual([
      { property: "background", value: 'url("a;b.png")' },
      { property: "outline", value: "none" },
    ]);
  });

  it("does not take a nested rule for a declaration", () => {
    const [rule] = rulesOf(".a { color: red; &:hover { outline: none } margin: 0 }");
    expect(rule!.declarations.map((declaration) => declaration.property)).toEqual([
      "color",
      "margin",
    ]);
  });
});

describe("focus css scan: the rules", () => {
  const found = (css: string) =>
    findOutlineRemovals("x.css", extractCssRules(css)).map((finding) => finding.selector);

  it("flags an outline removed with nothing to put it back", () => {
    expect(found(".a { outline: none }")).toEqual([".a"]);
    expect(found(".a { outline:0 }")).toEqual([".a"]);
    expect(found(".a { outline-style: none }")).toEqual([".a"]);
    expect(found(".a { outline-width: 0 }")).toEqual([".a"]);
    expect(found(".a:focus { outline: none !important }")).toEqual([".a:focus"]);
  });

  it("flags a focus rule that only recolours a border or adds a box-shadow", () => {
    expect(found(".a { outline: none }\n.a:focus { border-color: red }")).toEqual([".a"]);
    expect(found(".a { outline: none }\n.a:focus-visible { box-shadow: 0 0 0 2px red }")).toEqual([
      ".a",
    ]);
  });

  it("accepts an outline put back under a focus selector, a transparent one included", () => {
    expect(found(".a { outline: none }\n.a:focus-visible { outline: 2px solid red }")).toEqual([]);
    expect(found(".a { outline: none }\n.a:focus { outline: 2px solid transparent }")).toEqual([]);
    expect(found(".a { outline: none }\n.a:focus-visible { outline-style: solid }")).toEqual([]);
  });

  it("accepts a replacement drawn on a container that has the element inside it", () => {
    expect(
      found(".field { outline: none }\n.card:has(.field:focus-visible) { outline: 2px solid red }"),
    ).toEqual([]);
    expect(
      found(".field { outline: none }\n.card:focus-within { outline: 2px solid red }"),
    ).toEqual([".field"]);
  });

  it("does not count an outline that is not under a focus selector, or removed again", () => {
    expect(found(".a { outline: none }\n.a:hover { outline: 2px solid red }")).toEqual([".a"]);
    expect(found(".a { outline: none }\n.a:focus-visible { outline: none }")).toEqual([
      ".a",
      ".a:focus-visible",
    ]);
    expect(found(".a { outline: none }\n.a { outline: 2px solid red }")).toEqual([".a"]);
  });

  it("does not take one class for another that starts with its name", () => {
    expect(found(".a { outline: none }\n.a-b:focus-visible { outline: 2px solid red }")).toEqual([
      ".a",
    ]);
    expect(found(".a { outline: none }\n.a_b:focus-visible { outline: 2px solid red }")).toEqual([
      ".a",
    ]);
  });

  it("matches the element's own state selectors to the same base", () => {
    expect(
      found(
        ".item:hover, .item:focus-visible { outline: none; background: red }\n.item:focus-visible { outline: 2px solid red }",
      ),
    ).toEqual([]);
    expect(found(".item:hover, .item:focus-visible { outline: none; background: red }")).toEqual([
      ".item:focus-visible",
    ]);
  });

  it("leaves hover-only and forced-colors rules, and rules that keep their outline, alone", () => {
    expect(found(".a:hover { outline: none }")).toEqual([]);
    expect(found("@media (forced-colors: active) { .a { outline: none } }")).toEqual([]);
    expect(found(".a { outline: 2px solid red }")).toEqual([]);
    expect(found(".a { color: red }")).toEqual([]);
  });
});

describe("focus class scan: src", () => {
  const findings = scanSource();
  const open = findings.filter((finding) => !isAllowed(finding));

  const cssFindings = cssFiles().flatMap((relative) =>
    findOutlineRemovals(
      `src/${relative}`,
      extractCssRules(readFileSync(path.join(srcDir, relative), "utf8")),
    ),
  );
  const cssOpen = cssFindings.filter(
    (finding) =>
      !CSS_ALLOWLIST.some(
        (entry) => entry.file === finding.file && entry.selector === finding.selector,
      ),
  );

  it("reads the stylesheets: a meaningful number of rules, and the outline removals among them", () => {
    const ruleCount = cssFiles()
      .map((relative) => extractCssRules(readFileSync(path.join(srcDir, relative), "utf8")).length)
      .reduce((total, count) => total + count, 0);
    expect(ruleCount).toBeGreaterThan(1000);
    // The scan must have something to chew on: at least the rules that do put an outline back.
    const putBack = cssFiles().filter((relative) =>
      /outline:\s*2px/.test(readFileSync(path.join(srcDir, relative), "utf8")),
    );
    expect(putBack.length).toBeGreaterThan(5);
  });

  it("has no stylesheet rule that removes an outline without putting one back on focus", () => {
    expect(
      cssOpen.map((finding) => `${finding.file}:${finding.line} ${finding.selector}`),
      "give the element an outline under :focus-visible (a transparent one counts), or allowlist it with a reason",
    ).toEqual([]);
  });

  it("scans a meaningful amount of source", () => {
    const literalCount = readdirSync(srcDir, { recursive: true, encoding: "utf8" })
      .filter(isScanned)
      .map(
        (relative) =>
          extractStringLiterals(readFileSync(path.join(srcDir, relative), "utf8")).length,
      )
      .reduce((total, count) => total + count, 0);
    expect(literalCount).toBeGreaterThan(5000);
  });

  it("has no outline-none, which erases the focus indicator in forced-colors mode", () => {
    const found = open.filter((finding) => finding.rule === "outline-none");
    expect(found.map(describeFinding), "use outline-hidden").toEqual([]);
  });

  it("gives every focus:outline-hidden a ring, outline or border to replace the outline", () => {
    const found = open.filter((finding) => finding.rule === "outline-hidden-without-indicator");
    expect(found.map(describeFinding)).toEqual([]);
  });

  it("gives every unconditional outline-hidden a focus ring of its own to tell focus apart", () => {
    const found = open.filter((finding) => finding.rule === "outline-hidden-unconditional");
    expect(found.map(describeFinding)).toEqual([]);
  });

  it("keeps the CSS allowlist honest: every entry is explained and still needed", () => {
    for (const entry of CSS_ALLOWLIST) {
      expect(entry.reason.trim().length, `${entry.file} ${entry.selector}`).toBeGreaterThan(10);
      expect(
        cssFindings.some(
          (finding) => finding.file === entry.file && finding.selector === entry.selector,
        ),
        `${entry.file} ${entry.selector} no longer matches anything; remove it`,
      ).toBe(true);
    }
  });

  it("keeps the allowlist honest: every entry is explained and still needed", () => {
    for (const entry of ALLOWLIST) {
      expect(entry.reason.trim().length, `${entry.file} ${entry.token}`).toBeGreaterThan(10);
      expect(
        findings.some((finding) => finding.file === entry.file && finding.token === entry.token),
        `${entry.file} ${entry.token} no longer matches anything; remove it`,
      ).toBe(true);
    }
  });
});
