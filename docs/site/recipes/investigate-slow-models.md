# Investigate slow models

## When to use this

Use this recipe when you need to find which models or tests consumed the most time in a completed dbt run.

## Inputs required

- `manifest.json`
- `run_results.json`

## Recommended interface

| Interface | Use when |
| --------- | -------- |
| Web | Primary surface—timelines, execution views, bottlenecks |
| CLI | Scripted top-N lists and JSON export |
| MCP | Skip unless an agent runs many execution queries |

## Step 1: Confirm artifacts

```bash
export DEMO=./docs/site/public/demo   # or ./target
npx @dbt-tools/cli status --dbt-target "$DEMO" --json
```

## Step 2: Rank slow executions (CLI)

```bash
npx @dbt-tools/cli query-executions --dbt-target "$DEMO" \
  --sort execution_time_desc --limit 20 --json
```

Filter to failures only when triaging errors:

```bash
npx @dbt-tools/cli query-executions --dbt-target "$DEMO" \
  --status error,fail --sort execution_time_desc --limit 20 --json
```

For warehouse-specific metrics (slots, bytes), use adapter subcommands—see the [CLI README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md#query-executions).

## Step 3: Explore in the Web UI

```bash
npx @dbt-tools/web --dbt-target "$DEMO"
```

Open execution and timeline views for interactive drill-down. See [Investigation tour](../guide/web/investigation-tour.md).

## Interpretation notes

| Situation | What to expect |
| --------- | -------------- |
| Partial run | Only executed nodes appear in `run_results.json` |
| Retries | Timing may reflect final attempt; compare invocation metadata |
| Failed node with short duration | Failure may be fast; read error message in `explain` |
| Tests vs models | Both appear as executions; check `resource_type` |
| Ephemeral models | May not have table materialization rows; still can appear in timing |

## Common failure modes

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| `sort duration requires a warehouse criteria block` | Wrong sort flag | Use `--sort execution_time_desc` or an adapter subcommand |
| No executions | Empty run results | Re-run dbt with the models you need |

## Related docs

- [Investigate slow runs](../workflows/investigate-slow-runs.md) (workflow alias)
- [Web getting started](../guide/web/getting-started.md)
- [CLI cheatsheet](../reference/cli-cheatsheet.md)
