# Investigate slow models

## When to use this

Use this recipe when a dbt run is taking longer than expected and you want to identify which models or tests are causing the slowdown.

## Inputs required

- `manifest.json`
- `run_results.json` (must reflect a completed run with timing data)

## Recommended interface

| Interface | Use when                                                                |
| --------- | ----------------------------------------------------------------------- |
| CLI       | You need timing data as JSON for scripts or CI reporting                |
| Web       | You want a visual execution timeline and can compare runs interactively |
| MCP       | A coding agent needs to correlate timing, lineage, and failure data     |

## Step 1: Confirm the run has timing data

```bash
npx @dbt-tools/cli status --dbt-target ./target --json
```

Timing data is present when `run_results.json` reflects a `dbt run`, `dbt test`, or `dbt build` invocation (not a dry run or compile-only command). `readiness` must be `"full"`.

## Step 2: Get a run-level summary

```bash
npx @dbt-tools/cli run-summary --dbt-target ./target --json
```

`run-summary` includes aggregate timing, status mix, and bottleneck hints. `summary` is manifest graph statistics only and does not include execution time.

## Step 3: Rank the slowest executions

```bash
npx @dbt-tools/cli query-executions --dbt-target ./target --sort execution_time_desc --limit 20 --json
```

Root `query-executions` sorts are `execution_time_desc`, `execution_time_asc`, and `unique_id`. Warehouse subcommands add adapter sorts (for example `query-executions bigquery --min-slot-ms …`). Full flags: [CLI README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md).

Optional per-node table:

```bash
npx @dbt-tools/cli timeline --dbt-target ./target --sort duration --top 20 --json
```

`--sort duration` applies to **`timeline`**, not `query-executions`.

## Step 4: Find a specific slow model by name

```bash
npx @dbt-tools/cli discover --dbt-target ./target "heavy_model_name" --limit 5 --json
```

If you already know the `unique_id`, skip this step.

## Step 5: Inspect materialization (manifest)

```bash
npx @dbt-tools/cli explain model.my_project.heavy_model --dbt-target ./target --json
```

`explain` is manifest-shaped. Look at `summary.materialization` (full table materializations are often slower than incremental ones). Execution time lives on `query-executions` / `timeline` rows, not on `explain`.

## Step 6: Trace upstream dependencies

```bash
npx @dbt-tools/cli deps model.my_project.heavy_model --dbt-target ./target --direction upstream --json
```

A long upstream chain can indicate that the real bottleneck is earlier in the DAG. Compare those unique IDs against the `query-executions` ranking.

## Step 7 (optional): Open the Web UI

```bash
npx @dbt-tools/web --dbt-target ./target
```

Open **Timeline** (`?view=timeline`) for Gantt sequencing and **Runs** (`?view=runs`) for a sortable execution table. See [Investigate slow runs](../workflows/investigate-slow-runs.md).

## Interpreting results

| Observation                               | What it means                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| One model dominates total time            | Direct optimization candidate                                                              |
| Many models with similar duration         | Parallelism may help; check `threads` in dbt profile                                       |
| Tests slower than models                  | Complex test expressions or large table scans                                              |
| Ephemeral models show zero execution time | Expected — they are inlined into queries, not run separately                               |
| Short duration on a failed node           | The node may have failed before completing; timing does not reflect full potential runtime |
| Partial run with some nodes skipped       | Only completed nodes have reliable timing; skipped nodes show zero                         |

## Edge cases

**Retry scenarios:** If a run was retried from a checkpoint, `run_results.json` may only contain nodes from the retry, not the full DAG. Compare to prior `run_results.json` if available.

**Incremental models:** Execution time for incremental models reflects only the incremental load, not a full refresh. Compare to a historical full-refresh run if available.

**Tests on large tables:** dbt test timing is dominated by warehouse scan cost. Reducing row counts in test selection or using `store_failures` can help.

## Related

- [Debug a failed run](./debug-failed-run.md) — combine timing with failure context
- [Find model impact](./find-model-impact.md) — understand what depends on a slow model
- [Investigation tour](../guide/web/investigation-tour.md) — Web UI walkthrough
- [CLI cheatsheet](../reference/cli-cheatsheet.md)
