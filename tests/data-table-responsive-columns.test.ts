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
function loopsWithin({ sets, next }: Explored, from: number, to: number): boolean {
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
