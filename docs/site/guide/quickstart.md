# 5-minute quickstart

Try dbt-tools in a few minutes using **synthetic** [jaffle_shop](https://github.com/dbt-labs/jaffle-shop) artifacts checked into this repository. No warehouse or dbt project is required.

## Prerequisites

- Node.js 20+ (see the repository [`.node-version`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.node-version) for local development; published packages support Node 20+)
- npm, pnpm, or another Node package runner

## Set your artifact root

Pick **one** target directory for the commands below.

**Option A — your dbt project:**

```bash
export DEMO=./target
```

Requires `manifest.json` and `run_results.json` under that directory.

**Option B — bundled demo artifacts** (from a clone of [dbt-tools-ts](https://github.com/yu-iskw/dbt-tools-ts)):

```bash
export DEMO=./docs/site/public/demo
```

Or copy the demo folder anywhere:

```bash
cp -r ./docs/site/public/demo ./dbt-tools-demo-target
export DEMO=./dbt-tools-demo-target
```

See [Demo artifacts](./demo-artifacts.md) for provenance. The demo `run_results.json` includes a **synthetic** failure on `model.jaffle_shop.orders` for triage examples.

## Check artifact health

```bash
npx @dbt-tools/cli status --dbt-target "$DEMO" --json
```

### Expected output shape (`status`)

```json
{
  "target_dir": "./docs/site/public/demo",
  "readiness": "full",
  "manifest": { "exists": true },
  "run_results": { "exists": true }
}
```

Field names and paths vary with your `--dbt-target`; `readiness: "full"` means both required artifacts are present.

## Find a model

```bash
npx @dbt-tools/cli discover --dbt-target "$DEMO" "orders" --limit 5 --json
```

The top match includes `unique_id` (for example `model.jaffle_shop.orders`) and suggested next commands.

## Explain a model

```bash
npx @dbt-tools/cli explain model.jaffle_shop.orders --dbt-target "$DEMO" --json
```

Replace the `unique_id` with one from your `discover` output.

## Open the Web UI

```bash
npx @dbt-tools/web --dbt-target "$DEMO"
```

Open the URL printed in the terminal for lineage, execution, and discovery views.

## Use MCP for agent workflows

```bash
npx @dbt-tools/mcp --dbt-target "$DEMO"
```

Wire this server in your MCP client when a coding agent needs many queries over the same parsed run. See [MCP getting started](./mcp/getting-started.md).

## Next steps

- [Choose by goal](./choose-by-goal.md) — pick CLI, Web, MCP, or agent skills
- [Debug a failed run](../recipes/debug-failed-run.md)
- [Investigate slow models](../recipes/investigate-slow-models.md)
- [Find model impact](../recipes/find-model-impact.md)
- [Local and remote artifacts](../concepts/local-and-remote-artifacts.md) — S3, GCS, and CI paths (Deploy docs coming soon)
