# query-executions — CLI implementation

| Primitive        | Current CLI                  | Notes                                                |
| ---------------- | ---------------------------- | ---------------------------------------------------- |
| query-executions | `dbt-tools query-executions` | Warehouse subcommands: `bigquery`, `snowflake`, etc. |

## Recipes

```bash
# Failures / non-success
dbt-tools query-executions --dbt-target ./target --status error,fail,skipped --json

# Slowest nodes
dbt-tools query-executions --dbt-target ./target --sort execution_time_desc --limit 10 --json

# Per-resource pattern
dbt-tools query-executions --dbt-target ./target \
  --unique-id-pattern "*orders*" --json
```

Read `warehouse_type` from `dbt-tools status --json` when using adapter metric sorts.

See [packages/cli/README.md](../../../../../packages/cli/README.md) (`query-executions`).
