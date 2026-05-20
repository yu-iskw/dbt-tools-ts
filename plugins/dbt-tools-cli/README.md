# dbt-tools-cli (agent plugin)

First-party plugin with **primitive agent skills** for [`@dbt-tools/cli`](../../packages/cli/README.md). Skills define a stable user contract; CLI subcommands are documented in each skill’s `references/implementation.md` and can change without renaming skills.

## Skill handles (FQH)

```text
dbt-tools-cli:<skill-directory>
```

YAML `name` in each `SKILL.md` matches the folder name only (no plugin prefix). See [Agent Skills](https://agentskills.io/specification).

| Handle                             | Skill                                                      | Purpose                                                     |
| ---------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| `dbt-tools-cli:bind-target`        | [`bind-target`](skills/bind-target/SKILL.md)               | Set artifact root (`--dbt-target` / `DBT_TOOLS_DBT_TARGET`) |
| `dbt-tools-cli:check-session`      | [`check-session`](skills/check-session/SKILL.md)           | Readiness gate and artifact freshness                       |
| `dbt-tools-cli:refresh-snapshot`   | [`refresh-snapshot`](skills/refresh-snapshot/SKILL.md)     | Re-check after `dbt run` (re-invoke on same target)         |
| `dbt-tools-cli:find-resources`     | [`find-resources`](skills/find-resources/SKILL.md)         | Resolve `unique_id`                                         |
| `dbt-tools-cli:describe-resource`  | [`describe-resource`](skills/describe-resource/SKILL.md)   | Resource metadata (`explain`)                               |
| `dbt-tools-cli:trace-dependencies` | [`trace-dependencies`](skills/trace-dependencies/SKILL.md) | Lineage / impact (`deps`)                                   |
| `dbt-tools-cli:query-executions`   | [`query-executions`](skills/query-executions/SKILL.md)     | Filter/sort executions                                      |
| `dbt-tools-cli:summarize-run`      | [`summarize-run`](skills/summarize-run/SKILL.md)           | Run-level summary (`run-summary`)                           |

## Skills are primitives

Compose sub-agents or parent workflows from stable handles. Examples:

```text
Run triage: bind-target → check-session → refresh-snapshot → query-executions → describe-resource
Change impact: bind-target → find-resources → describe-resource → trace-dependencies (downstream)
```

## MCP sibling plugin

Same eight skill **names** ship in [`plugins/dbt-tools-mcp`](../dbt-tools-mcp/README.md) with MCP tool implementations. Use MCP for long sessions over large artifacts; use this CLI plugin for one-shot shell/CI or manifest-only `status`.

See [plugins/README.md](../README.md) and [plugins/CONTRIBUTING.md](../CONTRIBUTING.md).
