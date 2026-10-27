import { describe, expect, it } from "vite-plus/test";
import {
  DATA_TABLE_COLUMN_WIDTH_ESTIMATE,
  DATA_TABLE_RESERVED_WIDTH,
  DATA_TABLE_REVEAL_MARGIN,
  estimateColumnWidth,
  getColumnsHiddenByWidth,
  getDetailItems,
  reservedColumnsWidth,
  type DataTableColumn,
} from "../src/components/ui/data-table";
import {
  isResponsiveColumn,
  sameColumnNames,
} from "../src/components/ui/data-table/responsive-columns";

type Row = Record<string, unknown>;

/** Columns are built from `[name, options]` pairs, in render order. */
const cols = (...specs: Array<[string, Partial<DataTableColumn<Row>>?]>): DataTableColumn<Row>[] =>
  specs.map(([name, options]) => ({ name, ...options }));

const hiddenAt = (
  columns: DataTableColumn<Row>[],
  width: number | null,
  extra: { reservedWidth?: number; previouslyHidden?: ReadonlySet<string> } = {},
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
});

describe("reservedColumnsWidth", () => {
  it("always holds room for the details button, and adds selection and actions when present", () => {
    const { select, detail, actions } = DATA_TABLE_RESERVED_WIDTH;
    expect(reservedColumnsWidth({ selectable: false, actions: false })).toBe(detail);
    expect(reservedColumnsWidth({ selectable: true, actions: false })).toBe(select + detail);
    expect(reservedColumnsWidth({ selectable: true, actions: true })).toBe(
      select + detail + actions,
    );
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
