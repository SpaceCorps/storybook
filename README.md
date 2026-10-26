# SpaceCorps Storybook

> The SpaceCorps design system: React component library, renderers, diagrams, charts, and product widgets — published as `@spacecorps/components` and browsable in Storybook.

[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-blue)](https://www.typescriptlang.org/)
[![Vite+](https://img.shields.io/badge/Vite+-0.3-646CFF)](https://github.com/voidzero/vite-plus)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1-38B2AC)](https://tailwindcss.com/)
[![Storybook](https://img.shields.io/badge/Storybook-8.6-FF4785)](https://storybook.js.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB)](https://react.dev/)

## Hosted Storybook

The static Storybook is built from the `main` branch and served by a small nginx container on the
SpaceCorps Sliplane server (see `Dockerfile` and `deploy/`). Work lands on `development`; merging to
`main` releases, and Sliplane rebuilds on every push to `main`. The site is behind HTTP basic auth
(`STORYBOOK_USER`, `STORYBOOK_PASSWORD` secret env vars); the container refuses to start without a
password unless `STORYBOOK_PUBLIC=1`. This replaces the GitHub Pages workflow, which cannot publish
from a private repo on the free plan.

## Architecture & Subpath Exports

`@spacecorps/components` is structured with modular subpath exports, enabling consumers to import targeted subsets of the library without unnecessary dependencies:

- **`@spacecorps/components`** — Root entry for common components, utilities, and theme provider
- **`@spacecorps/components/ui`** — 38+ Radix UI & shadcn/ui primitives (Button, Input, Card, Dialog, etc.)
- **`@spacecorps/components/renderers`** — Rich content renderers (Markdown, JSON, XML, HTML, Code, Chat, ErrorBoundary)
- **`@spacecorps/components/diagrams`** — Diagram renderers (Mermaid, Graphviz) that lazy-load mermaid and @hpcc-js/wasm-graphviz on first render
- **`@spacecorps/components/tendril`** — Tendril execution widgets, Shell layout, diff inspection, and dashboard analytics
- **`@spacecorps/components/styles/*`** — Design system tokens and stylesheets (`index.css`, `markdown-spacing.css`)

## Installation

`@spacecorps/components` is published to **GitHub Packages**, not npmjs.com. Point the `@spacecorps`
scope at the GitHub registry once per consuming project, in its `.npmrc`:

```ini
@spacecorps:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

`GITHUB_TOKEN` needs the `read:packages` scope. In GitHub Actions the built-in token already has it —
set `permissions: packages: read` on the job and pass `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`.

Then install as usual:

```bash
pnpm add @spacecorps/components
# or
npm install @spacecorps/components
# or
vp install @spacecorps/components
```

## Setup

Import the CSS stylesheet in your application entry point:

```css
@import "@spacecorps/components/styles/index.css";
```

Or in JavaScript/TypeScript:

```ts
import "@spacecorps/components/styles/index.css";
```

## Usage Examples

### 1. Root Import & Theme Provider

```tsx
import { ThemeProvider, useTheme, Button, Card } from "@spacecorps/components";

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="app-theme">
      <Card>
        <Button>Hello World</Button>
      </Card>
    </ThemeProvider>
  );
}
```

### 2. UI Primitives

```tsx
import {
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  Card,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Input,
  cn,
} from "@spacecorps/components/ui";

function DemoComponent() {
  return (
    <div className={cn("space-y-4 p-4")}>
      <Button variant="default" size="lg">
        Primary Action
      </Button>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Open Dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <h2>Dialog Content</h2>
          <p>Your content here</p>
        </DialogContent>
      </Dialog>

      <Card>
        <Badge variant="secondary">Status</Badge>
        <Input placeholder="Enter text..." />
      </Card>

      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Tab 1 Content</TabsContent>
        <TabsContent value="tab2">Tab 2 Content</TabsContent>
      </Tabs>
    </div>
  );
}
```

### 2b. Forms, dates, times, calendars, tables and keyboard

```tsx
import {
  Button,
  DatePicker,
  Field,
  Input,
  TimeCalendar,
  TimeInput,
} from "@spacecorps/components/ui";

function LoginForm() {
  return (
    <form onSubmit={signIn}>
      <Field label="Username" name="username">
        <Input autoComplete="username" />
      </Field>
      <Field label="Password" name="password" hint="At least 12 characters">
        <Input type="password" autoComplete="current-password" />
      </Field>
      <Button type="submit">Sign in</Button>
    </form>
  );
}
```

- **Field** wires `id`, `aria-describedby` (hint and error), `aria-invalid`, `aria-required`, `name`
  and `disabled` into `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `RadioGroup`, `NumberInput`,
  `DatePicker`, `DateRangePicker`, `TimeInput` and `MultipleSelector`; the react-hook-form `FormItem`
  provides the same context. A prop on the control itself wins. `required` sets `aria-required` and
  the label asterisk, never the native attribute. Never derive an `id` from a `name`: `Field`
  generates a unique one. Without a `Field` there is no wiring. `DialogContent`, `AlertDialogContent`,
  `SheetContent` and `PopoverContent` reset the field context for what they contain; wrap any other
  portalled overlay in `FieldReset`, and build a custom control on `useFieldControl(props)`.
- **Password input**: `type="password"` renders a wrapper (`data-slot="password-input"`) with a
  show/hide button, on by default (`passwordToggle={false}` for PINs, or when you flip `type` with a
  button of your own). The button keeps one name, "Show password" (`passwordToggleLabel`), with
  `aria-pressed`. It keeps focus and caret, swaps the type on the same element, and puts
  `type="password"` back before submit, on form reset and on page hide; a disabled field never shows
  its secret. `className` lands on the `<input>`, except the utilities that size or place it (`w-*`,
  `max-w-*`, `flex-*`, `col-*`, `self-*`, `order-*`, margins), which move to the wrapper;
  `containerClassName` styles the wrapper; `revealed` / `onRevealedChange` share one reveal state
  across fields. Edge's own reveal eye is hidden on every password input.
- **Autocomplete**: a plain text `Input` renders `autocomplete="off"` and `data-1p-ignore`. Any
  explicit `autoComplete` that does not contain `off` renders as given and drops `data-1p-ignore`. The
  tokens `username`, `email`, `current-password`, `new-password`, `one-time-code` and `webauthn`, and
  any password input, drop both and turn spellcheck, auto-capitalisation and autocorrect off; `type`
  `email` and `url` turn those three off too but keep the `off` default unless you pass a token
  (`verbatim` forces the three off). `email` sets `inputmode="email"` and `one-time-code`
  `inputmode="numeric"`. A password input without a token omits `autocomplete` and warns in
  development: always pass `"current-password"` or `"new-password"`. `autoComplete={undefined}`
  means "not given"; `autoComplete="on"` renders `autocomplete="on"`. Browsers only offer saved
  credentials after one was saved for that origin.
- **DatePicker / DateRangePicker**: ISO `yyyy-mm-dd` strings, shown and typed as `yyyy-mm-dd`, Monday
  first (`weekStartsOn`), `min` / `max`, `locale` for month and weekday names. ArrowDown in the text
  field opens the calendar on the selected day; closing returns focus to that field. `DateRangePicker`
  submits `{name}-from` and `{name}-to` through hidden inputs; its `id` goes on the From input and the
  group gets `{id}-group`. `Calendar` takes `monthLabel` and `yearLabel` for the names of the month
  and year boxes in its caption (defaults "Month" and "Year"; `locale` does not translate them);
  `DatePicker` and `DateRangePicker` forward both to their calendar. A native `<input type="date|time">` follows the browser's
  locale instead.
- **TimeInput**: a 24-hour `HH:MM` text field whatever the browser's locale (a native
  `<input type="time">` shows `09:00 AM`). Digits are enough (`930` and `0930` become `09:30`);
  ArrowUp / ArrowDown step by `step` minutes, PageUp / PageDown by an hour, and `min` / `max` bound
  both typing and stepping. A list of times (`suggestionStep`, default 30, `0` for none;
  `suggestions` for an explicit list) opens from the clock button, Alt+ArrowDown, or ArrowDown in an empty field (ArrowDown steps down
  once the field has a time). Text that is not
  a time is never guessed at: AM/PM is refused, including a pasted `1:30 PM`, which stays
  `aria-invalid` while it sits in the field and is discarded, with an announcement, when the field
  is left (`discardedMessage` replaces the wording). A pasted `09:30` replaces the field and commits
  at once. A value with seconds (`09:30:00`, as a database `TIME` is serialised) is read as `09:30`.
  The clock button and the list carry the field's name after their own, which is the `aria-label` or
  the string label of the surrounding `Field` (`pickerLabel` and `listLabel` replace "Choose time"
  and "Suggested times"; with a non-text label give the whole name there). `name` submits the value
  through a hidden input.
- **TimeCalendar**: month grid and week time-grid for tracked time (`events` with `id`, `date`,
  `start`, `end`, `hours`, `title`, `color`, `running`), per-day totals, `onDayClick`, `onSlotClick`
  and `onEventClick`, and an agenda below 640 px (`compact`, `compactBelow`). The grid is one tab stop
  (the active day). `onNavigate` reports the anchor day, the view and the visible `range`; fetch
  entries with `getFetchRange(date, view)`, which starts a day earlier than `getVisibleRange`, so a
  night shift that began the evening before the first column still reaches the week view. `timeZone`
  decides what "today" is and how far a running entry has got, `now` pins the clock, `labels` replaces
  every string. All styling is Tailwind utilities; the root exposes `--sc-hour`, `--sc-cell-min`,
  `--sc-gutter` and `--sc-max-body`.
- **DataTable in a Card**: `variant` is `"bordered"` or `"embedded"`. Inside a `CardContent` it
  defaults to `"embedded"`, so a table in a card never draws a second border inside the card's; a
  table inside a `DialogContent`, `AlertDialogContent`, `SheetContent` or `PopoverContent` opened from
  a card is not in the card and defaults to `"bordered"` like anywhere else, and an explicit `variant`
  wins. `<CardContent flush>`
  drops the padding so the table runs edge to edge, the first and last column inset by the card
  padding. `Card` has `min-w-0`, so a wide table scrolls inside its own container instead of
  stretching a card that sits in a flex row or grid cell; add `min-w-fit` to a `Card` that should grow
  with its content instead. While a wide table scrolls, the selection column stays pinned left and
  the row-action column right. `showCaption` draws the caption above the table (the `<caption>` is
  always there, visually hidden); right-aligned columns do not wrap (`nowrap`, `wrapText`). Pass
  `getRowLabel` so a row checkbox reads "Select row Acme AB" and not a UUID.
- **DataTable keyboard**: the body is one tab stop (the active row, moved with the arrow keys,
  Home / End and PageUp / PageDown) and each row adds its checkbox, editable cells and row actions as
  stops of its own, so a 25-row page with one inline action per row is about 26 stops before the
  footer. Enter or Space on a focused row calls `onRowClick`; a click on a button, link or input
  inside a cell does not, and a focused row shows its truncated cells in full. Editable cells open
  with Enter, Space or F2, Enter commits, Escape discards, and Tab / Shift+Tab commit and move focus
  to the next / previous editable cell. The page-boundary buttons are `aria-disabled` (they keep
  focus), the pagination `<nav>` is named after the caption, and an action that removes its own row
  moves focus to the row now at that position.
- **Keyboard and focus**: Dialog, AlertDialog and Sheet return focus to the opener, with or without a
  Trigger (`fallbackFocusRef` covers an opener that left the page; `onCloseAutoFocus` with
  `preventDefault` opts out). Dialog and Sheet open on `data-autofocus`, else the first text field,
  else the Close button, and skip the field on touch devices (`pointer: coarse`) so the keyboard does
  not cover the dialog; AlertDialog opens on Cancel, not on a field. `useReturnFocus` (root and `/ui`
  entries) gives a custom Radix overlay the same return of focus (render its `anchor` as the first child of
  the content). `Tabs` are Radix (arrow keys, one tab stop, a focusable panel); the sidebar below
  768 px is a modal Sheet. `Button` and `IconButton` take `focusableWhenDisabled` (together with
  `disabled`, plus `disabledReason`) to keep a genuinely unavailable control reachable and announced; for a submit
  button gated on validation, prefer leaving it enabled and showing an error summary. Toasts last 5 s
  (12 s when destructive or with an action; `duration` overrides), close with their own button or
  Escape, and a click elsewhere on the page does not dismiss them. Escape with a dialog, sheet,
  alert dialog, menu or listbox open under a toast closes that overlay in one press and clears the toasts; an
  overlay that vetoes Escape leaves them. At most three toasts are open at once (closed ones do not
  count) and the slide-in honours `prefers-reduced-motion`. `DialogContent` draws a 2px ring when the
  dialog container itself has keyboard focus. A soft-disabled control (`GatedActionButton`, a
  `focusableWhenDisabled` button) is `aria-disabled`, never natively `disabled`. Rings are
  `outline-hidden` + `ring`, so they survive forced-colors mode.
- **Page area and sidebar**: `AppShell` renders its desktop sidebar as an `<aside>` named "Sidebar"
  (`sidebarLabel`; `Sidebar` takes `label`). Its page area is `tabindex="-1"` only as the target of the
  `skipLink` prop (`true` for "Skip to content", or a label string; off by default); when the page overflows and nothing in it is tabbable, `SidebarInsetContent` becomes a
  `role="region"` tab stop named "Page content" (`contentLabel`, or `scrollLabel` on
  `SidebarInsetContent`) so the arrow and Page keys can scroll it. A `role`, `aria-label` or
  `aria-labelledby` you pass wins. `ScrollArea` does the same for its viewport: it is a tab stop and a
  `region` (named by `aria-label`, `aria-labelledby` or "Scrollable content") only while the content
  overflows.
- **Ratings and popover links**: `StarRating` and `EmojiRating` with `allowHalf` are one
  `role="slider"` (Left/Right and Up/Down step 0.5, Page Up / Page Down step 1, Home clears, End gives
  the highest) with `aria-label`; without it they are the usual row of buttons. `PopoverLink` opens
  from Enter and Space, and its popover is a dialog named by the phrase.
- **Gamepad** (opt-in, off by default, nothing is listened to or polled until `enabled`): wrap the app
  in `<GamepadNavigationProvider enabled>`. D-pad or left stick moves focus, A activates (Enter
  submits a form from a text field), B sends Escape and, when nothing handled it, steps out of a
  calendar, tree or grid, LB / RB switch tabs. Only pads whose `Gamepad.mapping` is `"standard"` are
  read; wheels, flight sticks and many generic USB pads report `""` and are ignored unless you pass
  `allowNonStandardPads`. A widget keeps only the directions it uses and every other direction moves
  focus on, so nothing traps the pad: tab lists, toolbars and menubars keep Left / Right (the other
  axis moves on); a radio group keeps its own axis and does not wrap past its first or last radio; a
  slider keeps Left / Right (Up / Down when vertical) and stops at min and max; a native `<select>`
  changes with Left / Right, so passing a select never alters it; a spinbutton keeps Up / Down, and so
  does a native `<input type="number">` (the pad steps its value) and any element that carries
  `data-gamepad-step` (`NumberInput` and `TimeInput` do; the attribute name is exported as
  `GAMEPAD_STEP_ATTRIBUTE`); in a menu Right opens a submenu and Left closes it, and in a menubar
  Left / Right switch menus (Radix gets the real arrow key); tree, grid and treegrid keep all four
  but pass on a direction they did not act on. A in a text field submits only as Enter would: a
  form whose default submit button is disabled, or that has several text fields and no submit
  button, does nothing. Mount one `GamepadNavigationProvider`: a second enabled one is inert (with a
  warning in development) until the first unmounts. The full table is the
  comment on `compositeDirections` in `gamepad-logic.ts`. `useGamepadNavigation()` reports `enabled`,
  `connected`, `padId`, `modality` and `lastAction` (its `target` names the element that took focus
  after a move or tab switch). The provider sets `data-input-modality` on
  `<html>` (`gamepad`, `keyboard` or `pointer`, following the device used last once a pad has been
  seen) and `data-gamepad-focus` on the focused element, and draws a focus ring (`ringClassName`; pass
  `""` to style `[data-gamepad-focus]` yourself). Untested on a physical pad.

### 3. Rich Content Renderers

```tsx
import { MarkdownRenderer, JsonRenderer } from "@spacecorps/components/renderers";
import { MermaidRenderer, GraphvizRenderer } from "@spacecorps/components/diagrams";

function ContentDemo() {
  const markdownContent = "# Hello\n\nThis is **Markdown** content.";
  const mermaidDiagram = "graph TD; A-->B; B-->C;";
  const dotGraph = "digraph G { A -> B -> C; }";
  const jsonData = { name: "Example", value: 42 };

  return (
    <div className="space-y-6">
      <MarkdownRenderer content={markdownContent} />
      <MermaidRenderer content={mermaidDiagram} />
      <GraphvizRenderer content={dotGraph} />
      <JsonRenderer data={jsonData} />
    </div>
  );
}
```

### 4. Tendril Widgets

```tsx
import {
  TendrilShell,
  AgentViewer,
  PlanMarkdown,
  TendrilDashboard,
  ContentInput,
  BadgeSelect,
} from "@spacecorps/components/tendril";

function TendrilApp() {
  const dashboardData = {
    kpis: [
      { label: "Plans", value: 42, trend: "up", change: 12 },
      { label: "Jobs", value: 128, trend: "up", change: 8 },
    ],
    activity: [],
    jobs: [],
    trends: [],
  };

  return (
    <TendrilShell
      id="shell"
      eventHandler={(eventName, widgetId, args) => console.log(eventName, widgetId, args)}
      slots={{
        SidebarBody: <nav aria-label="Main">{/* ShellNav and section widgets */}</nav>,
        Content: (
          <div className="space-y-6">
            <TendrilDashboard {...dashboardData} />

            <AgentViewer events={[]} isStreaming={false} />

            <PlanMarkdown content="# Plan Title\n\nPlan description." />

            <ContentInput
              onSubmit={(text) => console.log("Submitted:", text)}
              placeholder="Enter your prompt..."
            />

            <BadgeSelect
              id="type"
              options={[
                { value: "feature", label: "Feature" },
                { value: "bug", label: "Bug" },
              ]}
              value={["feature"]}
              multiple={false}
              events={["OnChange"]}
              eventHandler={(eventName, widgetId, [next]) => console.log("Selected:", next)}
            />
          </div>
        ),
      }}
    />
  );
}
```

## Breaking changes since 0.1.2

Markup, behaviour and API changes that an existing caller or test can see, with what to do about
each. Additive props and new components are in the sections above.

**Inputs and forms**

- **Password `Input` DOM**: `type="password"` now renders
  `<div data-slot="password-input"><input><div><button></div></div>`. `className` and `ref` stay on the
  `<input>`, but sizing and placement utilities (`w-*`, `max-w-*`, `flex-*`, `col-*`, `self-*`,
  `order-*`, margins) move to the wrapper; use `containerClassName` for wrapper styling. A caller with
  its own eye button passes `passwordToggle={false}`. Edge's native reveal eye is hidden.
- **Credential `autocomplete` defaults**: a password, or an `autoComplete` containing `username`,
  `email`, `current-password`, `new-password`, `one-time-code` or `webauthn`, no longer gets
  `autocomplete="off"` or `data-1p-ignore`, and gets `spellcheck="false"`, `autocapitalize="none"` and
  `autocorrect="off"` (so do `type="email"` and `type="url"`). A password without a token omits
  `autocomplete` and warns in development. Plain text inputs with no `autoComplete`, or
  `autoComplete="off"`, are unchanged; any other explicit `autoComplete` value (for example `"name"`
  or `"on"`) now renders as given and no longer adds `data-1p-ignore`.
- **`autoComplete={undefined}`** on an `Input` now means "not given", so a plain field renders
  `autocomplete="off"`; it used to remove the attribute. Pass `autoComplete="on"` for the browser's
  default.
- **`aria-invalid="true"` styling**: `Input`, `Textarea`, the `Select` trigger, `MultipleSelector`,
  `RadioGroup`, `Checkbox` and `Switch` now draw a destructive border and focus ring for it (a
  react-hook-form `FormControl` emits it). In dark mode the invalid colour is `--red`, not the dim
  `--destructive`.
- **`Select` is a function component** around `SelectPrimitive.Root` with the same props (it also reads
  a `Field`'s `name` and `disabled`), so `Select === SelectPrimitive.Root` no longer holds.
- **`DatePicker` and `DateRangePicker`**: closing the calendar returns focus to the text field it was
  opened from with ArrowDown (otherwise to the calendar button, as before), and the hidden inputs carry
  `disabled`. On `DateRangePicker` a caller `id` lands on the first (From) input, not on the group,
  which gets `{id}-group`.
- **`NumberInput`** props now extend `InputProps`. `name` is submitted by a hidden input that holds the
  raw number, and the visible input carries no `name`, so `FormData` holds the number and not the
  formatted text. `disabled` is no longer defaulted to `false`, so a `Field`'s applies.
- **`MultipleSelector`**: the popover is no longer modal (the page stays interactive, Tab leaves);
  Escape closes the list and keeps focus and text (a second Escape clears the text); the chevron is no
  longer a tab stop; chip remove buttons are named `Remove <label>`; Select All and Clear All are
  `role="option"` items inside the list, not buttons in a footer; the empty message is a plain `div`.
- **`InputVariants`**: `textInputTrailingIconButtonClasses` has a focus-visible ring instead of
  `focus:outline-hidden`, and the Small trailing hit target is `size-6` (was `size-5`).
- **react-hook-form `Form`**: `FormControl` no longer emits `aria-invalid="false"` or a dangling
  `aria-describedby`; `FormMessage` has `role="alert"`; `FormItem` reports `hasLabel` only while a
  `FormLabel` is mounted; error text uses the destructive-800/200 steps.
- **`Calendar` caption**: Enter in the month or year box no longer blurs it.

**Overlays, focus and keyboard**

- **`Tabs` are always Radix**: inactive panels stay in the DOM as empty hidden `div role="tabpanel"`,
  the active panel is focusable, and triggers select on mousedown, focus and keys (a bare click still
  selects). `useRadix` is accepted and ignored.
- **Toasts**: `useToast` no longer dismisses on any document click or Escape. A toast times out after
  5 s (12 s when destructive or with an action) unless you pass `duration`. `ToastClose` is named
  "Close". At most three toasts are open at once; closed ones waiting out their exit animation no
  longer count towards it. Escape with an overlay open under a toast closes the overlay in one press
  and clears the toasts (the `Toaster` re-sends one Escape from the original target, and leaves a
  toast alone whose own `onEscapeKeyDown` calls `preventDefault`); an overlay that vetoes Escape
  keeps them. The close icon takes the toast's text colour at 70%, and the close button and action
  have 2px focus rings.
- **Dialog and Sheet initial focus** moves to `data-autofocus` or the first text field instead of the
  Close button (not on touch devices). A caller that relied on Close being first uses
  `onOpenAutoFocus`. `DialogContent` draws a 2px ring when the container itself has keyboard focus
  (`:focus-visible`); it used to hide both outline and ring on any focus
  (`focus:outline-hidden focus:ring-0`).
- **Mobile sidebar** (below 768 px) is a portalled modal Sheet instead of an inline fixed `div`;
  `SidebarMenuButton` and `SidebarMenuSubButton` close it only for a link with an `href`, so a button
  that routes in script passes `closeOnSelect`; no tooltip renders on mobile. `AppShell` wraps its nav
  in a `<nav>`, marks the active link `aria-current="page"`, renders its sidebar as an `<aside>` named
  "Sidebar" (`sidebarLabel`), gives its inset content `tabindex="-1"` only as the target of the skip
  link that the new `skipLink` prop adds (`true` for "Skip to content", or a label string; off by
  default), and makes that area a tab stop labelled "Page content" (`contentLabel`) when the page
  overflows and has nothing a keyboard can reach. `SidebarInset` is already a `<main>`: do not put another in
  `AppShell` children.
- **Desktop `Sidebar` root** is an `<aside aria-label>` (`label`, default "Sidebar"), not a `<div>`.
  Selectors on the tag name change to `aside` or `[data-sidebar]`; classes and data attributes are
  unchanged. `SidebarInsetContent` takes `scrollLabel`; a `role`, `aria-label` or `aria-labelledby`
  you pass wins over its own.
- **Sidebar shortcut and drawer**: Ctrl/Cmd+B toggles the sidebar only when focus is not in an input,
  textarea, select or contenteditable, no other handler has called `preventDefault`, and Alt and Shift
  are not held (it used to toggle from anywhere). The mobile drawer closes by itself when the viewport
  grows past 768 px, and `Sidebar` takes `mobileLabel` (default "Navigation") for the drawer's
  accessible name.
- **The icon-button and shell tooltip** (the one behind `IconButton` and `StatusLine`, and exported
  from `/tendril` as `ShellTooltip`; the `Tooltip` exported by `/ui` is the plain Radix wrapper and
  did not change): `triggerDisabled` is deprecated and ignored. A natively disabled `IconButton` no
  longer has an unnamed focusable wrapper as a tab stop; use `focusableWhenDisabled` for a disabled
  icon button that stays reachable. With empty `content` an element child stays mounted, so a control
  whose tooltip text comes and goes keeps focus, but its trigger is inert: no `data-state`, and
  nothing opens on hover or focus. Text, fragments, `asChild={false}` and `wrapTrigger` children are
  returned bare.
- **`Button` / `IconButton` `focusableWhenDisabled`** (new, opt-in; it only has an effect together
  with `disabled`) renders `aria-disabled="true"` and `data-disabled` with no native `disabled`: the
  control stays a tab stop, ignores click, Enter, Space and submit, drops `onPointerDown` /
  `onMouseDown` and, when it has a popup, ArrowDown / ArrowUp. `disabledReason` is announced as its
  description (a hidden span inside the button, so not rendered with `asChild`); `IconButton` also
  shows it in the tooltip as `label: reason`. A natively disabled button is unchanged.
- **`GatedActionButton` and `VaultDialogShell`'s submit** are soft-disabled: `aria-disabled="true"`
  and no native `disabled`, so assert `aria-disabled`, not `toBeDisabled()`; `.disabled` and
  `:disabled` no longer match. Click, Enter and Space are still ignored, the button is a tab stop,
  and its `textContent` is the label followed by the hidden reason (query by role and name).
  `GatedActionButtonProps` omits `focusableWhenDisabled` and `disabledReason` from `ButtonProps`; the
  gate sets both. `VaultDialogShell` takes a new `submitDisabledReason`, announced as the submit
  button's description and shown in a tooltip on hover and keyboard focus while `submitDisabled`; the
  built-in Vault dialogs pass one.
- **Focus rings**: `CopyToClipboardButton` shows the standard ring after a copy (the old
  `ring-primary` was invisible on the primary fill); menu rows and command items get an inset ring on
  keyboard focus.
- **`PlanWorkspace` tool panels** (Verifications, Questions): the trigger no longer has
  `aria-haspopup="dialog"` and carries `aria-controls` while open (the panel is a disclosure).
  Escape and outside presses leave the panel alone when a nested portalled overlay (popover, select,
  dialog) handles them. In the overflow menu an action with `active: true` is
  `role="menuitemcheckbox"` with `aria-checked` and a check mark, and a loading action is
  `aria-busy` and disabled. Selectors on `role="menuitem"` for a toggle action need `menuitemcheckbox`.

**Widgets**

- **`BadgeSelect`**: the trigger is a single `button role="combobox"` (was a `button` when empty and a
  `div role="combobox"` when filled), options are `div role="option"` and the remove buttons sit beside
  the combobox. Queries for `getByRole("button", { name: placeholder })` become `combobox`. Escape
  with the list open closes only the list (a surrounding Dialog or Sheet stays open), Alt chords other
  than Alt+ArrowDown / Alt+ArrowUp are left to the browser, a selected option that cannot be removed
  shows a check, the remove buttons have a 24px hit area, and pressing a badge's X while the list is
  open closes the list. In a single-select, Tab or Alt+ArrowUp with the list open keeps the
  highlighted option (it fires `OnChange`) before closing, as a native select does; a multi-select or
  an action row is not committed.
- **`ShellTabs` DOM**: the `.tsh-tab` wrapper is gone; `.tsh-tab-main` is the `role="tab"` button
  (inside `role="tablist"` "Agent sessions") and the close buttons live in `.tsh-tab-closes`. CSS or
  tests keyed on `.tsh-tab` need updating. The strip is one roving tab stop (Arrow keys, Home and End
  move between tabs; Enter or Space selects), and the close buttons are `tabIndex=-1`, so Tab no
  longer visits them. Delete on a focused tab closes it when `OnClose` is set. Tabs are 144 to 200px wide and the strip scrolls
  sideways (the wheel too) with its scrollbar hidden, instead of shrinking the tabs to nothing; a tab
  has a native `title`, a 24px close hit area and 36px of right padding, and keeps its highlight while
  its X is hovered. Closing the last tab with focus in the strip leaves a lone new-session button
  holding focus until focus moves on (`TendrilShell` keeps the Tabs row mounted for that long after
  `hasTabs` turns false).
- **`Slider`**: `aria-label` no longer reaches the root `span`; it goes to the thumb, or to the group
  for a range (`thumbLabels` names each thumb).
- **`Stepper`**: a caller `onClick` on `StepperTrigger` composes with the step change instead of
  replacing it (the caller runs first; on the default button `preventDefault()` vetoes the step, but with
  `asChild` the step always moves, so a router link can `preventDefault()` to navigate); `asChild`
  renders its
  single child through Slot, and several children are wrapped in one `div role="button"`. The root is
  `role="list"` and each item `role="listitem"`; each trigger is described by hidden "Completed",
  "Upcoming" or "Loading" text through `aria-describedby` (merged with yours). A disabled `asChild`
  step is dimmed, ignores the pointer and has `tabindex="-1"`.
- **`StarRating` and `EmojiRating`**: activating the pressed star or face from the keyboard clears the
  rating, matching `aria-pressed`; `EmojiRating` buttons are named "Rate N out of M". With
  `allowHalf` they are one `role="slider"` (`aria-label`, `aria-valuenow`, `aria-valuetext`), not a
  group of buttons: there are no per-star buttons or `aria-pressed`, Left/Right and Up/Down step 0.5,
  Page Up / Page Down step 1 and Home clears. Code that selects the stars with
  `getByRole("button")` in half mode uses the slider or `[data-rating]`. Whole mode keeps its row of buttons (still found
  with `getByRole("button")`), now inside a `role="group"` named by `aria-label` (default "Rating"),
  each with `aria-pressed`. An
  unrated star is an outline, an unreached emoji is grey and circled, and `EmojiRating` no longer
  dims faces to 40% opacity.
- **Image viewers**: `ImageOverlay` and the `PlanMarkdown` image viewer render through a Radix Portal
  as a dialog titled "Image preview" (was `aria-label="Image Overlay"`). Escape, focus return and Tab
  containment come from Radix. In `PlanMarkdown` the image is now wrapped in a `button.pmv-img-button`
  (disabled until the image has loaded; `aria-label="Open image"` when it has no alt) so it opens from
  the keyboard and focus returns to it on close. The click handler is on that button, not the `<img>`,
  and selectors that expect the `<img>` directly under the paragraph need updating.
- **`ScrollArea`**: the viewport is a tab stop only while its content overflows, and only then is it
  a `role="region"` (named by `aria-label`, `aria-labelledby` or "Scrollable content"). `aria-label`
  and `aria-labelledby` now land on the viewport, not the root. When the content fits there is no
  role, label or tab stop.
- **`Toolbar`**: arrow keys navigate only from the toolbar's own items (not from inputs in a slot or
  from menu content) and ignore Alt, Ctrl and Meta chords. `ToolbarButton` no longer renders
  `data-disabled="true"`; select `:disabled`. A pressed `ToolbarToggleButton` has a bar under the
  icon as well as the tint. In the overflow menu a `ToolbarToggleButton` is a
  `role="menuitemcheckbox"` with `aria-checked` following `pressed` (it was a plain `menuitem`), and
  an overflowed item's `onClick` receives the menu item's real click event instead of `{}`.
- **`ResizableHandle`** sets `aria-orientation` from its `ResizablePanelGroup` `direction`, and its
  pointer area (`::after`) is 25.9px across (`w-6` at this library's 0.27rem spacing) instead of
  about 4px, so it overlaps each neighbouring panel by about 12px.
- **`PopoverLink`** (additive, nothing to migrate): the trigger is still a `span role="button"` so it
  flows with wrapped text; Enter and Space now open it, and the popover is a dialog named by the
  link text.

**DataTable and Card**

- **`DataTable` in a `CardContent`** defaults to `variant="embedded"` (no border of its own), padded or
  flush; one in a dialog, alert dialog, sheet or popover opened from a card stays `"bordered"`. Pass `variant="bordered"` to keep the old look. `Card` gained `min-w-0`; use `min-w-fit` on a
  `Card` that should grow with a wide child.
- **Pagination**: the first, previous, next and last buttons are `aria-disabled`, not natively
  `disabled` (no `:disabled` selector or `.disabled` check), and the `<nav>` is named
  `<caption> pagination` when the table has a string caption or `aria-label`.
- **Editable cells**: the cell button's name is `Edit <header>: <value>` (was `Edit <header>`), Tab in
  the editor commits and moves on instead of trapping focus, and Escape in the editor does not reach
  app-level Escape listeners. `DataTableCellEditor`'s `onCommit` may receive the blur event as a second argument and it
  has a new optional `onNavigate(direction, event)` for Tab and Shift+Tab; `DataTable`'s
  `onCellCommit` event is unchanged.
- **`onRowClick`** no longer fires for a click on a button, link or input inside a custom cell. A
  consumer `onKeyDown`, `onFocus` or `onBlur` on `DataTable` runs in addition to the table's own.
- **Markup and look**: `showCaption` draws a separate `aria-hidden` copy and leaves the `<caption>`
  visually hidden; the row focus indicator is a 2px inset outline (was `ring-1`); hover and selected
  row tints are opaque; the sticky header is `z-index` 2 (3 for pinned header corners);
  `dataTableRowVariant` now includes the background and focus classes. The select-all
  checkbox reports mixed when only some rows of the page are selected. With `manualPagination`,
  `aria-rowindex` is offset by the page like a client-paged table. Cells that truncate are capped at
  `--ivy-data-table-truncate-width` (20rem; `column.width` is only a preferred width), so a long text
  column no longer stretches the table. Right-aligned cells use tabular numerals.

**New since 0.1.2, so nothing to migrate (behaviour worth knowing)**

`Field`, `TimeInput`, `TimeCalendar`, `GamepadNavigationProvider`, `useReturnFocus` and
`useSoftDisabled` did not exist in 0.1.2. `TimeInput` is typed text and does not take the `Input`
password props (`passwordToggle`, `revealed`, `containerClassName`, `verbatim` and the rest);
`GamepadNavigationProvider` ignores pads whose `mapping` is not `"standard"` unless
`allowNonStandardPads` is set, and only one enabled provider is live at a time (a second is inert and
warns in development). `GAMEPAD_STEP_ATTRIBUTE` (`data-gamepad-step`) is exported from the root and
`/ui` entries; put it on a custom field that steps its value with Up / Down.

**Storybook runner and lint scans (contributors)**

- **Keyboard sweep**: a story with `parameters.keyboard.sweep` now also fails when a focus indicator
  has less than 3:1 contrast, when the page has more stops than `maxStops`, or when the theme it
  rendered in is not the one in the story's `globals`. Per-stop failures read `Keyboard sweep: story "<id>" did not pass.` followed by the stops; a
  theme mismatch fails earlier, naming the declared and rendered themes.
  See [Keyboard sweep](#keyboard-sweep).
- **`tests/focus-class-scan.test.ts`**: a border colour no longer counts as a focus indicator next to
  `focus-visible:outline-hidden`; a bare `outline-hidden` with no focus ring in the string is flagged;
  a stylesheet rule that removes an outline without restoring one under a focus selector is flagged.
  Existing offenders are listed in the test's `ALLOWLIST` and `CSS_ALLOWLIST`; a new one fails the
  suite.

## Tendril Consumer Integration & Setup

`@spacecorps/components` serves as a core UI dependency for `SpaceCorps/Tendril-App` (a desktop Rust and Tauri application).

### 1. Stylesheet Import

Import the standalone compiled CSS bundle at the root of your application:

```ts
import "@spacecorps/@spacecorps/components/style.css";
```

This single stylesheet includes compiled design system tokens, Tailwind CSS utility classes, `@layer base` styles, and component CSS rules.

### 2. Tendril Entrypoint

Import Tendril widgets directly from the `./tendril` subpath:

```tsx
import {
  TendrilShell,
  PlanMarkdown,
  PlanDiffView,
  AgentViewer,
  TendrilProcessViewer,
  ContentInput,
  BadgeSelect,
  SortableVerificationList,
  TendrilDashboard,
} from "@spacecorps/@spacecorps/components/tendril";
```

### 3. Font Setup

The design system uses Geist Sans (`--font-sans`) and Geist Mono (`--font-mono`). Consumer applications can either:

1. Install variable fonts as dependencies:
   ```bash
   pnpm add @fontsource-variable/geist @fontsource-variable/geist-mono
   ```
   and import them in the application entry point:
   ```ts
   import "@fontsource-variable/geist";
   import "@fontsource-variable/geist-mono";
   ```
2. Rely on system fallback fonts (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` for sans, `ui-monospace, monospace` for mono).

### 4. Tauri WebView Compatibility and Safe Navigation

When embedding in desktop webviews (such as Tauri), clicking external links should not navigate the desktop container away from the application.

`PlanMarkdown` provides idiomatic React callback props:

- `onLinkClick?: (href: string, event: React.MouseEvent) => void;`: Intercepts link clicks. When omitted, external links (`http://`, `https://`) automatically open via `window.open(href, "_blank", "noopener,noreferrer")` to protect the desktop webview container.
- `onFileClick?: (filePath: string, event: React.MouseEvent) => void;`: Intercepts local filesystem (`file://`) link clicks for desktop integration (such as opening the file in an external editor or revealing in the OS file explorer). When omitted and `dangerouslyAllowLocalFiles` is false, local file links render as non-navigating text elements.

### 5. Private CI & Artifact Consumption

For reproducible consumption in private CI environments:

- Build and pack release tarballs via `pnpm pack`.
- Attach the generated `.tgz` archive to GitHub Releases or consume via tarball URL in `Tendril-App`.
- This ensures reproducible builds without committing private tokens or registry credentials.

## Storybook Catalog Showcase

This project includes a comprehensive Storybook catalog showcasing all components with interactive examples and documentation.

### Interactive Development

Launch the Storybook development server:

```bash
pnpm run storybook
# or
vp run storybook
```

Navigate to `http://127.0.0.1:6006` to explore the component catalog. When 6006 is already taken the
server steps to the next free port in 6006..6015, and either way the chosen URL is printed on startup
before Storybook boots. Override the range with `STORYBOOK_PORT_BASE`, or pass an exact port through
with `pnpm run storybook -- -p 7777`.

### Production Static Build

Build a production-ready static Storybook site:

```bash
pnpm run storybook:build
# or
vp run storybook:build
```

Output directory: `dist-storybook/`

### Static Preview

Preview the production Storybook build locally:

```bash
pnpm run storybook:preview
# or
vp run storybook:preview
```

### Visual Catalog Structure

The Storybook catalog is organized into the following sections:

- **Foundation** — Theme provider, typography, design tokens
- **UI Primitives** — All 38+ base components with variants and states
- **Renderers** — Content rendering components (Markdown, Mermaid, Graphviz, JSON, XML, HTML)
- **Tendril Shell** — Navigation, tabs, sidebar components
- **Tendril Widgets** — Agent viewer, plan markdown, diff view, dashboard, web viewer
- **Inputs & Controls** — ContentInput, BadgeSelect, SortableVerificationList
- **Specialized Components** — Chat bubbles, error boundaries, loading states

### Storybook Testing

Install Playwright browser binaries (one-time setup):

```bash
pnpm run test-storybook:install
```

Browser binaries are cached in `~/.cache/ms-playwright` (Linux/macOS) or `%USERPROFILE%\AppData\Local\ms-playwright` (Windows) and are not re-downloaded per clone.

Run Storybook tests against a running dev server:

```bash
pnpm run test-storybook
```

Run Storybook tests in CI mode (serves an existing `storybook-static/` on port 6006 and tests
against it, so run `pnpm run build-storybook` first):

```bash
pnpm run test-storybook:ci
```

#### Accessibility testing

Accessibility audits run automatically via `@storybook/addon-a11y` and `axe-playwright` during Storybook test runs.
By default, any axe accessibility violations fail the test suite.

To opt out a story when a violation is inherent to what is being demonstrated (such as a typography scale demo showing multiple heading levels):
use a scoped per-rule disable with an explanatory comment directly above the parameter:

```ts
parameters: {
  // heading-order: this story demonstrates the heading scale directly
  a11y: { config: { rules: [{ id: "heading-order", enabled: false }] } },
},
```

Every opt-out must include an explanatory comment justifying why the rule cannot be satisfied. If a per-rule disable does not fit, `failOnViolation: false` downgrades violations to logged warnings, or `disable: true` can be used for components that cannot be audited in isolation.

#### Keyboard sweep

A story opts into a Tab sweep:

```ts
parameters: { keyboard: { sweep: true, maxStops: 40, forcedColors: true } },
```

The runner presses Tab through the page and, at every stop, compares the element's outline
and box-shadow focused and blurred. Every stop must show a focus indicator that has at least 3:1
contrast against what it is drawn on (the browser's own `outline-style: auto` ring counts as visible),
or the story fails with "did not pass" and the stop named. A page with more stops than `maxStops`
fails too, so raise it to cover the page; `forcedColors` repeats the sweep under
`forced-colors: active`. The theme swept is the one the story renders in, and it must match the
story's `globals`: a dark story needs a story-level `globals: { theme: "dark" }` (Storybook ignores
`parameters.globals`), which the sweep checks against the `dark` class on `<html>`.

`tests/focus-class-scan.test.ts` is the static half. It fails on `outline-none`, on
`focus-visible:outline-hidden` with no ring or outline under a focus variant in the same class string
(a border colour is not a focus indicator), on a bare `outline-hidden` with no ring or outline under
a focus variant in the same class string, and on a stylesheet rule that
removes an outline without putting one back under a focus selector.

#### Visual regression

Every story is screenshotted and compared against a committed PNG baseline in `.storybook/__image_snapshots__/`, named `<story-id>-<theme>-<density>.png`. A story matches its baseline when at most 1% of pixels differ.

The committed baseline set is protected by a unit test floor in `tests/storybook-visual.test.ts` that asserts at least 116 PNGs exist, follow the naming pattern, and are non-empty. This guard runs on every `vp test` execution, so a missing or corrupted baseline set fails the test suite immediately, rather than silently re-recording platform-drifted snapshots or passing with no comparison.

The baselines are **rendered inside a container on purpose**. Text rasterization differs between DirectWrite (Windows), CoreText (macOS) and FreeType (Linux) on every glyph edge, which is far more than the 1% threshold allows, so a baseline generated on a developer machine can never pass on `ubuntu-latest`. Both the committed baselines and the CI comparison use `mcr.microsoft.com/playwright:v1.63.0-noble-amd64`, matching the pinned `playwright` devDependency.

To refresh the baselines after an **intentional design change**, run the Docker command below (a weekly workflow handles baselines that drift as `main` moves forward):

```bash
docker run --rm -t \
  -v "$(pwd)":/work -v /work/node_modules -v /work/storybook-static \
  -w /work mcr.microsoft.com/playwright:v1.63.0-noble-amd64 \
  bash -lc 'corepack enable pnpm \
    && corepack prepare pnpm@11.25.0 --activate \
    && pnpm install --frozen-lockfile --ignore-scripts \
    && pnpm run build-storybook \
    && pnpm run test-storybook:visual:update:ci'
```

On a Linux host add `--user "$(id -u):$(id -g)"`, or the PNGs land root-owned. Swap `test-storybook:visual:update:ci` for `test-storybook:visual:ci` to verify without writing.

For a quick local loop against a dev server already on port 6006 — useful for checking that a story renders at all, but **not** for judging pixels, since host rendering differs from the container:

```bash
pnpm run test-storybook:visual
pnpm run test-storybook:visual:update
```

On failure, annotated diffs are written to `.storybook/__image_snapshots__/__diff_output__/` (gitignored) and uploaded as the `visual-diffs` artifact by CI.

#### Automated baseline refresh

A weekly workflow (Mondays, 04:17 UTC) regenerates the committed baselines in the pinned container and opens a PR when they drift. Baselines go stale when a PR lands between generation and merge — a contributor who changed nothing visual discovers the false failure — so the automation keeps the set current as `main` moves forward. The workflow also runs on demand via `workflow_dispatch` in the Actions tab.

The refresh branch is `chore/visual-baseline-refresh`, force-pushed, with one long-lived PR. Only PNGs that fail the 1% threshold, or that do not yet exist, are written, so the diff is exactly the set of drifted baselines.

Opening the PR requires either the Actions "Allow GitHub Actions to create and approve pull requests" setting (Settings / Actions / General / Workflow permissions), or a `BASELINE_REFRESH_TOKEN` repository secret. The branch is pushed either way, so the workflow never loses data — it fails with a clear message naming the branch and the setting.

Opt a story out when it cannot produce stable pixels — a clock, a random seed, or an external site. The
parameter works on the meta, which covers every story in the file:

```ts
const meta: Meta<typeof Thing> = {
  title: "UI/Thing",
  component: Thing,
  parameters: { visual: { disable: true } },
};
```

or on a single story, when the rest of the file is fine:

```ts
export const Randomized: Story = {
  parameters: { visual: { disable: true } },
};
```

Currently opted out, grouped by why (a bare title means every story under it; `Title` → `Story` names
single stories). `tests/readme-catalog-section.test.ts` fails when a title with an opt-out is missing
from this list:

- **Seeded dates or times, and calendars or lists that open in a portal**: `UI/Calendar` (seeded with
  `new Date()`), `UI/DatePicker`, `UI/TimeInput`, `UI/TimeCalendar`.
- **Pixels that depend on something else**: `Components/Terminal` (the emulator measures its font),
  `Components/WebViewer` (frames an external site), `Domain/Loading` → `Skeleton` (picks its line count
  and widths with `Math.random()`) and `Components/AgentViewer` → `WithRichPlanLogs` (auto-scrolls, and
  its embedded diagrams resize the container as they render, so the scroll lands a few pixels off each
  run).
- **Content in a portal outside the captured root, or stories about focus rather than looks**:
  `UI/GamepadNavigation`, `UI/Keyboard`; `UI/Dialog` → `OpenOverPage`, `ScrollLockDoesNotShiftLayout`,
  `ControlledOpen`, `ChainedDialogs`, `EscapeWithAToastOver`, `EscapeVetoedWithAToastOver`, `OpenedFromContextMenu`,
  `AsChild`; `UI/AlertDialog` →
  `ControlledOpen`, `ConfirmThenReason`; `UI/Sheet` → `ControlledOpen`; `UI/Sidebar` →
  `AppShellKeyboard`, `DrawerWithAMenu`, `AppShellCollapsedFooter`; `UI/MultiSelect` → `Chips`,
  `InsideDialog`, `WithActions`, `LongListInsideDialog`; `UI/Toolbar` → `OverflowWithToggles`;
  `UI/DataTable` → `DialogOpenedFromCard`; `Components/PlanWorkspace`; `Components/PlanMarkdown` →
  `WithImage`; `Renderers/MarkdownRenderer` → `ImagesAndPopoverLinks`.
- **Interaction stories whose look another story already compares**: `UI/Tabs` → `KeyboardNavigation`,
  `Controlled`; `UI/Button` → `FocusableWhenDisabled`, `FocusableWhenDisabledBothThemes`,
  `IconButtonFocusableWhenDisabled`.
- **No baseline yet** (the flag comes off once the visual-baseline-refresh workflow has produced one):
  `UI/Card` → `WithFlushTable`, `FlushTableWithoutHeader`; `UI/DataTable` → the `InsideCard*` stories,
  `Bordered`, `Embedded`, `RowClick`, `RemovableRows`; `Components/PlanDiffView` → `ChangedFilesTree`;
  `UI/ScrollArea` → `FitsWithoutScrolling`; `UI/Slider` → `Range`, `CurrencyWithSpokenValues`;
  `UI/Stepper` → `AsChildLinks`, `AsChildDisabledStep`; `UI/Toolbar` → `WithSearchField`;
  `Components/BadgeSelect` → `InsideDialog`, `NonRemovableSelected`;
  `Domain/EmojiRating` → `Unrated`, `WholeFaces`, `HalfFaces`; `Domain/StarRating` → `Unrated`,
  `HalfStars`; `Patterns/Auth forms` and `UI/Field` (every story); `UI/Checkbox`, `UI/RadioGroup`,
  `UI/Switch` → `Invalid`; `UI/Input` → `Password`, `PasswordDensities`, `PasswordStates`,
  `PasswordNarrow`, `SharedReveal`, `Invalid`, `Semantics`; `Shell/TendrilShell` → `ManyAgentSessions`,
  `TwentyFourAgentSessions`, `SingleAgentSession`.

Animated stories do **not** need it: the runner injects CSS that pauses animations and transitions before
screenshotting.

A story whose content is _slow_ rather than unstable needs a settle delay instead of an opt-out. The
runner waits 100 ms between freezing the page and screenshotting it; stories that lazy-load a renderer
finish later than that and would otherwise be captured showing a loading placeholder:

```ts
parameters: { visual: { settleDelay: 3000 } },
```

`Renderers/MermaidRenderer`, `Renderers/GraphvizRenderer` and `Components/PlanMarkdown` use it, because
mermaid and `@hpcc-js/wasm-graphviz` are imported on first render and lay their diagrams out
asynchronously. A settle delay only helps when the story is still when it finishes — a story that both
renders late _and_ moves (`Components/AgentViewer` → `WithRichPlanLogs`) has to be opted out instead.

#### CI

The [storybook-tests.yml](.github/workflows/storybook-tests.yml) workflow runs on pushes to `main` and on pull requests that target `main`, as two jobs:

- **`test`** — builds Storybook and runs the accessibility and interaction pass. It caches Playwright browsers to avoid re-downloading on every run.
- **`visual`** — `needs: test`, so it only starts once accessibility is green. It runs in the pinned Playwright container (which already ships browsers, so no install step) and fails if any committed baseline is missing or if snapshots do not match.

## Development & Quality Gates

This project uses [Vite+](https://github.com/voidzero/vite-plus), a unified web toolchain that integrates:

- **Rolldown** & **tsdown** for fast bundling and `.d.mts` declaration generation
- **Oxlint** & **Oxfmt** for lightning-fast linting and formatting
- **Vitest** for unit testing

### Quality Checks

Run all linting, formatting, and type-checking in one command:

```bash
pnpm run check
# or
vp check
```

Auto-fix issues:

```bash
vp check --fix
```

### Windows: type-aware lint binary

Type-aware linting shells out to `tsgolint`. On Windows, pnpm only installs a `tsgolint.CMD` shim,
and that shim hands `cmd.exe` an unnormalized path into the virtual store — which exceeds the
260-character `MAX_PATH` limit whenever the checkout sits in a deep directory, so `vp check` fails
with:

```
Error running tsgolint: "exit status: exit code: 1"
The system cannot find the path specified.
```

`scripts/patch-tsgolint-win.ts` fixes this by placing the native `tsgolint.exe` where Vite+ looks
for it before falling back to the shim, so `cmd.exe` is never involved. It is a no-op on non-Windows
platforms.

Every `pnpm install` deletes that binary again while relinking bins, so the script runs from
`prepare` (which pnpm executes _after_ bin linking) as well as from `pnpm lint` and `pnpm run check`.
You should never need to invoke it, but to re-apply the repair by hand:

```bash
tsx scripts/patch-tsgolint-win.ts
```

Add `--json` to see what it resolved - the source binary, the target path and its length - without
writing anything.

**Retiring this repair:** The canary in `tests/tsgolintWinPatch.test.ts` fails when `oxlint-tsgolint` declares an `.exe` bin, or when pnpm's shim stops passing an unnormalized path. When that happens, the patch is obsolete and can be removed. Delete:

1. `scripts/patch-tsgolint-win.ts`
2. `tests/tsgolintWinPatch.test.ts`
3. The `tsx scripts/patch-tsgolint-win.ts && ` prefix on both `lint` and `check` in `package.json`
4. The `prepare` script (`tsx scripts/patch-tsgolint-win.ts`, its only command)
5. This README subsection

To confirm manually: run `pnpm install --ignore-scripts`, then check if `node_modules/.pnpm/vite-plus@*/node_modules/.bin/tsgolint.exe` exists.

### Windows: line endings

The repo enforces LF line endings via `.gitattributes`, overriding your local `core.autocrlf` setting
— you do not need to change your global git config. If you cloned before `.gitattributes` was
committed, you may see `vp check` report formatting issues in files that show no diff in `git status`.
This happens when your working copy has CRLF but the committed blob is LF: git's stat cache keeps
reporting them clean, while oxfmt sees CRLF as incorrect.

To fix it, discard uncommitted work and re-checkout:

```bash
git rm --cached -rq . && git reset --hard
```

This empties the index and forces git to re-checkout every file with the correct line endings.

**Warning:** The command above discards all uncommitted changes. Commit or stash your work first.

For a single file:

```bash
rm <path> && git checkout -- <path>
```

**Note:** `git add --renormalize .` normalizes the index but does not update the working tree, so it
will not fix the `vp check` failure.

### Windows: MAX_PATH budget

Windows process creation fails at 260 characters, independently of the `LongPathsEnabled` registry flag. Tendril worktrees inherit this ceiling: the native TypeScript compiler (`tsc.exe`) that `vp pack` spawns sits at `<checkout-path> + 116-character suffix`, so a checkout path of 144 characters or more breaks builds with `The system cannot find the path specified.`

Tendril's worst-case worktree path for this repo is 126 characters (`D:\.tendril\Plans\` + a 66-character plan folder + `\Worktrees\SpaceCorps\@spacecorps/components`), giving a 242-character target with 17 characters of headroom. `virtualStoreDirMaxLength: 40` in `pnpm-workspace.yaml` caps pnpm's virtual store directory names at 40 characters instead of the Windows default of 60, but does not shorten platform-specific package directories like `@typescript/typescript-win32-x64` that already fit under the cap. The binding constraint is the native compiler's path length, not the virtual store depth.

`tests/max-path-budget.test.ts` enforces the budget with three guards: (1) the declared and installed `virtualStoreDirMaxLength` agree, (2) every executable this repo spawns fits inside MAX_PATH from a maximum-depth Tendril worktree, and (3) a ratchet assertion that the deepest executable path in the tree has not grown. The test runs on Linux CI too, so the constraint is portable.

To measure your current path length, run the diagnostic command (reports `targetLength` without modifying anything):

```bash
tsx scripts/patch-tsgolint-win.ts --json
```

### Testing

Run the test suite:

```bash
pnpm test
# or
vp test
```

Run tests in watch mode during development:

```bash
vp test --watch
```

### Library Packaging

Build the library for production:

```bash
pnpm run build
# or
vp pack
```

This command:

- Bundles all entrypoints (`index.ts`, `ui.ts`, `renderers.ts`, `tendril.ts`, `diagrams.ts`,
  `charts.ts`, `theme.ts`) to ESM modules
- Generates TypeScript declaration files (`.d.mts`) with `tsgo`
- Outputs to `dist/` directory with sourcemaps

Verify the build output:

```bash
ls dist/
# index.mjs        index.d.mts
# ui.mjs           ui.d.mts
# renderers.mjs    renderers.d.mts
# tendril.mjs      tendril.d.mts
# diagrams.mjs     diagrams.d.mts
# charts.mjs       charts.d.mts
# theme.mjs        theme.d.mts
```

### Development Workflow

Watch mode for rapid iteration:

```bash
pnpm run dev
# or
vp pack --watch
```

This rebuilds the library automatically on file changes.

## Project Structure

```
@spacecorps/components/
├── src/
│   ├── index.ts              # Root entrypoint
│   ├── ui.ts                 # UI primitives entrypoint
│   ├── renderers.ts          # Renderers entrypoint
│   ├── tendril.ts            # Tendril widgets entrypoint
│   ├── components/           # Component implementations
│   │   ├── ui/               # 38+ Radix/shadcn primitives
│   │   ├── Shell/            # Tendril shell components
│   │   ├── AgentViewer/      # Agent execution visualizer
│   │   ├── PlanMarkdown/     # Plan markdown renderer
│   │   ├── TendrilDashboard/ # Analytics dashboard
│   │   └── ...
│   ├── lib/                  # Utility functions
│   ├── hooks/                # Custom React hooks
│   ├── contexts/             # React contexts
│   ├── styles/               # Global CSS and design tokens
│   └── types/                # TypeScript type definitions
├── tests/                    # Vitest test suite
├── stories/                  # Storybook stories
├── dist/                     # Built library output (gitignored)
├── dist-storybook/           # Built Storybook output (gitignored)
├── package.json              # Package manifest & scripts
├── vite.config.ts            # Vite+ configuration
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

## License

MIT

## Contributing

Contributions are welcome! Please ensure all changes pass quality checks:

```bash
vp check && vp test
```
