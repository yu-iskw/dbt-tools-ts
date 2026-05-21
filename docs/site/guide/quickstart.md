# 5-minute quickstart

Try dbt-tools in a few minutes using **synthetic** [jaffle_shop](https://github.com/dbt-labs/jaffle-shop) artifacts checked into this repository. No warehouse or dbt project is required.

## Prerequisites

- Node.js 20+ (see the repository [`.node-version`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.node-version))
- npm, pnpm, or another Node package runner

## Option A: Use your own dbt `target/` directory

If you already ran dbt and have `manifest.json` and `run_results.json` under `target/`:

```bash
npx @dbt-tools/cli status --dbt-target ./target --json
```

## Option B: Use the demo artifacts

From a clone of [dbt-tools-ts](https://github.com/yu-iskw/dbt-tools-ts), point at the bundled demo directory:

```bash
export DEMO=./docs/site/public/demo
npx @dbt-tools/cli status --dbt-target "$DEMO" --json
```

Or copy the demo folder anywhere on disk:

```bash
cp -r ./docs/site/public/demo ./dbt-tools-demo-target
npx @dbt-tools/cli status --dbt-target ./dbt-tools-demo-target --json
```

See [Demo artifacts](./demo-artifacts.md) for provenance and licensing of the sample files.

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
