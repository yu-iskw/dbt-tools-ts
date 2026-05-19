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

| Handle                               | Skill                                                          | Purpose                                                                                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dbt-tools-cli:dbt-artifacts-status` | [`dbt-artifacts-status`](skills/dbt-artifacts-status/SKILL.md) | **Pre-flight gate:** run `dbt-tools status` before other manifest/run_results workflows; enforce `readiness` branching and the sub-agent contract (pass parsed JSON downstream).        |
| `dbt-tools-cli:status`               | [`status`](skills/status/SKILL.md)                             | **Investigation:** user questions on artifact presence, freshness, and readiness; field-level JSON guidance. Use the gate skill above to block workflows until artifacts are confirmed. |
| `dbt-tools-cli:discover`             | [`discover`](skills/discover/SKILL.md)                         | Find dbt resources by name, type, tag, or approximate wording; resolve `unique_id` for downstream commands.                                                                             |
| `dbt-tools-cli:deps`                 | [`deps`](skills/deps/SKILL.md)                                 | Trace upstream and downstream dependencies for a dbt resource with `dbt-tools deps`.                                                                                                    |
| `dbt-tools-cli:query-executions`     | [`query-executions`](skills/query-executions/SKILL.md)         | Rank and filter run executions (time and warehouse adapter metrics).                                                                                                                    |
| `dbt-tools-cli:explain-deps`         | [`explain-deps`](skills/explain-deps/SKILL.md)                 | Explain a resource and downstream blast radius via `explain` + `deps --direction downstream`.                                                                                           |

### MCP users

For Cursor/Claude hosts using **`dbt-tools-mcp`**, see [`packages/mcp/REFERENCE.md`](../../packages/mcp/REFERENCE.md) (`dbt_tools_query_executions`, `dbt_tools_get_run_summary`, etc.) — same core primitives, different surface.

See [plugins/README.md](../README.md) for marketplace layout and discovery. For verification, CI commands, and per-engine manifest maintenance, see [plugins/CONTRIBUTING.md](../CONTRIBUTING.md).
