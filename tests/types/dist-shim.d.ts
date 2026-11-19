/**
 * Ambient type declarations for dist/workbench.mjs imports in tests.
 * Resolves static imports when dist/ has not yet been built, allowing vp check and
 * type-aware linting to pass on clean checkouts.
 */
declare module "*/dist/workbench.mjs" {
  export * from "@/workbench.ts";
}

declare module "../dist/workbench.mjs" {
  export * from "@/workbench.ts";
}
