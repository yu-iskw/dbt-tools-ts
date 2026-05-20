# check-session — MCP implementation

| Primitive     | Current MCP tool   | Notes        |
| ------------- | ------------------ | ------------ |
| check-session | `dbt_tools_status` | No arguments |

## Example response fields

| Field              | Meaning                                          |
| ------------------ | ------------------------------------------------ |
| `target`           | Active artifact root (`null` before bind-target) |
| `loadedAtMs`       | Snapshot load time (epoch ms)                    |
| `stale`            | `true` if last refresh failed                    |
| `lastRefreshError` | Present when `stale` is true                     |
| `versionToken`     | Changes when artifacts change                    |
| `runs[]`           | Discovered runs (typically one `current`)        |
| `warehouse_type`   | For warehouse-scoped query-executions            |

## Errors

`dbt artifact target is not configured` — call [`bind-target`](../../bind-target/SKILL.md) before other analysis tools.

See [packages/mcp/REFERENCE.md](../../../../../packages/mcp/REFERENCE.md).
