# CLI vs MCP vs skills

dbt-tools exposes three complementary layers. They are not interchangeable—pick based on how often you query the same artifact run and who invokes the tool.

![agent skills invoke CLI or MCP; Web, CLI, and MCP each use the shared analysis library; Web is not driven by CLI or MCP.](/diagrams/surface-routing.svg)

Agent skills invoke CLI or MCP only. Web shares the same analysis library (`@dbt-tools/core`) and is not driven by CLI or MCP.

## Comparison

| Layer                     | What it is               | Best for                                                 | Artifact access                                       |
| ------------------------- | ------------------------ | -------------------------------------------------------- | ----------------------------------------------------- |
| **CLI** (`dbt-tools`)     | One-shot shell commands  | CI, scripts, operators, skills running terminal commands | Loads (or re-downloads) per invocation                |
| **MCP** (`dbt-tools-mcp`) | Long-lived stdio server  | Coding agents with many tool calls on one run            | Keeps parse resident in memory                        |
| **Skills** (plugins)      | Packaged agent workflows | Natural-language tasks in Cursor, Codex, Claude          | Via **`dbt-tools-cli`** or **`dbt-tools-mcp`** plugin |

## CLI

- JSON output, stable exit codes, `--fields` for smaller payloads.
- Each command is independent unless you reuse the same `--dbt-target`.
- See [Common CLI tasks](../cli/common-tasks.md) and [workflows](../../workflows/index.md).

## MCP

- Use when parse cost dominates (large manifest, remote S3/GCS target) and the client issues **many** queries.
- Long sessions can cache up to **three** parsed artifact roots by default; switch with repeated `dbt_tools_set_target` (no extra plugin skills—see [MCP tools](../../reference/mcp-tools.md)).
- Configure clients to launch `dbt-tools-mcp` with the same artifact root as CLI.
- See [Connecting clients](../mcp/connecting-clients.md) and [dbt-tools-mcp plugin README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/dbt-tools-mcp/README.md).

## Skills

- Primitive skills live under `plugins/dbt-tools-cli/skills/` and `plugins/dbt-tools-mcp/skills/` (same eight names).
- Handles look like `dbt-tools-cli:find-resources` (stable skill name; may run CLI `discover` today—see each skill’s `references/implementation.md`).
- **`dbt-tools-cli`** skills require `dbt-tools` on PATH; **`dbt-tools-mcp`** skills call MCP tools after `dbt_tools_set_target`.
- Install both plugins from the repo marketplace when you want shell skills and MCP tools with matching handles.

## Typical combinations

| You are…                                          | Start with                                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Running CI checks                                 | CLI only                                                                                       |
| Using Cursor/Codex/Claude in this repo            | [Install agent skills](./install.md) — `dbt-tools-cli` (+ optional `dbt-tools-mcp`)            |
| Building a custom agent with dozens of tool calls | MCP (+ CLI for one-offs)                                                                       |
| Exploring visually after terminal work            | CLI + `dbt-tools-web` + `DBT_TOOLS_WEB_BASE_URL` ([deep links](../../reference/deep-links.md)) |

## Learn more

- [Skill catalog](./skill-catalog.md)
- [Install agent skills](./install.md)
- [plugins README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/README.md)
