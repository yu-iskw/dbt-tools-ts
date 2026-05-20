---
name: summarize-run
description: Summarize a dbt run (status breakdown, bottlenecks, adapter totals) without listing every node execution. Use before drill-down with query-executions.
compatibility: dbt-tools on PATH; run_results required (check-session readiness full).
---

# Summarize run

**Handle:** `dbt-tools-cli:summarize-run`

## Contract

- **Inputs:** bound artifact root only
- **Outputs:** run summary, status breakdown, bottlenecks, adapter-level totals
- **Done when:** the user has a run-level picture before per-node queries

## Preconditions

- [`bind-target`](../bind-target/SKILL.md)
- [`check-session`](../check-session/SKILL.md) — `readiness: full`

## Out of scope

- Per-node execution lists (use [`query-executions`](../query-executions/SKILL.md))
- Resource search

## Implementation

See [references/implementation.md](references/implementation.md).
