# MCP tools

`dbt-tools-mcp` exposes **eleven tools**. Each returns JSON in message `content` and `structuredContent`. Validation errors set `isError: true` with a `hint` when applicable.

Repeating **`dbt_tools_set_target`** for a recently used artifact root is fast when that root is still in the server’s in-memory LRU cache (default capacity **3**). Use **`dbt_tools_clear_cached_targets`** to free memory or **`dbt_tools_unset_target`** to drop the active binding while keeping cache entries.

Set **remote client flags** (GCS impersonation, S3 region/endpoint) at **server startup**. Bind or change the artifact root with **`dbt_tools_set_target`** (`s3://`, `gs://`, or a local path).

## Tools

| Tool                             | Purpose                                              |
| -------------------------------- | ---------------------------------------------------- |
| `dbt_tools_status`               | Target, run id, version token, stale state, `runs[]` |
| `dbt_tools_set_target`           | Set local, `s3://`, or `gs://` artifact root         |
| `dbt_tools_unset_target`         | Clear active target; retain LRU cache                |
| `dbt_tools_clear_cached_targets` | Drop all in-memory parsed caches                     |
| `dbt_tools_refresh`              | Reload when upstream artifacts change                |
| `dbt_tools_search_resources`     | Search / discover resources                          |
| `dbt_tools_get_resource`         | Resource details by `uniqueId`                       |
| `dbt_tools_query_dependencies`   | Upstream / downstream lineage                        |
| `dbt_tools_query_executions`     | Filter and sort executions                           |
| `dbt_tools_query_subgraph_cost`  | Subgraph cost / time rollup (no SQL)                 |
| `dbt_tools_get_run_summary`      | Run-level summary (no per-node list)                 |

**Typical chain:** `dbt_tools_set_target` (or `--dbt-target` at server startup) → `dbt_tools_status` → triage tools (`query_executions`, `get_resource`, …).

## Server startup flags

| Flag / environment variable                                                       | Purpose                                                       |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `--dbt-target` / `DBT_TOOLS_DBT_TARGET`                                           | Initial artifact root                                         |
| `--gcs-impersonate-service-account` / `DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT` | GCS read-only impersonation                                   |
| `--gcs-project-id` / `DBT_TOOLS_GCS_PROJECT_ID`                                   | GCS project                                                   |
| `--s3-region` / `DBT_TOOLS_S3_REGION`                                             | S3 region                                                     |
| `--s3-endpoint` / `DBT_TOOLS_S3_ENDPOINT`                                         | S3-compatible endpoint                                        |
| `--poll-interval-ms`                                                              | Background refresh interval (ms); `0` disables                |
| `--max-cached-targets` / `DBT_TOOLS_MAX_CACHED_TARGETS`                           | LRU capacity for parsed roots (default **3**; **0** disables) |
| `--cache-ttl-ms` / `DBT_TOOLS_CACHE_TTL_MS`                                       | Idle TTL for cached roots (default **0**, disabled)           |
| `-V`, `--version`                                                                 | Print package version and exit                                |

Do not pass GCS/S3 client flags to `dbt_tools_set_target`—configure them when launching the MCP server.

## Status fields (`dbt_tools_status` / `dbt_tools_set_target`)

Besides `target`, `loadedAtMs`, `stale`, and `runs[]`, status may include:

| Field           | Meaning                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `cachedTargets` | Other artifact roots still held in the in-memory LRU cache              |
| `cachePolicy`   | Active `maxTargets` and `ttlMs` for the workspace                       |
| `fromCache`     | On `set_target`, `true` when the snapshot was restored without re-parse |

Full examples and per-tool inputs: [`packages/mcp/REFERENCE.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/mcp/REFERENCE.md).

## Learn more

- [Configuration](./configuration.md) — all `DBT_TOOLS_*` variables
- [Local and remote artifacts](../concepts/local-and-remote-artifacts.md) — S3, GCS, impersonation
- [MCP getting started](../guide/mcp/getting-started.md)
- [Web server CLI](./web-cli.md) — same remote flags on `dbt-tools-web`
- [packages/mcp/REFERENCE.md](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/mcp/REFERENCE.md) — per-tool inputs and examples
