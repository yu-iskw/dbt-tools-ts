# bind-target — MCP implementation

| Primitive   | Current MCP tool       | Notes                                           |
| ----------- | ---------------------- | ----------------------------------------------- |
| bind-target | `dbt_tools_set_target` | Input: `{ "target": "<path\|s3://…\|gs://…>" }` |

## Workflow

1. Call `dbt_tools_status` (no args).
2. If `target` is `null`, call `dbt_tools_set_target` with the user's artifact root.
3. On success, response matches status shape (`loadedAtMs`, `runs[]`, etc.). Repeating `set_target` for the same root may return `fromCache: true` when the server still holds that root in its LRU cache.

## Examples

```json
{ "target": "./target" }
```

```json
{ "target": "gs://my-bucket/dbt/prod" }
```

Optional startup target: user may add `--dbt-target` in **their** `.cursor/mcp.json` / `.mcp.json` — not in the bundled plugin `mcp.json`.

Remote client settings (GCS impersonation, S3 region/endpoint): pass **`--gcs-impersonate-service-account`**, **`--gcs-project-id`**, **`--s3-region`**, **`--s3-endpoint`** at MCP startup, or set matching `DBT_TOOLS_*` env vars. Not configurable via `dbt_tools_set_target`. Same flags exist on **`dbt-tools-web`** — see [packages/mcp/REFERENCE.md](../../../../../packages/mcp/REFERENCE.md) and [docs/site/reference/web-cli.md](../../../../../docs/site/reference/web-cli.md).
