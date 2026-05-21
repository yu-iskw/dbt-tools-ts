# Debug a failed run

## When to use this

Use this recipe when a dbt run finished with errors and you need failed nodes, messages, and dependency context quickly.

## Inputs required

- `manifest.json`
- `run_results.json` (required for execution status and timing; use [Check run health](../workflows/check-run-health.md) if missing)

Optional: [demo artifacts](../guide/demo-artifacts.md) for a walkthrough without your own project.

## Recommended interface

| Interface | Use when |
| --------- | -------- |
| CLI | CI gates, shell triage, JSON for scripts |
| Web | Visual lineage and execution after you have a `unique_id` |
| MCP | A coding agent will run many follow-up queries on the same run |

## Step 1: Check artifact health

```bash
export DEMO=./docs/site/public/demo   # or ./target
npx @dbt-tools/cli status --dbt-target "$DEMO" --json
```

Expect `readiness: "full"` when both required files are present. If you only have `manifest.json`, readiness is `manifest-only` and execution commands are limited.

## Step 2: Find the failing resource

Search by partial name or filter by status:

```bash
npx @dbt-tools/cli discover --dbt-target "$DEMO" "fct_orders" --json
npx @dbt-tools/cli query-executions --dbt-target "$DEMO" \
  --status error,fail,skipped --limit 20 --json
```

Copy the `unique_id` from the top match or execution row.

## Step 3: Explain the failure

```bash
npx @dbt-tools/cli explain model.jaffle_shop.orders --dbt-target "$DEMO" --json
```

Replace with your `unique_id` from step 2.

## Step 4: Check downstream impact

```bash
npx @dbt-tools/cli deps model.jaffle_shop.orders \
  --dbt-target "$DEMO" --direction downstream --json
```

## Open the same resource in Web

```bash
npx @dbt-tools/web --dbt-target "$DEMO"
```

Use discovery and execution views for the same `unique_id`. See [Investigation tour](../guide/web/investigation-tour.md).

## Ask a coding agent

Install [agent skills](../guide/agents/install.md) or connect [MCP](../guide/mcp/getting-started.md). Prefer skills such as `dbt-tools-cli:describe-resource` and `dbt-tools-cli:trace-dependencies` for one-shot tasks; use MCP when the agent needs many tool calls on one run.

## Common failure modes

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| Missing manifest | Wrong `--dbt-target` | Point at the dbt `target/` directory that contains `manifest.json` |
| Empty or missing run results | dbt did not execute nodes yet | Run `dbt run`, `dbt test`, or the job that produces `run_results.json` |
| `UNSUPPORTED_VERSION` | Manifest schema older than v10 | Regenerate artifacts with dbt 1.10+ |
| Remote auth errors | Cloud credentials | [Local and remote artifacts](../concepts/local-and-remote-artifacts.md) |

## Related docs

- [Explain a failure](../workflows/explain-failure.md) (workflow alias)
- [Common CLI tasks](../guide/cli/common-tasks.md)
- [CLI cheatsheet](../reference/cli-cheatsheet.md)
- [Troubleshooting](../reference/troubleshooting.md)
