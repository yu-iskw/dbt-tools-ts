# trace-dependencies — MCP implementation

| Primitive          | Current MCP tool               | Notes                                        |
| ------------------ | ------------------------------ | -------------------------------------------- |
| trace-dependencies | `dbt_tools_query_dependencies` | Replaces legacy `lineage` and `impact` tools |

## Examples

```json
{
  "uniqueId": "model.my_project.orders",
  "direction": "downstream",
  "depth": 2
}
```

```json
{
  "uniqueId": "model.my_project.orders",
  "direction": "upstream",
  "buildOrder": true
}
```

Default `direction` is `upstream` if omitted — pass `downstream` explicitly for impact-style questions.

See [packages/mcp/REFERENCE.md](../../../../../packages/mcp/REFERENCE.md).
