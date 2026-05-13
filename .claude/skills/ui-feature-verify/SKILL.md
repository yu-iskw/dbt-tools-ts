---
name: ui-feature-verify
description: Lightweight verification for UI-only changes to @dbt-tools/web. Runs lint, unit tests, coverage, a fresh build, Playwright E2E, and a coverage gap report. Use instead of the full verifier when changes are confined to packages/web/src/ and/or packages/web/e2e/. Skips CodeQL and pack+npx smoke.
compatibility: Requires pnpm and Node as in repo .node-version; Playwright Chromium via @dbt-tools/web devDependencies. Run from repository root unless noted.
---

# UI feature verify

## Trigger scenarios

Use this skill when:

- A change is **confined to `packages/web/src/`** (components, styles, types, lib, helpers).
- A change touches **`packages/web/e2e/`** (Playwright specs, fixtures, helpers) **even if** nothing under `web/src/` changed — E2E-only work still needs build + browser install + E2E (steps 5–7).
- The user asks to verify, green-check, or ship a UI feature without a full verifier run.
- The task involves new nav pills, view tabs, timeline inspector changes, or other interactive UI elements.

Do **not** use this skill when changes touch published packages (`dbt-artifacts-parser`, `@dbt-tools/core`), scripts under `scripts/`, CI workflows, or `package.json` files **in isolation** (no `@dbt-tools/web` app or E2E scope). Use the full **verifier** agent for those. If the diff mixes those areas **with** `packages/web/src/` or **`packages/web/e2e/`**, prefer this skill for the web/E2E verification slice and call out any remaining gates the full verifier must cover.

## Steps (canonical order)

1. **Working-tree check.** Run `git status --short`. If files outside `packages/web/` are modified, warn the user and ask whether to proceed. If another agent may still be writing files, wait for it to finish before continuing.

2. **Lint.** Run `pnpm lint:report` from the repository root. Must exit 0. If it fails, apply `lint-and-fix` until it passes, then rerun.

3. **Unit tests.** Run `pnpm --filter @dbt-tools/web test`. If tests fail, apply `test-and-fix` and rerun until green.

4. **Coverage.** Run `pnpm coverage:report` from the repository root. Must exit 0. If below thresholds, add unit tests and rerun. Thresholds: lines 60%, branches 50%, functions 60%, statements 60% (see `CLAUDE.md`).

5. **Build (always rebuild).** Run `pnpm --filter @dbt-tools/web build`. Do not skip even if `dist/` appears current—a stale build causes silent E2E failures. If it fails, apply `build-and-fix` and rerun.

6. **Playwright browser check.** Run `pnpm --filter @dbt-tools/web exec playwright install chromium --with-deps`. Idempotent when browsers are present; fast. Do not skip.

7. **E2E.** Run `pnpm --filter @dbt-tools/web test:e2e`. If E2E fails, apply `dbt-tools-web-e2e-fix` and rerun until green. **E2E-only edits** (no `web/src/` changes) still require **steps 5–7** (fresh build, Playwright install, E2E).

8. **Coverage gap report.** Review the diff for this session (`git diff --name-only HEAD~1..HEAD` or the user's stated scope). List every new interactive UI element (button, tab, pivot, navigation link) added. For each, confirm a `toBeVisible` or equivalent assertion exists in the corresponding spec under `packages/web/e2e/`. Report any element without a spec assertion as a gap. Do not claim the feature is shipped until each gap is covered or explicitly accepted by the user with a reason.

## Parallel batches

- **Steps 2 and 3** are safe to run in parallel (lint and unit tests are independent).
- **Step 4** must run after step 3 (Vitest contention if concurrent).
- **Steps 5–8** are sequential: build → browser check → E2E → gap report.

## What this skill skips

Intentionally omits `pnpm codeql` and `dbt-tools-web-pack-npx-smoke`. Both are expensive and irrelevant for source-only UI changes. Use the full **verifier** agent when those gates are needed.

## Related

- [dbt-tools-web-e2e skill](../dbt-tools-web-e2e/SKILL.md) — authoring E2E specs
- [dbt-tools-web-e2e-fix skill](../dbt-tools-web-e2e-fix/SKILL.md) — fixing E2E failures
- [verifier agent](../../agents/verifier.md) — full verification including CodeQL
- [Coverage contract](../dbt-tools-web-e2e/SKILL.md#coverage-contract) — assertion requirement for new UI elements
