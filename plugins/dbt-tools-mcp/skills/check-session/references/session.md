# MCP session vs CLI readiness

MCP loads **manifest.json** and **run_results.json** together when `dbt_tools_set_target` succeeds. There is no `manifest-only` MCP session.

| Situation                                         | Action                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| MCP server running, `loadedAtMs` set, not `stale` | Use analysis primitives                                                                          |
| `target` is null                                  | [`bind-target`](../../bind-target/SKILL.md)                                                      |
| `stale: true`                                     | [`refresh-snapshot`](../../refresh-snapshot/SKILL.md); read `lastRefreshError`                   |
| Only manifest exists locally                      | Use **dbt-tools-cli** [`check-session`](../../../../dbt-tools-cli/skills/check-session/SKILL.md) |
