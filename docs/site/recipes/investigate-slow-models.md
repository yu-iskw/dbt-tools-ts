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

Timing data is present when `run_results.json` reflects a `dbt run`, `dbt test`, or `dbt build` invocation (not a dry run or compile-only command).

## Step 2: Get a run summary

```bash
npx @dbt-tools/cli summary --dbt-target ./target --json
```

The summary includes aggregate timing and node counts. Look for unusually high total execution time.

## Step 3: Find a specific slow model by name

```bash
npx @dbt-tools/cli discover --dbt-target ./target "heavy_model_name" --limit 5 --json
```

If you already know the `unique_id`, skip to Step 4.

## Step 4: Inspect the model's execution details

```bash
npx @dbt-tools/cli explain model.my_project.heavy_model --dbt-target ./target --json
```

Check the `execution_time` field in the output. Also check `config.materialized` — full table materializations are often slower than incremental ones.

## Step 5: Trace upstream dependencies

```bash
npx @dbt-tools/cli deps model.my_project.heavy_model --dbt-target ./target --direction upstream --json
```

A long upstream chain can indicate that the real bottleneck is earlier in the DAG. Check execution times of upstream nodes as well.

## Step 6 (optional): Open the Web UI for visual investigation

```bash
npx @dbt-tools/web --dbt-target ./target
```

The Web UI provides an execution timeline view. Open it and look for the longest bars in the run timeline. Hover over nodes to inspect timing details.

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
