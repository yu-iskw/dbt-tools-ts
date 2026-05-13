# 2. Field-level lineage inference via AST parsing

Date: 2026-04-18

## Status

Accepted

## Context

dbt artifacts provide strong model-level lineage, but they do not natively expose the
field-level dependency information needed for deeper impact analysis and root-cause
investigation. This repository already implements field-lineage behavior and tests, so
leaving the capability undocumented would make the canonical ADR set incomplete.

We need a field-lineage model that stays aligned with the repository's artifact-first
positioning and does not depend on proprietary live-platform features.

## Decision

We infer **field-level lineage from compiled SQL in dbt artifacts** rather than relying
on proprietary or live-platform lineage systems.

### Durable invariants

1. **Compiled SQL is the primary source of truth for field lineage.** The lineage model
   is derived from artifact SQL rather than warehouse queries, IDE integrations, or
   hosted platform metadata.
2. **AST parsing is the inference mechanism.** Field-level relationships are inferred by
   parsing compiled SQL, resolving aliases and expressions, and mapping output fields
   back to upstream resource fields.
3. **Catalog metadata can refine inference but does not replace it.** Column metadata
   may help validate or label inferred fields, but the architectural choice is still
   SQL-driven inference from artifacts.
4. **Fallback remains model-level lineage when inference fails.** Parse failures or SQL
   edge cases must degrade gracefully rather than breaking broader dependency analysis.
5. **Field nodes remain part of the shared graph model.** Field lineage extends the same
   artifact-derived graph vocabulary used elsewhere in the repository instead of forming
   a separate incompatible subsystem.

## Consequences

**Positive:**

- Deepens artifact-driven lineage analysis without requiring live dbt Cloud, IDE, or
  warehouse integration.
- Supports impact analysis and provenance questions at a more useful level of detail.
- Keeps field-level behavior aligned with the repository's offline and CI-friendly
  positioning.

**Negative / risks:**

- SQL dialect differences and complex compiled queries make inference inherently
  imperfect.
- Parsing and resolution add computational cost beyond model-level lineage alone.
- Some edge cases will necessarily fall back to coarser lineage.

## Alternatives considered

- **Rely only on model-level lineage:** Rejected because it leaves important impact
  analysis questions unanswered.
- **Depend on proprietary or live-platform column-lineage systems:** Rejected because it
  conflicts with the repository's artifact-first and offline-friendly architecture.
- **Treat field lineage as a separate non-graph subsystem:** Rejected because it would
  fragment the shared analysis model.

## References

- Legacy provenance: ADR-0005
- Product boundaries: [0008-dbt-tools-operational-intelligence-and-positioning-boundaries.md](./0008-dbt-tools-operational-intelligence-and-positioning-boundaries.md)
