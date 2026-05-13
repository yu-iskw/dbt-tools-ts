# Fixtures and paths for E2E

Specs live under `packages/web/e2e/`. Resolve paths from the spec file with `import.meta.url` and `path.resolve` so they work in ESM.

## Canonical dbt artifact JSON

The web E2E suite keeps stable, reviewable fixtures under `packages/web/e2e/fixtures/`.

| Role           | Path (from repo root)                                           |
| -------------- | --------------------------------------------------------------- |
| Manifest v12   | `packages/web/e2e/fixtures/dbt-artifacts/manifest_1.11.json`    |
| Run results v6 | `packages/web/e2e/fixtures/dbt-artifacts/run_results_1.11.json` |
| Catalog v1     | `packages/web/e2e/fixtures/dbt-artifacts/catalog_1.11.json`     |

Use existing helpers such as [`e2e/helpers/preload.ts`](../../../../packages/web/e2e/helpers/preload.ts) when a spec needs the canonical artifact set.

## Local E2E fixtures

| File                                     | Purpose                                          |
| ---------------------------------------- | ------------------------------------------------ |
| `packages/web/e2e/fixtures/invalid.json` | Invalid JSON for error-path tests.               |
| `packages/web/e2e/fixtures/sources.json` | Source artifact fixture used by preload helpers. |

Add new files under `packages/web/e2e/fixtures/` when a scenario needs small, controlled inputs. Keep fixtures small and avoid reaching back into the external parser repository at test runtime.

## Labels and file inputs

The analyze flow uses labeled file inputs; stable `id` values are defined in `FileUpload.tsx` (for example `manifest-input`, `run-results-input`). Prefer matching visible labels and roles in tests when they stay in sync with the component.
