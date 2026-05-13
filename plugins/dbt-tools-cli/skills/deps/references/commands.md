# deps — command reference

## Quick recipes

```bash
# Downstream dependencies (default)
dbt-tools deps model.my_project.orders --dbt-target ./target --json

# Upstream dependencies
dbt-tools deps model.my_project.orders --dbt-target ./target --direction upstream --json

# Immediate neighbors only (depth 1)
dbt-tools deps model.my_project.orders --dbt-target ./target --depth 1 --json

# Flat list instead of tree
dbt-tools deps model.my_project.orders --dbt-target ./target --format flat --json

# Upstream deps in topological build order
dbt-tools deps model.my_project.orders --dbt-target ./target \
  --direction upstream --build-order --json

# Field-filtered (reduce output size)
dbt-tools deps model.my_project.orders --dbt-target ./target \
  --fields "unique_id,name" --json

# Check runtime option schema
dbt-tools schema deps
```

## Key options summary

| Option          | Values                    | Default      | Notes                                           |
| --------------- | ------------------------- | ------------ | ----------------------------------------------- |
| `--direction`   | `upstream` / `downstream` | `downstream` | Which direction to traverse                     |
| `--depth`       | integer                   | unlimited    | Max traversal hops; `1` = immediate neighbors   |
| `--format`      | `tree` / `flat`           | `tree`       | Output structure                                |
| `--build-order` | flag                      | off          | Topological order; only meaningful for upstream |
| `--fields`      | comma-separated names     | all          | Shrinks payload; e.g. `unique_id,name`          |

## JSON output shape (tree, excerpt)

```json
{
  "unique_id": "model.my_project.orders",
  "name": "orders",
  "resource_type": "model",
  "dependencies": [
    {
      "unique_id": "model.my_project.stg_orders",
      "name": "stg_orders",
      "resource_type": "model",
      "dependencies": []
    }
  ]
}
```

## JSON output shape (flat)

```json
{
  "unique_id": "model.my_project.orders",
  "dependencies": [
    { "unique_id": "model.my_project.stg_orders", "name": "stg_orders" },
    { "unique_id": "source.my_project.raw_orders", "name": "raw_orders" }
  ]
}
```

## Decision guidance

| Goal                                | Flags to use                                            |
| ----------------------------------- | ------------------------------------------------------- |
| Full transitive lineage (tree view) | (defaults)                                              |
| Just immediate parents / children   | `--depth 1`                                             |
| Count all transitive deps           | `--format flat --fields "unique_id"` then count entries |
| Run-order for upstream deps         | `--direction upstream --build-order`                    |
| Keep context window small           | `--depth 2 --fields "unique_id,name"`                   |

## Failure responses

| Symptom                                      | Likely cause                    | Response                                                                   |
| -------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------- |
| `VALIDATION_ERROR`: invalid resource ID      | Bad characters or format in ID  | Re-run `discover` to get a clean `unique_id`.                              |
| `VALIDATION_ERROR`: resource not in manifest | ID valid but not found in graph | Check `--dbt-target` path; the resource may be in a different project.     |
| `ARTIFACT_BUNDLE_INCOMPLETE` on stderr       | `manifest.json` missing         | Run `dbt-tools status --json` to confirm; tell user to generate artifacts. |
| Very large JSON output                       | Wide or deep dependency graph   | Add `--depth 2` and `--fields "unique_id,name"` to bound it.               |
