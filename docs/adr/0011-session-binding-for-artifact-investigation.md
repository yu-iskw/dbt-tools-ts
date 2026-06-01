# ADR-0011: Session binding for artifact investigation

## Status

Accepted

## Context

Concurrent artifact loads (MCP target switches, web preload vs user load, remote poll vs configure, background refresh vs `setTarget`) can commit stale snapshots unless each surface discards work started under an older session.

Prior fixes introduced three parallel mechanisms (`loadGeneration`, `sessionGeneration`, `activeLoadGeneration`) without a shared name or contract.

## Decision

1. **`@dbt-tools/core` exports `SessionBinding`** (`captureSessionBinding`, `isSessionBindingCurrent`) as the canonical stale-session rule: match both `epoch` and `scopeKey` after every `await`.
2. **MCP `ArtifactWorkspace`** uses `loadGeneration` + `dbtTarget` as epoch/scope; all mutation paths capture a binding at start and call `bindingStillActive(binding)` after I/O.
3. **Web `ArtifactSourceService`** uses `sessionGeneration` as epoch; configure bumps generation so in-flight remote discovery cannot revert a new prefix. `GET /api/artifact-source` is read-only; poll uses `POST /api/artifact-source/refresh`.
4. **Web analysis worker** uses `activeLoadGeneration`; non-preload loads send `invalidate-pending-loads` before starting a new parse.
5. **Accept pending remote run** uses `POST /api/artifact-source/accept-pending-run` so switch + artifact bytes share one server transaction from the browser’s perspective.

## Consequences

- New surfaces should reuse `SessionBinding` types/helpers instead of inventing a fourth epoch scheme.
- Poll and status are split; callers that need fresh remote discovery must call refresh explicitly.
- `applyDiscoveredArtifactSource` uses `commitLoadedVersion: boolean` instead of inverted `syncLoadedVersion`.

## Related

- [ADR-0004](0004-remote-object-storage-artifact-sources-and-auto-reload.md) — detect / notify / confirm for remote runs
