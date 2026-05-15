---
name: mcp-server
description: Run the dbt-tools MCP server against local or remote dbt artifact targets.
  Use when the user wants a long-lived MCP session for artifact queries.
compatibility: dbt-tools-mcp on PATH; Node 20+; dbt artifact directory or s3:// / gs:// prefix.
---

# dbt-tools MCP server

**Skill handle (FQH):** `dbt-tools-mcp:mcp-server` (plugin `dbt-tools-mcp`, skill directory `mcp-server`). Use for documentation only; YAML `name` remains `mcp-server` per [Agent Skills](https://agentskills.io/specification).

## When to use

Use when an interactive agent session should call `dbt_tools_*` tools against parsed artifacts without re-downloading on every query.

## Recommended pattern

```bash
dbt-tools-mcp --dbt-target ./target
```

Or set `DBT_TOOLS_DBT_TARGET` and run `dbt-tools-mcp` with no `--dbt-target`.

For remote targets and credential chains, see [`@dbt-tools/mcp`](../../../../packages/mcp/README.md).
