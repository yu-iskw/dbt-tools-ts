# 6. Timeline includes dbt sources via snapshot synthesis

Date: 2026-04-18

## Status

Accepted

## Context

The execution timeline is one of the product's highest-signal investigation surfaces.
Legacy ADRs captured several related concerns separately: dependency-edge visibility,
graph completeness, multi-hop context, test visibility, zooming, and synthesized
source rows.

Those records point to one durable theme: the timeline is not a raw dump of
`run_results.json`; it is a **bounded investigation view** derived from the manifest
graph and the analysis snapshot.

## Decision

We preserve the timeline as a **filtered, graph-aware execution-analysis surface** with
bounded context and explicit synthesis where raw artifacts are incomplete.

### Durable invariants

1. **Timeline rows come from the analysis snapshot, not only direct `run_results`
   entries.** When a dbt `source` materially participates in the executed DAG but lacks
   its own timed row, the snapshot may synthesize a source row rather than leaving that
   source invisible.
2. **Synthesized source rows are bounded by direct executed dependents.** Synthetic
   source timing is derived only from direct, already-timed dependents rather than a
   transitive DAG rollup.
3. **Synthetic timing is representative, not fabricated placeholder time.** Start and
   end windows are derived from dependent timing spans, and sources with no timed direct
   dependents are not rendered as placeholder rows.
4. **Project-scope filtering must stay robust to manifest/package mismatch.** The
   snapshot may use a package-scope fallback based on executed resources so in-scope
   sources are not dropped when manifest naming is misleading.
5. **Dependency context is graph-derived and bounded.** Timeline edges and related
   investigation context come from manifest-graph adjacency and only connect resources
   present in the current filtered bundle.
6. **Display aids do not change graph meaning.** Ranking, capping, toggles, zooming,
   and optional multi-hop context are readability tools, not alternate dependency
   semantics.
7. **The timeline optimizes for investigation over exhaustiveness.** Large runs may
   hide lower-value detail by default or require progressive interaction so the surface
   stays readable.

## Consequences

**Positive:**

- Users can reason about executed sources and dependency context even when dbt artifacts
  omit direct source timing.
- The timeline remains readable on large runs without pretending to be a full graph
  explorer.
- Core snapshot logic stays the single source of truth for timeline-relevant graph data.
- Synthetic rows remain tied to the executed run rather than becoming a manifest-wide
  placeholder catalog.

**Negative / risks:**

- Synthesized rows and bounded edge context require careful explanation to avoid being
  mistaken for raw artifact truth.
- Timeline defaults and display controls may evolve, which can surprise returning users
  if the invariants are not explained clearly.

## Alternatives considered

- **Use only raw run-result rows:** Rejected because important executed sources often
  disappear from the timeline entirely.
- **Render unbounded dependency context:** Rejected because the surface becomes too
  cluttered for real-world runs.
- **Treat timeline behavior as a pure UI detail:** Rejected because graph-derived
  synthesis and edge constraints are architectural contracts between core and web.

## References

- Legacy provenance: ADR-0018, ADR-0023, ADR-0024, ADR-0025, ADR-0026, ADR-0032
- Related scalability record: [0003-large-manifest-web-performance-dependency-index-and-lazy-sql.md](./0003-large-manifest-web-performance-dependency-index-and-lazy-sql.md)
