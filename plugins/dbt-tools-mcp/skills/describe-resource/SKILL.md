---
name: describe-resource
description: Return metadata for one dbt resource by uniqueId. Use when explaining what a model, source, or test does.
compatibility: dbt-tools MCP server enabled; uniqueId from find-resources when unknown.
---

# Describe resource

**Handle:** `dbt-tools-mcp:describe-resource`

## Contract

- **Inputs:** `uniqueId`; optional `includeCode` (default false)
- **Outputs:** resource node details (description, metadata, optional SQL)
- **Done when:** the user understands the resource

## Preconditions

- [`bind-target`](../bind-target/SKILL.md)
- Loaded session via [`check-session`](../check-session/SKILL.md)

## Out of scope

- Downstream impact graph (use [`trace-dependencies`](../trace-dependencies/SKILL.md), `direction: downstream`)

## Implementation

See [references/implementation.md](references/implementation.md).
