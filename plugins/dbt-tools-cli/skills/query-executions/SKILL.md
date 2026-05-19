---
name: query-executions
description: Filter and sort run_results executions by time and warehouse metrics using
  dbt-tools query-executions. Use for slow models, slot ms, bytes processed, test runtime,
  or triage with explicit status filters.
compatibility: dbt-tools on PATH; manifest.json and run_results.json under --dbt-target.
---

# Query run executions

**Skill handle (FQH):** `dbt-tools-cli:query-executions`

## When to use

- Post-run triage with explicit statuses (`error`, `fail`, `skipped`)
- Top slowest models or tests
- BigQuery slot ms or Snowflake row metrics leaders
- Per-resource execution lookup via `--unique-id-pattern`

## Workflow

1. When readiness is unknown, run [`dbt-artifacts-status`](../dbt-artifacts-status/SKILL.md) first.
2. Read `warehouse_type` from `dbt-tools status --json` when tuning adapter metrics.
3. Run ranked queries (see [references/commands.md](references/commands.md)).
4. Optional totals: `dbt-tools run-summary --dbt-target ./target --json`.
5. Drill down with [`discover`](../discover/SKILL.md), [`deps`](../deps/SKILL.md), or [`explain-deps`](../explain-deps/SKILL.md).

## Related documentation

- [references/commands.md](references/commands.md)
- [packages/cli/README.md](../../../../packages/cli/README.md)
