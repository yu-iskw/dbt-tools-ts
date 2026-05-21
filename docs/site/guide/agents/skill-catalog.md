# Skill catalog

Two plugins share the same eight skill directory names:

| Plugin id       | Handle prefix    | Runs via        |
| --------------- | ---------------- | --------------- |
| `dbt-tools-cli` | `dbt-tools-cli:` | `dbt-tools` CLI |
| `dbt-tools-mcp` | `dbt-tools-mcp:` | MCP tools       |

**Handle format:** `plugin-id:<skill-directory>` (for example `dbt-tools-cli:check-session`). YAML `name` in each `SKILL.md` matches the folder only (no plugin prefix). Source files live under [`plugins/dbt-tools-cli/skills/`](https://github.com/yu-iskw/dbt-tools-ts/tree/main/plugins/dbt-tools-cli/skills) and [`plugins/dbt-tools-mcp/skills/`](https://github.com/yu-iskw/dbt-tools-ts/tree/main/plugins/dbt-tools-mcp/skills).

See [CLI vs MCP vs skills](./cli-vs-mcp-vs-skills.md) for when to use each plugin.

## dbt-tools-cli skills

| Handle                             | Intent                                                      | CLI (current)      |
| ---------------------------------- | ----------------------------------------------------------- | ------------------ |
| `dbt-tools-cli:bind-target`        | Set artifact root (`--dbt-target` / `DBT_TOOLS_DBT_TARGET`) | (flags / env)      |
| `dbt-tools-cli:check-session`      | Readiness gate and artifact freshness                       | `status`           |
| `dbt-tools-cli:refresh-snapshot`   | Re-check after `dbt run` (re-invoke on same target)         | `status`           |
| `dbt-tools-cli:find-resources`     | Resolve `unique_id`                                         | `discover`         |
| `dbt-tools-cli:describe-resource`  | Resource metadata                                           | `explain`          |
| `dbt-tools-cli:trace-dependencies` | Lineage / impact                                            | `deps`             |
| `dbt-tools-cli:query-executions`   | Filter/sort executions                                      | `query-executions` |
| `dbt-tools-cli:summarize-run`      | Run-level summary                                           | `run-summary`      |

Skill bodies: [`plugins/dbt-tools-cli/skills/`](https://github.com/yu-iskw/dbt-tools-ts/tree/main/plugins/dbt-tools-cli/skills). CLI subcommands are documented in each skill’s `references/implementation.md` and can change without renaming skills.

## dbt-tools-mcp skills

| Handle                             | Intent                                | MCP tool (current)             |
| ---------------------------------- | ------------------------------------- | ------------------------------ |
| `dbt-tools-mcp:bind-target`        | Set artifact root for the MCP session | `dbt_tools_set_target`         |
| `dbt-tools-mcp:check-session`      | Readiness gate and artifact freshness | `dbt_tools_status`             |
| `dbt-tools-mcp:refresh-snapshot`   | Re-check after `dbt run`              | `dbt_tools_refresh`            |
| `dbt-tools-mcp:find-resources`     | Resolve `unique_id`                   | `dbt_tools_search_resources`   |
| `dbt-tools-mcp:describe-resource`  | Resource metadata                     | `dbt_tools_get_resource`       |
| `dbt-tools-mcp:trace-dependencies` | Lineage / impact                      | `dbt_tools_query_dependencies` |
| `dbt-tools-mcp:query-executions`   | Filter/sort executions                | `dbt_tools_query_executions`   |
| `dbt-tools-mcp:summarize-run`      | Run-level summary                     | `dbt_tools_get_run_summary`    |

Skill bodies: [`plugins/dbt-tools-mcp/skills/`](https://github.com/yu-iskw/dbt-tools-ts/tree/main/plugins/dbt-tools-mcp/skills). Full tool reference: [MCP tools](../../reference/mcp-tools.md) and [`packages/mcp/REFERENCE.md`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/mcp/REFERENCE.md).

## Suggested composition

Compose workflows from stable handles (examples from the plugin READMEs):

1. `dbt-tools-cli:bind-target` — set artifact root before other skills.
2. `dbt-tools-cli:check-session` — gate before manifest/run commands.
3. `dbt-tools-cli:find-resources` — when the user gives a model name, not a `unique_id`.
4. `dbt-tools-cli:describe-resource` or `dbt-tools-cli:trace-dependencies` — investigation and impact.
5. `dbt-tools-cli:query-executions` — post-run performance triage.

Example chain: `bind-target` → `check-session` → `find-resources`

Run triage: `bind-target` → `check-session` → `refresh-snapshot` → `query-executions` → `describe-resource`

Change impact: `bind-target` → `find-resources` → `describe-resource` → `trace-dependencies` (downstream)

Use the same skill **names** with the `dbt-tools-mcp:` prefix when the host calls MCP tools instead of shell CLI.

## Related workflows

- [Check run health](../../workflows/check-run-health.md)
- [Find a model](../../workflows/find-a-model.md)
- [Explain a failure](../../workflows/explain-failure.md)
- [Wire your coding agent](../../workflows/wire-your-coding-agent.md)

## Learn more

- [Install agent skills](./install.md)
- [CLI README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md) — underlying commands and flags
- [plugins README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/README.md)
