# refresh-snapshot — MCP implementation

| Primitive        | Current MCP tool    | Notes        |
| ---------------- | ------------------- | ------------ |
| refresh-snapshot | `dbt_tools_refresh` | No arguments |

## Workflow

After `dbt run` or external artifact update:

1. `dbt_tools_refresh`
2. `dbt_tools_status` to confirm `stale` is false

Optional background refresh: user adds `--poll-interval-ms` in their MCP overlay (not bundled in plugin).

See [packages/mcp/REFERENCE.md](../../../../../packages/mcp/REFERENCE.md).
