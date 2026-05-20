# bind-target — MCP implementation

| Primitive   | Current MCP tool       | Notes                                           |
| ----------- | ---------------------- | ----------------------------------------------- |
| bind-target | `dbt_tools_set_target` | Input: `{ "target": "<path\|s3://…\|gs://…>" }` |

## Workflow

1. Call `dbt_tools_status` (no args).
2. If `target` is `null`, call `dbt_tools_set_target` with the user's artifact root.
3. On success, response matches status shape (`loadedAtMs`, `runs[]`, etc.).

## Examples

```json
{ "target": "./target" }
```

```json
{ "target": "gs://my-bucket/dbt/prod" }
```

Optional startup target: user may add `--dbt-target` in **their** `.cursor/mcp.json` / `.mcp.json` — not in the bundled plugin `mcp.json`.

GCS impersonation: `DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT` at MCP startup only — see [packages/mcp/REFERENCE.md](../../../../../packages/mcp/REFERENCE.md).
