# Install plugins

First-party **coding agent skills** for dbt-tools live under [`plugins/`](https://github.com/yu-iskw/dbt-tools-ts/tree/main/plugins) in this repository. Each plugin bundles skills that run **`dbt-tools` CLI** commands on your machine.

**Typical stack:** CLI for artifact access; **skills** for workflow prompts; **MCP** (`dbt-tools-mcp`) optional for IDE tool calls over the same artifacts.

**Engine-specific steps:** [Cursor](./install-cursor.md) · [Codex](./install-codex.md) · [Claude Code](./install-claude.md)

See also [CLI vs MCP vs skills](./cli-vs-mcp-vs-skills.md) and the [Skill catalog](./skill-catalog.md).

## Skill handles

Use logical handles in docs and prompts, for example:

- `dbt-tools-cli:status`
- `dbt-tools-cli:discover`
- `dbt-tools-cli:explain`
- `dbt-tools-cli:deps`
- `dbt-tools-cli:query-executions`

The handle is `plugin-id:skill-directory`, not necessarily the YAML `name` inside each `SKILL.md`. See the [plugins README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/README.md).

## Prerequisites

- Node.js 20+ and `dbt-tools` on PATH (via `npm install -g @dbt-tools/cli` or `npx`)
- dbt artifacts under `target/` ([overview](../overview.md))

## Learn more

- [Wire your IDE agent](../../workflows/wire-your-ide-agent.md)
- [Agents overview](./index.md)
- [plugins README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/README.md)
- [plugins CONTRIBUTING](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/CONTRIBUTING.md) — for contributors
