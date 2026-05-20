---
name: query-executions
description: Filter and sort run_results node executions by status, time, and warehouse metrics. Use for post-run triage and slow-node investigation.
compatibility: dbt-tools on PATH; run_results required (check-session readiness full).
---

# Query executions

**Handle:** `dbt-tools-cli:query-executions`

## Contract

- **Inputs:** optional status filter; sort; limit/offset; optional `unique_id` pattern; warehouse-specific options when relevant
- **Outputs:** ranked or filtered execution rows
- **Done when:** the user has the executions needed for triage or drill-down

## Preconditions

- [`bind-target`](../bind-target/SKILL.md)
- [`check-session`](../check-session/SKILL.md) — `readiness: full` (requires `run_results.json`)

## Out of scope

- Run-level aggregates without per-node detail (use [`summarize-run`](../summarize-run/SKILL.md))
- Lineage graphs

## Implementation

See [references/implementation.md](references/implementation.md).
