# CLI vs MCP vs skills

dbt-tools exposes three complementary layers. They are not interchangeable—pick based on how often you query the same artifact run and who invokes the tool.

## Comparison

| Layer                     | What it is               | Best for                                                 | Artifact access                        |
| ------------------------- | ------------------------ | -------------------------------------------------------- | -------------------------------------- |
| **CLI** (`dbt-tools`)     | One-shot shell commands  | CI, scripts, operators, skills running terminal commands | Loads (or re-downloads) per invocation |
| **MCP** (`dbt-tools-mcp`) | Long-lived stdio server  | IDE agents with many tool calls on one run               | Keeps parse resident in memory         |
| **Skills** (plugins)      | Packaged agent workflows | Natural-language tasks in Cursor, Codex, Claude          | Invokes **CLI** on your machine        |

## CLI

- JSON output, stable exit codes, `--fields` for smaller payloads.
- Each command is independent unless you reuse the same `--dbt-target`.
- See [Common CLI tasks](../cli/common-tasks.md) and [workflows](../../workflows/index.md).

## MCP

- Use when parse cost dominates (large manifest, remote S3/GCS target) and the client issues **many** queries.
- Configure clients to launch `dbt-tools-mcp` with the same artifact root as CLI.
- See [Connecting clients](../mcp/connecting-clients.md).

## Skills

- Skills are **prompt + procedure** bundles under `plugins/dbt-tools-cli/skills/`.
- Handles look like `dbt-tools-cli:discover` (plugin id + skill directory).
- They do **not** replace installing the CLI—`dbt-tools` must be on PATH.
- MCP is optional alongside skills when the IDE uses MCP tools instead of shell skills.

## Typical combinations

| You are…                                          | Start with                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| Running CI checks                                 | CLI only                                                                     |
| Using Cursor/Codex/Claude in this repo            | [Install plugins](./install.md) + skills                                     |
| Building a custom agent with dozens of tool calls | MCP (+ CLI for one-offs)                                                     |
| Exploring visually after terminal work            | CLI + `DBT_TOOLS_WEB_BASE_URL` ([deep links](../../reference/deep-links.md)) |

## Learn more

- [Skill catalog](./skill-catalog.md)
- [Install plugins](./install.md)
- [plugins README](https://github.com/yu-iskw/dbt-tools-ts/blob/main/plugins/README.md)
