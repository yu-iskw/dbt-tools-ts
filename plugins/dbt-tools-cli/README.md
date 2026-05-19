# dbt-tools-cli (agent plugin)

First-party plugin wrapping the **[`@dbt-tools/cli`](../../packages/cli/README.md)** **structured interface** (JSON, `schema`, `status`) so coding agents and skills can orchestrate artifact analysis alongside other tools. Skills live under [`skills/`](skills/).

## Skill handles (FQH)

Each skill has a **logical handle** for docs and disambiguation when many plugins are installed:

```text
dbt-tools-cli:<skill-directory>
```

`<skill-directory>` is the kebab-case folder name under [`skills/`](skills/) (same string as YAML `name` in `SKILL.md`). The plugin id `dbt-tools-cli` matches [`plugins/dbt-tools-cli/.claude-plugin/plugin.json`](.claude-plugin/plugin.json) (and the other engine manifests).

**YAML `name`:** Keep a **single** kebab-case segment (e.g. `name: status`). Do **not** put `dbt-tools-cli:status` in frontmatter `name` — the [Agent Skills specification](https://agentskills.io/specification) and [VS Code Agent Skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills) forbid colons, slashes, and manual namespace prefixes in `name` (Copilot may **silently** skip invalid skills).

### Host compatibility (slash / picker)

- **FQH in this README** = documentation only; your editor may show a different slash token.
- **Claude Code:** Plugin skills use a `plugin-name:skill-name` namespace for collisions; see [Extend Claude with skills](https://code.claude.com/docs/en/skills).
- **VS Code + GitHub Copilot:** Plugin-distributed skills get a `/my-plugin:skill-name` style prefix from the product; see [Use Agent Skills in VS Code](https://code.visualstudio.com/docs/copilot/customization/agent-skills).
- **Cursor:** [Agent Skills](https://cursor.com/docs/skills) documents `/` + skill name; plugin-prefix wording may differ from VS Code’s page—follow the client you use.
- **Codex:** Explicit skill mention via `$` or `/skills`; plugin `name` is the package namespace — [Agent Skills](https://developers.openai.com/codex/skills), [Build plugins](https://developers.openai.com/codex/plugins/build).
- **Gemini CLI:** [Agent Skills](https://geminicli.com/docs/cli/skills/) aligns with the open standard; discovery via `/skills`.

| Handle                           | Skill                                                  | Purpose                                                                                                                   |
| -------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `dbt-tools-cli:status`           | [`status`](skills/status/SKILL.md)                     | **`dbt-tools status`:** readiness gate before other commands **and** investigation of presence, freshness, and readiness. |
| `dbt-tools-cli:discover`         | [`discover`](skills/discover/SKILL.md)                 | Resolve `unique_id` via `discover` / `search`.                                                                            |
| `dbt-tools-cli:deps`             | [`deps`](skills/deps/SKILL.md)                         | Dependency graph via `dbt-tools deps`.                                                                                    |
| `dbt-tools-cli:explain`          | [`explain`](skills/explain/SKILL.md)                   | Resource context and downstream blast radius (`explain` + `deps --direction downstream`).                                 |
| `dbt-tools-cli:query-executions` | [`query-executions`](skills/query-executions/SKILL.md) | Rank and filter run executions (time and warehouse adapter metrics).                                                      |

### MCP users

For Cursor/Claude hosts using **`dbt-tools-mcp`**, see [`packages/mcp/REFERENCE.md`](../../packages/mcp/REFERENCE.md) — same core primitives, different surface:

| CLI                   | MCP                            |
| --------------------- | ------------------------------ |
| `status`              | `dbt_tools_status`             |
| `discover` / `search` | `dbt_tools_search_resources`   |
| `deps`                | `dbt_tools_query_dependencies` |
| `explain`             | `dbt_tools_get_resource`       |
| `query-executions`    | `dbt_tools_query_executions`   |

See [plugins/README.md](../README.md) for marketplace layout and discovery. For verification, CI commands, and per-engine manifest maintenance, see [plugins/CONTRIBUTING.md](../CONTRIBUTING.md).
