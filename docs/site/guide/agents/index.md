# Agent skills

First-party **agent skills** for dbt-tools live under [`plugins/`](https://github.com/yu-iskw/dbt-tools-ts/tree/main/plugins) in the repository. Cursor, Codex, and Claude Code package them as **plugins**; each plugin ships the same eight primitive skill directory names with CLI or MCP implementations.

## Start here

- [Install agent skills](./install.md) — Cursor, Codex, and Claude Code (`dbt-tools-cli` + `dbt-tools-mcp`)
- [CLI vs MCP vs skills](./cli-vs-mcp-vs-skills.md) — which layer to use
- [Skill catalog](./skill-catalog.md) — handles and intents

Skills invoke the **CLI** or **MCP** on your machine depending on which plugin you enable. See [Wire your coding agent](../../workflows/wire-your-coding-agent.md).

Repository detail: [plugins README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/README.md).
