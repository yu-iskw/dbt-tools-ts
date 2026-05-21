# Wire your coding agent

## Outcome

Your coding agent (Cursor, Codex, or Claude Code) can run dbt-tools workflows via first-party plugins and skills.

## When to use this

| Surface | Use when                                                                           |
| ------- | ---------------------------------------------------------------------------------- |
| CLI     | Skills invoke `dbt-tools` on your machine—you still need the CLI available on PATH |
| MCP     | Optional: long-lived `dbt-tools-mcp` for MCP tool calls over the same artifacts    |
| Web     | Optional: open investigation UI while the agent runs CLI skills                    |

## Steps

1. Follow [Install agent skills](../guide/agents/install.md) (sections for Cursor, Codex, or Claude).
2. Enable **`dbt-tools-cli`** (and optionally **`dbt-tools-mcp`**) from the repo marketplace paths.
3. Use handles from the [Skill catalog](../guide/agents/skill-catalog.md) (for example `dbt-tools-cli:check-session`, `dbt-tools-cli:find-resources`).
4. Optionally add MCP (`dbt-tools-mcp`) for repeated tool calls—see [Connecting clients](../guide/mcp/connecting-clients.md).

## Example

Ask your agent:

> Use `dbt-tools-cli:bind-target` for `./target`, then `dbt-tools-cli:check-session`, then `dbt-tools-cli:find-resources` for "orders".

## Next

- [CLI vs MCP vs skills](../guide/agents/cli-vs-mcp-vs-skills.md)
- [Skill catalog](../guide/agents/skill-catalog.md)
- [Agents overview](../guide/agents/index.md)
- [plugins README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/README.md)
