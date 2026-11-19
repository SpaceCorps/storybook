import { describe, expect, expectTypeOf, it } from "vitest";
import * as root from "../src/index";
import * as ui from "../src/ui";
import * as renderers from "../src/renderers";
import * as workbench from "../src/workbench";

/**
 * What a consumer imports for forms, dates, times, calendars, gamepad input and focus handling, in
 * groups. Both `@spacecorps/components` and `@spacecorps/components/ui` re-export every group with
 * `export * from ...`, so dropping one line from `src/index.ts` or `src/ui.ts` removes a whole group
 * at once. Naming the names, not the group, is what makes that fail a test with a readable list.
 */
const SHARED_EXPORTS = {
  field: [
    "Field",
    "FieldReset",
    "FieldContext",
    "useFieldContext",
    "useFieldControl",
    "fieldVariant",
    "fieldErrorTextClass",
  ],
  "time input": [
    "TimeInput",
    "parseTimeText",
    "timeToMinutes",
    "minutesToTime",
    "timeListVariant",
    "timeOptionVariant",
  ],
  "time calendar": [
    "TimeCalendar",
    "getVisibleRange",
    "getFetchRange",
    "getPeriodRange",
    "CALENDAR_COLORS",
    "calendarColorForKey",
    "formatTrackedHours",
  ],
  "gamepad navigation": [
    "GamepadNavigationProvider",
    "useGamepadNavigation",
    "gamepadFocusRingClass",
    "GAMEPAD_FOCUS_ATTRIBUTE",
    "INPUT_MODALITY_ATTRIBUTE",
    "GAMEPAD_AXIS",
    "GAMEPAD_BUTTON",
  ],
  "date pickers": [
    "DatePicker",
    "DateRangePicker",
    "compareIsoDates",
    "formatIsoDate",
    "isIsoDate",
    "parseIsoDate",
    "datePickerButtonVariant",
    "datePickerInputVariant",
    "dateRangeFrameVariant",
  ],
  "soft-disabled buttons": ["Button", "buttonVariant", "useSoftDisabled"],
  "data table": [
    "DataTable",
    "DataTableCellEditor",
    "DataTablePagination",
    "useDataTableRowFocus",
    "useInlineCellEdit",
    "dataTableRowVariant",
  ],
} as const;

describe("Package Exports", () => {
  describe("Root Export (@spacecorps/components)", () => {
    it("should export ThemeProvider and theme utilities", () => {
      expect(root.ThemeProvider).toBeDefined();
      expect(root.useTheme).toBeDefined();
      expect(root.ThemeContext).toBeDefined();
    });

    it("should export utility functions", () => {
      expect(root.cn).toBeDefined();
    });

    it("should export common UI components", () => {
      expect(root.Button).toBeDefined();
      expect(root.Input).toBeDefined();
      expect(root.Card).toBeDefined();
      expect(root.Badge).toBeDefined();
      expect(root.DataTable).toBeDefined();
      expect(root.Dialog).toBeDefined();
      expect(root.Tabs).toBeDefined();
    });

    it("should export primary renderers", () => {
      expect(root.MarkdownRenderer).toBeDefined();
    });

    it("should export primary SpaceCorps widgets", () => {
      expect(root.WorkbenchShell).toBeDefined();
      expect(root.AgentViewer).toBeDefined();
      expect(root.PlanMarkdown).toBeDefined();
      expect(root.AgentDashboard).toBeDefined();
      expect(root.QuestionsPanel).toBeDefined();
    });

    it("should export density context and scale", () => {
      expect(root.DensityProvider).toBeDefined();
      expect(root.useDensity).toBeDefined();
      expect(root.DensityScale).toBeDefined();
      expect(typeof root.useDensityScale).toBe("function");
    });

    it("should export shared hooks", () => {
      expect(root.useResizableSidebar).toBeDefined();
      expect(typeof root.useResizableSidebar).toBe("function");
    });

    it("should export PlanWorkspace", () => {
      expect(root.PlanWorkspace).toBeDefined();
    });

    it("should export image and debug-log utilities", () => {
      expect(root.debugLog).toBeDefined();
      expect(root.isDebugLoggingEnabled).toBeDefined();
      expect(root.isImageFile).toBeDefined();
      expect(root.isCompressibleImage).toBeDefined();
      expect(root.processImageFile).toBeDefined();
    });
  });

  describe("UI Primitives Export (@spacecorps/components/ui)", () => {
    it("should export utility functions", () => {
      expect(ui.cn).toBeDefined();
    });

    it("should export key UI primitive components", () => {
      // Verify the module exports exist
      expect(Object.keys(ui).length).toBeGreaterThan(0);

      // Sample key primitives (not exhaustive)
      expect(ui.Button).toBeDefined();
      expect(ui.Input).toBeDefined();
      expect(ui.Card).toBeDefined();
      expect(ui.Badge).toBeDefined();
      expect(ui.Dialog).toBeDefined();
      expect(ui.Tabs).toBeDefined();
      expect(ui.Checkbox).toBeDefined();
      expect(ui.Switch).toBeDefined();
      expect(ui.Accordion).toBeDefined();
      expect(ui.Slider).toBeDefined();
      expect(ui.Toggle).toBeDefined();
      expect(ui.Label).toBeDefined();
      expect(ui.Select).toBeDefined();
      expect(ui.DataTable).toBeDefined();
      expect(ui.DataTablePagination).toBeDefined();
    });

    it("should export variant namespaces", () => {
      expect(ui.DetailVariants).toBeDefined();
      expect(ui.ExpandableVariants).toBeDefined();
      expect(ui.InputVariants).toBeDefined();
      expect(ui.SelectVariants).toBeDefined();
      expect(ui.TableVariants).toBeDefined();
    });

    it("should export widget utilities and shared primitives", () => {
      expect(ui.IconButton).toBeDefined();
      expect(ui.StatusLine).toBeDefined();
      expect(ui.withTooltipScope).toBeDefined();
      expect(ui.TuiBadge).toBeDefined();
      expect(ui.CountBadge).toBeDefined();
      expect(ui.StatusDot).toBeDefined();
    });
  });

  describe("Renderers Export (@spacecorps/components/renderers)", () => {
    it("should export rich content renderers", () => {
      expect(renderers.MarkdownRenderer).toBeDefined();
      expect(renderers.JsonRenderer).toBeDefined();
      expect(renderers.XmlRenderer).toBeDefined();
      expect(renderers.HtmlRenderer).toBeDefined();
    });

    it("should export specialized presentation components", () => {
      expect(renderers.Icon).toBeDefined();
      expect(renderers.InvalidIcon).toBeDefined();
      expect(renderers.Kbd).toBeDefined();
      expect(renderers.Loading).toBeDefined();
      expect(renderers.LoadingScreen).toBeDefined();
      expect(renderers.LogoLoading).toBeDefined();
      expect(renderers.TextShimmer).toBeDefined();
      expect(renderers.CopyToClipboardButton).toBeDefined();
      expect(renderers.EmojiRating).toBeDefined();
      expect(renderers.StarRating).toBeDefined();
      expect(renderers.NumberInput).toBeDefined();
    });

    it("should export chat components", () => {
      expect(renderers.ChatBubble).toBeDefined();
      expect(renderers.ChatInput).toBeDefined();
      expect(renderers.ChatMessageList).toBeDefined();
      expect(renderers.MessageLoading).toBeDefined();
    });

    it("should export error handling components", () => {
      expect(renderers.ErrorBoundary).toBeDefined();
      expect(renderers.ErrorDisplay).toBeDefined();
      expect(renderers.ErrorSheet).toBeDefined();
      expect(renderers.DevTools).toBeDefined();
    });

    it("should export utility functions", () => {
      expect(renderers.copyToClipboard).toBeDefined();
      expect(renderers.getPlatformShortcut).toBeDefined();
    });
  });

  describe("SpaceCorps Export (@spacecorps/components/workbench)", () => {
    it("should export shell components", () => {
      expect(workbench.WorkbenchShell).toBeDefined();
      expect(workbench.ShellNav).toBeDefined();
      expect(workbench.ShellTabs).toBeDefined();
      expect(workbench.ShellAgentButton).toBeDefined();
      expect(workbench.ShellNewPlanButton).toBeDefined();
      expect(workbench.ShellSettingsButton).toBeDefined();
      expect(workbench.ShellSidebarHeader).toBeDefined();
      expect(workbench.ShellSidebarSection).toBeDefined();
      expect(workbench.BrandIcon).toBeDefined();
      expect(workbench.brandIcons).toBeDefined();
    });

    it("should export shell rail flyout, section items, and tooltip", () => {
      expect(workbench.ShellRailFlyout).toBeDefined();
      expect(workbench.ShellSectionItems).toBeDefined();
      expect(workbench.ShellTooltip).toBeDefined();
      expect(workbench.sectionItemIcons).toBeDefined();
      expect(workbench.formatShortcut).toBeDefined();
    });

    it("should export the plan workspace split-pane layout", () => {
      expect(workbench.PlanWorkspace).toBeDefined();
    });

    it("should export shared hooks", () => {
      expect(workbench.useResizableSidebar).toBeDefined();
      expect(typeof workbench.useResizableSidebar).toBe("function");
    });

    it("should export agent and execution visualizers", () => {
      expect(workbench.AgentViewer).toBeDefined();
      expect(workbench.ProcessViewer).toBeDefined();
    });

    it("should export inputs and form controls", () => {
      expect(workbench.ContentInput).toBeDefined();
      expect(workbench.BadgeSelect).toBeDefined();
      expect(workbench.SortableVerificationList).toBeDefined();
    });

    it("should export plan markdown components", () => {
      expect(workbench.PlanMarkdown).toBeDefined();
      expect(workbench.DraftMarkdown).toBeDefined();
      expect(workbench.AlertBlockquote).toBeDefined();
      expect(workbench.AnnotationPopover).toBeDefined();
      expect(workbench.QuestionsCallout).toBeDefined();
      expect(workbench.SearchOverlay).toBeDefined();
    });

    it("should export plan diff components", () => {
      expect(workbench.PlanDiffView).toBeDefined();
      expect(workbench.getLanguageFromFilePath).toBeDefined();
      expect(workbench.registerExtensionMapping).toBeDefined();
      expect(workbench.registerExtensionMappings).toBeDefined();
      expect(workbench.clearCustomExtensionMappings).toBeDefined();
      expect(workbench.customExtensionRegistry).toBeDefined();
    });

    it("should export plan changes view and its file tree helper", () => {
      expect(workbench.PlanChangesView).toBeDefined();
      expect(workbench.buildFileTree).toBeDefined();
    });

    it("should export plan git view", () => {
      expect(workbench.PlanGitView).toBeDefined();
    });

    it("should export dashboard components", () => {
      expect(workbench.AgentDashboard).toBeDefined();
      expect(workbench.ActivityGrid).toBeDefined();
      expect(workbench.PillBars).toBeDefined();
      expect(workbench.TrendChart).toBeDefined();
      expect(workbench.HoverTip).toBeDefined();
    });

    it("should export web viewer", () => {
      expect(workbench.WebViewer).toBeDefined();
    });

    it("should export workbench questions widgets and helpers", () => {
      expect(workbench.QuestionsPanel).toBeDefined();
      expect(workbench.QuestionsForm).toBeDefined();
      expect(workbench.ChatQuestionsBlock).toBeDefined();
      expect(workbench.DescriptionMarkdown).toBeDefined();
      expect(workbench.buildAnswersSummary).toBeDefined();
      expect(workbench.canSubmitAnswers).toBeDefined();
      expect(workbench.documentAnswers).toBeDefined();
      expect(workbench.documentOtherOpen).toBeDefined();
      expect(workbench.entryTitle).toBeDefined();
      expect(workbench.hasEntries).toBeDefined();
      expect(workbench.submitNote).toBeDefined();
      expect(workbench.unansweredRequired).toBeDefined();
    });
  });
});

describe("Forms, dates, times, calendars, keyboard and focus exports", () => {
  const entries: Array<[string, object]> = [
    ["@spacecorps/components", root],
    ["@spacecorps/components/ui", ui],
  ];

  describe.each(entries)("%s", (_entry, barrel) => {
    it.each(Object.entries(SHARED_EXPORTS))("exports the %s names", (_group, names) => {
      const exported = barrel as Record<string, unknown>;
      const missing = names.filter((name) => exported[name] === undefined);
      expect(missing).toEqual([]);
    });
  });

  it("exports the hooks and components as callable things", () => {
    for (const barrel of [root, ui]) {
      expect(typeof barrel.useFieldControl).toBe("function");
      expect(typeof barrel.useFieldContext).toBe("function");
      expect(typeof barrel.useGamepadNavigation).toBe("function");
      expect(typeof barrel.useSoftDisabled).toBe("function");
      expect(typeof barrel.getFetchRange).toBe("function");
      expect(typeof barrel.getVisibleRange).toBe("function");
      expect(typeof barrel.parseTimeText).toBe("function");
      // `forwardRef` components are objects, plain function components are functions.
      for (const component of [
        barrel.Field,
        barrel.FieldReset,
        barrel.TimeInput,
        barrel.TimeCalendar,
        barrel.GamepadNavigationProvider,
        barrel.DatePicker,
        barrel.DateRangePicker,
      ]) {
        expect(["function", "object"]).toContain(typeof component);
      }
    }
  });

  it("exports useReturnFocus from both entries", () => {
    expect(typeof root.useReturnFocus).toBe("function");
    expect(typeof ui.useReturnFocus).toBe("function");
  });

  it("exports Calendar and the Input helpers from the ui entry", () => {
    expect(ui.Calendar).toBeDefined();
    expect(typeof ui.InputVariants.resolveInputSemantics).toBe("function");
    expect(ui.InputVariants.textInputPasswordPaddingVariant).toBeDefined();
  });

  // Types are erased at run time, so these are checked by the type checker (`vp check`): dropping a
  // barrel line, or renaming one of these, fails there with "has no exported member".
  it("exports the public types from both entries", () => {
    expectTypeOf<ui.DataTableVariant>().toEqualTypeOf<"bordered" | "embedded">();
    expectTypeOf<root.DataTableVariant>().toEqualTypeOf<ui.DataTableVariant>();
    expectTypeOf<ui.DataTableProps<{ id: string }>["variant"]>().toEqualTypeOf<
      ui.DataTableVariant | undefined
    >();
    expectTypeOf<ui.CalendarView>().toEqualTypeOf<"month" | "week">();
    expectTypeOf<root.CalendarView>().toEqualTypeOf<ui.CalendarView>();
    expectTypeOf<ui.InputModality>().toEqualTypeOf<"gamepad" | "keyboard" | "pointer">();
    expectTypeOf<root.InputModality>().toEqualTypeOf<ui.InputModality>();
    expectTypeOf<ui.DateRangeValue>().toEqualTypeOf<{ from: string; to: string }>();
    expectTypeOf<root.DateRangeValue>().toEqualTypeOf<ui.DateRangeValue>();
    expectTypeOf<ui.FieldProps>().toHaveProperty("label");
    expectTypeOf<root.FieldProps>().toHaveProperty("label");
    expectTypeOf<ui.TimeInputProps>().toHaveProperty("pickerLabel");
    expectTypeOf<root.TimeInputProps>().toHaveProperty("pickerLabel");
    expectTypeOf<ui.TimeCalendarProps>().toHaveProperty("events");
    expectTypeOf<root.TimeCalendarProps>().toHaveProperty("events");
    expectTypeOf<ui.TimeCalendarEvent>().toHaveProperty("start");
    expectTypeOf<ui.TimeCalendarNavigation>().toHaveProperty("range");
    expectTypeOf<ui.GamepadNavigationProviderProps>().toHaveProperty("allowNonStandardPads");
    expectTypeOf<root.GamepadNavigationProviderProps>().toHaveProperty("allowNonStandardPads");
    expectTypeOf<ui.GamepadNavigationState>().toHaveProperty("modality");
    expectTypeOf<ui.SoftDisabledOptions<HTMLButtonElement>>().not.toBeAny();
    expectTypeOf<root.UseReturnFocusResult>().toHaveProperty("anchor");
  });
});
