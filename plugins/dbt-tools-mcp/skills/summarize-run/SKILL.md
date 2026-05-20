---
name: summarize-run
description: Summarize the loaded dbt run (status breakdown, bottlenecks, adapter totals) without per-node execution rows.
compatibility: dbt-tools MCP server enabled; loaded session with run_results.
---

# Summarize run

**Handle:** `dbt-tools-mcp:summarize-run`

## Contract

- **Inputs:** none
- **Outputs:** summary, status breakdown, bottlenecks, adapter totals
- **Done when:** run-level picture is clear before drill-down

## Preconditions

- [`bind-target`](../bind-target/SKILL.md)
- Loaded session

## Out of scope

- Per-node lists (use [`query-executions`](../query-executions/SKILL.md))

## Implementation

See [references/implementation.md](references/implementation.md).
