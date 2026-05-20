---
name: check-session
description: Check whether dbt artifacts exist, are fresh, and which readiness level applies. Use as a gate before manifest- or run_results-based analysis.
compatibility: dbt-tools on PATH; artifact root bound via bind-target.
---

# Check session

**Handle:** `dbt-tools-cli:check-session`

## Contract

- **Inputs:** bound artifact root (from [`bind-target`](../bind-target/SKILL.md))
- **Outputs:** readiness (`full`, `manifest-only`, `unavailable`), artifact paths, ages, summary line
- **Done when:** readiness is reported and downstream primitives are allowed or blocked per level

## Preconditions

- [`bind-target`](../bind-target/SKILL.md) applied for this session

## Out of scope

- Multi-step run triage (compose with [`query-executions`](../query-executions/SKILL.md))
- Reloading after `dbt run` (use [`refresh-snapshot`](../refresh-snapshot/SKILL.md))

## Implementation

See [references/implementation.md](references/implementation.md) and [references/readiness.md](references/readiness.md).
