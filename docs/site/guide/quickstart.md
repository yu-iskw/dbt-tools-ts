# 5-minute quickstart

Use dbt-tools to inspect dbt artifacts from the command line, a browser, or a coding agent—no warehouse connection required.

## Prerequisites

- Node.js 20+
- `manifest.json` and `run_results.json` from a dbt run, located under a local `target/` directory

> **New to dbt?** See [New to dbt?](./foundations/new-to-dbt.md) and [dbt artifacts](../concepts/dbt-artifacts.md).

> **No dbt project yet?** See [Try with a sample project](./try-with-sample-project.md) to generate artifacts with [jaffle_shop_duckdb](https://github.com/dbt-labs/jaffle_shop_duckdb), then run every example on this page against `./target`.

## Step 1: Check artifact health

```bash
npx @dbt-tools/cli status --dbt-target ./target --json
```

Expected output shape:

```json
{
  "target_dir": "./target",
  "manifest": {
    "path": "./target/manifest.json",
    "exists": true,
    "modified_at": "2024-01-15T10:00:00Z",
    "age_seconds": 3600
  },
  "run_results": {
    "path": "./target/run_results.json",
    "exists": true,
    "modified_at": "2024-01-15T10:01:00Z",
    "age_seconds": 3540
  },
  "readiness": "full",
  "summary": "Required artifacts present. Manifest and execution analysis available; catalog.json and sources.json remain optional enrichments."
}
```

`readiness: "full"` means both `manifest.json` and `run_results.json` are present and readable. `readiness: "manifest-only"` means `run_results.json` is missing. `readiness: "unavailable"` means `manifest.json` was not found at that path.

## Step 2: Find a model

```bash
npx @dbt-tools/cli discover --dbt-target ./target "orders" --limit 5 --json
```

The output includes `unique_id` values such as `model.my_project.orders`. Use these in subsequent commands.

## Step 3: Explain a model or failure

```bash
npx @dbt-tools/cli explain model.my_project.orders --dbt-target ./target --json
```

Replace `model.my_project.orders` with a `unique_id` from the discover output (for example `model.jaffle_shop.orders` after [jaffle_shop_duckdb](https://github.com/dbt-labs/jaffle_shop_duckdb) `dbt build`). The explain command returns resource metadata, description, column information, and test associations.

## Step 4: Inspect dependencies

```bash
npx @dbt-tools/cli deps model.my_project.orders --dbt-target ./target --direction downstream --json
```

Use `--direction upstream` to trace sources, `--direction downstream` to find the blast radius.

## Step 5 (optional): Open the Web UI

```bash
npx @dbt-tools/web --dbt-target ./target
```

Open `http://localhost:3000` in a browser to explore lineage, run results, and execution timings visually.

## Step 6 (optional): Use MCP for agent sessions

```bash
npx @dbt-tools/mcp --dbt-target ./target
```

Point your coding agent at this MCP server. The server parses the artifacts once and handles many tool calls without re-reading files. See [Connecting clients](./mcp/connecting-clients.md) for client configuration.

## Next steps

- [Choose by goal](./choose-by-goal.md) — route to the right interface for your job
- [Debug a failed run](../recipes/debug-failed-run.md) — identify failed nodes and next actions
- [Investigate slow models](../recipes/investigate-slow-models.md) — rank execution bottlenecks
- [S3 artifacts](../deploy/s3.md) — read artifacts from remote object storage
- [Ask an agent about a dbt run](../recipes/ask-agent-about-dbt-run.md) — MCP and agent skills
