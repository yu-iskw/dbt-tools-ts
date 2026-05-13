# 1. Record architecture decisions

Date: 2026-04-18

## Status

Accepted

## Context

This repository needs a stable place to record **enduring architectural decisions**:
choices that shape product boundaries, data flow, packaging, release trust, and the
rules future contributors should preserve.

The historical ADR corpus mixed durable decisions with tactical UI, styling, and workflow details. That made the record noisy for maintainers and coding agents and encouraged drift whenever paths or implementation details changed.

## Decision

We keep a **small curated ADR canon** under `docs/adr/` and treat it as the **only
canonical ADR location** for this repository.

### Durable rules

1. ADRs record **why** a significant decision exists: context, alternatives,
   trade-offs, consequences, and stable invariants.
2. ADRs do **not** duplicate volatile details that already belong in code, config,
   READMEs, or `AGENTS.md`, such as file inventories, token tables, lint thresholds,
   or tactical UI wiring.
3. Historical migration material is not a second canonical source of truth.
4. When older ADRs contain useful explanatory context but not an enduring decision,
   that content moves to `docs/architecture/` or other living docs instead of being
   preserved as a canonical ADR.

## Consequences

**Positive:**

- Future readers can find the repository's enduring decisions quickly.
- Coding agents see less misleading or stale architectural guidance.
- Operational detail stays in the sources that already own it.

**Negative / risks:**

- Some historical detail is no longer preserved as first-class ADR text.
- Curating the ADR set requires judgment about what is durable versus tactical.

## Alternatives considered

- **Keep the full historical ADR set as canonical:** Rejected because it preserves too
  much tactical churn and weakens signal quality.
- **Stop using ADRs and rely only on READMEs and code:** Rejected because major
  architectural intent and trade-offs become harder to find and easier to forget.

## References

- Canonical index: [README.md](./README.md)
- ADR authoring guidance: [../../.claude/skills/manage-adr/SKILL.md](../../.claude/skills/manage-adr/SKILL.md)
