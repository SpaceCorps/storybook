import { cleanup } from "@testing-library/react";
import { afterEach } from "vite-plus/test";

afterEach(() => {
  cleanup();
});

if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Node 26 enables its experimental Web Storage by default, and without `--localstorage-file` its
// `localStorage` getter returns `undefined`. That global lands on the very object jsdom uses as
// `window`, and it shadows jsdom's own, so every test touching `localStorage` dies on "Cannot read
// properties of undefined". Node 24 — which CI pins — has the flag off, so the suite is green there
// and red on a developer's machine, which is the worst way round for a failure to be.
//
// The repair borrows a real `Storage` from a throwaway iframe rather than hand-rolling a Map-backed
// fake: tests lean on jsdom's actual semantics — `length`, `key(n)`, value coercion — and a fake
// that drifts from them would pass tests the browser would fail. The instance keeps working after
// the iframe is detached, because its backing store belongs to the storage object, not the frame.
//
// `sessionStorage` needs none of this: Node's version of it does not require the file flag, so
// jsdom's survives.
if (typeof window !== "undefined" && window.localStorage === undefined) {
  const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
  if (descriptor?.configurable) {
    const frame = window.document.createElement("iframe");
    window.document.body.append(frame);
    const borrowed = frame.contentWindow?.localStorage;
    frame.remove();
    if (borrowed) {
      // The iframe is a second jsdom realm, so `borrowed` inherits from *its* `Storage.prototype`.
      // Tests stub storage failures with `vi.spyOn(Storage.prototype, "getItem")` against the outer
      // realm's prototype, and that patch would miss an object parented elsewhere — the SSR test
      // read a value back where it expected the throw. Re-parenting keeps the working backing store
      // (it belongs to the instance) while putting the object on the prototype tests reach for.
      Object.setPrototypeOf(borrowed, Storage.prototype);
      Object.defineProperty(window, "localStorage", {
        value: borrowed,
        configurable: true,
        enumerable: true,
        writable: false,
      });
    }
  }
}
