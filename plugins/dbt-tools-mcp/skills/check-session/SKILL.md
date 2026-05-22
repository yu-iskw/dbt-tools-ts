---
name: check-session
description: Check MCP session state—target, load time, stale flag, runs, warehouse type. Use as a gate before analysis primitives.
compatibility: dbt-tools MCP server enabled; bind-target applied when target was null.
---

# Check session

**Handle:** `dbt-tools-mcp:check-session`

## Contract

- **Inputs:** none (uses current MCP workspace)
- **Outputs:** `target`, `loadedAtMs`, `stale`, `versionToken`, `runs[]`, `warehouse_type`; optional `lastRefreshError`, `cachedTargets`, `cachePolicy`, `fromCache` (on recent `set_target`)
- **Done when:** session state is clear and downstream primitives are safe to call

## Preconditions

- [`bind-target`](../bind-target/SKILL.md) when `target` was previously null

## Out of scope

- CLI-style `readiness` matrix (use CLI plugin for manifest-only preflight)
- Multi-step triage

## Implementation

See [references/implementation.md](references/implementation.md) and [references/session.md](references/session.md).
