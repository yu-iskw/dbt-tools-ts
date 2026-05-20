# Agent plugins (Codex, Cursor, and Claude Code)

This monorepo ships **first-party agent plugins** under `plugins/<plugin-id>/`. Each plugin uses a shared layout (per-engine manifests and a `skills/` tree). For vendor-specific packaging rules, see upstream docs: [Claude Code](https://code.claude.com/docs/en/plugins), [Codex](https://developers.openai.com/codex/plugins/build), and the [cursor/plugins](https://github.com/cursor/plugins) reference for Cursor.

**Referring to skills across plugins:** Use a **logical handle** `plugin-id:skill-directory` in docs and runbooks (for example `dbt-tools-cli:check-session`). That is **not** the YAML `name` inside `SKILL.md` — `name` must stay a single kebab-case segment matching the folder per the [Agent Skills specification](https://agentskills.io/specification). Hosts may add their own slash or picker prefix for plugin skills (see [dbt-tools-cli README](dbt-tools-cli/README.md#skill-handles-fqh) for vendor links).

## Prerequisites

- **Clone this repository** and use the **repository root** as the working directory for local marketplace commands below.
- **`dbt-tools-cli` plugin:** [`@dbt-tools/cli`](../packages/cli/README.md) on `PATH` when skills invoke CLI commands.
- **`dbt-tools-mcp` plugin:** Node.js and `npx` for the bundled MCP server; after install, set artifact roots with `dbt_tools_set_target` (see [dbt-tools-mcp README](dbt-tools-mcp/README.md) and [packages/mcp/REFERENCE.md](../packages/mcp/REFERENCE.md)). User-specific MCP env (GCS impersonation, etc.) belongs in your host MCP config, not in the plugin bundle.

## Installation

All three hosts read **repo-scoped marketplace catalogs** that point at `./plugins/dbt-tools-cli` and `./plugins/dbt-tools-mcp`. Install from a **local clone** (below) or, after this repo is on GitHub, add the same marketplace from a remote source.

### Local clone (recommended for development)

Run these steps from the **repository root** (`dbt-tools-ts/`).

#### Codex

Catalog: [`.agents/plugins/marketplace.json`](../.agents/plugins/marketplace.json) (marketplace name `dbt-tools-ts`).

```bash
# From repo root — register the repo marketplace
codex plugin marketplace add ./

# Restart Codex, then open the plugin directory, select marketplace
# "dbt-tools-ts (local)", and install:
#   - dbt-tools-cli
#   - dbt-tools-mcp
```

Alternatively, use the Codex UI: **Plugin directory** → add marketplace → choose the local repo → enable each plugin.

See [Codex plugins](https://developers.openai.com/codex/plugins) and [Build plugins](https://developers.openai.com/codex/plugins/build) for marketplace refresh and MCP policy.

#### Cursor

Catalog: [`.cursor-plugin/marketplace.json`](../.cursor-plugin/marketplace.json).

1. Open **Cursor Settings** → **Plugins** (or **Features** → **Plugins**, depending on version).
2. **Add marketplace** → point at this repository root (local folder) or at `https://github.com/yu-iskw/dbt-tools-ts` after publish.
3. Enable **`dbt-tools-cli`** and **`dbt-tools-mcp`** (project-scoped when working in this repo, or user-scoped if you want them everywhere).

Each plugin also has a manifest under `plugins/<plugin-id>/.cursor-plugin/plugin.json`. See [Cursor plugins](https://cursor.com/docs/plugins).

#### Claude Code

Catalog: [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) (marketplace name `dbt-tools-ts`).

In Claude Code, from the repository root:

```text
/plugin marketplace add .
/plugin install dbt-tools-cli@dbt-tools-ts
/plugin install dbt-tools-mcp@dbt-tools-ts
```

Plugin skills are namespaced by plugin id (for example `/dbt-tools-cli:check-session` — exact prefix depends on your Claude Code version).

See [Discover and install plugins](https://code.claude.com/en/discover-plugins) and [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces).

### Remote marketplace (GitHub)

After the catalog is on your default branch, you can register the repo without a local clone:

| Host            | Example                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------- |
| **Codex**       | `codex plugin marketplace add yu-iskw/dbt-tools-ts`                                          |
| **Claude Code** | `/plugin marketplace add yu-iskw/dbt-tools-ts` then install plugins `@dbt-tools-ts` as above |
| **Cursor**      | Add marketplace URL or GitHub repo in **Settings → Plugins**                                 |

Pin a ref if needed (`--ref main` for Codex; Claude supports `ref` / `sha` in marketplace sources per upstream docs).

## Plugin index

| Plugin id     | Path                    | Purpose                                                                                                    |
| ------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| dbt-tools-cli | `plugins/dbt-tools-cli` | Primitive skills for [`@dbt-tools/cli`](../packages/cli/README.md) — see [README](dbt-tools-cli/README.md) |
| dbt-tools-mcp | `plugins/dbt-tools-mcp` | Same primitives for [`@dbt-tools/mcp`](../packages/mcp/README.md) — see [README](dbt-tools-mcp/README.md)  |

---

**Contributors:** adding plugins, editing marketplaces, structural checks, Docker verification, and CI commands are documented in [`CONTRIBUTING.md`](CONTRIBUTING.md).
