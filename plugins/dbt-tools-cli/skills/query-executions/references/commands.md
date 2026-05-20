# query-executions commands

## Common (any warehouse)

```bash
# Triage — pass statuses explicitly
dbt-tools query-executions --dbt-target ./target \
  --status error,fail,skipped --limit 50 --json

# Slowest nodes
dbt-tools query-executions --dbt-target ./target \
  --sort execution_time_desc --limit 10 --resource-types model,test,unit_test --json
```

## Warehouse subcommands

| Subcommand                                | Typical sorts                                | Min filters                                    |
| ----------------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| `bigquery`                                | `slot_ms_desc`, `bytes_processed_desc`       | `--min-slot-ms`, `--min-bytes-processed`       |
| `snowflake`                               | `rows_inserted_desc`, `bytes_processed_desc` | `--min-rows-inserted`, `--min-bytes-processed` |
| `athena`, `postgres`, `redshift`, `spark` | `bytes_processed_desc`, `rows_affected_desc` | `--min-bytes-processed`, `--min-rows-affected` |

```bash
dbt-tools query-executions bigquery --dbt-target ./target \
  --sort slot_ms_desc --min-slot-ms 1000 --limit 10 --json

dbt-tools query-executions snowflake --dbt-target ./target \
  --sort rows_inserted_desc --min-rows-inserted 1 --json
```

## MCP equivalent

For `dbt-tools-mcp`, use `dbt_tools_query_executions` with optional `bigquery` / `snowflake` blocks — see [packages/mcp/REFERENCE.md](../../../../../packages/mcp/REFERENCE.md).
