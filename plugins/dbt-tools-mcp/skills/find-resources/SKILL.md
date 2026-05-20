---
name: find-resources
description: Find dbt resources by name, type, tag, package, or path. Use to resolve uniqueId before describe-resource, trace-dependencies, or query-executions.
compatibility: dbt-tools MCP server enabled; bind-target and loaded session.
---

# Find resources

**Handle:** `dbt-tools-mcp:find-resources`

## Contract

- **Inputs:** optional query text; optional filters (type, tag, package, path); paging limit and offset
- **Outputs:** candidate resources with `unique_id` and metadata
- **Done when:** one `uniqueId` is selected or the user disambiguates

## Preconditions

- [`bind-target`](../bind-target/SKILL.md)
- [`check-session`](../check-session/SKILL.md) — loaded snapshot

## Out of scope

- Run triage narratives
- Impact essays

## Implementation

See [references/implementation.md](references/implementation.md).
