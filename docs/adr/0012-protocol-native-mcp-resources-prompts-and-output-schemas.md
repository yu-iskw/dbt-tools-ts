# ADR-0012: Protocol-native MCP resources, prompts, and output schemas

## Status

Accepted

## Context

`@dbt-tools/mcp` exposed ten composable tools with Zod input validation and dual JSON `content` / `structuredContent` responses, but did not publish tool output schemas or MCP resources and prompts. Agents and hosts had no stable `dbt-tools://` URIs for artifact context or user-invoked workflow templates.

## Decision

1. Add **`@dbt-tools/core/contracts`** (Zod v4) as the source of truth for tool and resource JSON shapes.
2. Register **`outputSchema`** on all ten existing tools; validate handler payloads at the MCP boundary (`DBT_TOOLS_VALIDATE_OUTPUT=0` to opt out).
3. Expose read-only **resources** (`dbt-tools://status`, `dbt-tools://runs/current/summary`) and **resource templates** for resource metadata, SQL (bounded), and dependencies.
4. Register five **prompts** (`triage_dbt_run`, `analyze_model_blast_radius`, `inspect_dbt_resource`, `optimize_dbt_run`, `review_artifact_snapshot`) that compose existing tools and resources.
5. Add optional **`ArtifactLoadProgress`** callbacks on `ArtifactWorkspace` and map them to MCP progress notifications when clients supply a `progressToken`.
6. Add **`pnpm smoke:mcp`** protocol smoke harness and document Inspector-based manual checks.

Backward compatibility: tool names and successful tool JSON shapes are unchanged. Resource JSON uses a new envelope with `versionToken` and `loadedAtMs`.

## Consequences

- MCP hosts can attach resources and list output schemas without new specialized tools.
- `ResourceNode` contract tests use permissive nested schemas to limit drift pain.
- Streamable HTTP, OAuth, roots, and resource subscriptions remain deferred.

## Related

- [packages/mcp/README.md](../../packages/mcp/README.md)
- [docs/site/reference/mcp-resources.md](../site/reference/mcp-resources.md)
- [docs/site/reference/mcp-prompts.md](../site/reference/mcp-prompts.md)
