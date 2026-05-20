# Install plugins

First-party **coding agent skills** for dbt-tools live under [`plugins/`](https://github.com/yu-iskw/dbt-tools-ts/tree/main/plugins) in this repository. Each plugin bundles skills that run **`dbt-tools` CLI** commands on your machine.

**Typical stack:** CLI for artifact access; **skills** for workflow prompts; **MCP** (`dbt-tools-mcp`) optional for IDE tool calls over the same artifacts.

See [CLI vs MCP vs skills](./cli-vs-mcp-vs-skills.md) and the [Skill catalog](./skill-catalog.md) for handles and when to use each layer.

## Prerequisites

- Node.js 20+ and `dbt-tools` on PATH (`npm install -g @dbt-tools/cli` or `npx`)
- dbt artifacts under `target/` ([overview](../overview.md))

Verify setup: `dbt-tools status --dbt-target ./target`

## Cursor

1. Open this repository in Cursor.
2. Enable **dbt-tools-cli** from [`.cursor-plugin/marketplace.json`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.cursor-plugin/marketplace.json) (see [`plugins/dbt-tools-cli/.cursor-plugin/plugin.json`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/dbt-tools-cli/.cursor-plugin/plugin.json)).
3. Optional: [MCP for Cursor](../mcp/connecting-clients.md) for tool calls instead of shell skills.

## Codex

1. Work from a clone of this repository.
2. Confirm [`.agents/plugins/marketplace.json`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.agents/plugins/marketplace.json) lists `./plugins/dbt-tools-cli`.
3. Follow [Codex plugin build docs](https://developers.openai.com/codex/plugins/build) to load the marketplace.

## Claude Code

1. Open the repository locally.
2. Register plugins per [Claude plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) using [`.claude/settings.json`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.claude/settings.json) and [`plugins/dbt-tools-cli/.claude-plugin/plugin.json`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/dbt-tools-cli/.claude-plugin/plugin.json).
3. See [Discover and install plugins](https://code.claude.com/en/discover-plugins).

## Learn more

- [Wire your IDE agent](../../workflows/wire-your-ide-agent.md)
- [Agents overview](./index.md)
- [plugins README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/README.md)
