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
  "resourceTypes": ["model"],
  "limit": 20,
  "bigquery": { "sort": "slot_ms_desc", "minSlotMs": 1000000 }
}
```

```json
{
  "uniqueIds": ["model.my_package.fct_orders"],
  "bigquery": { "sort": "slot_ms_desc" }
}
```

```json
{ "uniqueIdPattern": "fct_orders", "globMode": "substring", "limit": 20 }
```

```json
{ "bigquery": { "queryId": "4825e532-3019-4417-bc75-64b304316b2f" }, "limit": 5 }
```

Use `warehouse_type` from `dbt_tools_status` to pick the warehouse block.

Default `limit` 10, max 50. `offset` requires `limit`.

See [packages/mcp/REFERENCE.md](../../../../../packages/mcp/REFERENCE.md).
