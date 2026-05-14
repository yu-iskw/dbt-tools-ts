# @dbt-tools/mcp

Long-lived MCP server for dbt artifact analysis. It keeps a selected artifact run parsed in memory so agent clients can issue many small queries without repeatedly downloading, loading, and parsing large `manifest.json` / `run_results.json` files.

Use the CLI (`@dbt-tools/cli`) for one-shot CI and shell workflows. Use this MCP server for interactive agent sessions, especially when artifacts are large or live in S3/GCS.

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

Pass `--poll-interval-ms <ms>` to enable best-effort periodic refresh for the selected run. The `dbt_tools_refresh` tool remains available when an agent needs an immediate refresh after a known artifact update.

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
- `dbt_tools_search_resources`: bounded resource search by query and filters.
- `dbt_tools_get_resource`: details for one resource by `unique_id`.
- `dbt_tools_lineage`: upstream or downstream dependency neighborhood.
- `dbt_tools_impact`: downstream impact for one resource.
- `dbt_tools_failures`: bounded page of non-successful executions.
- `dbt_tools_run_report`: execution summary and bounded execution rows.

## Design Notes

The MCP package is intentionally thin. Shared artifact lifecycle, query semantics, pagination contracts, and output types live in `@dbt-tools/core`; this package adapts those core use cases to MCP stdio transport and JSON tool responses.
