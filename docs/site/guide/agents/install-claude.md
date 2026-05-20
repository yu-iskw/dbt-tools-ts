# Install on Claude Code

Shared prerequisites and skill handles: [Install plugins](./install.md).

## Steps

1. Clone or open this repository locally.
2. Register the plugin path per [Claude plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) (this repo does not commit a root hosted `marketplace.json`).
3. Use project settings such as [`.claude/settings.json`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.claude/settings.json) and [`plugins/dbt-tools-cli/.claude-plugin/plugin.json`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/dbt-tools-cli/.claude-plugin/plugin.json).
4. Verify `dbt-tools` is on PATH: `dbt-tools status --dbt-target ./target`.
5. Optional: configure MCP separately—skills still use the CLI.

See also [Discover and install plugins](https://code.claude.com/en/discover-plugins).

## Learn more

- [Skill catalog](./skill-catalog.md)
- [Wire your IDE agent](../../workflows/wire-your-ide-agent.md)
