# @dbt-tools/mcp

Long-lived MCP server for dbt artifact analysis. It keeps a selected artifact run parsed in memory so agent clients can issue many small queries without repeatedly downloading, loading, and parsing large `manifest.json` / `run_results.json` files.

Use the CLI (`@dbt-tools/cli`) for one-shot CI and shell workflows. Use this MCP server for interactive agent sessions, especially when artifacts are large or live in S3/GCS.

**Security / trust:** stdio MCP under one OS user, ambient cloud credentials, and remote read size limits are summarized in [`AGENTS.md`](../../AGENTS.md) (**Security posture**).

## Installation

```bash
npm install -g @dbt-tools/mcp
```

Or run with `npx` from an MCP client configuration.

## Configuration

The server accepts the same target forms as the CLI:

```bash
dbt-tools-mcp --dbt-target ./target
dbt-tools-mcp --dbt-target s3://my-bucket/dbt/prod
dbt-tools-mcp --dbt-target gs://my-bucket/dbt/prod
```

You can also set `DBT_TOOLS_DBT_TARGET` and omit `--dbt-target`.

Remote credentials stay in the Node process and use the normal AWS SDK / Google Cloud client chains. `DBT_TOOLS_REMOTE_SOURCE` can provide provider-specific options such as AWS region, S3 endpoint, or GCS project id.

For **`gs://`** targets, optional **`--gcs-project-id`** and **`--gcs-impersonate-service-account <email>`** override the GCS client **`projectId`** and impersonated principal from `DBT_TOOLS_REMOTE_SOURCE` when set; bucket and prefix always come from the **`gs://`** URI.

Pass `--poll-interval-ms <ms>` to enable best-effort periodic refresh for the selected run. The `dbt_tools_refresh` tool remains available when an agent needs an immediate refresh after a known artifact update.

Use **`dbt_tools_set_target`** to point a long-lived session at a different artifact root (local path, `s3://`, or `gs://`) without restarting the process. Optional `gcsProjectId` and `gcsImpersonateServiceAccount` arguments match **`--gcs-project-id`** / **`--gcs-impersonate-service-account`** when you need per-switch GCS overrides; omit them to keep the overrides from server startup.

## Startup vs first load

The server **connects MCP stdio first**; it does **not** block the handshake on downloading or parsing artifacts. Heavy work runs on the **first** `dbt_tools_refresh`, the **first** `dbt_tools_set_target`, the **first** analysis tool call (for example `dbt_tools_search_resources`), or when **`--poll-interval-ms`** triggers a refresh while nothing is loaded yet. Until then, **`dbt_tools_status`** may show **`versionToken: null`** and **`loadedAtMs: null`**, which is expected. This avoids MCP client timeouts (for example Inspector **`McpError -32001`**) while the remote `manifest.json` is very large.

## Debug logging (large artifacts)

Set **`DBT_TOOLS_DEBUG=1`** in the MCP server process environment. `@dbt-tools/core` then writes **low-volume, phase-scoped lines to stderr** (prefix `[dbt-tools][artifact-workspace]`) during artifact **discovery**, **fetch**, **JSON decode**, **parse**, **snapshot build**, **initialize**, and **refresh**. This helps distinguish a long remote load from a hung process. **Do not** rely on stdout for diagnostics: stdout is reserved for MCP JSON-RPC when using stdio transport.

```json
{
  "mcpServers": {
    "dbt-tools": {
      "command": "npx",
      "args": ["-y", "@dbt-tools/mcp", "--dbt-target", "s3://my-bucket/dbt/prod"],
      "env": {
        "AWS_REGION": "ap-northeast-1",
        "DBT_TOOLS_DEBUG": "1"
      }
    }
  }
}
```

## MCP Client Example

```json
{
  "mcpServers": {
    "dbt-tools": {
      "command": "npx",
      "args": [
        "-y",
        "@dbt-tools/mcp",
        "--dbt-target",
        "s3://my-bucket/dbt/prod",
        "--poll-interval-ms",
        "30000"
      ],
      "env": {
        "AWS_REGION": "ap-northeast-1"
      }
    }
  }
}
```

## Tools

- `dbt_tools_status`: current target, selected run, version token, load time, and stale state.
- `dbt_tools_refresh`: check artifact metadata and reload if the selected run changed.
- `dbt_tools_list_runs`: list discovered artifact runs.
- `dbt_tools_select_run`: select a discovered run by run id.
- `dbt_tools_set_target`: point the server at a new artifact target and load the default run (same response shape as `dbt_tools_status`).
- `dbt_tools_search_resources`: bounded resource search by query and filters.
- `dbt_tools_get_resource`: details for one resource by `unique_id`.
- `dbt_tools_lineage`: upstream or downstream dependency neighborhood.
- `dbt_tools_impact`: downstream impact for one resource.
- `dbt_tools_failures`: bounded page of non-successful executions.
- `dbt_tools_run_report`: execution summary and bounded execution rows.

## Design Notes

The MCP package is intentionally thin. Shared artifact lifecycle, query semantics, pagination contracts, and output types live in `@dbt-tools/core`; this package adapts those core use cases to MCP stdio transport and JSON tool responses.
