# Playwright conventions (`@dbt-tools/web`)

Source of truth: [`packages/web/playwright.config.ts`](../../../../packages/web/playwright.config.ts).

## Server and base URL

- **`baseURL`:** `http://localhost:4173`
- **`webServer`:** `vite preview` on port `4173` only (see config). Always run `pnpm --filter @dbt-tools/web build` before preview starts—do not assume `dist/` is current. The GitHub **Test** workflow always builds before the sharded E2E jobs.
- Tests always hit the **preview** server. Do not assume HMR, dev-only env, or behaviors that differ between `pnpm dev` and `vite preview` unless you explicitly verify both.

## Projects and reporting

- **Browser project:** Chromium (`Desktop Chrome`) only.
- **Parallelism:** `fullyParallel: true`. **`workers`:** Playwright’s default locally; in CI, **2** workers to avoid overloading the single `vite preview` process (raise only after profiling).
- **Retries:** `1` in CI, `0` locally — balances flake tolerance vs wall time on failures.
- **Reporters:** `github` + `line` when `CI` is set; `html` locally.
- **CI:** `.github/workflows/test.yml` runs E2E in **two shards** (`--shard=1/2`, `--shard=2/2`), each with its own `webServer`, plus a **Playwright browser cache** on `~/.cache/ms-playwright`.
- **Traces:** `trace: "on-first-retry"` — useful when debugging flakes in CI.

## Selector priority

1. **`getByRole`** with accessible name (buttons, headings, regions).
2. **`getByLabel`** when the control has an associated label (e.g. file inputs labeled in the UI).
3. **`data-testid`** — reserved for future use if the team adds explicit test hooks; prefer roles/labels first.
4. **Stable `id`** — use when the component documents it for integration (e.g. `#manifest-input`, `#run-results-input` in `FileUpload.tsx`).

Avoid long CSS selectors tied to layout or third-party class names.

## Waits and timeouts

- Prefer **`expect(locator).toBeVisible()`** and other `expect` auto-waiting assertions over fixed sleeps.
- Use explicit **`timeout`** on `expect` when the app performs heavy work (e.g. large artifact parse, virtualized tables, canvas). Keep **`loadWorkspace`**’s Overview button wait at **30s**; it also asserts the **Overview** header within **10s** after navigation.
- Avoid `page.waitForTimeout` except as a last resort; if used, comment why a condition-based wait is impossible.

## Preload and explorer helpers

- [`e2e/helpers/preload.ts`](../../../../packages/web/e2e/helpers/preload.ts) registers `/api/*` mocks with **`page.route`** (Vite preview + Playwright). **`mockPreloadContext`** applies the same handlers to each **existing** `Page` on a `BrowserContext`; new pages still need **`mockPreload(page)`** before navigating to the app.
- Catalog **explorer filters** (search box, execution status pills) start **collapsed** — expand the **Explorer filters** region first when a spec targets those controls.

## Anti-patterns

- Relying on **dev-server-only** behavior while CI uses preview.
- Assertions on **implementation details** (internal state, minified class strings) instead of user-visible outcomes.
- **Unskipping** tests without resolving preview/bundle errors noted in the spec (e.g. dynamic import / `require` issues).

## Local debugging

From repo root:

```bash
pnpm --filter @dbt-tools/web exec playwright test --ui
```

(Adjust flags as needed; ensure the same `playwright.config.ts` applies.)
