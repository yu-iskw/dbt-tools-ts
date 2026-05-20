---
name: find-resources
description: Find dbt resources by name, type, tag, package, or path. Use to resolve unique_id before describe-resource, trace-dependencies, or query-executions.
compatibility: dbt-tools on PATH; manifest required (check-session readiness not unavailable).
---

# Find resources

**Handle:** `dbt-tools-cli:find-resources`

## Contract

- **Inputs:** optional query text; optional filters (type, tag, package, path); paging limit
- **Outputs:** candidate resources with `unique_id` and enough metadata to disambiguate
- **Done when:** one `unique_id` is selected or the user chooses among candidates

## Preconditions

- [`bind-target`](../bind-target/SKILL.md)
- [`check-session`](../check-session/SKILL.md) — `readiness` not `unavailable`

## Out of scope

- Run triage narratives
- Downstream blast-radius essays

## Implementation

See [references/implementation.md](references/implementation.md).
