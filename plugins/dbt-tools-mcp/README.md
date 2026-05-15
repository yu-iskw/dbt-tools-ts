# dbt-tools-mcp (agent plugin)

First-party plugin for **[`@dbt-tools/mcp`](../../packages/mcp/README.md)** — wiring the MCP server into Codex, Cursor, and Claude Code marketplaces. Skills live under [`skills/`](skills/).

## Skill handles (FQH)

```text
dbt-tools-mcp:<skill-directory>
```

| Handle                     | Skill                                      | Purpose                                          |
| -------------------------- | ------------------------------------------ | ------------------------------------------------ |
| `dbt-tools-mcp:mcp-server` | [`mcp-server`](skills/mcp-server/SKILL.md) | Start and configure the `dbt-tools-mcp` process. |

See [plugins/README.md](../README.md) for marketplace paths and [plugins/CONTRIBUTING.md](../CONTRIBUTING.md) for verification.
