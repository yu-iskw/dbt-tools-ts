# MCP resources

`dbt-tools-mcp` exposes read-only **resources** and **resource templates** using the `dbt-tools://` URI scheme. Resources complement the ten [MCP tools](./mcp-tools.md); they do not replace them.

## Static resources

| URI                                | MIME type          | When available                                   |
| ---------------------------------- | ------------------ | ------------------------------------------------ |
| `dbt-tools://status`               | `application/json` | Always (even with no target bound)               |
| `dbt-tools://runs/current/summary` | `application/json` | After a target is bound and artifacts are loaded |

## Resource templates

| URI template                                                | Purpose                                       |
| ----------------------------------------------------------- | --------------------------------------------- |
| `dbt-tools://resources/{uniqueId}`                          | Resource metadata (`includeCode: false`)      |
| `dbt-tools://resources/{uniqueId}/sql/raw`                  | Raw SQL (`text/sql`, byte-bounded)            |
| `dbt-tools://resources/{uniqueId}/sql/compiled`             | Compiled SQL (`text/sql`, byte-bounded)       |
| `dbt-tools://resources/{uniqueId}/dependencies/{direction}` | `upstream` or `downstream` dependency context |

`resources/list` returns only the two static URIs. Discovery of models uses `dbt_tools_search_resources`.

## JSON envelope

JSON resources include snapshot metadata:

- `versionToken`
- `loadedAtMs`
- `target` (when bound)
- `stale`

Plus a payload field: `status`, `summary`, `resource`, or `dependencies`.

## Tool fallbacks

| Resource                           | Tool                           |
| ---------------------------------- | ------------------------------ |
| `dbt-tools://status`               | `dbt_tools_status`             |
| `dbt-tools://runs/current/summary` | `dbt_tools_get_run_summary`    |
| `dbt-tools://resources/{uniqueId}` | `dbt_tools_get_resource`       |
| Dependency template                | `dbt_tools_query_dependencies` |

## SQL limits

Default max SQL resource size is 256 KiB (absolute cap 1 MiB). Truncated SQL ends with a `dbt-tools:` notice line. The same limits apply to `dbt_tools_get_resource` when `includeCode` is true.

## URI encoding

Always percent-encode `uniqueId` in the path (for example `encodeURIComponent('model.pkg.orders')`). Raw `/` characters split into multiple path segments and will not resolve to a single resource id.

## Errors (resources)

| Condition            | Resource behavior               |
| -------------------- | ------------------------------- |
| Malformed URI        | `InvalidParams`                 |
| No target configured | `InvalidParams` with setup hint |
| Unknown resource     | `InvalidParams`                 |

Tools use JSON `isError` results for missing targets; `dbt_tools_get_resource` returns success with `null` for unknown ids instead of an error — see [MCP tools](./mcp-tools.md#errors-tools).
