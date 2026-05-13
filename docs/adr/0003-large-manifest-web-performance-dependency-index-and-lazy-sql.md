# 3. Large-manifest web performance: direct dependency index and lazy SQL

Date: 2026-04-18

## Status

Accepted

## Context

`@dbt-tools/web` must stay useful on very large manifests and large run-result corpora.
The main risk is not only React rendering; it is the cost of building, transporting,
and repeatedly deriving analysis state from artifact data.

The legacy ADR set captured several related choices separately: graph construction,
upstream build-order analysis, run-results search, large-manifest scaling, adapter
metrics, and materialization semantics. Those records all point to the same durable concern:
**shared analysis state must stay bounded, reusable, and cheap enough to serve both
the web UI and other consumers**.

## Decision

We treat the **analysis snapshot and worker protocol** as the primary scalability
boundary for large artifact sets.

### Durable invariants

1. **ManifestGraph is the shared graph substrate.** Core dependency analysis is built on
   a Graphology-backed DAG model, including graphology-dag support where topological
   ordering is required.
2. **Upstream build order is a first-class graph behavior.** The system supports
   topological build-order analysis for upstream dependency questions instead of treating
   dependency output as arbitrary traversal order.
3. **Bound broad snapshot data.** Snapshot-friendly dependency previews and summary
   counts represent **direct** neighbor context, not whole-graph reachability totals.
4. **Defer heavyweight per-resource payloads.** Large SQL text and similar heavy fields
   are loaded lazily or on demand instead of being shipped eagerly with every resource.
5. **Normalize shared execution semantics in core.** Cross-surface concepts that must
   mean the same thing in CLI, workers, and web views belong in `@dbt-tools/core`
   rather than being re-derived separately in UI code.
6. **Adapter-response metrics are normalized at the tools layer.** Warehouse feedback
   from `adapter_response` is treated as optional, normalized execution metadata that
   can be shared across CLI, web, and analysis snapshots without changing parser
   schemas.
7. **Materialization semantics are normalized from manifest data.** Materialization is a
   manifest-derived shared semantic model, not a view-local string convention or a
   `run_results`-owned field.
8. **Move global scans off the main thread when they grow with corpus size.**
   Search-style and other broad queries should use worker-backed or similarly bounded
   execution paths when eager main-thread scans stop scaling.
9. **Keep graph-derived analysis reusable.** The same core analysis structures should be
   able to feed the web app, CLI, and future automation surfaces without rebuilding
   incompatible parallel models.

## Consequences

**Positive:**

- Large manifests remain tractable without turning every UI interaction into a
  full-graph walk.
- Dependency queries can expose meaningful build-order semantics without inventing a
  second graph model.
- Web, CLI, and worker consumers share one analysis vocabulary.
- Payload size stays controlled even when compiled SQL is large.

**Negative / risks:**

- Direct-neighbor summaries are less expressive than transitive counts.
- Lazy payload fetching adds protocol and lifecycle complexity.
- Optional adapter metrics and normalized semantics add shared-model complexity that must
  stay intentional.
- New shared snapshot fields need discipline so the boundary does not become a dumping
  ground for one-off view concerns.

## Alternatives considered

- **Eager full-closure snapshot data:** Rejected because it scales poorly and duplicates
  work most views do not need.
- **Store all heavy fields in every resource row:** Rejected because it inflates worker
  memory and browser transfer costs.
- **Let each surface compute its own semantics locally:** Rejected because it invites
  drift between CLI, worker, and web behavior.

## References

- Legacy provenance: ADR-0002, ADR-0004, ADR-0007, ADR-0024, ADR-0027, ADR-0030, ADR-0033
- Related explanatory note: [../architecture/web-investigation-workspace-evolution.md](../architecture/web-investigation-workspace-evolution.md)
