# Find model impact

## When to use this

Use this recipe before changing a dbt model to understand which downstream models and tests depend on it. This helps you assess the blast radius of a change before it reaches CI or production.

## Inputs required

- `manifest.json` (run results not required for lineage analysis)
- Optional: `run_results.json` (adds execution status to downstream nodes)

## Recommended interface

| Interface | Use when |
|---|---|
| CLI | You need dependency lists as JSON for scripting or pre-change review |
| Web | You want to visually explore the lineage graph around a model |
| MCP | An AI agent needs to reason about impact scope and suggest test coverage |

## Step 1: Find the model by name

If you only have a partial name:

```bash
npx @dbt-tools/cli discover --dbt-target ./target "orders" --limit 5 --json
```

Note the `unique_id` from the output. It will look like `model.my_project.orders`.

## Step 2: Inspect downstream dependencies

```bash
npx @dbt-tools/cli deps model.my_project.orders --dbt-target ./target --direction downstream --json
```

The output lists all models, tests, snapshots, and exposures that depend—directly or transitively—on the target model.

## Step 3: Inspect upstream dependencies

```bash
npx @dbt-tools/cli deps model.my_project.orders --dbt-target ./target --direction upstream --json
```

Upstream dependencies show what the model reads. If you are changing a source, this helps you find all models that consume it.

## Step 4: Explain the model

```bash
npx @dbt-tools/cli explain model.my_project.orders --dbt-target ./target --json
```

The explain output includes column definitions, tests associated with the model, and configuration metadata. Check whether there are downstream exposures or BI tools connected to this model.

## Step 5 (optional): Open in Web for visual lineage

```bash
npx @dbt-tools/web --dbt-target ./target
```

The Web UI shows the lineage graph visually. Search for the model by name and click to expand its upstream and downstream nodes. This is especially useful for models with many indirect dependents.

## Reading the output

| Field in deps output | What it means |
|---|---|
| Direct downstream nodes | Models or tests that directly reference this model |
| Transitive downstream nodes | Models that depend on direct dependents |
| Exposures | BI reports, dashboards, or other downstream consumers declared in `exposure` blocks |
| Tests | Tests that run against this model or its columns |

## Common questions

**"What breaks if I rename this model?"**
Run `deps --direction downstream` and count the transitive dependents. Any model in the list will break if the source is renamed without also updating the `ref()` call.

**"Is this model used by anyone?"**
If `deps --direction downstream` returns an empty list, the model has no declared dependents in the project. It may still be referenced by other tools or by external consumers not captured in the manifest.

**"What sources does this model read?"**
Run `deps --direction upstream`. Source nodes appear with `unique_id` values like `source.my_project.raw.orders`.

## Related

- [Debug a failed run](./debug-failed-run.md) — combine impact analysis with failure context
- [Open CLI result in Web](./open-cli-result-in-web.md) — move from JSON to browser for visual lineage
- [CLI cheatsheet](../reference/cli-cheatsheet.md)
- [Deep links](../reference/deep-links.md) — link from CLI JSON to specific Web views
