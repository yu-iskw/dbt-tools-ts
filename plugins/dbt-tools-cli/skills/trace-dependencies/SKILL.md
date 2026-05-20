---
name: trace-dependencies
description: Trace upstream or downstream dependencies for a dbt resource. Use for lineage, build order, or downstream blast radius.
compatibility: dbt-tools on PATH; unique_id required.
---

# Trace dependencies

**Handle:** `dbt-tools-cli:trace-dependencies`

## Contract

- **Inputs:** `unique_id`; direction (`upstream` or `downstream`, CLI default `downstream`); optional depth; optional build order (upstream)
- **Outputs:** dependency graph or flat list suitable for the user question
- **Done when:** dependency neighborhood or build sequence is clear

## Preconditions

- [`bind-target`](../bind-target/SKILL.md)
- [`check-session`](../check-session/SKILL.md) — manifest present
- `unique_id` from [`find-resources`](../find-resources/SKILL.md) when unknown

## Out of scope

- Resource description prose (use [`describe-resource`](../describe-resource/SKILL.md))
- Execution metrics

## Implementation

See [references/implementation.md](references/implementation.md).
