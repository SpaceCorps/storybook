import { describe, expect, it, vi } from "vite-plus/test";

/**
 * Guards the `localStorage` repair in `tests/setup.ts`.
 *
 * Node 26 ships an experimental Web Storage that is on by default and whose `localStorage` is
 * `undefined` unless `--localstorage-file` is passed. It installs onto the same global jsdom uses
 * as `window`, so it shadows jsdom's working implementation and 47 tests across four files died on
 * "Cannot read properties of undefined". CI pins Node 24, where the flag is off — so the breakage
 * appeared only on developer machines, and only the ones that had moved on to 26.
 *
 * These assertions hold on both versions: on 24 they describe jsdom's own storage, on 26 the one
 * the repair borrowed. That is the point — the suite should not be able to tell the difference.
 */
describe("localStorage in the test environment", () => {
  it("is a usable Storage, whichever Node version provides it", () => {
    expect(window.localStorage).toBeDefined();
    window.localStorage.clear();
    window.localStorage.setItem("probe", "1");
    expect(window.localStorage.getItem("probe")).toBe("1");
    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.key(0)).toBe("probe");
    window.localStorage.removeItem("probe");
    expect(window.localStorage.getItem("probe")).toBeNull();
    window.localStorage.clear();
  });

  it("answers to a spy on this realm's Storage.prototype", () => {
    // The repair borrows a Storage from a throwaway iframe, which is a second jsdom realm. Tests
    // that simulate a quota or security failure patch `Storage.prototype` here, and an object
    // parented in the other realm would sail straight past that patch and return a real value.
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => window.localStorage.getItem("anything")).toThrow("QuotaExceededError");
    spy.mockRestore();
    expect(() => window.localStorage.getItem("anything")).not.toThrow();
  });

  it("is not the same object as sessionStorage", () => {
    // Node's `sessionStorage` needs no file flag, so jsdom's survives and is untouched by the
    // repair. Aliasing the two would let one test's writes surface in another's reads.
    window.localStorage.setItem("where", "local");
    expect(window.sessionStorage.getItem("where")).toBeNull();
    window.localStorage.clear();
  });
});
