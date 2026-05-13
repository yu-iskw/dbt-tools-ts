---
name: dbt-tools-web-e2e-fix
description: Run Playwright E2E for @dbt-tools/web and fix failures. Use when the user asks to run E2E tests, fix E2E, fix Playwright failures, green test:e2e, or debug failing web app E2E—not unit tests (Vitest).
compatibility: Requires pnpm, Node as in repo .node-version; Playwright via @dbt-tools/web devDependencies. Run commands from repository root unless noted.
---

# dbt-tools web E2E fix (Playwright)

## Trigger scenarios

Activate this skill when the user says or implies:

- Run **E2E** / **Playwright** / **`pnpm test:e2e`** for the web app
- Fix **failing E2E**, **flaky** Playwright tests, **timeouts**, or **test:e2e** errors
- Get **green** web end-to-end tests after UI or spec changes

Do **not** use this skill for **`pnpm test`** (Vitest); use **`test-and-fix`** for unit tests.

## Purpose

Run the `@dbt-tools/web` Playwright suite from the repo root. If it fails, read the output (and traces/screenshots when configured), apply the smallest fix in the **app**, **spec**, or **fixture**, and re-run until E2E passes or an iteration limit is reached.

## Commands for this repo

Run from the **repository root**.

- **E2E (preferred):** `pnpm test:e2e` — runs `pnpm --filter @dbt-tools/web test:e2e`, which executes **`pnpm build && playwright test`** inside the web package, so **`dist/` is built before preview**.
- **Equivalent:** `pnpm --filter @dbt-tools/web test:e2e`

If **Playwright reports missing browsers**, install from the repo root (example): `pnpm --filter @dbt-tools/web exec playwright install` (or follow the error text).

**Debugging (optional):** From `packages/web`, you can run Playwright with extra flags after a local build, e.g. `pnpm exec playwright test --debug` or with tracing—see [Playwright conventions](../dbt-tools-web-e2e/references/playwright-conventions.md).

**Standalone build failures:** If you bypass the package script and `dist/` is stale or the web package fails to compile, use **`build-and-fix`** (`pnpm build` / `pnpm --filter @dbt-tools/web build`).

## Fixer loop

1. **Run:** Execute `pnpm test:e2e` from the repository root.
2. **Identify:** Read the output for failing spec file, test title, assertion message, timeout, or screenshot/trace path.
3. **Fix:** Apply the minimum necessary change—implementation bug, stable selector/assertion, fixture path, timing/waits, or config. Prefer one logical fix per iteration.
4. **Verify:** Re-run `pnpm test:e2e`.
5. **Repeat** until E2E passes or up to **5 iterations** to avoid unbounded loops.

## Common failure types

- **Assertion / visibility mismatch:** Align the spec with intentional UI behavior, or fix the app if the test reflects the product contract. Prefer roles, labels, and accessible names over brittle CSS (see **`dbt-tools-web-e2e`**).
- **Timeout / flake:** Reduce unnecessary fixed sleeps; use Playwright auto-waiting and targeted `expect` retries; check for race conditions in the app.
- **Fixture or path errors:** Correct paths under `packages/web/e2e/`; see [fixtures and paths](../dbt-tools-web-e2e/references/fixtures-and-paths.md).
- **Preview vs dev:** Tests use **Vite preview**, not `pnpm dev`. Do **not** remove `test.skip` or weaken assertions without fixing the **preview/bundle** root cause. See [Preview build constraint](../dbt-tools-web-e2e/SKILL.md#preview-build-constraint) in **`dbt-tools-web-e2e`**.
- **Global `getByRole` collisions:** The same **accessible name** can appear in the **sidebar** and in a **panel** (for example a new primary nav item vs copy inside `section.upload-hero`). Assertions like “no button named X on this screen” must be **scoped** (`page.locator("#app-sidebar")`, `page.locator("section.upload-hero")`, `main`, etc.); never rely on a page-wide `getByRole` when multiple regions can expose the same label.
- **When to run E2E early:** After changes to **primary sidebar order/labels**, **workspace chrome**, **artifact load**, or **any file under** `packages/web/e2e/`, run **`pnpm test:e2e`** before claiming complete — nav-only changes can pass unit tests but fail navigation specs.

## Related skills

- **Authoring specs, selectors, fixtures:** [`dbt-tools-web-e2e`](../dbt-tools-web-e2e/SKILL.md)
- **Unit tests (Vitest):** [`test-and-fix`](../test-and-fix/SKILL.md)
- **TypeScript / workspace build errors:** [`build-and-fix`](../build-and-fix/SKILL.md)

## Quality gates

After meaningful UI, spec, or app fixes for E2E: from the repo root run **`pnpm lint:report`** and **`pnpm coverage:report`** until both exit 0. E2E does not replace unit-test coverage thresholds.

## Verifier agent

The default **verifier** agent does **not** run Playwright E2E (slower, browser-dependent); it **does** run **`dbt-tools-web-pack-npx-smoke`** (tarball + `npx --help`) after **`pnpm build`**. Run **`pnpm test:e2e`** and this skill when the user or task calls for full web flow verification—for example after substantive **`@dbt-tools/web`** UI or E2E spec changes.

## Other projects

If the project uses a different command, run the equivalent E2E script from the repo root and use the same fixer loop: run E2E → read failures → fix → re-run.
