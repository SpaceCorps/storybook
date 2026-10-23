# SpaceCorps Storybook — Agent Guidelines

This repository is the SpaceCorps design system. It was extracted from a parent monorepo
(`src/packages/components`) and now stands alone: what used to be inherited from the monorepo root
lives here instead.

Two things changed in the extraction, and both are load-bearing:

- **`pnpm-workspace.yaml` is a real file, not a symlink.** In the monorepo it symlinked to the root
  workspace file three levels up. It now carries its own copy of the `catalog:` entries (`vite`,
  `vite-plus`), the playwright overrides and `minimumReleaseAgeExclude`. `package.json` resolves
  `vite` and `vite-plus` through `catalog:`, so deleting or trimming those entries breaks install.
- **The package is `@spacecorps/components`, published to GitHub Packages** (`npm.pkg.github.com`),
  not npmjs.com. `tests/package-metadata.test.ts` pins the name, repository metadata and
  `publishConfig`; update that test deliberately, never to make a red build green.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## Git Hooks

`.vite-hooks/pre-commit` runs `vp staged --no-stash` instead of plain `vp staged`. `refs/stash` is shared by every worktree of this clone, and lint-staged resolves its backup stash by _index_, so a sibling worktree's commit can make it drop or apply the wrong entry.

- Do not remove the `--no-stash` flag to silence the `Skipping backup` warning it prints on every commit. The warning is the honest price of the protection.
- If a commit fails and you had unstaged hunks in a partially staged file, they are in `lint-staged_unstaged.patch` inside `git rev-parse --absolute-git-dir`. Re-apply with `git apply --3way`.

## Resolving Merge Conflicts

When resolving conflicts in `package.json` or `pnpm-workspace.yaml`:

1. **Never keep your branch's manifest side wholesale.** Resolve conflicts key-by-key, preferring the side that introduced the change over the base. Keeping `HEAD` or `MERGE_HEAD` without inspection silently reverts already-merged changes.

2. **Run the merge guard before committing the resolution:**

   ```bash
   pnpm run verify:merge
   ```

   The guard detects lost changes by comparing `base`, `ours`, `theirs`, and `merged` for every dependency/script key and the `packageManager`, `devEngines`, `type`, `main`, `types` and `exports` fields in `package.json`, plus every catalog, override and setting in `pnpm-workspace.yaml`. If it reports findings, review each one — a revert surfaces as someone else's test failing, not yours.

3. **If a drop is deliberate,** pass `--allow <section>.<key>` to suppress the warning and document why in the commit message. For example:

   ```bash
   pnpm run verify:merge --allow devDependencies.old-package
   ```

4. **After committing the resolution, run the full test suite** (`pnpm test`), not only your plan's tests. A lost change is detected by another plan's tests breaking, so a green suite on your subset proves nothing.

### Precedent

Commit `8698ad1` _"[00059] Resolve merge conflicts with main"_ kept the base side of `package.json` wholesale, reverting [Plan 00077](plan://00077)'s dev scripts and [Plan 00090](plan://00090)'s variable font switch. Both were already merged to `main` — the conflict resolution undid them. Two test files went red (`tests/storybook-runner.test.ts`, `tests/fonts.test.ts`) and the bad resolution merged anyway because `vp check` short-circuited before the suite ran.

The merge guard prevents this pattern. Branch protection that requires a green `Lint & Types` + `Package Build` + `Unit Tests` + `Merge Resolution Guard` status will be enabled via `pnpm run protect:main` once the repository is public or on a paid GitHub plan. Until then, the guard runs in CI as a job that can fail the PR, but cannot block merging.

## Multi-Document Lockfile

`pnpm-lock.yaml` contains **two YAML documents** separated by `---`. The leading document locks the package manager itself (`packageManagerDependencies`); the second document is the project's dependency graph.

The pinned pnpm — 11.25.0 — is what _writes_ the leading document. Any older pnpm **removes** it, silently and with exit 0, and does not put it back: pnpm 10 has no `packageManagerDependencies` support, so a bare `pnpm install` from a pnpm 10 on `PATH` strips the block and never restores it. That is a one-way loss, not self-healing behavior. Once stripped, `pnpm install --frozen-lockfile` (both jobs in `.github/workflows/storybook-tests.yml`) fails with a message that names neither a pnpm version nor a file:

```
[ERROR] Cannot update packageManagerDependencies with "frozen-lockfile" because the lockfile is not up to date
```

The top-level `"packageManager": "pnpm@11.25.0"` field in `package.json` is what forces the right pnpm: pnpm's `manage-package-manager-versions` (default `true`) reads it and re-executes as 11.25.0, so even a pnpm 10 on `PATH` leaves the lockfile byte-identical. `devEngines.packageManager` is kept alongside it because `vp install` reads that one; the two must always name the same version, and `tests/package-manager-pin.test.ts` fails if they drift or if the lockfile block goes missing.

Operational rules:

- Do not delete the leading document during merge conflict resolution. It will not come back on its own.
- If `manage-package-manager-versions` is disabled in your pnpm config, install with `vp install` or `corepack pnpm@11.25.0 install` rather than bare `pnpm` — the `packageManager` field cannot protect you with that setting off.
- Tests that parse the lockfile use the `yaml` package to select a document by key (`overrides` for the project document, `packageManagerDependencies` for the leading one) — never by index.
- Every workflow now installs with `--frozen-lockfile` (`ci.yml` included), so a stripped leading document fails the PR everywhere instead of being silently repaired in one job.

## Node 26 and `localStorage`

`vp test` is green on 142 files / 1396 tests. It was not always: on Node 26 it reported **48 failures
across 5 files**, and on the Node 24 that CI pins it reported none. A failure that only reproduces on
a developer's machine is the worst way round, so the cause is worth knowing.

Node 26 turns its experimental Web Storage on by default, and without `--localstorage-file` that
`localStorage` getter returns `undefined`. Node installs it on the same global object jsdom uses as
`window`, where it shadows jsdom's working implementation — so `localStorage.clear()` in a
`beforeEach` threw "Cannot read properties of undefined" and took every test in the file with it.
`sessionStorage` is unaffected; Node's does not require the file flag.

`tests/setup.ts` repairs it by borrowing a real `Storage` from a throwaway iframe and re-parenting it
onto this realm's `Storage.prototype`. Both halves matter: a hand-rolled Map-backed fake would drift
from jsdom's `length`/`key(n)`/coercion semantics, and an object left parented in the iframe's realm
would slip past the `vi.spyOn(Storage.prototype, "getItem")` that tests use to simulate a quota
failure. `tests/local-storage-repair.test.ts` guards all of it, and its assertions hold on both Node
versions — the suite should not be able to tell which one it is running on.

If a future Node makes the flag unnecessary, the repair no-ops on its own: it only runs when
`window.localStorage` is `undefined`.

## CI runs on a capped allowance

This repo is private and SpaceCorps is on the free org plan, so Actions minutes are a hard monthly
allowance (2,000) rather than a bill. When it is exhausted, jobs do not queue — they fail in about
two seconds with "recent account payments have failed or your spending limit needs to be increased",
which reads like a broken workflow and is not one. Check
`gh api /organizations/SpaceCorps/settings/billing/usage` before debugging a two-second failure.

The allowance is shared across every private repo in the org, so a run here competes with the rest
of them. That is why each job carries a `timeout-minutes`, why `pull_request` triggers are scoped to
`main`, and why every workflow has a `concurrency` group that cancels superseded runs. Keep those
three properties on any workflow added here: on a capped plan a wasted run is not just cost, it is a
run some later commit will not get.

The public repos (`open-agents`, `open-browser`) draw on unlimited free minutes and are unaffected.
