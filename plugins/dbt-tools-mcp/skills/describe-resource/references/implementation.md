# describe-resource — MCP implementation

| Primitive         | Current MCP tool         | Notes |
| ----------------- | ------------------------ | ----- |
| describe-resource | `dbt_tools_get_resource` |       |

## Examples

```json
{ "uniqueId": "model.my_project.orders" }
```

```json
{ "uniqueId": "model.my_project.orders", "includeCode": true }
```

Returns `null` or error if id not found — re-run [`find-resources`](../../find-resources/SKILL.md).

See [packages/mcp/REFERENCE.md](../../../../../packages/mcp/REFERENCE.md).
