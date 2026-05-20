# refresh-snapshot — CLI implementation

There is no dedicated refresh command. Re-run analysis primitives on the same target after artifacts change.

| Primitive        | Current CLI                                                           | Notes                                      |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| refresh-snapshot | `dbt-tools status --json` (optional) then re-invoke analysis commands | Confirms new `modified_at` / `age_seconds` |

## Recipes

```bash
# After dbt run — confirm freshness
dbt-tools status --dbt-target ./target --json

# Then continue with find-resources, query-executions, etc.
```

Each CLI invocation reloads artifacts for that command (unlike MCP in-memory snapshot).
