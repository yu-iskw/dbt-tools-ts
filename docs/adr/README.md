# Architecture Decision Records

`docs/adr/` is the **only canonical ADR corpus** for this repository.

The records here were curated from earlier dbt-tools history during the repository split. Historical source material is not a second architectural source of truth for humans or coding agents.

## Canonical ADR Set

- [0001](./0001-record-architecture-decisions.md) - ADR policy and canonical location
- [0002](./0002-field-level-lineage-inference-via-ast-parsing.md) - artifact-derived field-level lineage
- [0003](./0003-large-manifest-web-performance-dependency-index-and-lazy-sql.md) - analysis snapshot scalability and shared derivation invariants
- [0004](./0004-remote-object-storage-artifact-sources-and-auto-reload.md) - artifact loading, discovery, and remote-source semantics
- [0005](./0005-knip-and-eslint-layers-for-monorepo-dead-code-detection.md) - deterministic quality and dead-code gates
- [0006](./0006-timeline-includes-dbt-sources-via-snapshot-synthesis.md) - timeline and execution-analysis invariants
- [0007](./0007-first-party-coding-agent-plugins-and-repository-verification.md) - first-party coding-agent plugins and repository verification
- [0008](./0008-dbt-tools-operational-intelligence-and-positioning-boundaries.md) - product positioning and package boundaries
- [0009](./0009-npm-releases-authenticate-via-github-actions-oidc-trusted-publishing.md) - npm release trust model for `@dbt-tools/*` packages
- [0010](./0010-shared-discovery-ranker-intent-commands-and-cli-web-deep-links.md) - shared discovery ranker, intent CLI, web discover view, and CLI-web handoff
- [0011](./0011-session-binding-for-artifact-investigation.md) - session binding for artifact investigation
- [0012](./0012-protocol-native-mcp-resources-prompts-and-output-schemas.md) - protocol-native MCP resources, prompts, and output schemas
- [0013](./0013-pure-default-core-and-node-boundary.md) - pure default core entry and `@dbt-tools/core/node` boundary
- [0014](./0014-use-case-registry-cross-surface-contract.md) - use-case registry as single cross-surface contract
- [0015](./0015-threat-model-controls.md) - threat model pointer and constructive security controls
- [0016](./0016-mcp-sdk-v2-dual-era-stdio-without-http.md) - MCP SDK v2 dual-era stdio without HTTP

## Supporting Docs

- [../rfc/README.md](../rfc/README.md) — proposed designs (RFCs propose; ADRs record).
- [../architecture/web-investigation-workspace-evolution.md](../architecture/web-investigation-workspace-evolution.md) preserves useful non-ADR UI and workflow history.
- ADR authoring guidance lives in [../../.claude/skills/manage-adr/SKILL.md](../../.claude/skills/manage-adr/SKILL.md).
