# trace-dependencies — CLI implementation

| Primitive          | Current CLI                         | Notes                                                   |
| ------------------ | ----------------------------------- | ------------------------------------------------------- |
| trace-dependencies | `dbt-tools deps <unique_id> --json` | `--direction upstream\|downstream` (default downstream) |

## Recipes

```bash
# Downstream (impact surface)
dbt-tools deps model.my_project.orders --dbt-target ./target --direction downstream --json

# Upstream build order
dbt-tools deps model.my_project.orders --dbt-target ./target \
  --direction upstream --build-order --json

# Bounded graph
dbt-tools deps model.my_project.orders --dbt-target ./target --depth 2 \
  --fields "unique_id,name" --json
```

| Option          | Purpose                    |
| --------------- | -------------------------- |
| `--depth`       | Limit hops                 |
| `--format flat` | List instead of tree       |
| `--build-order` | Topological upstream order |
| `--fields`      | Shrink payload             |

See [packages/cli/README.md](../../../../../packages/cli/README.md) (`deps`).
