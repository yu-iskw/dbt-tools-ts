# query-executions — MCP implementation

| Primitive        | Current MCP tool             | Notes |
| ---------------- | ---------------------------- | ----- |
| query-executions | `dbt_tools_query_executions` |       |

## Examples

```json
{ "status": ["error", "fail", "skipped"], "limit": 10 }
```

```json
{ "sort": "execution_time_desc", "limit": 10 }
```

```json
{
  "sort": "execution_time_desc",
  "limit": 10,
  "bigquery": { "sort": "slot_ms_desc" }
}
```

Use `warehouse_type` from `dbt_tools_status` to pick the warehouse block.

Default `limit` 10, max 50. `offset` requires `limit`.

See [packages/mcp/REFERENCE.md](../../../../../packages/mcp/REFERENCE.md).
