# Wire your IDE agent

## Outcome

Your coding agent (Cursor, Codex, or Claude Code) can run dbt-tools workflows via first-party plugins and skills.

## When to use this

| Surface | Use when                                                                           |
| ------- | ---------------------------------------------------------------------------------- |
| CLI     | Skills invoke `dbt-tools` on your machine—you still need the CLI available on PATH |
| MCP     | Optional: long-lived `dbt-tools-mcp` for IDE tool calls over the same artifacts    |
| Web     | Optional: open investigation UI while the agent runs CLI skills                    |

## Prerequisites

- Node.js 20+ and artifacts under `target/` ([overview](../guide/overview.md))
- Clone or work inside this repository (or copy plugin paths into your project)

## Steps

1. Follow [Install plugins](../guide/agents/install.md) or [Cursor](../guide/agents/install-cursor.md) / [Codex](../guide/agents/install-codex.md) / [Claude](../guide/agents/install-claude.md).
2. Enable the `dbt-tools-cli` plugin from the repo marketplace paths.
3. Use handles from the [Skill catalog](../guide/agents/skill-catalog.md) (for example `dbt-tools-cli:status`, `dbt-tools-cli:discover`).
4. Optionally add MCP (`dbt-tools-mcp`) for repeated tool calls—see [Connecting clients](../guide/mcp/connecting-clients.md).

## Example

Ask your agent:

> Use `dbt-tools-cli:status` to check artifact readiness for `./target`, then `dbt-tools-cli:discover` for "orders".

## Next

- [CLI vs MCP vs skills](../guide/agents/cli-vs-mcp-vs-skills.md)
- [Skill catalog](../guide/agents/skill-catalog.md)
- [Agents overview](../guide/agents/)
- [plugins README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/README.md)
