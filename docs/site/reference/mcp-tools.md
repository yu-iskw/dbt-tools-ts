# MCP tools

`dbt-tools-mcp` exposes **eight tools**. Each returns JSON in message `content` and `structuredContent`. Validation errors set `isError: true` with a `hint` when applicable.

Set **remote client flags** (GCS impersonation, S3 region/endpoint) at **server startup**. Bind or change the artifact root with **`dbt_tools_set_target`** (`s3://`, `gs://`, or a local path).

## Tools

| Tool                           | Purpose                                              |
| ------------------------------ | ---------------------------------------------------- |
| `dbt_tools_status`             | Target, run id, version token, stale state, `runs[]` |
| `dbt_tools_set_target`         | Set local, `s3://`, or `gs://` artifact root         |
| `dbt_tools_refresh`            | Reload when upstream artifacts change                |
| `dbt_tools_search_resources`   | Search / discover resources                          |
| `dbt_tools_get_resource`       | Resource details by `uniqueId`                       |
| `dbt_tools_query_dependencies` | Upstream / downstream lineage                        |
| `dbt_tools_query_executions`   | Filter and sort executions                           |
| `dbt_tools_get_run_summary`    | Run-level summary (no per-node list)                 |

**Typical chain:** `dbt_tools_status` → `dbt_tools_set_target` → triage tools (`query_executions`, `get_resource`, …).

## Server startup flags

| Flag / environment variable                                                       | Purpose                                        |
| --------------------------------------------------------------------------------- | ---------------------------------------------- |
| `--dbt-target` / `DBT_TOOLS_DBT_TARGET`                                           | Initial artifact root                          |
| `--gcs-impersonate-service-account` / `DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT` | GCS read-only impersonation                    |
| `--gcs-project-id` / `DBT_TOOLS_GCS_PROJECT_ID`                                   | GCS project                                    |
| `--s3-region` / `DBT_TOOLS_S3_REGION`                                             | S3 region                                      |
| `--s3-endpoint` / `DBT_TOOLS_S3_ENDPOINT`                                         | S3-compatible endpoint                         |
| `--poll-interval-ms`                                                              | Background refresh interval (ms); `0` disables |
| `-V`, `--version`                                                                 | Print package version and exit                 |

Do not pass GCS/S3 client flags to `dbt_tools_set_target`—configure them when launching the MCP server.

## Learn more

- [Configuration](./configuration.md) — all `DBT_TOOLS_*` variables
- [Local and remote artifacts](../concepts/local-and-remote-artifacts.md) — S3, GCS, impersonation
- [MCP getting started](../guide/mcp/getting-started.md)
- [Web server CLI](./web-cli.md) — same remote flags on `dbt-tools-web`
- [packages/mcp/REFERENCE.md](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/mcp/REFERENCE.md) — per-tool inputs and examples
