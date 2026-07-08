# ADR-0014: Use-case registry as cross-surface contract

## Status

Accepted

## Context

CLI commands, MCP tools, and the web worker protocol each called `@dbt-tools/core` independently and shaped their own envelopes. Parity bugs and retrofitted MCP `outputSchema` (ADR-0012) showed that three hand-wired surfaces drift. [RFC-0001](../rfc/RFC-0001-clean-slate-redesign.md) centralizes every product operation in one registry.

## Decision

1. **`USE_CASE_REGISTRY` in `@dbt-tools/core` is the single cross-surface contract.** Each entry defines `name`, `title`, Zod `input`/`output` schemas (from `contracts/`), `read: 'snapshot'`, and a pure `run(snapshot, input)` handler.
2. **Surfaces are thin adapters only.** CLI (commander), MCP (SDK), and web worker translate flags/messages ↔ registry input/output; they do not reimplement analysis logic.
3. **v1 use cases are read-only over an immutable snapshot.** Adapters refuse to register handlers with `read` other than `'snapshot'` without an explicit ADR for writable operations.
4. **Shared output fields** (`versionToken`, `reasons`, `next_actions`, bounded payloads per ADR-0010) live in contract schemas so explainability is uniform across surfaces.
5. **Generated JSON Schema** from registry Zod (`pnpm schemas:sync` → `packages/core/generated/use-case-schemas.json`, Zod v4 `toJSONSchema()`) is committed for review and downstream docs; contract changes are semver-meaningful public API for CLI/MCP consumers.

Adding an operation is one registry file + contract tests; adapters pick it up without further wiring.

## Consequences

- Registry diff tests can verify CLI/MCP/web tool parity.
- Warehouse-specific execution filter shapes stay in discriminated contract unions, not flat option bags shared across adapters.
- The registry is an array and ~100-line adapters per surface — not a DI framework or runtime plugin system.

## Related

- [RFC-0001 §4.4](../rfc/RFC-0001-clean-slate-redesign.md) — registry design
- [ADR-0012](0012-protocol-native-mcp-resources-prompts-and-output-schemas.md) — MCP `outputSchema` at boundary
- [ADR-0010](0010-shared-discovery-ranker-intent-commands-and-cli-web-deep-links.md) — shared discovery and deep-link fields
- [packages/core/src/usecases/registry.ts](../../packages/core/src/usecases/registry.ts)
