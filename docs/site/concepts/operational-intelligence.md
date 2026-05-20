# Operational Intelligence

**Operational intelligence** here means deterministic, structured signals derived from dbt artifacts—graphs, execution timelines, readiness snapshots, and discovery—without requiring an LLM to interpret raw JSON.

## Design principles

1. **Artifact-driven** — answers come from parsed `manifest.json` / `run_results.json`, not from chat.
2. **Deterministic** — same inputs produce the same structured outputs for CI and agents.
3. **Shared substrate** — a common analysis engine backs the CLI, MCP, and web interfaces for different workflows.
4. **Agent-friendly** — JSON, field filtering, and MCP resident caches reduce token churn.

## Where to read more

- [ADR-0008 — positioning and boundaries](https://github.com/yu-iskw/dbt-tools-ts/blob/main/docs/adr/0008-dbt-tools-operational-intelligence-and-positioning-boundaries.md)
- [ADR-0010 — shared discovery and deep links](https://github.com/yu-iskw/dbt-tools-ts/blob/main/docs/adr/0010-shared-discovery-ranker-intent-commands-and-cli-web-deep-links.md)
- Engineering ADRs: [`docs/adr/`](https://github.com/yu-iskw/dbt-tools-ts/tree/main/docs/adr)
