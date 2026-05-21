# Getting started with @dbt-tools/mcp

**Long-lived MCP server** (stdio) that keeps a dbt artifact run parsed in memory so agent clients can issue many small queries without reloading large manifests on every call.

Use `dbt-tools-mcp` when an MCP client (Cursor, Claude Desktop, etc.) needs **many queries** over the same artifact run—especially for large artifacts or remote S3/GCS targets where parse cost dominates.

Step-by-step jobs (status, discover, explain) live under **CLI → Workflows** in the sidebar. Use MCP when the same artifact run needs many tool calls without re-parsing each time.

## Install and run

```bash
npx @dbt-tools/mcp --dbt-target ./target
```

Or global install:

```bash
npm install -g @dbt-tools/mcp
dbt-tools-mcp --dbt-target ./target
```

Configure your MCP client to launch `dbt-tools-mcp` with the same `--dbt-target` (or `DBT_TOOLS_DBT_TARGET`).

## Learn more

- [MCP tools](../../reference/mcp-tools.md) — tool and startup-flag reference
- [Configuration](../../reference/configuration.md) — environment variables and targets
- [Local and remote artifacts](../../concepts/local-and-remote-artifacts.md) — S3, GCS, impersonation
- [Package README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/mcp/README.md)
