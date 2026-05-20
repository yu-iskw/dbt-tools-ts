# describe-resource — CLI implementation

| Primitive         | Current CLI                            | Notes                                           |
| ----------------- | -------------------------------------- | ----------------------------------------------- |
| describe-resource | `dbt-tools explain <unique_id> --json` | Optional `--trace` for investigation transcript |

## Recipes

```bash
dbt-tools explain model.my_project.orders --dbt-target ./target --json
```

Inspect fields with `dbt-tools schema explain` when unsure of output shape.

See [packages/cli/README.md](../../../../../packages/cli/README.md) (`explain`).
