# Getting started with @dbt-tools/mcp

**Long-lived MCP server** (stdio) that keeps a dbt artifact run parsed in memory so agent clients can issue many small queries without reloading large manifests on every call.

Use `dbt-tools-mcp` when an MCP client (Cursor, Claude Desktop, etc.) needs **many queries** over the same artifact run—especially for large artifacts or remote S3/GCS targets where parse cost dominates.

Step-by-step jobs (status, discover, explain) live under **CLI → Workflows** in the sidebar. Use MCP when the same artifact run needs many tool calls without re-parsing each time.

## Install and run

```bash
npx -y @dbt-tools/mcp --help
npx -y @dbt-tools/mcp --dbt-target ./target
```

Or global install:

```bash
npm install -g @dbt-tools/mcp
dbt-tools-mcp --dbt-target ./target
```

Configure your MCP client to launch `npx -y @dbt-tools/mcp` or the global `dbt-tools-mcp` binary with the same `--dbt-target` (or `DBT_TOOLS_DBT_TARGET`). See [Connecting clients](./connecting-clients.md).

The server also exposes read-only [`dbt-tools://` resources](../../reference/mcp-resources.md) and user-invoked [prompts](../../reference/mcp-prompts.md) (workflow templates over the same tools).

## Multiple artifact roots (tag slices)

One MCP process can investigate **several artifact prefixes** in a long session (for example mutually exclusive dbt tags with separate `target/` uploads):

1. `dbt_tools_set_target` → `s3://bucket/dbt/domain-a/` (or a local path)
2. Triage with `dbt_tools_search_resources`, `dbt_tools_query_executions`, etc.
3. `dbt_tools_set_target` → `s3://bucket/dbt/domain-b/`
4. `dbt_tools_set_target` → domain-a again — **fast** if still in the LRU cache (default capacity **3**)

Use a **stable URI or path string** per slice so cache keys match on repeat `set_target`. **`dbt_tools_refresh`** and background poll only update the **active** target. When finished or under memory pressure, call **`dbt_tools_clear_cached_targets`**. To drop the active binding but keep cache entries for a quick re-bind, use **`dbt_tools_unset_target`**.

See [MCP tools](../../reference/mcp-tools.md) and [`packages/mcp/REFERENCE.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/mcp/REFERENCE.md).

## Artifact requirements

MCP loads **`manifest.json` and `run_results.json` together** when a target is set. There is no manifest-only MCP session. If you only ran `dbt compile`, use CLI `dbt-tools status` or **`dbt-tools-cli:check-session`** to inspect readiness, then run `dbt build` or `dbt run` before starting MCP. See [Troubleshooting](../../reference/troubleshooting.md) and the [check-session reference](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/dbt-tools-mcp/skills/check-session/references/session.md).

## Learn more

- [MCP tools](../../reference/mcp-tools.md) — tool and startup-flag reference
- [MCP resources](../../reference/mcp-resources.md) — `dbt-tools://` URIs
- [MCP prompts](../../reference/mcp-prompts.md) — user-invoked workflow templates
- [Configuration](../../reference/configuration.md) — environment variables and targets
- [Local and remote artifacts](../../concepts/local-and-remote-artifacts.md) — S3, GCS, impersonation
- [Package README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/mcp/README.md)
