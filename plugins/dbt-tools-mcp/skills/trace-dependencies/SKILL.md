---
name: trace-dependencies
description: Trace upstream or downstream dependencies for a dbt resource. Use for lineage, build order, or downstream blast radius.
compatibility: dbt-tools MCP server enabled; uniqueId required.
---

# Trace dependencies

**Handle:** `dbt-tools-mcp:trace-dependencies`

## Contract

- **Inputs:** `uniqueId`; `direction` (`upstream` or `downstream`, default `upstream`); optional `depth`; optional `buildOrder` (upstream); `includeCode` (default false); `includeExecutionMetrics` for per-node run metrics. Subgraph cost rollups: `dbt_tools_query_subgraph_cost`.
- **Outputs:** dependency graph payload from MCP
- **Done when:** dependency neighborhood or build sequence is clear

## Preconditions

- [`bind-target`](../bind-target/SKILL.md)
- Loaded session
- `uniqueId` from [`find-resources`](../find-resources/SKILL.md) when unknown

## Out of scope

- Resource description (use [`describe-resource`](../describe-resource/SKILL.md))
- Execution metrics

## Implementation

See [references/implementation.md](references/implementation.md).
