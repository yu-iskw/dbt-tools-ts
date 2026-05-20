---
name: query-executions
description: Filter and sort node executions from run_results by status, time, and warehouse metrics. Use for post-run triage.
compatibility: dbt-tools MCP server enabled; loaded session with run_results.
---

# Query executions

**Handle:** `dbt-tools-mcp:query-executions`

## Contract

- **Inputs:** optional status; sort; limit/offset; `uniqueIdPattern`; warehouse block (at most one)
- **Outputs:** bounded execution rows
- **Done when:** triage or ranking question is answered

## Preconditions

- [`bind-target`](../bind-target/SKILL.md)
- Loaded session (requires `run_results.json` at target)

## Out of scope

- Run summary without per-node rows (use [`summarize-run`](../summarize-run/SKILL.md))

## Implementation

See [references/implementation.md](references/implementation.md).
