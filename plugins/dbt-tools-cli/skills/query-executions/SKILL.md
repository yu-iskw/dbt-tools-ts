---
name: query-executions
description: Filter and sort run_results node executions by status, time, and warehouse metrics. Use for post-run triage and slow-node investigation.
compatibility: dbt-tools on PATH; run_results required (check-session readiness full).
---

# Query executions

**Handle:** `dbt-tools-cli:query-executions`

## Contract

- **Inputs:** optional status filter; sort; limit/offset; optional `unique_id` pattern; `--unique-ids` (max 100); `--glob-mode` (CLI default **strict**); BigQuery `--query-id`; warehouse-specific options when relevant
- **Outputs:** ranked or filtered execution rows; may include `not_found`, `excluded_by_resource_types`, and `hints` when filters exclude ran nodes or combine with AND semantics
- **Done when:** the user has the executions needed for triage or drill-down

## Preconditions

- [`bind-target`](../bind-target/SKILL.md)
- [`check-session`](../check-session/SKILL.md) — `readiness: full` (requires `run_results.json`)

## Out of scope

- Run-level aggregates without per-node detail (use [`summarize-run`](../summarize-run/SKILL.md))
- Lineage graphs

## Implementation

See [references/implementation.md](references/implementation.md).
