# Investigation tour

`dbt-tools-web` is a **browser UI** for exploring dbt artifacts—no LLM required. It reads `manifest.json` and `run_results.json` from a local `target/` directory or preloads **`s3://`** / **`gs://`** roots when you pass **`--dbt-target`** at startup (same flags as MCP for GCS impersonation and S3 client settings).

## Start the UI

```bash
npx @dbt-tools/web --dbt-target ./target
# or local alias:
npx @dbt-tools/web --target ./target
```

Open the URL printed in the terminal (default `http://127.0.0.1:3000`). Vite **dev** (`pnpm dev:web`) uses **5173**. See [Web server CLI](../../reference/web-cli.md) for remote and impersonation examples.

## What to explore

Sidebar (top to bottom), plus **Settings** in the footer:

| Area                  | What you get                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Health**            | Run readiness, failing nodes, and bottleneck pressure before opening a single asset                           |
| **Timeline**          | Gantt-style execution order, critical path, and sequencing from `run_results.json`                            |
| **Inventory**         | Ranked resource search (same contract as CLI `discover`) plus asset tabs: **Summary / Lineage / Tests / SQL** |
| **Runs**              | Filterable execution table (status, kind, warehouse adapter columns)                                          |
| **Settings** (footer) | Appearance, session, and default lenses for Timeline and Inventory                                            |

Header **search** jumps to Inventory on a selected asset (**Summary** tab).

## Typical flow

1. Confirm artifacts with [Check run health](../../workflows/check-run-health.md).
2. Start the web server. Find a model in **Inventory** or header search.
3. Open the asset and switch tabs: Summary, Lineage, Tests, SQL.
4. Use **Timeline** for sequencing and **Runs** for a sortable execution list.
5. Use CLI `query-executions` when you need a scriptable top-N list from the same run.

## Learn more

- [Getting started](./getting-started.md)
- [Investigate slow runs](../../workflows/investigate-slow-runs.md)
- [Troubleshooting](../../reference/troubleshooting.md)
- [Web README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/web/README.md)
