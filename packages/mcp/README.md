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

### Developing from source

From the monorepo root (workspace `bin` is not linked for this package):

```bash
pnpm --filter @dbt-tools/mcp build
node packages/mcp/dist/server.js --help

# Local smoke test (lazy init + debug logs on stderr)
DBT_TOOLS_DEBUG=1 node packages/mcp/dist/server.js --dbt-target ./target
```

Test with [MCP Inspector](https://github.com/modelcontextprotocol/inspector) (local build):

```bash
npx @modelcontextprotocol/inspector -- node packages/mcp/dist/server.js --dbt-target ./target
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

- **`--dbt-target`** — optional local path, `s3://bucket/prefix`, or `gs://bucket/prefix` (or set at runtime via **`dbt_tools_set_target`**)
- **`DBT_TOOLS_DBT_TARGET`** — same value as `--dbt-target` when you omit the flag at startup
- **`--poll-interval-ms`** — optional background refresh interval (best-effort); use **`dbt_tools_refresh`** for an immediate reload after CI uploads
- **`--gcs-project-id`**, **`--gcs-impersonate-service-account`**, **`--s3-region`**, **`--s3-endpoint`** — remote client settings (`gs://` vs `s3://` only; see [REFERENCE.md](REFERENCE.md))
- **`DBT_TOOLS_GCS_PROJECT_ID`**, **`DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT`**, **`DBT_TOOLS_S3_REGION`**, **`DBT_TOOLS_S3_ENDPOINT`** — same settings via env (flags override env when both are set); bucket/prefix always from the URI
- **`DBT_TOOLS_DEBUG=1`** — phased progress on **stderr** (list/download/parse); use while debugging GCS/S3 startup
- **Lazy startup** — MCP connects immediately; artifacts load on the first tool that needs them.

Full CLI flags, environment variables, client examples, tool parameters, and troubleshooting: **[REFERENCE.md](REFERENCE.md)**.

### Remote artifacts (summary)

**S3:**

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
        "--s3-region",
        "ap-northeast-1"
      ],
      "env": { "AWS_REGION": "ap-northeast-1" }
    }
  }
}
```

**GCS** (project + impersonation via env):

```json
{
  "mcpServers": {
    "dbt-tools": {
      "command": "npx",
      "args": ["-y", "@dbt-tools/mcp", "--dbt-target", "gs://my-bucket/dbt/prod"],
      "env": {
        "DBT_TOOLS_GCS_PROJECT_ID": "my-gcp-project",
        "DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT": "reader@my-gcp-project.iam.gserviceaccount.com",
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/key.json"
      }
    }
  }
}
```

Credentials stay in the Node child process (AWS/GCP default chains). See [REFERENCE.md](REFERENCE.md) and [ADR-0004](../../docs/adr/0004-remote-object-storage-artifact-sources-and-auto-reload.md).

### Optional startup target (runtime `set_target`)

Use one MCP config for many projects; set the artifact path per session:

```json
{
  "mcpServers": {
    "dbt-tools": {
      "command": "npx",
      "args": ["-y", "@dbt-tools/mcp"],
      "env": {
        "DBT_TOOLS_GCS_IMPERSONATE_SERVICE_ACCOUNT": "reader@my-project.iam.gserviceaccount.com",
        "DBT_TOOLS_GCS_PROJECT_ID": "my-project"
      }
    }
  }
}
```

Then call **`dbt_tools_set_target`** with `{ "target": "./target" }` or a remote URI. GCS impersonation and S3 region stay in startup `env` / flags—not on the tool.

## Resources, prompts, and output schemas

- **Resources** — `dbt-tools://status`, `dbt-tools://runs/current/summary`, and templates for resource metadata, SQL (`text/sql`, size-bounded), and dependencies. See [docs/site/reference/mcp-resources.md](../../docs/site/reference/mcp-resources.md).
- **Prompts** — `triage_dbt_run`, `analyze_model_blast_radius`, `inspect_dbt_resource`, `optimize_dbt_run`, `review_artifact_snapshot`. See [docs/site/reference/mcp-prompts.md](../../docs/site/reference/mcp-prompts.md).
- **Output schemas** — every tool publishes `outputSchema` aligned with `structuredContent`. Validation is on by default (`DBT_TOOLS_VALIDATE_OUTPUT` unset or any value other than `0` / `false`). Set **`DBT_TOOLS_VALIDATE_OUTPUT=0`** in production if you prefer to skip server-side output re-parsing. Top-level tool envelopes are strict; nested resource fields use passthrough for forward compatibility.

Protocol smoke (after build): `pnpm smoke:mcp` from the monorepo root.

## Suggested agent workflow

1. **`dbt_tools_status`** or read **`dbt-tools://status`** — confirm target is set, loaded, and whether `stale` is true
2. **`dbt_tools_set_target`** — when `target` is `null`, point at local `target/` or `s3://` / `gs://` prefix
3. **`dbt_tools_search_resources`** — find models/sources by name or filters
4. **`dbt_tools_get_resource`** — details for a `unique_id` (set `includeCode: true` when you need SQL)
5. **`dbt_tools_query_dependencies`** — upstream/downstream DAG (blast radius = `direction: downstream`)
6. **`dbt_tools_query_executions`** — ranked/filtered executions (warehouse block for adapter metrics)
7. **`dbt_tools_get_run_summary`** — totals and bottlenecks without a node list
8. **`dbt_tools_refresh`** — after a new dbt run uploads artifacts (or rely on `--poll-interval-ms`)
9. **`dbt_tools_unset_target`** / **`dbt_tools_clear_cached_targets`** — when switching tag slices or freeing memory (see [REFERENCE.md](REFERENCE.md#lifecycle-and-refresh))

## Tools (10)

| Tool                             | Summary                                     |
| -------------------------------- | ------------------------------------------- |
| `dbt_tools_status`               | Target, runs[], warehouse_type, stale state |
| `dbt_tools_set_target`           | Set or change artifact root (path/URI only) |
| `dbt_tools_unset_target`         | Clear active target; keep LRU cache         |
| `dbt_tools_clear_cached_targets` | Drop all in-memory parsed caches            |
| `dbt_tools_refresh`              | Reload if artifacts changed                 |
| `dbt_tools_search_resources`     | Catalog search                              |
| `dbt_tools_get_resource`         | One resource by `unique_id`                 |
| `dbt_tools_query_dependencies`   | Upstream/downstream dependencies            |
| `dbt_tools_query_executions`     | Filter/sort run executions                  |
| `dbt_tools_get_run_summary`      | Run aggregates (no node list)               |

Parameters, defaults, and pagination limits: **[REFERENCE.md](REFERENCE.md#mcp-tools-reference)**.

## Troubleshooting

- **`No versions available for @dbt-tools/mcp` (npm 11+)** — if your `~/.npmrc` sets `min-release-age`, fresh releases are hidden until they age out. Use `npx --min-release-age=0 -y @dbt-tools/mcp …`, wait for the quarantine window, or lower that setting. npm does not yet support a per-scope exclude like pnpm’s `minimumReleaseAgeExclude`.
- **No output from `npx … -- --help`** — pass flags after `--` (e.g. `npx --min-release-age=0 -y @dbt-tools/mcp -- --help`); help prints to stdout and exits 0.
- **Analysis tools return `target is not configured`** — call **`dbt_tools_set_target`**, or set `--dbt-target` / `DBT_TOOLS_DBT_TARGET` at startup.
- **`Expected exactly one artifact set`** — the target must contain a single complete `manifest.json` + `run_results.json` pair at its root; fix the path or layout ([ADR-0004](../../docs/adr/0004-remote-object-storage-artifact-sources-and-auto-reload.md)).
- **S3/GCS access denied** — configure AWS/GCP credentials on the **child process** (`env` in MCP config).
- **`stale: true`** — last refresh failed; call `dbt_tools_refresh` and read `lastRefreshError` in the status payload.
- **MCP client stops working** — do not write non-protocol text to **stdout**; only MCP messages belong there (errors at startup go to stderr).

More symptoms: **[REFERENCE.md](REFERENCE.md#troubleshooting)**.

## Design notes

The MCP package is intentionally thin. Shared artifact lifecycle, query semantics, pagination contracts, and output types live in `@dbt-tools/core`; this package adapts those use cases to MCP stdio transport and JSON tool responses.

**Multi-target cache:** `ArtifactWorkspace` keeps up to **three** parsed artifact roots in memory by default (`DBT_TOOLS_MAX_CACHED_TARGETS`, `--max-cached-targets`). Repeating `dbt_tools_set_target` for a recent root skips download/parse when the entry is still cached. Background poll and `dbt_tools_refresh` only touch the **active** target.
