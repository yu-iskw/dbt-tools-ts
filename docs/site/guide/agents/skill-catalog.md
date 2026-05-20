# Skill catalog

First-party skills ship in the **`dbt-tools-cli`** plugin. Each skill documents a workflow that runs **`dbt-tools` CLI** commands—see [CLI vs MCP vs skills](./cli-vs-mcp-vs-skills.md).

**Handle format:** `dbt-tools-cli:<skill-directory>` (for example `dbt-tools-cli:status`). Source files live under [`plugins/dbt-tools-cli/skills/`](https://github.com/yu-iskw/dbt-tools-ts/tree/main/plugins/dbt-tools-cli/skills) in the repository.

| Handle                           | You ask the agent to…                                                    | Runs                                         |
| -------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| `dbt-tools-cli:status`           | Check artifact presence, freshness, and readiness before other analysis  | CLI `status`                                 |
| `dbt-tools-cli:discover`         | Find resources by name, type, tag, or fuzzy wording; resolve `unique_id` | CLI `discover`                               |
| `dbt-tools-cli:explain`          | Summarize a resource and downstream blast radius                         | CLI `explain`, `deps --direction downstream` |
| `dbt-tools-cli:deps`             | Trace upstream/downstream dependencies or build order                    | CLI `deps`                                   |
| `dbt-tools-cli:query-executions` | Filter/sort executions (slow nodes, failures, warehouse metrics)         | CLI `query-executions`                       |

## Suggested order

1. `dbt-tools-cli:status` — gate before manifest/run commands.
2. `dbt-tools-cli:discover` — when the user gives a model name, not a `unique_id`.
3. `dbt-tools-cli:explain` or `dbt-tools-cli:deps` — investigation and impact.
4. `dbt-tools-cli:query-executions` — post-run performance triage.

## Related workflows

- [Check run health](../../workflows/check-run-health.md)
- [Find a model](../../workflows/find-a-model.md)
- [Explain a failure](../../workflows/explain-failure.md)
- [Wire your IDE agent](../../workflows/wire-your-ide-agent.md)

## Learn more

- [Install plugins](./install.md)
- [CLI README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/packages/cli/README.md) — underlying commands and flags
