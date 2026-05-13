# discover and search — command reference

## Quick recipes

```bash
# Ranked discovery by name
dbt-tools discover --dbt-target ./target "orders" --json

# Discovery with type filter
dbt-tools discover --dbt-target ./target "type:model finance" --json

# Discovery: filter-only (empty query, flags required)
dbt-tools discover --dbt-target ./target --type model --json

# Discovery with paging (discover supports --limit only; --offset is not available)
dbt-tools discover --dbt-target ./target "orders" --json --limit 10

# Simple search
dbt-tools search --dbt-target ./target "orders" --json

# Search with flag-based filters
dbt-tools search --dbt-target ./target --type model --tag finance --json

# Search with paging
dbt-tools search --dbt-target ./target "orders" --limit 10 --offset 0 --json

# Check runtime schema when unsure of options
dbt-tools schema discover
dbt-tools schema search
```

## `discover` JSON output shape

```json
{
  "query": "orders",
  "total": 2,
  "matches": [
    {
      "unique_id": "model.my_project.orders",
      "resource_type": "model",
      "name": "orders",
      "score": 0.95,
      "confidence": "high",
      "reasons": ["exact name match"],
      "next_actions": ["deps", "explain"],
      "primitive_commands": ["dbt-tools deps model.my_project.orders ..."]
    }
  ]
}
```

When `--limit` is set, the response includes `has_more` and `limit`. `--offset` is **not** supported by `discover`; use `search` when you need offset-based paging.

## `search` JSON output shape

```json
{
  "query": "orders",
  "total": 2,
  "results": [
    {
      "unique_id": "model.my_project.orders",
      "resource_type": "model",
      "name": "orders",
      "package_name": "my_project",
      "path": "models/marts/orders.sql"
    }
  ]
}
```

## Decision guidance

| Situation                                | Preferred command                                  |
| ---------------------------------------- | -------------------------------------------------- |
| Need `unique_id` for deps/explain/impact | `discover` — scores and `next_actions` help narrow |
| Filter-only browse (type, tag, package)  | Either; `search` is simpler                        |
| `run_results.json` not available         | Either — both work manifest-only                   |
| User gave approximate / misspelled name  | `discover` (fuzzy matching)                        |

## Inline token syntax

Supported in both `discover` and `search` query strings:

- `type:<value>` — resource type (e.g. `model`, `source`, `test`, `seed`)
- `tag:<value>` — tag name
- `package:<value>` — package name
- `source:<value>` / `owner:<value>` — matched as plain text terms

Flag-based filters take precedence over inline tokens.

## Failure responses

| Symptom                                 | Likely cause                   | Response                                                                   |
| --------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `ARTIFACT_BUNDLE_INCOMPLETE` on stderr  | `manifest.json` missing        | Run `dbt-tools status --json` to confirm; tell user to generate artifacts. |
| `VALIDATION_ERROR` on stderr            | Invalid characters in query    | Remove `?`, `#`, `%`, path traversal segments from the query.              |
| `total: 0`, no error                    | No resources match the query   | Broaden query; try `inventory` to browse all resources.                    |
| Multiple high-confidence matches        | Ambiguous resource name        | Surface candidates to user; check `disambiguation` array in `discover`.    |
| `command not found: dbt-tools discover` | CLI version may not include it | Fall back to `dbt-tools search`; verify with `dbt-tools schema`.           |
