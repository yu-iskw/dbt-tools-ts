---
name: refresh-snapshot
description: Reload in-memory artifacts after dbt run or a known artifact change. Use on the same target without restarting MCP.
compatibility: dbt-tools MCP server enabled; bind-target already succeeded.
---

# Refresh snapshot

**Handle:** `dbt-tools-mcp:refresh-snapshot`

## Contract

- **Inputs:** none
- **Outputs:** updated status shape; `versionToken` may change; `stale` cleared on success
- **Done when:** `dbt_tools_refresh` has loaded or updated the in-memory snapshot for the bound target (`stale` cleared on success)

## Preconditions

- [`bind-target`](../bind-target/SKILL.md) succeeded for this target
- After **`dbt_tools_clear_cached_targets`**, call **`dbt_tools_refresh`** (or **`dbt_tools_set_target`** / an analysis tool) to reload artifacts into memory

## Out of scope

- Changing target URI (use [`bind-target`](../bind-target/SKILL.md))
- Changing GCS impersonation (restart MCP with new env)

## Implementation

See [references/implementation.md](references/implementation.md).
