# Install agent skills

First-party **agent skills** for dbt-tools live under [`plugins/`](https://github.com/yu-iskw/dbt-tools-ts/tree/main/plugins) in this repository. Host UIs package them as **plugins**; each plugin bundles a `skills/` tree with the same eight primitive skill names.

**Typical stack:** CLI or MCP for artifact access; **skills** for workflow prompts in Cursor, Codex, or Claude Code.

See [CLI vs MCP vs skills](./cli-vs-mcp-vs-skills.md) and the [Skill catalog](./skill-catalog.md) for handles and when to use each layer.

## Plugin pair

| Plugin id       | Prerequisites                              | Runs via                              |
| --------------- | ------------------------------------------ | ------------------------------------- |
| `dbt-tools-cli` | `dbt-tools` on PATH (`@dbt-tools/cli`)     | Shell / `dbt-tools` CLI commands      |
| `dbt-tools-mcp` | Node.js 20+ and `npx` for `@dbt-tools/mcp` | MCP tools (`dbt_tools_set_target`, …) |

Install **both** from the same repo marketplace when you want CLI skills and MCP tools with matching handles. MCP-only sessions still need `dbt_tools_set_target` per session (see [dbt-tools-mcp README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/dbt-tools-mcp/README.md)).

## Prerequisites

- Node.js 20+ and `dbt-tools` on PATH (`npm install -g @dbt-tools/cli` or `npx`)
- dbt artifacts under `target/` ([overview](../overview.md))

Verify setup: `dbt-tools status --dbt-target ./target`

## Cursor

Catalog: [`.cursor-plugin/marketplace.json`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.cursor-plugin/marketplace.json).

1. Open this repository in Cursor (or add the GitHub repo as a remote marketplace).
2. **Add marketplace** → repository root (local folder) or `https://github.com/yu-iskw/dbt-tools-ts`.
3. Enable **`dbt-tools-cli`** and **`dbt-tools-mcp`** (project-scoped in this repo, or user-scoped everywhere).

Plugin manifests: [`plugins/dbt-tools-cli/.cursor-plugin/plugin.json`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/dbt-tools-cli/.cursor-plugin/plugin.json), [`plugins/dbt-tools-mcp/.cursor-plugin/plugin.json`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/dbt-tools-mcp/.cursor-plugin/plugin.json).

Optional: [MCP for Cursor](../mcp/connecting-clients.md) to customize the bundled `dbt-tools-mcp` server beyond the plugin defaults.

## Codex

Catalog: [`.agents/plugins/marketplace.json`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.agents/plugins/marketplace.json) (marketplace name `dbt-tools-ts`).

From the repository root:

```bash
codex plugin marketplace add ./
```

Restart Codex, open the plugin directory, select marketplace **dbt-tools-ts (local)**, and install **`dbt-tools-cli`** and **`dbt-tools-mcp`**.

See [Codex plugin build docs](https://developers.openai.com/codex/plugins/build).

## Claude Code

Catalog: [`.claude-plugin/marketplace.json`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.claude-plugin/marketplace.json) (marketplace name `dbt-tools-ts`).

From the repository root:

```text
/plugin marketplace add .
/plugin install dbt-tools-cli@dbt-tools-ts
/plugin install dbt-tools-mcp@dbt-tools-ts
```

Also register via [`.claude/settings.json`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/.claude/settings.json) and [`plugins/dbt-tools-cli/.claude-plugin/plugin.json`](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/dbt-tools-cli/.claude-plugin/plugin.json) per [Claude plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces).

See [Discover and install plugins](https://code.claude.com/en/discover-plugins).

## Learn more

- [Wire your coding agent](../../workflows/wire-your-ide-agent.md)
- [Agents overview](./index.md)
- [plugins README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/README.md)
