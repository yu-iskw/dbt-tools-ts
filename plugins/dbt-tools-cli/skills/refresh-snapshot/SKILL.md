---
name: refresh-snapshot
description: Confirm artifacts are up to date after dbt run or a known artifact change. Use before re-running analysis on the same target.
compatibility: dbt-tools on PATH; bind-target and check-session already applied.
---

# Refresh snapshot

**Handle:** `dbt-tools-cli:refresh-snapshot`

## Contract

- **Inputs:** bound artifact root unchanged
- **Outputs:** confirmation that a new `status` reflects current files (ages / readiness)
- **Done when:** user or agent can trust subsequent analysis uses the latest artifacts

## Preconditions

- [`bind-target`](../bind-target/SKILL.md)
- User ran `dbt` or artifacts were updated externally

## Out of scope

- Changing artifact root (use [`bind-target`](../bind-target/SKILL.md))
- Per-node execution triage

## Implementation

See [references/implementation.md](references/implementation.md).
