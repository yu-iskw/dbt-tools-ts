# Install on Codex

Shared prerequisites and skill handles: [Install plugins](./install.md).

## Steps

1. Work from a clone of this repository (Codex loads repo-scoped marketplaces).
2. Confirm [`.agents/plugins/marketplace.json`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.agents/plugins/marketplace.json) lists `./plugins/dbt-tools-cli`.
3. Let Codex discover plugins from that marketplace per [Codex plugin build docs](https://developers.openai.com/codex/plugins/build).
4. Verify `dbt-tools` is on PATH: `dbt-tools status --dbt-target ./target`.
5. Use handles such as `dbt-tools-cli:discover` in tasks—see [Skill catalog](./skill-catalog.md).

## Learn more

- [CLI vs MCP vs skills](./cli-vs-mcp-vs-skills.md)
- [Wire your IDE agent](../../workflows/wire-your-ide-agent.md)
