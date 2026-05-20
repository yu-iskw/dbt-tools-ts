---
name: bind-target
description: Establish the dbt artifact root for this session (local path, s3://, or gs://). Use before any other dbt-tools analysis primitive.
compatibility: dbt-tools MCP server enabled; call dbt_tools_set_target when status shows no target.
---

# Bind target

**Handle:** `dbt-tools-mcp:bind-target`

## Contract

- **Inputs:** artifact root path or URI the user intends to analyze
- **Outputs:** MCP status payload with non-null `target` and loaded snapshot (`loadedAtMs` set on success)
- **Done when:** `dbt_tools_status` shows the intended `target` and artifacts are loaded

## Preconditions

- **dbt-tools** MCP server from this plugin is enabled in the host

## Out of scope

- GCS impersonation or S3 client options (MCP process startup env only — see plugin README)
- Run triage workflows

## Implementation

See [references/implementation.md](references/implementation.md).
