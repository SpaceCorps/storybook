import { describe, expect, it } from "vite-plus/test";
import {
  DATA_TABLE_COLUMN_WIDTH_ESTIMATE,
  DATA_TABLE_RESERVED_WIDTH,
  DATA_TABLE_REVEAL_MARGIN,
  estimateActionsColumnWidth,
  estimateColumnWidth,
  estimateStartColumnWidth,
  getColumnsHiddenByWidth,
  getDetailItems,
  getResponsiveFit,
  getRowActionsCollapsed,
  reservedColumnsWidth,
  type DataTableColumn,
  type ResponsiveFit,
  type ResponsiveFitOptions,
} from "../src/components/ui/data-table";
import {
  isResponsiveColumn,
  sameColumnNames,
} from "../src/components/ui/data-table/responsive-columns";
import { Densities } from "../src/types/density";

type Row = Record<string, unknown>;

/** Columns are built from `[name, options]` pairs, in render order. */
const cols = (...specs: Array<[string, Partial<DataTableColumn<Row>>?]>): DataTableColumn<Row>[] =>
  specs.map(([name, options]) => ({ name, ...options }));

const hiddenAt = (
  columns: DataTableColumn<Row>[],
  width: number | null,
  extra: {
    reservedWidth?: number;
    remPx?: number;
    previouslyHidden?: ReadonlySet<string>;
  } = {},
): string[] => [...getColumnsHiddenByWidth(columns, { width, ...extra })].sort();

describe("estimateColumnWidth", () => {
  it("reads px and rem lengths", () => {
    expect(estimateColumnWidth({ width: "110px" })).toBe(110);
    expect(estimateColumnWidth({ width: "7.5rem" })).toBe(120);
    expect(estimateColumnWidth({ width: " 90 PX " })).toBe(90);
  });

  it("falls back to the default for anything that says nothing about px", () => {
    for (const width of [undefined, "", "auto", "20%", "calc(10px + 2rem)", "10em", "px"]) {
      expect(estimateColumnWidth({ width })).toBe(DATA_TABLE_COLUMN_WIDTH_ESTIMATE);
    }
  });

  it("follows the root font size for a rem width and for the 8rem default, and not for px", () => {
    expect(estimateColumnWidth({ width: "7.5rem" }, 20)).toBe(150);
    expect(estimateColumnWidth({ width: "7.5rem" }, 16)).toBe(120);
    expect(estimateColumnWidth({ width: "110px" }, 20)).toBe(110);
    for (const width of [undefined, "auto", "20%"]) {
      expect(estimateColumnWidth({ width }, 20)).toBe(160);
      expect(estimateColumnWidth({ width }, 10)).toBe(80);
    }
  });

  it("is 16px when the root font size is left out", () => {
    expect(estimateColumnWidth({ width: "5rem" })).toBe(estimateColumnWidth({ width: "5rem" }, 16));
    expect(estimateColumnWidth({})).toBe(estimateColumnWidth({}, 16));
  });
});

/**
 * The widths of the pinned cells are a model in steps of the spacing scale (0.27rem, 4.32px at a 16px
 * root), not constants: every number below was measured in a browser at 390px and rounded up (Medium:
 * start cell with the details button 47.5, with the checkbox too 69.1, two icon actions 99.4; Small
 * 38.9 / 60.5 / 90.7; Large 56.2 / 77.8 / 108). The literals are the pin: a change to the model that
 * moves one of them has to move it here on purpose.
 */
describe("the pinned columns' widths", () => {
  /** The padding of a pinned cell, in steps, by density. */
  const paddingSteps: Record<Densities, number> = {
    [Densities.Small]: 1,
    [Densities.Medium]: 2,
    [Densities.Large]: 3,
  };
  const densities = [Densities.Small, Densities.Medium, Densities.Large];

  describe("reservedColumnsWidth", () => {
    it("is 48 for the details button alone, 70 with a checkbox, and 100 more for two icon actions", () => {
      expect(reservedColumnsWidth({ selectable: false, actions: false })).toBe(48);
      expect(reservedColumnsWidth({ selectable: true, actions: false })).toBe(70);
      expect(reservedColumnsWidth({ selectable: false, actions: true })).toBe(148);
      expect(reservedColumnsWidth({ selectable: true, actions: true })).toBe(170);
    });

    it("is what the exported constants say at Medium and 16px, and they are the measured numbers", () => {
      const { select, detail, actions } = DATA_TABLE_RESERVED_WIDTH;
      expect(DATA_TABLE_RESERVED_WIDTH).toEqual({ select: 22, detail: 48, actions: 100 });
      expect(reservedColumnsWidth({ selectable: false, actions: false })).toBe(detail);
      expect(reservedColumnsWidth({ selectable: true, actions: false })).toBe(select + detail);
      expect(reservedColumnsWidth({ selectable: true, actions: true })).toBe(
        select + detail + actions,
      );
    });

    it("counts two actions unless told, and the actions it is told", () => {
      expect(reservedColumnsWidth({ selectable: false, actions: true, actionCount: 2 })).toBe(148);
      expect(reservedColumnsWidth({ selectable: false, actions: true, actionCount: 1 })).toBe(105);
      expect(reservedColumnsWidth({ selectable: false, actions: true, actionCount: 3 })).toBe(191);
      // No actions column is no room, whatever the count.
      expect(reservedColumnsWidth({ selectable: false, actions: false, actionCount: 3 })).toBe(48);
      expect(reservedColumnsWidth({ selectable: false, actions: true, actionCount: 0 })).toBe(48);
    });

    it("passes the density, the inset and the unit on to both cells", () => {
      expect(
        reservedColumnsWidth({ selectable: true, actions: true, density: Densities.Small }),
      ).toBe(61 + 91);
      expect(
        reservedColumnsWidth({ selectable: true, actions: true, density: Densities.Large }),
      ).toBe(78 + 108);
      expect(reservedColumnsWidth({ selectable: true, actions: true, unitPx: 5 })).toBe(80 + 115);
      // Medium, selectable, inset: ps-6 on the start cell (16 + 4 steps = 20) and pe-6 on the actions.
      expect(reservedColumnsWidth({ selectable: true, actions: true, inset: true })).toBe(
        Math.ceil(20 * 4.32) + Math.ceil(27 * 4.32),
      );
    });
  });

  describe("estimateStartColumnWidth", () => {
    it("is the cell with the details button, by density: 39 / 48 / 57", () => {
      for (const [density, width] of [
        [Densities.Small, 39],
        [Densities.Medium, 48],
        [Densities.Large, 57],
      ] as const) {
        expect(estimateStartColumnWidth({ selectable: false, density })).toBe(width);
      }
    });

    it("adds the checkbox and the gap after it: 61 / 70 / 78", () => {
      for (const [density, width] of [
        [Densities.Small, 61],
        [Densities.Medium, 70],
        [Densities.Large, 78],
      ] as const) {
        expect(estimateStartColumnWidth({ selectable: true, density })).toBe(width);
      }
    });

    it("is Medium unless told", () => {
      expect(estimateStartColumnWidth({ selectable: false })).toBe(48);
      expect(estimateStartColumnWidth({ selectable: true })).toBe(70);
    });

    it("drops the button and its gap with withDetails: false, and is 0 with nothing left in it", () => {
      expect(estimateStartColumnWidth({ selectable: true, withDetails: false })).toBe(35);
      expect(estimateStartColumnWidth({ selectable: false, withDetails: false })).toBe(0);
      for (const density of densities) {
        expect(estimateStartColumnWidth({ selectable: false, withDetails: false, density })).toBe(
          0,
        );
      }
      // The button is 7 steps and the gap in front of it 1, so it is 8 steps less than with it.
      expect(estimateStartColumnWidth({ selectable: true, withDetails: false, unitPx: 5 })).toBe(
        estimateStartColumnWidth({ selectable: true, unitPx: 5 }) - 8 * 5,
      );
    });

    it("adds (6 - padding) steps on the start side for the inset of a flush card", () => {
      // unitPx 5 keeps the arithmetic whole. Padding is 1, 2 and 3 steps by density.
      for (const density of densities) {
        const padding = paddingSteps[density];
        const flat = estimateStartColumnWidth({ selectable: false, density, unitPx: 5 });
        const inset = estimateStartColumnWidth({
          selectable: false,
          density,
          unitPx: 5,
          inset: true,
        });
        expect(inset - flat).toBe((6 - padding) * 5);
      }
      expect(estimateStartColumnWidth({ selectable: false, inset: true })).toBe(65);
      // With a checkbox the end side is the checkbox cell's pr-2 whatever the inset says.
      expect(
        estimateStartColumnWidth({ selectable: true, inset: true, unitPx: 5 }) -
          estimateStartColumnWidth({ selectable: true, unitPx: 5 }),
      ).toBe(4 * 5);
    });

    it("scales with the unit: whole steps of unitPx", () => {
      expect(estimateStartColumnWidth({ selectable: false, unitPx: 5 })).toBe(11 * 5);
      expect(estimateStartColumnWidth({ selectable: true, unitPx: 5 })).toBe(16 * 5);
      expect(estimateStartColumnWidth({ selectable: false, unitPx: 8 })).toBe(11 * 8);
      // A root font of 20px resolves --spacing to 5.4px; the unit the page resolved is what counts.
      expect(estimateStartColumnWidth({ selectable: false, unitPx: 0.27 * 20 })).toBe(60);
    });

    it("ignores a unit that is not a positive number", () => {
      for (const unitPx of [0, -4, Number.NaN]) {
        expect(estimateStartColumnWidth({ selectable: true, unitPx })).toBe(70);
      }
    });

    it("takes the checkbox the browser measured over the model's, and only a usable one", () => {
      // Medium, unit 5: 2 + [checkbox] + 1 gap + 7 + 2 steps around a measured 20px checkbox.
      expect(estimateStartColumnWidth({ selectable: true, unitPx: 5, checkboxPx: 20 })).toBe(
        12 * 5 + 20,
      );
      expect(estimateStartColumnWidth({ selectable: true, unitPx: 5, checkboxPx: 16 })).toBe(
        12 * 5 + 16,
      );
      // The model's own checkbox at Medium is 4 steps: 16px here.
      expect(estimateStartColumnWidth({ selectable: true, unitPx: 5 })).toBe(12 * 5 + 4 * 5);
      for (const checkboxPx of [null, 0, -1, Number.NaN, undefined]) {
        expect(estimateStartColumnWidth({ selectable: true, checkboxPx })).toBe(70);
      }
      // No checkbox in the cell, nothing to replace.
      expect(estimateStartColumnWidth({ selectable: false, checkboxPx: 40 })).toBe(48);
    });
  });

  describe("estimateActionsColumnWidth", () => {
    it("is one icon button 48 / 57 / 65, two 91 / 100 / 108, three 134 / 143 / 152", () => {
      const expected: Record<number, [number, number, number]> = {
        1: [48, 57, 65],
        2: [91, 100, 108],
        3: [134, 143, 152],
      };
      for (const [count, [small, medium, large]] of Object.entries(expected)) {
        const actionCount = Number(count);
        expect(
          estimateActionsColumnWidth({ actionCount, density: Densities.Small }),
          `${count} at Small`,
        ).toBe(small);
        expect(
          estimateActionsColumnWidth({ actionCount, density: Densities.Medium }),
          `${count} at Medium`,
        ).toBe(medium);
        expect(
          estimateActionsColumnWidth({ actionCount, density: Densities.Large }),
          `${count} at Large`,
        ).toBe(large);
      }
    });

    it("is Medium unless told, and each further icon adds a button and a gap (10 steps)", () => {
      expect(estimateActionsColumnWidth({ actionCount: 2 })).toBe(100);
      expect(estimateActionsColumnWidth({ actionCount: 1 })).toBe(57);
      // Padding 2 + 4 buttons of 9 + 3 gaps of 1 + padding 2 = 43 steps.
      expect(estimateActionsColumnWidth({ actionCount: 4, unitPx: 5 })).toBe(43 * 5);
      expect(
        estimateActionsColumnWidth({ actionCount: 2, unitPx: 5 }) -
          estimateActionsColumnWidth({ actionCount: 1, unitPx: 5 }),
      ).toBe(10 * 5);
    });

    it("is 0 for no actions", () => {
      for (const actionCount of [0, -1, Number.NaN]) {
        expect(estimateActionsColumnWidth({ actionCount })).toBe(0);
      }
    });

    it("adds (6 - padding) steps on the end side for the inset of a flush card", () => {
      for (const density of densities) {
        const padding = paddingSteps[density];
        const flat = estimateActionsColumnWidth({ actionCount: 2, density, unitPx: 5 });
        const inset = estimateActionsColumnWidth({
          actionCount: 2,
          density,
          unitPx: 5,
          inset: true,
        });
        expect(inset - flat).toBe((6 - padding) * 5);
      }
      expect(estimateActionsColumnWidth({ actionCount: 2, inset: true })).toBe(117);
    });

    it("scales with the unit, and ignores one that is not a positive number", () => {
      expect(estimateActionsColumnWidth({ actionCount: 2, unitPx: 5 })).toBe(23 * 5);
      expect(estimateActionsColumnWidth({ actionCount: 2, unitPx: 8 })).toBe(23 * 8);
      for (const unitPx of [0, -4, Number.NaN]) {
        expect(estimateActionsColumnWidth({ actionCount: 2, unitPx })).toBe(100);
      }
    });
  });
});

describe("getColumnsHiddenByWidth: hideBelow", () => {
  const columns = cols(["date"], ["start", { hideBelow: 600 }], ["project", { hideBelow: 800 }]);

  it("hides a column exactly while the container is narrower than its threshold", () => {
    expect(hiddenAt(columns, 900)).toEqual([]);
    expect(hiddenAt(columns, 800)).toEqual([]);
    expect(hiddenAt(columns, 799.5)).toEqual(["project"]);
    expect(hiddenAt(columns, 600)).toEqual(["project"]);
    expect(hiddenAt(columns, 599)).toEqual(["project", "start"]);
    expect(hiddenAt(columns, 100)).toEqual(["project", "start"]);
  });

  it("never hides a column that has no option", () => {
    expect(hiddenAt(columns, 1)).not.toContain("date");
  });

  it("is a function of its arguments: the same call gives the same answer and nothing is mutated", () => {
    const before = JSON.stringify(columns);
    expect(hiddenAt(columns, 700)).toEqual(hiddenAt(columns, 700));
    expect(JSON.stringify(columns)).toBe(before);
  });

  it("ignores options that are not finite numbers", () => {
    const odd = cols(["a"], ["b", { hideBelow: Number.NaN, priority: Number.POSITIVE_INFINITY }]);
    expect(isResponsiveColumn(odd[1])).toBe(false);
    expect(hiddenAt(odd, 1)).toEqual([]);
  });
});

describe("getColumnsHiddenByWidth: before the container is measured", () => {
  it("assumes the narrow case: every column with an option is hidden, the others are not", () => {
    const columns = cols(
      ["date"],
      ["start", { hideBelow: 600 }],
      ["hours", { priority: 2 }],
      ["note", { priority: 9 }],
    );
    expect(hiddenAt(columns, null)).toEqual(["hours", "note", "start"]);
  });

  it("still keeps one column when every one has an option", () => {
    const columns = cols(["a", { priority: 3 }], ["b", { priority: 1 }], ["c", { priority: 2 }]);
    expect(hiddenAt(columns, null)).toEqual(["a", "c"]);
  });
});

describe("getColumnsHiddenByWidth: priority", () => {
  // Estimates in px: a 100, b 80, c 60, d 40. Lower number is more important.
  const columns = cols(
    ["a", { priority: 1, width: "100px" }],
    ["b", { priority: 2, width: "80px" }],
    ["c", { priority: 3, width: "60px" }],
    ["d", { priority: 4, width: "40px" }],
  );

  it("hides nothing while everything fits", () => {
    expect(hiddenAt(columns, 280)).toEqual([]);
    expect(hiddenAt(columns, 500)).toEqual([]);
  });

  it("drops the least important column first, one at a time, until the rest fits", () => {
    expect(hiddenAt(columns, 279)).toEqual(["d"]);
    expect(hiddenAt(columns, 240)).toEqual(["d"]);
    expect(hiddenAt(columns, 239)).toEqual(["c", "d"]);
    expect(hiddenAt(columns, 180)).toEqual(["c", "d"]);
    expect(hiddenAt(columns, 179)).toEqual(["b", "c", "d"]);
  });

  it("hides the same columns at a width as the ranking alone says, whatever the declared order", () => {
    const shuffled = [columns[2], columns[0], columns[3], columns[1]];
    expect(hiddenAt(shuffled, 200)).toEqual(hiddenAt(columns, 200));
  });

  it("drops the column on the right first among equals", () => {
    const equal = cols(
      ["left", { priority: 1, width: "100px" }],
      ["mid", { priority: 2, width: "100px" }],
      ["right", { priority: 2, width: "100px" }],
    );
    expect(hiddenAt(equal, 250)).toEqual(["right"]);
    expect(hiddenAt(equal, 150)).toEqual(["mid", "right"]);
  });

  it("leaves a column with no priority alone however narrow it gets", () => {
    const mixed = cols(
      ["fixed", { width: "200px" }],
      ["a", { priority: 1, width: "100px" }],
      ["b", { priority: 2, width: "100px" }],
    );
    expect(hiddenAt(mixed, 250)).toEqual(["a", "b"]);
    expect(hiddenAt(mixed, 1)).toEqual(["a", "b"]);
  });

  it("counts the pinned columns against the room", () => {
    expect(hiddenAt(columns, 280, { reservedWidth: 0 })).toEqual([]);
    expect(hiddenAt(columns, 280, { reservedWidth: 36 })).toEqual(["d"]);
    expect(hiddenAt(columns, 280, { reservedWidth: 100 })).toEqual(["c", "d"]);
  });

  it("reads a column's width as the default estimate when it names none", () => {
    const unsized = cols(["a", { priority: 1 }], ["b", { priority: 2 }]);
    const need = 2 * DATA_TABLE_COLUMN_WIDTH_ESTIMATE;
    expect(hiddenAt(unsized, need)).toEqual([]);
    expect(hiddenAt(unsized, need - 1)).toEqual(["b"]);
  });

  it("keeps the most important column when nothing fits", () => {
    expect(hiddenAt(columns, 1)).toEqual(["b", "c", "d"]);
    expect(hiddenAt(columns, 0)).toEqual(["b", "c", "d"]);
  });
});

describe("getColumnsHiddenByWidth: hideBelow and priority together", () => {
  it("never drops a hideBelow column on priority, though it takes up room while it shows", () => {
    const columns = cols(
      ["keep", { priority: 1, width: "100px" }],
      ["wide", { priority: 2, hideBelow: 200, width: "500px" }],
      ["extra", { priority: 3, width: "100px" }],
    );
    // `wide` answers only to its own threshold, so the others give way around it.
    expect(hiddenAt(columns, 300)).toEqual(["extra", "keep"]);
    // Below it, it is gone and what is left fits (just) after one more.
    expect(hiddenAt(columns, 199)).toEqual(["extra", "wide"]);
  });

  it("hides a hideBelow column before it spends the budget of the others", () => {
    const columns = cols(
      ["a", { priority: 1, width: "100px" }],
      ["b", { priority: 2, width: "100px" }],
      ["c", { hideBelow: 250, width: "100px" }],
    );
    // At 220 `c` is gone, so `a` and `b` fit in 200 and nothing else has to go.
    expect(hiddenAt(columns, 220)).toEqual(["c"]);
    // At 260 `c` stays and takes its 100px, which is more than the others leave room for.
    expect(hiddenAt(columns, 260)).toEqual(["b"]);
  });
});

describe("getColumnsHiddenByWidth: the root font size", () => {
  it("scales a rem width and the default estimate, and leaves a px width", () => {
    const columns = cols(
      ["a", { priority: 1, width: "10rem" }],
      ["b", { priority: 2, width: "100px" }],
      ["c", { priority: 3 }],
    );
    // At 16px: a 160, b 100, c 128 = 388. At 20px: a 200, b 100, c 160 = 460.
    expect(hiddenAt(columns, 388)).toEqual([]);
    expect(hiddenAt(columns, 387)).toEqual(["c"]);
    expect(hiddenAt(columns, 388, { remPx: 16 })).toEqual([]);
    expect(hiddenAt(columns, 460, { remPx: 20 })).toEqual([]);
    expect(hiddenAt(columns, 459, { remPx: 20 })).toEqual(["c"]);
    // 12px: a 120, b 100, c 96 = 316.
    expect(hiddenAt(columns, 316, { remPx: 12 })).toEqual([]);
    expect(hiddenAt(columns, 315, { remPx: 12 })).toEqual(["c"]);
  });

  it("is what makes a table that fits at 16px not fit at a larger root font", () => {
    const columns = cols(["a", { priority: 1 }], ["b", { priority: 2 }]);
    expect(hiddenAt(columns, 300)).toEqual([]);
    expect(hiddenAt(columns, 300, { remPx: 20 })).toEqual(["b"]);
  });

  it("gives the hysteresis the same estimates: the margin is in px of the container, not of the font", () => {
    const columns = cols(["a", { priority: 1 }], ["b", { priority: 2 }]);
    const hidden = new Set(["b"]);
    // 2 x 8rem at 20px is 320.
    expect(
      hiddenAt(columns, 320 + DATA_TABLE_REVEAL_MARGIN - 1, {
        remPx: 20,
        previouslyHidden: hidden,
      }),
    ).toEqual(["b"]);
    expect(
      hiddenAt(columns, 320 + DATA_TABLE_REVEAL_MARGIN, { remPx: 20, previouslyHidden: hidden }),
    ).toEqual([]);
  });
});

describe("getColumnsHiddenByWidth: the pinned columns of a phone table", () => {
  // The polish app's phone table: a details button and two icon actions around three columns.
  const columns = cols(
    ["date", { priority: 1, width: "100px" }],
    ["amount", { priority: 2, width: "100px" }],
    ["text", { priority: 3, width: "144px" }],
  );

  it("hid too little with the 0.2.1 constants and hides the column the pinned cells need room for now", () => {
    // 0.2.1 reserved 116 px: `DATA_TABLE_RESERVED_WIDTH.detail` 36 + `.actions` 80, for a table with a
    // details button and actions. The two pinned cells really take 148 px (47.5 + 99.4 measured,
    // each rounded up), and a border or two more, so date and amount (200) need 348 px with them:
    // they do not fit a 330 px container, and the old number said they did.
    const reservedIn021 = 116;
    const reserved = reservedColumnsWidth({ selectable: false, actions: true });
    expect(reserved).toBe(148);

    // Before: text goes, and date and amount are taken to fit (316 <= 330) though 348 > 330.
    expect(hiddenAt(columns, 330, { reservedWidth: reservedIn021 })).toEqual(["text"]);
    // After: amount goes as well, and what is left fits (248 <= 330).
    expect(hiddenAt(columns, 330, { reservedWidth: reserved })).toEqual(["amount", "text"]);
    // Even with a border on each of the pinned cells (+2) the answer is the same.
    expect(hiddenAt(columns, 330, { reservedWidth: reserved + 2 })).toEqual(["amount", "text"]);
  });

  it("keeps date and amount once the container has the 348 px they and the pinned cells need", () => {
    const reservedWidth = reservedColumnsWidth({ selectable: false, actions: true });
    expect(hiddenAt(columns, 348 + 144, { reservedWidth })).toEqual([]);
    expect(hiddenAt(columns, 348 + 143, { reservedWidth })).toEqual(["text"]);
    expect(hiddenAt(columns, 348, { reservedWidth })).toEqual(["text"]);
    expect(hiddenAt(columns, 347, { reservedWidth })).toEqual(["amount", "text"]);
  });
});

describe("getRowActionsCollapsed", () => {
  const margin = DATA_TABLE_REVEAL_MARGIN;
  const below = 500;

  it("never folds when below is not a finite number", () => {
    for (const unusable of [
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      for (const width of [null, 0, 400, 500, 10_000]) {
        for (const wasCollapsed of [undefined, false, true]) {
          expect(getRowActionsCollapsed({ width, below: unusable, wasCollapsed })).toBe(false);
        }
      }
    }
  });

  it("folds before a measurement, whatever the history", () => {
    for (const wasCollapsed of [undefined, false, true]) {
      expect(getRowActionsCollapsed({ width: null, below, wasCollapsed })).toBe(true);
    }
  });

  it("folds at once while the container is narrower than below, whatever the history", () => {
    for (const wasCollapsed of [undefined, false, true]) {
      expect(getRowActionsCollapsed({ width: below - 0.5, below, wasCollapsed })).toBe(true);
      expect(getRowActionsCollapsed({ width: 0, below, wasCollapsed })).toBe(true);
    }
  });

  it("unfolds once the container is a margin past below, whatever the history", () => {
    for (const wasCollapsed of [undefined, false, true]) {
      expect(getRowActionsCollapsed({ width: below + margin, below, wasCollapsed })).toBe(false);
      expect(getRowActionsCollapsed({ width: 5000, below, wasCollapsed })).toBe(false);
    }
  });

  it("keeps what it was in the band from below up to a margin past it", () => {
    for (const width of [below, below + 1, below + margin - 1, below + margin - 0.5]) {
      expect(getRowActionsCollapsed({ width, below, wasCollapsed: true })).toBe(true);
      expect(getRowActionsCollapsed({ width, below, wasCollapsed: false })).toBe(false);
    }
  });

  it("takes a first measurement in the band as unfolded", () => {
    for (const width of [below, below + 1, below + margin - 1]) {
      expect(getRowActionsCollapsed({ width, below })).toBe(false);
      expect(getRowActionsCollapsed({ width, below, wasCollapsed: undefined })).toBe(false);
    }
  });

  it("ends a boundary wobble: a width that swings by less than the margin cannot toggle it", () => {
    let folded: boolean | undefined;
    const seen: boolean[] = [];
    for (const width of [650, 490, 505, 495, 510, 498, 520]) {
      folded = getRowActionsCollapsed({ width, below, wasCollapsed: folded });
      seen.push(folded);
    }
    // Folds on the way down, and 520 is still short of 524.
    expect(seen).toEqual([false, true, true, true, true, true, true]);
  });
});

describe("getResponsiveFit", () => {
  // a 100 + b 100 around pinned cells of 100 px, or 40 px once the actions are folded.
  const columns = cols(
    ["a", { priority: 1, width: "100px" }],
    ["b", { priority: 2, width: "100px" }],
  );
  const base = { reservedWidth: 100, reservedFoldedWidth: 40, collapseBelow: 300 };
  const fit = (width: number | null, extra: Partial<ResponsiveFitOptions> = {}) =>
    getResponsiveFit(columns, { width, ...base, ...extra });
  const names = (result: ResponsiveFit) => [...result.hidden].sort();

  it("fits the columns into the folded width while the actions are folded, and the plain one otherwise", () => {
    // 250 px: 300 do not fit, 240 do.
    expect(names(fit(250))).toEqual([]);
    expect(fit(250)).toMatchObject({ trigger: true, collapsed: true });
    // 350 px is wide enough to unfold, and there 300 fit.
    expect(names(fit(350))).toEqual([]);
    expect(fit(350)).toMatchObject({ trigger: false, collapsed: false });
    // Not folding at 250 (below 200) the plain 100 is used and b has to go.
    expect(names(fit(250, { collapseBelow: 200 }))).toEqual(["b"]);
    expect(fit(250, { collapseBelow: 200 })).toMatchObject({ trigger: false, collapsed: false });
  });

  it("defaults the folded width to the plain one", () => {
    const result = fit(250, { reservedFoldedWidth: undefined });
    expect(names(result)).toEqual(["b"]);
    expect(result).toMatchObject({ trigger: true, collapsed: true });
  });

  it("collapsed is the trigger and collapseApplies; the folded width is used for nothing else", () => {
    for (const trigger of [true, false]) {
      for (const collapseApplies of [true, false]) {
        const result = fit(trigger ? 250 : 350, { collapseApplies });
        expect(result.trigger).toBe(trigger);
        expect(result.collapsed).toBe(trigger && collapseApplies);
      }
    }
    // Nothing to fold: the plain width decides, though the container is narrow enough to fold.
    const nothing = fit(250, { collapseApplies: false });
    expect(names(nothing)).toEqual(["b"]);
    expect(nothing).toMatchObject({ trigger: true, collapsed: false });
  });

  it("does not fold without a collapseBelow, and folds before a measurement with one", () => {
    expect(fit(100, { collapseBelow: undefined })).toMatchObject({
      trigger: false,
      collapsed: false,
    });
    expect(fit(100, { collapseBelow: Number.POSITIVE_INFINITY })).toMatchObject({
      trigger: false,
      collapsed: false,
    });
    expect(fit(null)).toMatchObject({ trigger: true, collapsed: true });
    expect(fit(null, { collapseBelow: undefined })).toMatchObject({ trigger: false });
  });

  it("takes previous.trigger as the history of the fold, in the band only", () => {
    // 300 up to 323 is the band.
    expect(fit(310).trigger).toBe(false);
    expect(fit(310, { previous: { hidden: new Set(), trigger: true } }).trigger).toBe(true);
    expect(fit(310, { previous: { hidden: new Set(), trigger: false } }).trigger).toBe(false);
    expect(fit(299, { previous: { hidden: new Set(), trigger: false } }).trigger).toBe(true);
    expect(fit(324, { previous: { hidden: new Set(), trigger: true } }).trigger).toBe(false);
  });

  it("takes previous.hidden as the history of the columns", () => {
    // Plain 300 px, unfolded (collapseBelow 200): b is hidden at 250 and held until 324.
    const unfolded = { collapseBelow: 200 };
    const wasHidden = { hidden: new Set(["b"]), trigger: false };
    expect(names(fit(310, unfolded))).toEqual([]);
    expect(names(fit(310, { ...unfolded, previous: wasHidden }))).toEqual(["b"]);
    expect(names(fit(323, { ...unfolded, previous: wasHidden }))).toEqual(["b"]);
    expect(names(fit(324, { ...unfolded, previous: wasHidden }))).toEqual([]);
  });

  it("uses the width of the fold it has just decided, not the one the history was made under", () => {
    // History: unfolded and b hidden. At 280 the fold turns on, 240 px fits, and b comes back.
    const wasUnfolded = { hidden: new Set(["b"]), trigger: false };
    const result = fit(280, { previous: wasUnfolded });
    expect(result).toMatchObject({ trigger: true, collapsed: true });
    expect(names(result)).toEqual([]);
  });

  it("with collapseApplies: false never folds the width but still tracks the trigger", () => {
    const applies = { collapseApplies: false };
    // The trigger flips as usual, with its band...
    expect(fit(250, applies).trigger).toBe(true);
    expect(fit(310, { ...applies, previous: { hidden: new Set(), trigger: true } }).trigger).toBe(
      true,
    );
    expect(fit(324, { ...applies, previous: { hidden: new Set(), trigger: true } }).trigger).toBe(
      false,
    );
    // ...so that turning folding back on later starts from the right side of the band.
    for (const width of [250, 310, 400]) {
      const off = fit(width, { ...applies, previous: { hidden: new Set(), trigger: true } });
      expect(off.collapsed).toBe(false);
      expect(names(off)).toEqual(
        names(
          fit(width, { collapseBelow: undefined, previous: { hidden: new Set(), trigger: true } }),
        ),
      );
    }
  });

  it("is the same as the two parts called one after the other", () => {
    const previous = { hidden: new Set(["b"]), trigger: true };
    for (const width of [null, 120, 250, 299, 300, 310, 323, 324, 600]) {
      const trigger = getRowActionsCollapsed({ width, below: 300, wasCollapsed: previous.trigger });
      const hidden = getColumnsHiddenByWidth(columns, {
        width,
        reservedWidth: trigger ? 40 : 100,
        previouslyHidden: previous.hidden,
      });
      const result = fit(width, { previous });
      expect(result.trigger).toBe(trigger);
      expect(sameColumnNames(result.hidden, hidden)).toBe(true);
    }
  });

  it("follows the root font size like the columns do", () => {
    const unsized = cols(["a", { priority: 1 }], ["b", { priority: 2 }]);
    const wide = getResponsiveFit(unsized, { width: 300, reservedWidth: 0, remPx: 20 });
    expect([...wide.hidden]).toEqual(["b"]);
  });
});

describe("getColumnsHiddenByWidth: the one column that stays", () => {
  it("is the one with the lowest priority number", () => {
    const columns = cols(["a", { priority: 5 }], ["b", { priority: 1 }], ["c", { priority: 3 }]);
    expect(hiddenAt(columns, 1)).toEqual(["a", "c"]);
  });

  it("is, among columns that only have hideBelow, the one that goes last", () => {
    const columns = cols(
      ["a", { hideBelow: 700 }],
      ["b", { hideBelow: 300 }],
      ["c", { hideBelow: 500 }],
    );
    expect(hiddenAt(columns, 100)).toEqual(["a", "c"]);
  });

  it("is the first of equals", () => {
    const columns = cols(["a", { priority: 1 }], ["b", { priority: 1 }]);
    expect(hiddenAt(columns, 1)).toEqual(["b"]);
  });

  it("does not exist for a table without columns", () => {
    expect(hiddenAt([], 100)).toEqual([]);
  });
});

describe("getColumnsHiddenByWidth: hysteresis", () => {
  const columns = cols(["date"], ["project", { hideBelow: 600 }]);
  const margin = DATA_TABLE_REVEAL_MARGIN;

  it("hides at once when the container drops below the threshold", () => {
    expect(hiddenAt(columns, 599, { previouslyHidden: new Set() })).toEqual(["project"]);
  });

  it("keeps a hidden column hidden until the container is a margin past the threshold", () => {
    const hidden = new Set(["project"]);
    expect(hiddenAt(columns, 600, { previouslyHidden: hidden })).toEqual(["project"]);
    expect(hiddenAt(columns, 600 + margin - 1, { previouslyHidden: hidden })).toEqual(["project"]);
    expect(hiddenAt(columns, 600 + margin, { previouslyHidden: hidden })).toEqual([]);
  });

  it("does not hold a column back that was showing", () => {
    // Without the history this is the plain answer, and a shown column hides as soon as it should.
    expect(hiddenAt(columns, 610, { previouslyHidden: new Set() })).toEqual([]);
    expect(hiddenAt(columns, 599, { previouslyHidden: new Set() })).toEqual(["project"]);
  });

  it("gives a first measurement no history to be steady about", () => {
    expect(hiddenAt(columns, 610)).toEqual([]);
  });

  it("settles: feeding the answer back in at the same width changes nothing", () => {
    for (const width of [590, 600, 610, 623, 624, 700]) {
      const first = getColumnsHiddenByWidth(columns, {
        width,
        previouslyHidden: new Set(["project"]),
      });
      const again = getColumnsHiddenByWidth(columns, { width, previouslyHidden: first });
      expect(sameColumnNames(first, again)).toBe(true);
    }
  });

  it("ends a boundary wobble: a width that swings by less than the margin cannot toggle the column", () => {
    let hidden: ReadonlySet<string> = new Set();
    const seen: boolean[] = [];
    // Crossing down, then swinging 10px either side of the threshold.
    for (const width of [650, 590, 605, 595, 610, 598, 612]) {
      hidden = getColumnsHiddenByWidth(columns, { width, previouslyHidden: hidden });
      seen.push(hidden.has("project"));
    }
    expect(seen).toEqual([false, true, true, true, true, true, true]);
  });

  it("applies to a priority drop as well", () => {
    const ranked = cols(
      ["a", { priority: 1, width: "100px" }],
      ["b", { priority: 2, width: "100px" }],
    );
    const hidden = new Set(["b"]);
    expect(hiddenAt(ranked, 200, { previouslyHidden: hidden })).toEqual(["b"]);
    // The margin is exactly DATA_TABLE_REVEAL_MARGIN: a pixel short of it the column is still held.
    expect(hiddenAt(ranked, 200 + margin - 1, { previouslyHidden: hidden })).toEqual(["b"]);
    expect(hiddenAt(ranked, 200 + margin, { previouslyHidden: hidden })).toEqual([]);
  });

  it("never lets the history hide every column", () => {
    const only = cols(
      ["a", { priority: 1, width: "100px" }],
      ["b", { priority: 2, width: "100px" }],
    );
    const hiddenBoth = new Set(["a", "b"]);
    // 110px holds `a` alone, but a margin short of that nothing does: history plus margin say both.
    expect(hiddenAt(only, 110, { previouslyHidden: hiddenBoth })).toEqual(["b"]);
  });
});

describe("getColumnsHiddenByWidth: hysteresis on a table that mixes hideBelow and priority", () => {
  // The table of the bug report. Estimates in px: date 100, project 128, hours 84, amount 128,
  // note 200, status 128, plus 156 for the selection, details and actions columns.
  const reservedWidth = 156;
  const mixed = cols(
    ["date", { priority: 1, width: "100px" }],
    ["project", { hideBelow: 700 }],
    ["hours", { priority: 2, width: "84px" }],
    ["amount", { hideBelow: 900 }],
    ["note", { priority: 5, width: "200px" }],
    ["status"],
  );
  const shown = (hidden: ReadonlySet<string>) =>
    mixed.map((column) => column.name).filter((name) => !hidden.has(name));

  /** The columns a table shows after the container takes these widths one after the other. */
  const walk = (widths: number[], from?: ReadonlySet<string>) => {
    let hidden = from;
    const steps: Array<{ width: number; shown: string[] }> = [];
    for (const width of widths) {
      hidden = getColumnsHiddenByWidth(mixed, { width, reservedWidth, previouslyHidden: hidden });
      steps.push({ width, shown: shown(hidden) });
    }
    return steps;
  };

  it("does not pay for a hideBelow column that is not on show: the note stays across 699 -> 700", () => {
    const steps = walk([699, 700]);
    expect(steps[0].shown).toEqual(["date", "hours", "note", "status"]);
    // `project` is held back for another 24px, so it takes no room and the note keeps its.
    expect(steps[1].shown).toEqual(["date", "hours", "note", "status"]);
  });

  it("does not flip the note when the width alternates between 699 and 700", () => {
    const steps = walk(Array.from({ length: 24 }, (_, i) => (i % 2 === 0 ? 699 : 700)));
    for (const step of steps) expect(step.shown).toEqual(["date", "hours", "note", "status"]);
  });

  it("lets the note go once, when the project it paid for comes back", () => {
    const steps = walk([699, 700, 710, 723, 724, 760]);
    expect(steps.map((step) => step.shown.includes("note"))).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(steps[4].shown).toEqual(["date", "project", "hours", "status"]);
  });

  it("keeps the project hidden until 724, and shown once it is back", () => {
    const steps = walk([723, 724, 710, 724, 709, 725], new Set(["project", "amount"]));
    expect(steps.map((step) => step.shown.includes("project"))).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
  });
});

/* -------------------------------------------------------------------------------------------------
 * The oscillation invariant, as a seeded property test over random tables.
 *
 * A table inside a scroll box can sit at a height where one layout has a scrollbar and the other has
 * none, so its container is W px wide in one layout and W - 15 in the other. If the answer to
 * "which columns are hidden" differs between the two and each answer asks for the other layout, the
 * table commits forever. The reveal margin (24px) is larger than the scrollbar (15px) to rule that
 * out; this checks that it does for every mix of hideBelow, priority and plain columns, not only for
 * the two kinds on their own.
 * ---------------------------------------------------------------------------------------------- */

/** A small seeded generator (mulberry32), so a failure names a table that can be rebuilt. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 1600;
const SCROLLBAR = 15;
const WIDTH_COUNT = MAX_WIDTH - MIN_WIDTH + 1;
const TABLES = 2000;
/** The tests that look at every width of every state read fewer tables. */
const POINTWISE_TABLES = 500;

interface RandomTable {
  seed: number;
  columns: DataTableColumn<Row>[];
  reservedWidth: number;
}

/** 1 to 8 columns, each hideBelow only, priority only, both or neither; `px`, `rem`, `%` or no width. */
function randomTable(seed: number): RandomTable {
  const rand = seeded(seed);
  const int = (below: number) => Math.floor(rand() * below);
  const columns: DataTableColumn<Row>[] = [];
  const count = 1 + int(8);
  for (let index = 0; index < count; index += 1) {
    const column: DataTableColumn<Row> = { name: `c${index}` };
    const kind = int(4);
    if (kind === 0 || kind === 2) column.hideBelow = 300 + int(1101);
    // A narrow range, so that ranks tie now and then.
    if (kind === 1 || kind === 2) column.priority = 1 + int(5);
    const unit = int(4);
    if (unit === 0) column.width = `${40 + int(261)}px`;
    else if (unit === 1) column.width = `${3 + int(16)}rem`;
    else if (unit === 2) column.width = `${10 + int(31)}%`;
    columns.push(column);
  }
  return { seed, columns, reservedWidth: int(301) };
}

const listOf = (hidden: ReadonlySet<string>): string => [...hidden].join(",");

const hasOption = (column: DataTableColumn<Row>, option: "hideBelow" | "priority") =>
  column[option] !== undefined;

/**
 * Every set a table can be in, and what each width turns each one into. The states are the closure of
 * "a first measurement at any width" under "the container takes any width next, with the last answer
 * fed back", which contains every set any sweep up and down can reach. A state is an index into
 * `sets`; `next[state][width - MIN_WIDTH]` is the state that width turns it into.
 */
function exploreStates({ columns, reservedWidth }: RandomTable) {
  const sets: Array<ReadonlySet<string>> = [];
  const ids = new Map<number, number>();
  const next: Int16Array[] = [];
  const remember = (hidden: ReadonlySet<string>): number => {
    let mask = 0;
    for (let index = 0; index < columns.length; index += 1) {
      if (hidden.has(columns[index].name)) mask |= 1 << index;
    }
    let id = ids.get(mask);
    if (id === undefined) {
      id = sets.length;
      ids.set(mask, id);
      sets.push(hidden);
    }
    return id;
  };
  for (let at = 0; at < WIDTH_COUNT; at += 1) {
    remember(getColumnsHiddenByWidth(columns, { width: MIN_WIDTH + at, reservedWidth }));
  }
  // `sets` grows while it is walked: every state gets its row, including the ones found on the way.
  for (let id = 0; id < sets.length; id += 1) {
    const previouslyHidden = sets[id];
    const row = new Int16Array(WIDTH_COUNT);
    for (let at = 0; at < WIDTH_COUNT; at += 1) {
      const width = MIN_WIDTH + at;
      row[at] = remember(
        getColumnsHiddenByWidth(columns, { width, reservedWidth, previouslyHidden }),
      );
    }
    next.push(row);
  }
  return { sets, next };
}

type Explored = RandomTable & ReturnType<typeof exploreStates>;

/** Each table is explored once, on first use, and shared by every test below. */
const explored = new Map<number, Explored>();
function tableAt(seed: number): Explored {
  let table = explored.get(seed);
  if (!table) {
    const random = randomTable(seed);
    table = { ...random, ...exploreStates(random) };
    explored.set(seed, table);
  }
  return table;
}
const seeds = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

/** Whether the states can be walked in a loop using only widths from `from` to `to`. */
function loopsWithin(
  { sets, next }: { sets: readonly unknown[]; next: Int16Array[] },
  from: number,
  to: number,
): boolean {
  const colour = new Int8Array(sets.length);
  const walk = (state: number): boolean => {
    colour[state] = 1;
    for (let at = from - MIN_WIDTH; at <= to - MIN_WIDTH; at += 1) {
      const target = next[state][at];
      if (target === state || colour[target] === 2) continue;
      if (colour[target] === 1 || walk(target)) return true;
    }
    colour[state] = 2;
    return false;
  };
  return sets.some((_, state) => colour[state] === 0 && walk(state));
}

describe("getColumnsHiddenByWidth: no oscillation under a scrollbar-sized jitter", () => {
  /** `from {a} at W - jitter -> {b} -> at W -> back`, for the first way a table can be walked in a loop. */
  const twoStepLoops = (table: Explored, jitter: number) => {
    const found: string[] = [];
    for (let s0 = 0; s0 < table.sets.length; s0 += 1) {
      for (let width = MIN_WIDTH + jitter; width <= MAX_WIDTH; width += 1) {
        const s1 = table.next[s0][width - jitter - MIN_WIDTH];
        if (s1 !== s0 && table.next[s1][width - MIN_WIDTH] === s0) {
          found.push(
            `seed ${table.seed}: {${listOf(table.sets[s0])}} at ${width - jitter}px -> {${listOf(table.sets[s1])}} at ${width}px -> back`,
          );
          break;
        }
      }
    }
    return found;
  };

  it(`holds for ${TABLES} random tables: s1 = f(W - 15, s0) never leads straight back to s0`, () => {
    const failures: string[] = [];
    let states = 0;
    let mixedTables = 0;
    for (const seed of seeds(TABLES)) {
      const table = tableAt(seed);
      states += table.sets.length;
      const kinds = (own: "hideBelow" | "priority", other: "hideBelow" | "priority") =>
        table.columns.some((column) => hasOption(column, own) && !hasOption(column, other));
      if (kinds("hideBelow", "priority") && kinds("priority", "hideBelow")) mixedTables += 1;
      failures.push(...twoStepLoops(table, SCROLLBAR));
    }
    expect(failures.slice(0, 10)).toEqual([]);
    // The generator reaches the shape that matters, not only the two kinds that were already safe.
    expect(mixedTables).toBeGreaterThan(TABLES / 10);
    expect(states).toBeGreaterThan(TABLES);
  }, 120_000);

  it("holds for any jitter smaller than the margin, and the check can see a loop a pixel past it", () => {
    const within: string[] = [];
    let pastTheMargin = 0;
    for (const seed of seeds(TABLES)) {
      const table = tableAt(seed);
      for (let jitter = 1; jitter < DATA_TABLE_REVEAL_MARGIN; jitter += 1) {
        within.push(...twoStepLoops(table, jitter));
      }
      if (twoStepLoops(table, DATA_TABLE_REVEAL_MARGIN + 1).length > 0) pastTheMargin += 1;
    }
    expect(within.slice(0, 10)).toEqual([]);
    // Without this the loop above could be passing because it looks at nothing.
    expect(pastTheMargin).toBeGreaterThan(TABLES / 4);
  }, 120_000);

  it("cannot be walked in a loop by any widths within 15px of each other", () => {
    const failures: string[] = [];
    for (const seed of seeds(TABLES)) {
      const table = tableAt(seed);
      for (let from = MIN_WIDTH; from + SCROLLBAR <= MAX_WIDTH; from += 1) {
        if (loopsWithin(table, from, from + SCROLLBAR)) {
          failures.push(`seed ${seed}: ${from}px to ${from + SCROLLBAR}px`);
          break;
        }
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  }, 120_000);
});

/** The column that stays when every column has an option and the width is not known; else none. */
const keptColumn = (columns: DataTableColumn<Row>[]) =>
  columns.every(isResponsiveColumn)
    ? columns.find((column) => !getColumnsHiddenByWidth(columns, { width: null }).has(column.name))
    : undefined;

describe("getColumnsHiddenByWidth: what the hysteresis keeps", () => {
  const estimate = (column: DataTableColumn<Row>) => estimateColumnWidth(column);

  it("never hides a column that has no option, never hides every column, and hides what its threshold says", () => {
    const failures: string[] = [];
    for (const seed of seeds(POINTWISE_TABLES)) {
      const table = tableAt(seed);
      const { columns, sets, next } = table;
      const kept = keptColumn(columns);
      for (let state = 0; state < sets.length; state += 1) {
        for (let at = 0; at < WIDTH_COUNT; at += 1) {
          const width = MIN_WIDTH + at;
          const hidden = sets[next[state][at]];
          const where = `seed ${seed}, from {${listOf(sets[state])}} at ${width}px`;
          if (columns.every((column) => hidden.has(column.name)))
            failures.push(`${where}: all hidden`);
          for (const column of columns) {
            const responsive = isResponsiveColumn(column);
            if (!responsive && hidden.has(column.name))
              failures.push(`${where}: ${column.name} has no option`);
            // The one column the guard keeps may show though its threshold says otherwise.
            if (
              column !== kept &&
              column.hideBelow !== undefined &&
              width < column.hideBelow &&
              !hidden.has(column.name)
            ) {
              failures.push(`${where}: ${column.name} shows below its hideBelow`);
            }
          }
        }
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  }, 120_000);

  it("never hides a priority column while the columns left showing already fit", () => {
    // `hideBelow` columns and the one kept column are outside the budget; every other priority column
    // is hidden whenever what shows takes more than the container has.
    const failures: string[] = [];
    for (const seed of seeds(POINTWISE_TABLES)) {
      const { columns, reservedWidth, sets, next } = tableAt(seed);
      const kept = keptColumn(columns);
      for (let state = 0; state < sets.length; state += 1) {
        for (let at = 0; at < WIDTH_COUNT; at += 1) {
          const width = MIN_WIDTH + at;
          const hidden = sets[next[state][at]];
          const showing =
            reservedWidth +
            columns.reduce(
              (sum, column) => (hidden.has(column.name) ? sum : sum + estimate(column)),
              0,
            );
          if (showing <= width) continue;
          for (const column of columns) {
            const budgeted = hasOption(column, "priority") && !hasOption(column, "hideBelow");
            if (budgeted && column !== kept && !hidden.has(column.name)) {
              failures.push(
                `seed ${seed}, from {${listOf(sets[state])}} at ${width}px: ${column.name} shows though ${showing}px > ${width}px`,
              );
            }
          }
        }
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  }, 120_000);

  it("hides every column that has an option before the container is measured, bar the one kept", () => {
    for (const seed of seeds(TABLES)) {
      const { columns, reservedWidth } = tableAt(seed);
      const hidden = getColumnsHiddenByWidth(columns, { width: null, reservedWidth });
      const responsive = columns.filter(isResponsiveColumn);
      const left = responsive.filter((column) => !hidden.has(column.name));
      // All of them, unless that leaves no column at all: then exactly the most important one stays.
      if (responsive.length === columns.length) expect(left).toHaveLength(1);
      else expect(left).toHaveLength(0);
    }
  });

  it("lets a column that is showing go as the container grows only to pay for a hideBelow column that came back", () => {
    const failures: string[] = [];
    for (const seed of seeds(500)) {
      const { columns, reservedWidth } = randomTable(seed);
      const kept = keptColumn(columns);
      const sweep = (widths: number[], growing: boolean) => {
        let before: ReadonlySet<string> | undefined;
        for (const width of widths) {
          const hidden = getColumnsHiddenByWidth(columns, {
            width,
            reservedWidth,
            previouslyHidden: before,
          });
          if (before) {
            // Growing, a hideBelow column coming back pays; shrinking, one going away frees the room.
            const paying = columns.some(
              (column) =>
                hasOption(column, "hideBelow") &&
                before!.has(column.name) === growing &&
                hidden.has(column.name) !== growing,
            );
            for (const column of columns) {
              const moved = growing
                ? !before.has(column.name) && hidden.has(column.name)
                : before.has(column.name) && !hidden.has(column.name);
              if (moved && !paying && column !== kept) {
                failures.push(
                  `seed ${seed}: ${column.name} ${growing ? "hid" : "came back"} at ${width}px for nothing`,
                );
              }
            }
          }
          before = hidden;
        }
      };
      const up = Array.from({ length: WIDTH_COUNT }, (_, i) => MIN_WIDTH + i);
      sweep(up, true);
      sweep([...up].reverse(), false);
    }
    expect(failures.slice(0, 10)).toEqual([]);
  }, 120_000);
});

/* -------------------------------------------------------------------------------------------------
 * The same, with the row actions folding.
 *
 * Folding changes the room the pinned columns leave (the folded actions are narrower), so the state is
 * now the pair (hidden columns, fold trigger) and the fold has its own threshold, `collapseBelow`.
 * The pair has to be as steady under a scrollbar-sized jitter as the columns alone: the fold depends on
 * the width and its own previous value only, so it cannot be dragged round a loop by the columns.
 * ---------------------------------------------------------------------------------------------- */

/** The folding tables are fewer: each state's row is a `getResponsiveFit` call per width. */
const FOLD_TABLES = 600;

interface FoldTable extends RandomTable {
  /** Absent for about 1 table in 5. */
  collapseBelow: number | undefined;
  reservedFoldedWidth: number;
  collapseApplies: boolean;
}

interface FitState {
  hidden: ReadonlySet<string>;
  trigger: boolean;
}

/** `randomTable`, plus the folding options, drawn from a stream of their own so the columns stay as they were. */
function randomFoldTable(seed: number): FoldTable {
  const table = randomTable(seed);
  const rand = seeded(seed + 0x9e3779b9);
  const int = (below: number) => Math.floor(rand() * below);
  const { columns, reservedWidth } = table;

  const reservedFoldedWidth =
    rand() < 0.25 ? reservedWidth : reservedWidth - int(Math.min(150, reservedWidth) + 1);
  const collapseApplies = rand() < 0.8;

  let collapseBelow: number | undefined;
  if (rand() >= 0.2) {
    const highest = MAX_WIDTH - DATA_TABLE_REVEAL_MARGIN;
    const clamp = (value: number) => Math.min(highest, Math.max(MIN_WIDTH, value));
    // Where the fold is most likely to get in the way: at a threshold, or where the fit changes.
    const edges: number[] = columns.flatMap((column) =>
      column.hideBelow === undefined ? [] : [column.hideBelow],
    );
    if (rand() < 0.4) {
      for (const room of new Set([reservedWidth, reservedFoldedWidth])) {
        let before = listOf(
          getColumnsHiddenByWidth(columns, { width: MIN_WIDTH, reservedWidth: room }),
        );
        for (let width = MIN_WIDTH + 1; width <= MAX_WIDTH; width += 1) {
          const now = listOf(getColumnsHiddenByWidth(columns, { width, reservedWidth: room }));
          if (now !== before) edges.push(width);
          before = now;
        }
      }
    }
    collapseBelow =
      edges.length > 0 && rand() < 0.6
        ? clamp(edges[int(edges.length)] + int(61) - 30)
        : MIN_WIDTH + int(highest - MIN_WIDTH + 1);
  }
  return { ...table, collapseBelow, reservedFoldedWidth, collapseApplies };
}

/** One `getResponsiveFit` step of a table, the reserved widths optionally moved by `shift` px. */
const fitStep = (
  table: FoldTable,
  width: number,
  previous?: FitState,
  shift = 0,
  collapseApplies = table.collapseApplies,
): ResponsiveFit =>
  getResponsiveFit(table.columns, {
    width,
    reservedWidth: table.reservedWidth + shift,
    reservedFoldedWidth: table.reservedFoldedWidth + shift,
    collapseBelow: table.collapseBelow,
    collapseApplies,
    previous,
  });

/** A state is a set of hidden columns and a fold trigger; this names it for a lookup. */
function keyOfState(columns: readonly DataTableColumn<Row>[], { hidden, trigger }: FitState) {
  let mask = 0;
  for (let index = 0; index < columns.length; index += 1) {
    if (hidden.has(columns[index].name)) mask |= 1 << index;
  }
  return mask * 2 + (trigger ? 1 : 0);
}

/**
 * `exploreStates` for the pair: the closure of "a first measurement at any width" under "any width
 * next, with the last answer fed back", the fold decided by `getResponsiveFit` itself.
 */
function exploreFitStates(table: FoldTable) {
  const sets: FitState[] = [];
  const ids = new Map<number, number>();
  const next: Int16Array[] = [];
  const remember = ({ hidden, trigger }: FitState): number => {
    const key = keyOfState(table.columns, { hidden, trigger });
    let id = ids.get(key);
    if (id === undefined) {
      id = sets.length;
      ids.set(key, id);
      sets.push({ hidden, trigger });
    }
    return id;
  };
  for (let at = 0; at < WIDTH_COUNT; at += 1) remember(fitStep(table, MIN_WIDTH + at));
  for (let id = 0; id < sets.length; id += 1) {
    const row = new Int16Array(WIDTH_COUNT);
    for (let at = 0; at < WIDTH_COUNT; at += 1) {
      row[at] = remember(fitStep(table, MIN_WIDTH + at, sets[id]));
    }
    next.push(row);
  }
  return { sets, next };
}

type FoldExplored = FoldTable & ReturnType<typeof exploreFitStates>;

const exploredFolds = new Map<number, FoldExplored>();
function foldAt(seed: number): FoldExplored {
  let table = exploredFolds.get(seed);
  if (!table) {
    const random = randomFoldTable(seed);
    table = { ...random, ...exploreFitStates(random) };
    exploredFolds.set(seed, table);
  }
  return table;
}

const showState = ({ hidden, trigger }: FitState) =>
  `{${listOf(hidden)}}${trigger ? " folded" : ""}`;

describe("getResponsiveFit: the generator", () => {
  it("draws tables with and without a fold threshold, with room to gain or none, applying or not", () => {
    let without = 0;
    let nearThreshold = 0;
    let equal = 0;
    let gains = 0;
    let notApplying = 0;
    let bothTriggers = 0;
    for (const seed of seeds(FOLD_TABLES)) {
      const table = foldAt(seed);
      const below = table.collapseBelow;
      if (below === undefined) without += 1;
      else {
        expect(below).toBeGreaterThanOrEqual(MIN_WIDTH);
        expect(below).toBeLessThanOrEqual(MAX_WIDTH - DATA_TABLE_REVEAL_MARGIN);
        if (table.columns.some((column) => Math.abs(below - (column.hideBelow ?? Infinity)) <= 30))
          nearThreshold += 1;
      }
      expect(table.reservedFoldedWidth).toBeLessThanOrEqual(table.reservedWidth);
      expect(table.reservedFoldedWidth).toBeGreaterThanOrEqual(0);
      if (table.reservedFoldedWidth === table.reservedWidth) equal += 1;
      else gains += 1;
      if (!table.collapseApplies) notApplying += 1;
      if (new Set(table.sets.map((state) => state.trigger)).size === 2) bothTriggers += 1;
    }
    expect(without / FOLD_TABLES).toBeGreaterThan(0.12);
    expect(without / FOLD_TABLES).toBeLessThan(0.28);
    expect(notApplying / FOLD_TABLES).toBeGreaterThan(0.12);
    expect(notApplying / FOLD_TABLES).toBeLessThan(0.28);
    expect(equal).toBeGreaterThan(FOLD_TABLES / 10);
    expect(gains).toBeGreaterThan(FOLD_TABLES / 2);
    expect(nearThreshold).toBeGreaterThan(FOLD_TABLES / 10);
    expect(bothTriggers).toBeGreaterThan(FOLD_TABLES / 3);
  }, 120_000);
});

describe("getResponsiveFit: no oscillation under a scrollbar-sized jitter", () => {
  /** The first way the pair can be walked in a loop: `s0 at W - jitter -> s1 at W -> s0`. */
  const twoStepLoops = (table: FoldExplored, jitter: number) => {
    const found: string[] = [];
    for (let s0 = 0; s0 < table.sets.length; s0 += 1) {
      for (let width = MIN_WIDTH + jitter; width <= MAX_WIDTH; width += 1) {
        const s1 = table.next[s0][width - jitter - MIN_WIDTH];
        if (s1 !== s0 && table.next[s1][width - MIN_WIDTH] === s0) {
          found.push(
            `seed ${table.seed} (fold below ${table.collapseBelow}, reserved ${table.reservedWidth}/${table.reservedFoldedWidth}${table.collapseApplies ? "" : ", not applying"}): ${showState(table.sets[s0])} at ${width - jitter}px -> ${showState(table.sets[s1])} at ${width}px -> back`,
          );
          break;
        }
      }
    }
    return found;
  };

  it(`holds for ${FOLD_TABLES} random tables, for any jitter smaller than the margin: s1 = f(W - j, s0) never leads straight back to s0`, () => {
    const failures: string[] = [];
    let states = 0;
    for (const seed of seeds(FOLD_TABLES)) {
      const table = foldAt(seed);
      states += table.sets.length;
      for (let jitter = 1; jitter < DATA_TABLE_REVEAL_MARGIN; jitter += 1) {
        failures.push(...twoStepLoops(table, jitter));
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
    expect(states).toBeGreaterThan(FOLD_TABLES);
  }, 120_000);

  it("can see a loop a pixel past the margin, which is what the margin is for", () => {
    let pastTheMargin = 0;
    for (const seed of seeds(FOLD_TABLES)) {
      if (twoStepLoops(foldAt(seed), DATA_TABLE_REVEAL_MARGIN + 1).length > 0) pastTheMargin += 1;
    }
    // Without this the test above could be passing because it looks at nothing.
    expect(pastTheMargin).toBeGreaterThan(FOLD_TABLES / 4);
  }, 120_000);

  it("cannot be walked in a loop by any widths within 15px of each other", () => {
    const failures: string[] = [];
    for (const seed of seeds(FOLD_TABLES)) {
      const table = foldAt(seed);
      for (let from = MIN_WIDTH; from + SCROLLBAR <= MAX_WIDTH; from += 1) {
        if (loopsWithin(table, from, from + SCROLLBAR)) {
          failures.push(`seed ${seed}: ${from}px to ${from + SCROLLBAR}px`);
          break;
        }
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  }, 120_000);
});

describe("getResponsiveFit: what the fold depends on", () => {
  it("depends on the width, collapseBelow and its own previous value only, for any hidden columns", () => {
    const margin = DATA_TABLE_REVEAL_MARGIN;
    const expectedTrigger = (table: FoldTable, width: number, was: boolean | undefined) => {
      const below = table.collapseBelow;
      if (below === undefined) return false;
      if (width < below) return true;
      if (width >= below + margin) return false;
      return was ?? false;
    };
    const failures: string[] = [];
    for (const seed of seeds(FOLD_TABLES)) {
      const table = foldAt(seed);
      // Every state the walk reaches, at every width: the trigger is the fold's own hysteresis.
      for (let state = 0; state < table.sets.length; state += 1) {
        for (let at = 0; at < WIDTH_COUNT; at += 1) {
          const width = MIN_WIDTH + at;
          const got = table.sets[table.next[state][at]].trigger;
          const want = expectedTrigger(table, width, table.sets[state].trigger);
          if (got !== want)
            failures.push(`seed ${seed}: ${showState(table.sets[state])} at ${width}px`);
        }
      }
      // And for sets of hidden columns that walk never reaches: drawn at random.
      const rand = seeded(seed * 31 + 7);
      for (let draw = 0; draw < 120; draw += 1) {
        const hidden = new Set(
          table.columns.filter(() => rand() < 0.5).map((column) => column.name),
        );
        const trigger = rand() < 0.5;
        const width = MIN_WIDTH + Math.floor(rand() * WIDTH_COUNT);
        const result = fitStep(table, width, { hidden, trigger });
        if (result.trigger !== expectedTrigger(table, width, trigger))
          failures.push(`seed ${seed}: {${listOf(hidden)}} ${trigger} at ${width}px`);
        if (result.collapsed !== (result.trigger && table.collapseApplies))
          failures.push(`seed ${seed}: collapsed at ${width}px`);
      }
      // A first measurement has nothing to keep: the band is unfolded.
      for (let at = 0; at < WIDTH_COUNT; at += 1) {
        const width = MIN_WIDTH + at;
        const trigger = fitStep(table, width).trigger;
        if (trigger !== (table.collapseBelow !== undefined && width < table.collapseBelow))
          failures.push(`seed ${seed}: first measurement at ${width}px`);
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  }, 120_000);

  it("fits the columns into the reserved width of the fold it decided, and nothing else", () => {
    const estimate = (column: DataTableColumn<Row>) => estimateColumnWidth(column);
    const failures: string[] = [];
    let folded = 0;
    for (const seed of seeds(POINTWISE_TABLES)) {
      const table = foldAt(seed);
      const { columns, sets, next } = table;
      const kept = keptColumn(columns);
      for (let state = 0; state < sets.length; state += 1) {
        for (let at = 0; at < WIDTH_COUNT; at += 1) {
          const width = MIN_WIDTH + at;
          const { hidden, trigger } = sets[next[state][at]];
          // The folded width counts only when the fold is on and has anything to fold.
          const collapsed = trigger && table.collapseApplies;
          if (collapsed) folded += 1;
          const room = collapsed ? table.reservedFoldedWidth : table.reservedWidth;
          const showing =
            room +
            columns.reduce(
              (sum, column) => (hidden.has(column.name) ? sum : sum + estimate(column)),
              0,
            );
          if (showing <= width) continue;
          for (const column of columns) {
            const budgeted = hasOption(column, "priority") && !hasOption(column, "hideBelow");
            if (budgeted && column !== kept && !hidden.has(column.name)) {
              failures.push(
                `seed ${seed}, from ${showState(sets[state])} at ${width}px: ${column.name} shows though ${showing}px > ${width}px (${collapsed ? "folded" : "unfolded"})`,
              );
            }
          }
        }
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
    expect(folded).toBeGreaterThan(0);
  }, 120_000);

  it("never picks the folded width when nothing can fold: the answer is the one without a fold at all", () => {
    const failures: string[] = [];
    let compared = 0;
    for (const seed of seeds(POINTWISE_TABLES)) {
      const table = foldAt(seed);
      if (table.collapseBelow === undefined || table.reservedFoldedWidth === table.reservedWidth)
        continue;
      for (let state = 0; state < table.sets.length; state += 1) {
        for (let width = MIN_WIDTH; width <= MAX_WIDTH; width += 7) {
          const previous = table.sets[state];
          const applying = fitStep(table, width, previous, 0, false);
          const plain = getColumnsHiddenByWidth(table.columns, {
            width,
            reservedWidth: table.reservedWidth,
            previouslyHidden: previous.hidden,
          });
          compared += 1;
          if (applying.collapsed || !sameColumnNames(applying.hidden, plain))
            failures.push(`seed ${seed}: ${showState(previous)} at ${width}px`);
        }
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
    expect(compared).toBeGreaterThan(1000);
  }, 120_000);

  it("settles: feeding the answer back in at the same width changes nothing", () => {
    const failures: string[] = [];
    for (const seed of seeds(FOLD_TABLES)) {
      const { sets, next } = foldAt(seed);
      for (let state = 0; state < sets.length; state += 1) {
        for (let at = 0; at < WIDTH_COUNT; at += 1) {
          const once = next[state][at];
          if (next[once][at] !== once)
            failures.push(`seed ${seed}: ${showState(sets[state])} at ${MIN_WIDTH + at}px`);
        }
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  }, 120_000);
});

describe("getResponsiveFit: a reserved width that changes between calls", () => {
  const margin = DATA_TABLE_REVEAL_MARGIN;

  /**
   * The pinned cells are measured, so the room they leave can change between two renders. Both
   * reserved widths move by `shift` px for the second call. For each state of the walk, each jitter
   * up to `limit` and each width: `s1 = f(W - j, s0)` at the old widths, then `f(W, s1)` at the new
   * ones, and whether that is back at `s0`.
   */
  const returnsFrom = (table: FoldExplored, shift: number, limit: number) => {
    // The rows under the shifted widths, computed once per state that is asked about.
    const rows = new Map<number, Int32Array>();
    const shifted = (state: number): Int32Array => {
      let row = rows.get(state);
      if (!row) {
        row = new Int32Array(WIDTH_COUNT);
        for (let at = 0; at < WIDTH_COUNT; at += 1) {
          const { hidden, trigger } = fitStep(table, MIN_WIDTH + at, table.sets[state], shift);
          row[at] = keyOfState(table.columns, { hidden, trigger });
        }
        rows.set(state, row);
      }
      return row;
    };
    const found: string[] = [];
    for (let s0 = 0; s0 < table.sets.length; s0 += 1) {
      const home = keyOfState(table.columns, table.sets[s0]);
      for (let jitter = 1; jitter <= limit; jitter += 1) {
        for (let width = MIN_WIDTH + jitter; width <= MAX_WIDTH; width += 1) {
          const s1 = table.next[s0][width - jitter - MIN_WIDTH];
          if (s1 !== s0 && shifted(s1)[width - MIN_WIDTH] === home) {
            found.push(
              `seed ${table.seed}: ${showState(table.sets[s0])} at ${width - jitter}px -> ${showState(table.sets[s1])} at ${width}px with the widths ${shift > 0 ? "+" : ""}${shift} -> back`,
            );
            break;
          }
        }
      }
    }
    return found;
  };

  it("keeps the margin when the reserved width grows by up to a margin and a pixel, and loses what it shrinks by", () => {
    const failures: string[] = [];
    const rand = seeded(2024);
    for (const seed of seeds(300)) {
      const table = foldAt(seed);
      // A wider reserve puts the columns under more pressure. A column shown a margin past its
      // threshold at W - j is hidden again at W only if the room fell by more than margin + j.
      const grow = 1 + Math.floor(rand() * (margin + 1));
      failures.push(...returnsFrom(table, grow, margin - 1));
      // A narrower one gives away that much of the margin: jitters short of the rest are still safe.
      const shrink = 1 + Math.floor(rand() * 20);
      failures.push(...returnsFrom(table, -shrink, margin - 1 - shrink));
    }
    expect(failures.slice(0, 10)).toEqual([]);
  }, 120_000);

  it("a reserved width that changes by dR leaves a margin of margin - dR: the plain invariant can fail by 2 px", () => {
    // Found in review: a (100, priority 1) and x (100, priority 2), W = 1000, jitter 23. The pinned
    // cells measured 778 on one render and 776 on the next, 2 px less.
    const columns = cols(
      ["a", { priority: 1, width: "100px" }],
      ["x", { priority: 2, width: "100px" }],
    );
    const at = (width: number, reservedWidth: number, hidden: string[]) =>
      getResponsiveFit(columns, {
        width,
        reservedWidth,
        previous: { hidden: new Set(hidden), trigger: false },
      }).hidden;

    // 778 + 200 = 978 does not fit 977, so x goes; 776 + 200 = 976 fits 1000 - 24 with room to spare.
    const s0: string[] = [];
    const s1 = at(1000 - 23, 778, s0);
    expect([...s1]).toEqual(["x"]);
    expect([...at(1000, 776, [...s1])]).toEqual(s0);

    // The same two renders with the widths unchanged do not return: x is held a margin.
    expect([...at(1000, 778, [...s1])]).toEqual(["x"]);

    // With 2 px less to lose, every jitter up to margin - 2 stays safe at every width, from either set.
    const returned: string[] = [];
    for (let jitter = 1; jitter <= margin - 2; jitter += 1) {
      for (let width = 300; width <= 1600; width += 1) {
        for (const from of [s0, ["x"]]) {
          const away = at(width - jitter, 778, from);
          const back = at(width, 776, [...away]);
          if (!sameColumnNames(away, new Set(from)) && sameColumnNames(back, new Set(from)))
            returned.push(
              `${from.join(",") || "-"} at ${width - jitter}px -> ${listOf(away)} at ${width}px`,
            );
        }
      }
    }
    expect(returned).toEqual([]);

    // And the first jitter past that is where it fails: margin - dR is tight, not just sufficient.
    const failing = new Set<number>();
    for (let jitter = margin - 1; jitter <= margin; jitter += 1) {
      for (let width = 300; width <= 1600; width += 1) {
        const away = at(width - jitter, 778, s0);
        const back = at(width, 776, [...away]);
        if (!sameColumnNames(away, new Set(s0)) && sameColumnNames(back, new Set(s0)))
          failing.add(jitter);
      }
    }
    expect(failing).toEqual(new Set([margin - 1, margin]));
  });

  it("a reserved width that grows by more than a margin and a pixel is a real resize, and can bring a column back round", () => {
    const columns = cols(
      ["a", { priority: 1, width: "100px" }],
      ["x", { priority: 2, width: "100px" }],
    );
    /** Whether `x` hidden at W - j (room 700 + 200 = 900), shown a margin past, is hidden again at W by `grow` more. */
    const backAfter = (grow: number) => {
      const found: string[] = [];
      for (let jitter = 1; jitter < margin; jitter += 1) {
        for (let width = 300; width <= 1600; width += 1) {
          const shown = getResponsiveFit(columns, {
            width: width - jitter,
            reservedWidth: 700,
            previous: { hidden: new Set(["x"]), trigger: false },
          }).hidden;
          const again = getResponsiveFit(columns, {
            width,
            reservedWidth: 700 + grow,
            previous: { hidden: shown, trigger: false },
          }).hidden;
          if (!shown.has("x") && again.has("x")) found.push(`${width - jitter}px -> ${width}px`);
        }
      }
      return found;
    };
    expect(backAfter(margin + 1)).toEqual([]);
    expect(backAfter(margin + 2)).toContain("924px -> 925px");
  });
});

describe("getResponsiveFit: what the hysteresis keeps, with the fold", () => {
  it("lets a showing column go as the container grows only to pay for a hideBelow column that came back, or because the fold let go", () => {
    const failures: string[] = [];
    let paidByFold = 0;
    for (const seed of seeds(POINTWISE_TABLES)) {
      const table = randomFoldTable(seed);
      const { columns } = table;
      const kept = keptColumn(columns);
      // Folding changes the room only when the folded actions are narrower.
      const folding = table.reservedFoldedWidth < table.reservedWidth;
      const sweep = (widths: number[], growing: boolean) => {
        let before: ResponsiveFit | undefined;
        for (const width of widths) {
          const now = fitStep(table, width, before);
          if (before) {
            // Growing, a hideBelow column coming back pays; shrinking, one going away frees the room.
            const paying = columns.some(
              (column) =>
                hasOption(column, "hideBelow") &&
                before!.hidden.has(column.name) === growing &&
                now.hidden.has(column.name) !== growing,
            );
            // Growing, unfolding takes room from the columns; shrinking, folding gives it back.
            const flipped = growing
              ? before.collapsed && !now.collapsed
              : !before.collapsed && now.collapsed;
            for (const column of columns) {
              const moved = growing
                ? !before.hidden.has(column.name) && now.hidden.has(column.name)
                : before.hidden.has(column.name) && !now.hidden.has(column.name);
              if (moved && !paying && column !== kept) {
                if (flipped && folding) paidByFold += 1;
                else
                  failures.push(
                    `seed ${seed} (fold below ${table.collapseBelow}): ${column.name} ${growing ? "hid" : "came back"} at ${width}px for nothing`,
                  );
              }
            }
          }
          before = now;
        }
      };
      const up = Array.from({ length: WIDTH_COUNT }, (_, i) => MIN_WIDTH + i);
      sweep(up, true);
      sweep([...up].reverse(), false);
    }
    expect(failures.slice(0, 10)).toEqual([]);
    // The exemption is used: folding does make a column come and go in these tables.
    expect(paidByFold).toBeGreaterThan(0);
  }, 120_000);
});

describe("sameColumnNames", () => {
  it("compares sets by their members", () => {
    expect(sameColumnNames(new Set(["a", "b"]), new Set(["b", "a"]))).toBe(true);
    expect(sameColumnNames(new Set(["a"]), new Set(["a", "b"]))).toBe(false);
    expect(sameColumnNames(new Set(["a"]), new Set(["b"]))).toBe(false);
    expect(sameColumnNames(new Set(), new Set())).toBe(true);
  });
});

describe("getDetailItems", () => {
  it("pairs each column's header with what the renderer makes of it, in order", () => {
    const columns = cols(["start", { header: "Start" }], ["amount", { header: "Amount" }]);
    const items = getDetailItems(columns, (column) => `<${column.name}>`);
    expect(items).toEqual([
      { name: "start", label: "Start", content: "<start>" },
      { name: "amount", label: "Amount", content: "<amount>" },
    ]);
  });

  it("labels a column with no header by its name", () => {
    const items = getDetailItems(cols(["owner"]), () => "x");
    expect(items[0].label).toBe("owner");
  });

  it("is empty for no columns", () => {
    expect(getDetailItems([], () => "x")).toEqual([]);
  });
});
