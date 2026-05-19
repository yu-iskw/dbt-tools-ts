# @dbt-tools/mcp

Long-lived **MCP server** (stdio transport) for dbt artifact analysis. It keeps a selected artifact run parsed in memory so agent clients can issue many small queries without repeatedly downloading, loading, and parsing large `manifest.json` / `run_results.json` files.

## When to use this server

Use **`dbt-tools-mcp`** when an MCP client (Cursor, Claude Desktop, etc.) needs **many small queries** over the same dbt artifact run without reloading `manifest.json` / `run_results.json` on every call—especially for **large** artifacts or **S3/GCS** targets where parse and download cost dominates.

## Requirements

- **Node.js 20+** (see [`package.json`](package.json) `engines`)
- Artifact **target** with `manifest.json` and `run_results.json` at the **root** of that location (typical dbt `target/` layout). Optional `catalog.json` / `sources.json` when present. See [ADR-0004](../../docs/adr/0004-remote-object-storage-artifact-sources-and-auto-reload.md) for the one-pair-per-location contract.

## Installation

```bash
npm install -g @dbt-tools/mcp
```

The binary is **`dbt-tools-mcp`**. Or run via **`npx`** from your MCP client config (no global install required).

```bash
dbt-tools-mcp --dbt-target ./target --help
```

## Quick start (local)

Add to your MCP client (Cursor, Claude Desktop, etc.):

```json
{
  "mcpServers": {
    "dbt-tools": {
      "command": "npx",
      "args": ["-y", "@dbt-tools/mcp", "--dbt-target", "./target"]
    }
  }
}
```

Point `./target` at the directory that contains `manifest.json` and `run_results.json`.

## Configuration (summary)

- **`--dbt-target`** — local path, `s3://bucket/prefix`, or `gs://bucket/prefix` (required unless env is set)
- **`DBT_TOOLS_DBT_TARGET`** — same value as `--dbt-target` when you omit the flag
- **`--poll-interval-ms`** — optional background refresh interval (best-effort); use **`dbt_tools_refresh`** for an immediate reload after CI uploads
- **`DBT_TOOLS_REMOTE_SOURCE`** — optional JSON for S3/GCS client options (region, endpoint, project id); the **URI** sets bucket/prefix, not a second location

Full CLI flags, environment variables, client examples, tool parameters, and troubleshooting: **[REFERENCE.md](REFERENCE.md)**.

### Remote artifacts (summary)

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

Credentials stay in the Node child process (AWS/GCP default chains). For endpoint, region, and `DBT_TOOLS_REMOTE_SOURCE` details, see [REFERENCE.md](REFERENCE.md) and [ADR-0004](../../docs/adr/0004-remote-object-storage-artifact-sources-and-auto-reload.md).

## Suggested agent workflow

1. **`dbt_tools_status`** — confirm the target loaded and whether `stale` is true
2. **`dbt_tools_search_resources`** — find models/sources by name or filters
3. **`dbt_tools_get_resource`** — details for a `unique_id` (set `includeCode: true` when you need SQL)
4. **`dbt_tools_lineage`** or **`dbt_tools_impact`** — dependency neighborhood or downstream blast radius
5. **`dbt_tools_refresh`** — after a new dbt run uploads artifacts (or rely on `--poll-interval-ms`)

For failures and run timing, use **`dbt_tools_failures`** and **`dbt_tools_run_report`**.

## Tools

| Tool                         | Summary                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `dbt_tools_status`           | Target, selected run, version token, load time, stale state |
| `dbt_tools_refresh`          | Reload if the selected run’s artifacts changed              |
| `dbt_tools_list_runs`        | Discovered runs (typically 0 or 1 entry)                    |
| `dbt_tools_select_run`       | Load a run by id (usually `current`)                        |
| `dbt_tools_search_resources` | Search by query and optional filters                        |
| `dbt_tools_get_resource`     | One resource by `unique_id`                                 |
| `dbt_tools_lineage`          | Upstream or downstream dependencies                         |
| `dbt_tools_impact`           | Downstream impact                                           |
| `dbt_tools_failures`         | Page of non-successful executions                           |
| `dbt_tools_run_report`       | Execution summary and bounded execution rows                |

Parameters, defaults, and pagination limits: **[REFERENCE.md](REFERENCE.md#mcp-tools-reference)**.

## Troubleshooting

- **`dbt artifact target is required`** — set `--dbt-target` or `DBT_TOOLS_DBT_TARGET` in the MCP server `env` or args.
- **`Expected exactly one artifact set`** — the target must contain a single complete `manifest.json` + `run_results.json` pair at its root; fix the path or layout ([ADR-0004](../../docs/adr/0004-remote-object-storage-artifact-sources-and-auto-reload.md)).
- **S3/GCS access denied** — configure AWS/GCP credentials on the **child process** (`env` in MCP config).
- **`stale: true`** — last refresh failed; call `dbt_tools_refresh` and read `lastRefreshError` in the status payload.
- **MCP client stops working** — do not write non-protocol text to **stdout**; only MCP messages belong there (errors at startup go to stderr).

More symptoms: **[REFERENCE.md](REFERENCE.md#troubleshooting)**.

## Design notes

The MCP package is intentionally thin. Shared artifact lifecycle, query semantics, pagination contracts, and output types live in `@dbt-tools/core`; this package adapts those use cases to MCP stdio transport and JSON tool responses.
