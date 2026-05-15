# Agent plugins (Codex, Cursor, and Claude Code)

This monorepo ships **first-party agent plugins** under `plugins/<plugin-id>/`. Each plugin uses a shared layout (per-engine manifests and a `skills/` tree). For vendor-specific packaging rules, see upstream docs: [Claude Code](https://code.claude.com/docs/en/plugins), [Codex](https://developers.openai.com/codex/plugins/build), and the [cursor/plugins](https://github.com/cursor/plugins) reference for Cursor.

**Referring to skills across plugins:** Use a **logical handle** `plugin-id:skill-directory` in docs and runbooks (for example `dbt-tools-cli:status`). That is **not** the YAML `name` inside `SKILL.md` — `name` must stay a single kebab-case segment matching the folder per the [Agent Skills specification](https://agentskills.io/specification). Hosts may add their own slash or picker prefix for plugin skills (see [dbt-tools-cli README](dbt-tools-cli/README.md#skill-handles-fqh) for vendor links).

## How to use these plugins

### Codex

**Codex** loads plugins from a single repo-scoped marketplace:

- [`.agents/plugins/marketplace.json`](../.agents/plugins/marketplace.json)

Entries use local paths such as `./plugins/<plugin-id>` for first-party plugins in this repository.

### Cursor

**Cursor** uses the repo-scoped marketplace at [`.cursor-plugin/marketplace.json`](../.cursor-plugin/marketplace.json). Each plugin also has a [`.cursor-plugin/plugin.json`](dbt-tools-cli/.cursor-plugin/plugin.json) under `plugins/<plugin-id>/`.

### Claude Code

Per [Claude Code plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces), a **hosted** marketplace is often a root-level `marketplace.json` catalog.

**This monorepo does not commit a Claude-hosted root `marketplace.json`.** In-repo catalog JSON for **Codex** and **Cursor** lives in the files above. **Claude Code** consumes the same on-disk plugin directories under `plugins/<plugin-id>/` (for example [`plugins/dbt-tools-cli/.claude-plugin/plugin.json`](dbt-tools-cli/.claude-plugin/plugin.json)) via project or user configuration such as [`.claude/settings.json`](../.claude/settings.json).

To install or register plugins the way Claude’s docs describe (for example `/plugin marketplace add` with a path or URL), see [Discover and install plugins](https://code.claude.com/en/discover-plugins) and [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces).

## Plugin index

| Plugin id     | Path                    | Purpose                                                     |
| ------------- | ----------------------- | ----------------------------------------------------------- |
| dbt-tools-cli | `plugins/dbt-tools-cli` | Workflows for [`@dbt-tools/cli`](../packages/cli/README.md) |
| dbt-tools-mcp | `plugins/dbt-tools-mcp` | Workflows for [`@dbt-tools/mcp`](../packages/mcp/README.md) |

---

**Contributors:** adding plugins, editing marketplaces, structural checks, Docker verification, and CI commands are documented in [`CONTRIBUTING.md`](CONTRIBUTING.md).
