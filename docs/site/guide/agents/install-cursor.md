# Install on Cursor

Shared prerequisites and skill handles: [Install plugins](./install.md).

## Steps

1. Open this repository in Cursor (or ensure the workspace includes the repo root).
2. Confirm the marketplace file exists: [`.cursor-plugin/marketplace.json`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.cursor-plugin/marketplace.json).
3. Enable or install the **dbt-tools-cli** plugin from Cursor’s plugin/marketplace UI (repo-scoped catalog).
4. Verify `dbt-tools` is on PATH: `dbt-tools status --dbt-target ./target`.
5. Optional: add [MCP](../mcp/connecting-clients.md) for tool calls instead of shell-based skills.

Plugin manifest: [`plugins/dbt-tools-cli/.cursor-plugin/plugin.json`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/dbt-tools-cli/.cursor-plugin/plugin.json).

## Learn more

- [Skill catalog](./skill-catalog.md)
- [Wire your IDE agent](../../workflows/wire-your-ide-agent.md)
- [Cursor plugins reference](https://github.com/cursor/plugins)
