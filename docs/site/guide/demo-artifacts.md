# Demo artifacts

The docs site ships **synthetic** dbt artifacts so you can run CLI, Web, and MCP examples without a warehouse.

## Location

| Context            | Path                                                                        |
| ------------------ | --------------------------------------------------------------------------- |
| In this repository | `docs/site/public/demo/`                                                    |
| After site build   | Served as static files under `/demo/` (not a substitute for `--dbt-target`) |

For commands, always pass a **directory** that contains `manifest.json` and `run_results.json`, for example:

```bash
npx @dbt-tools/cli status --dbt-target ./docs/site/public/demo --json
```

## Contents

| File               | Description                                                                   |
| ------------------ | ----------------------------------------------------------------------------- |
| `manifest.json`    | jaffle_shop manifest (manifest schema v10+; synthetic project metadata)       |
| `run_results.json` | Run results fixture with a **doc-only** `error` on `model.jaffle_shop.orders` |

`catalog.json` is optional and not bundled in the demo set.

The bundled `run_results.json` is mostly a successful jaffle_shop run. One execution row is intentionally set to `error` so [Debug a failed run](../recipes/debug-failed-run.md) works end-to-end. Use your own `target/` for real failure messages.

## Regenerate fixtures

From the repository root:

```bash
node scripts/docs/sync-demo-artifacts.mjs
```

This copies v10 manifest and v6-shaped run results from `packages/test-fixtures/`, then applies the synthetic failure on `model.jaffle_shop.orders`.

## Provenance

Files are derived from repository test fixtures (`packages/test-fixtures/dbt-artifacts-parser/resources/`) and contain **no real customer data**. Project names, schemas, and adapter fields are illustrative only.

Do not paste production manifests, credentials, or `DBT_ENV_CUSTOM_ENV_*` secrets into public examples. See [dbt Artifacts](../concepts/dbt-artifacts.md).

## Licensing

The `@dbt-tools/*` packages are source-available; demo fixture content follows the same repository terms. See [LICENSES/README.md](https://github.com/yu-iskw/dbt-tools-ts/blob/main/LICENSES/README.md).

## Next

- [5-minute quickstart](./quickstart.md)
- [Recipes](../recipes/)
