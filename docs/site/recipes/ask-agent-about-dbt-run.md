# Ask an agent about a dbt run

## When to use this

Use this recipe when you want a coding agent to query dbt artifacts on your behalf. This is useful for natural-language questions about run results, model explanations, lineage, and failure context without running CLI commands manually.

## Inputs required

- `manifest.json` and `run_results.json` under a target directory
- A coding agent that supports CLI invocation, MCP, or agent skills

## Choose your integration path

| Path                       | Best for                                     | Setup effort                   |
| -------------------------- | -------------------------------------------- | ------------------------------ |
| CLI commands via the agent | Ad-hoc questions in any coding agent session | Low — no server needed         |
| MCP server                 | Many follow-up questions in one session      | Medium — start `dbt-tools-mcp` |
| Agent skills               | Repeatable named operations in an IDE agent  | Low — install skills once      |

## Path A: CLI via the agent

Ask your coding agent to run CLI commands on your behalf. This requires no additional setup—if the agent can run shell commands, it can use `@dbt-tools/cli`.

Example prompt:

```text
Run: npx @dbt-tools/cli status --dbt-target ./target --json
Then explain what the output means for my dbt project health.
```

The agent executes the command, receives the JSON, and responds with an interpretation.

This works in Claude Code, Cursor, and any coding agent with shell tool access.

## Path B: MCP server

The MCP server parses the artifacts once and keeps them in memory for the session. This is faster for many follow-up queries and avoids re-reading files on each question. MCP requires **`manifest.json` and `run_results.json`** at the target root (no manifest-only session)—see [MCP getting started](../guide/mcp/getting-started.md#artifact-requirements).

Start the server:

```bash
npx @dbt-tools/mcp --dbt-target ./target
```

Then configure your coding agent to connect to it. See [Connecting clients](../guide/mcp/connecting-clients.md) for client-specific configuration.

Once connected, you can ask questions like:

- "What failed in the last dbt run?"
- "Which models depend on the orders model?"
- "What is the execution time for the top 10 slowest models?"
- "Explain what the fct_revenue model does."

The MCP server handles each question as a tool call against the already-parsed artifacts.

## Path C: Agent skills

Agent skills are pre-built named operations for Cursor, Codex, and Claude Code. Install them once and invoke them by name without writing raw CLI commands.

Install and configure skills: [Install agent skills](../guide/agents/install.md)

Example skill invocations:

- `dbt-tools-cli:check-session` — check artifact health
- `dbt-tools-mcp:bind-target` / `dbt_tools_set_target` — bind artifact root; repeat for another tag slice; `dbt_tools_clear_cached_targets` when done
- `dbt-tools-cli:find-resources` — search for a model by name
- `dbt-tools-cli:describe-resource` — explain a model or test
- `dbt-tools-cli:trace-dependencies` — find upstream or downstream deps

See the full [Skill catalog](../guide/agents/skill-catalog.md).

## Trust and safety

Before pointing an agent at dbt artifacts, review [Agent safety](../trust/agent-safety.md). Key points:

- The MCP server exposes everything returned by its tools to the coding agent.
- Coding agents may persist, summarize, or transmit returned metadata depending on their own settings.
- Use read-only artifact paths. Do not expose credentials in artifact environment metadata.
- Treat model names, error messages, and metadata as potentially sensitive in agent contexts.
- Use artifacts from a [public sample project](../guide/try-with-sample-project.md) for public examples or shared sessions.

## Safe example prompts

These prompts are appropriate for production artifact sessions:

- "What is the overall run status from the last dbt run?"
- "List the failed models from the last run."
- "Explain what the orders model does based on the manifest."
- "Which models depend on the customers model?"

Avoid prompts that ask the agent to write and execute arbitrary SQL or to read files outside the dbt target directory.

## Related

- [MCP getting started](../guide/mcp/getting-started.md)
- [Connecting clients](../guide/mcp/connecting-clients.md)
- [Install agent skills](../guide/agents/install.md)
- [CLI vs MCP vs skills](../guide/agents/cli-vs-mcp-vs-skills.md)
- [Agent safety](../trust/agent-safety.md)
- [MCP tools reference](../reference/mcp-tools.md)
