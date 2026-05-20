# find-resources — CLI implementation

| Primitive                 | Current CLI                 | Notes                                   |
| ------------------------- | --------------------------- | --------------------------------------- |
| find-resources            | Prefer `dbt-tools discover` | Ranked `score`, `confidence`, `reasons` |
| find-resources (fallback) | `dbt-tools search`          | Simpler; supports `--offset`            |

## Recipes

```bash
dbt-tools discover --dbt-target ./target "orders" --json --limit 10
dbt-tools discover --dbt-target ./target --type model --json
dbt-tools search --dbt-target ./target "orders" --limit 10 --offset 0 --json
```

## Extracting unique_id

- **discover:** `matches[].unique_id`
- **search:** `results[].unique_id`

Inline query tokens: `type:model`, `tag:finance`, `package:core` (flag filters take precedence).

See [packages/cli/README.md](../../../../../packages/cli/README.md) (`discover`, `search`).
