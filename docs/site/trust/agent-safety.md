# Agent safety

This page covers the risks and guardrails for using dbt-tools with AI agents through MCP or agent skills.

## How the MCP boundary works

The MCP server (`@dbt-tools/mcp`) is a tool surface that exposes parsed artifact data to an AI client. The architecture is:

```text
AI client (Cursor, Claude, Codex, etc.)
    ↓ tool calls
MCP server (dbt-tools-mcp)
    ↓ reads
dbt artifact files (manifest.json, run_results.json, …)
```

The MCP server controls what is returned. It cannot write to artifact files or issue warehouse queries. What it returns is determined by the tool schema and the content of the artifact files.

The AI client controls what happens next. The client may:

- Include returned data in its context window for subsequent reasoning
- Summarize or log returned data
- Transmit returned data to third-party services based on its own configuration

**dbt-tools does not control what an AI client does with tool responses.**

## Risks to understand

**Metadata exposure:** Artifact files may contain model names, column names, error messages, execution timing, project configuration, and environment metadata. Everything the MCP server returns from these files may appear in the AI client's context.

**Error message content:** SQL error messages from `run_results.json` may include table names, column names, and partial query text from your warehouse. These appear in the `error` field of explain output.

**Environment metadata:** If `DBT_ENV_CUSTOM_ENV_*` variables were set at dbt run time, their values appear in `manifest.json` and in MCP tool responses. Never set credentials or secrets as `DBT_ENV_CUSTOM_ENV_*` variables.

**Client data handling:** Some AI clients log tool responses, send them to a cloud API for inference, or include them in training data depending on the subscription plan and privacy settings. Review your AI client's data handling policy before connecting it to production artifacts.

**Prompt injection:** Model descriptions, column descriptions, and error messages come from artifact files and may contain text crafted by someone who contributed to the dbt project. Treat these fields as untrusted text in agent workflows. Do not auto-execute code or commands extracted from artifact content without review.

## Guardrails

**Use read-only artifact roots.** The MCP server and CLI only need read access to artifact files. Grant least-privilege credentials on the artifact prefix. See [Credentials](../deploy/credentials.md).

**Use sample-project artifacts for public examples.** Never share screenshots, blog posts, or recordings of sessions where production artifacts are visible. Use a [public sample project](../guide/try-with-sample-project.md) (e.g. jaffle_shop_duckdb) for all public-facing content.

**Separate dev and prod artifact roots.** Use different target roots for development and production runs. Avoid pointing an agent at production artifacts during development workflows.

**Review AI client privacy settings.** Before connecting the MCP server to a cloud AI client, review whether the client sends tool responses to the provider's inference API, whether it logs sessions, and what the provider's data retention policy is.

**Scope what the agent can ask.** Agent skills (`@dbt-tools/skills`) provide named operations with predictable inputs and outputs. They are safer than open-ended prompts that ask the agent to run arbitrary CLI commands.

**Monitor for unexpected behavior.** If an agent produces unexpected commands or requests access to files outside the artifact root, stop the session and review what data the agent received.

## Safe usage patterns

- Ask agents to summarize run status from `manifest.json` and `run_results.json`
- Ask agents to explain what a specific model does
- Ask agents to list dependencies of a named model
- Ask agents to identify the slowest models in a run

## Patterns to avoid

- Asking an agent to write and execute SQL based on artifact metadata
- Asking an agent to read files outside the `--dbt-target` directory
- Passing production artifact sessions to shared or untrusted AI clients
- Embedding credentials in prompts or in `DBT_ENV_CUSTOM_ENV_*` variables

## Related

- [Data boundaries](./data-boundaries.md)
- [Production hardening](./production-hardening.md)
- [Ask an agent about a dbt run](../recipes/ask-agent-about-dbt-run.md)
- [MCP getting started](../guide/mcp/getting-started.md)
- [CLI vs MCP vs skills](../guide/agents/cli-vs-mcp-vs-skills.md)
