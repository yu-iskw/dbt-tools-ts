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
- **Done when:** a snapshot is already loaded and `dbt_tools_refresh` (or background poll) updates it to match the latest artifacts on the bound target

## Preconditions

- [`bind-target`](../bind-target/SKILL.md) succeeded for this target
- A snapshot is loaded (after `bind-target`, an analysis tool, or `dbt_tools_set_target` with a full load). After **`dbt_tools_clear_cached_targets`**, call **`dbt_tools_set_target`** again or any analysis tool before expecting refresh to reload artifacts

## Out of scope

- Changing target URI (use [`bind-target`](../bind-target/SKILL.md))
- Changing GCS impersonation (restart MCP with new env)

## Implementation

See [references/implementation.md](references/implementation.md).
