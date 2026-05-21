# 5-minute quickstart

Use dbt-tools to inspect dbt artifacts from the command line, a browser, or an AI agent—no warehouse connection required.

## Prerequisites

- Node.js 20+
- `manifest.json` and `run_results.json` from a dbt run, located under a local `target/` directory

> **No dbt project yet?** See [Demo artifacts](./demo-artifacts.md) to get synthetic fixtures you can use with every example on this page.

## Step 1: Check artifact health

```bash
npx @dbt-tools/cli status --dbt-target ./target --json
```

Expected output shape:

```json
{
  "status": "full",
  "artifacts": {
    "manifest": { "schema_version": "v11", "generated_at": "2024-01-15T12:00:00Z" },
    "run_results": { "schema_version": "v5", "generated_at": "2024-01-15T12:05:00Z" }
  }
}
```

A `"status": "full"` means both `manifest.json` and `run_results.json` are present and readable. `"manifest-only"` means `run_results.json` is missing. `"unavailable"` means neither file was found at that path.

## Step 2: Find a model

```bash
npx @dbt-tools/cli discover --dbt-target ./target "orders" --limit 5 --json
```

The output includes `unique_id` values such as `model.my_project.orders`. Use these in subsequent commands.

## Step 3: Explain a model or failure

```bash
npx @dbt-tools/cli explain model.my_project.orders --dbt-target ./target --json
```

Replace `model.my_project.orders` with a `unique_id` from the discover output. The explain command returns resource metadata, description, column information, and test associations.

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

Point your AI client at this MCP server. The server parses the artifacts once and handles many tool calls without re-reading files. See [Connecting clients](./mcp/connecting-clients.md) for client configuration.

## Next steps

- [Choose by goal](./choose-by-goal.md) — route to the right interface for your job
- [Debug a failed run](../recipes/debug-failed-run.md) — identify failed nodes and next actions
- [Investigate slow models](../recipes/investigate-slow-models.md) — rank execution bottlenecks
- [S3 artifacts](../deploy/s3.md) — read artifacts from remote object storage
- [Ask an agent about a dbt run](../recipes/ask-agent-about-dbt-run.md) — MCP and agent skills
