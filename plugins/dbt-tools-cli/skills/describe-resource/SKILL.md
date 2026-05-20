---
name: describe-resource
description: Return metadata and context for one dbt resource by unique_id. Use when explaining what a model, source, or test does.
compatibility: dbt-tools on PATH; unique_id from find-resources when not already known.
---

# Describe resource

**Handle:** `dbt-tools-cli:describe-resource`

## Contract

- **Inputs:** `unique_id`
- **Outputs:** description, resource metadata, lineage context fields from CLI JSON
- **Done when:** the user understands what the resource represents

## Preconditions

- [`bind-target`](../bind-target/SKILL.md)
- [`check-session`](../check-session/SKILL.md) — manifest present
- `unique_id` resolved via [`find-resources`](../find-resources/SKILL.md) if needed

## Out of scope

- Full downstream impact surface (use [`trace-dependencies`](../trace-dependencies/SKILL.md) with `downstream`)
- Execution timing or failures

## Implementation

See [references/implementation.md](references/implementation.md).
