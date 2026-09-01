# Debug a failed run

## When to use this

Use this recipe when a dbt run, test, or build has produced failures and you want to identify which nodes failed, understand the error context, and determine next steps.

## Inputs required

- `manifest.json`
- `run_results.json` (must reflect the failed run)
- Optional: `catalog.json` (for column-level context in the Web UI)

## Recommended interface

| Interface | Use when                                                                       |
| --------- | ------------------------------------------------------------------------------ |
| CLI       | You need automation, scripting, or JSON output for downstream tools            |
| Web       | You need visual lineage and execution context around the failure               |
| MCP       | A coding agent needs to ask several follow-up questions about the same failure |

## Step 1: Confirm artifacts are readable

```bash
npx @dbt-tools/cli status --dbt-target ./target --json
```

`readiness: "full"` confirms both manifest and run results are present. If `run_results.json` is missing, `readiness` will be `"manifest-only"` and you will not have failure information.

## Step 2: Get a run-level summary

```bash
npx @dbt-tools/cli run-summary --dbt-target ./target --json
```

`run-summary` returns run-level aggregates, status breakdown, and bottlenecks. Use it to confirm the run produced failures before listing individual nodes.

`summary` is **manifest graph** statistics only (`total_nodes`, `nodes_by_type`, `total_edges`, `has_cycles`). It does not include pass/fail counts.

## Step 3: List failed nodes

```bash
npx @dbt-tools/cli failures --dbt-target ./target --json
```

Or filter executions by status:

```bash
npx @dbt-tools/cli query-executions --dbt-target ./target --status error,fail --json
```

Note a `unique_id` from the output (for example `model.my_project.orders` or `test.my_project.not_null_orders_id`).

## Step 4: Find the failed resource by name

If you know a model or test name but not the full `unique_id`:

```bash
npx @dbt-tools/cli discover --dbt-target ./target "orders" --limit 5 --json
```

## Step 5: Explain the failed node

```bash
npx @dbt-tools/cli explain model.my_project.orders --dbt-target ./target --json
```

The explain output includes the resource definition, description, configuration, and the error message from the failed run if `run_results.json` is present.

## Step 6: Inspect the blast radius

```bash
npx @dbt-tools/cli impact model.my_project.orders --dbt-target ./target --json
npx @dbt-tools/cli deps model.my_project.orders --dbt-target ./target --direction downstream --json
```

`impact` returns upstream/downstream counts and notable dependents (and a lineage `web_url` when `DBT_TOOLS_WEB_BASE_URL` is set). `deps` lists the full downstream graph. Use `--direction upstream` on `deps` to trace the source of the failure.

## Step 7 (optional): Open in Web for visual context

If your CLI output includes a `web_url` field, open that URL directly:

```bash
npx @dbt-tools/cli explain model.my_project.orders --dbt-target ./target --json \
  | jq -r '.web_url'
```

Or start the Web UI and navigate manually:

```bash
npx @dbt-tools/web --dbt-target ./target
```

See [Open CLI result in Web](./open-cli-result-in-web.md) for deep-link setup.

## Common failure modes

| Readiness                  | Likely cause                                          | Fix                                                                              |
| -------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| `manifest-only`            | `run_results.json` not found                          | Point `--dbt-target` at the directory containing the artifacts, or run dbt first |
| `unavailable`              | Wrong `--dbt-target` path                             | Confirm the directory contains `manifest.json`                                   |
| `explain` returns no error | Run did not fail for this node                        | Use `failures` to see which nodes actually failed                                |
| `unique_id` not found      | Model name is wrong or belongs to a different project | Use `discover` to search by name                                                 |
| Empty downstream deps      | Node has no dependents                                | The failure is a leaf; no blast radius                                           |

## Related

- [Investigate slow models](./investigate-slow-models.md) — timing-focused investigation
- [Find model impact](./find-model-impact.md) — understand dependency scope before a change
- [Open CLI result in Web](./open-cli-result-in-web.md) — move from JSON to browser
- [CLI cheatsheet](../reference/cli-cheatsheet.md)
- [Troubleshooting](../reference/troubleshooting.md)
