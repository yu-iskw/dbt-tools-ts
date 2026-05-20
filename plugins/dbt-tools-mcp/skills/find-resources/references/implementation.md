# find-resources — MCP implementation

| Primitive      | Current MCP tool             | Notes |
| -------------- | ---------------------------- | ----- |
| find-resources | `dbt_tools_search_resources` |       |

## Examples

```json
{ "query": "orders", "type": "model", "limit": 10, "offset": 0 }
```

```json
{ "type": "model", "tag": "finance", "limit": 20 }
```

## Outputs

- `results[].unique_id` (use as `uniqueId` in downstream tools)
- `total`, `has_more` when limited

Inline query tokens in `query` still work (`type:model`, `tag:finance`).

See [packages/mcp/REFERENCE.md](../../../../../packages/mcp/REFERENCE.md).
