# 5. Knip and ESLint layers for monorepo dead-code detection

Date: 2026-04-18

## Status

Accepted

## Context

This monorepo needs deterministic feedback on maintainability, dead code, and agent-made
changes. The legacy ADR set spread those concerns across separate records for lint
severity, plugin choice, coverage/test feedback, and monorepo dead-code detection.

The durable decision is not any single threshold table. It is that **quality gates are
multi-layered, repo-level, and intentionally blocking for both humans and coding
agents**.

## Decision

We keep a **layered, deterministic quality-gate model** anchored in living config and
documented operationally in `AGENTS.md`.

### Durable invariants

1. **ESLint and Knip answer different questions and are both required.**
   ESLint covers source-level correctness and structure; Knip covers unused exports,
   files, and dependency graph issues across the workspace.
2. **The ESLint layer includes structural unused-code checks, not just stylistic lint.**
   Production-source handling includes checks such as unused private class members so
   dead internal structure is treated as a correctness issue, not only a cleanup task.
3. **Knip is modeled around real workspace entry points.** The workspace graph is seeded
   from package entry modules, CLI surfaces, app entrypoints, tests, and e2e paths
   rather than only static library imports.
4. **Knip configuration intentionally distinguishes export ergonomics from dead code.**
   Settings such as `ignoreExportsUsedInFile` and targeted ignores are part of the
   design so static analysis signal stays useful in a pnpm monorepo.
5. **Repo-level quality gates are blocking signals.** Lint, dead-code detection, and
   related report scripts are not advisory-only for normal completion claims.
6. **Thresholds and rule matrices live in config, not in ADR text.** The ADR records
   why the layered model exists; exact values stay in living sources.
7. **Prefer fixing the underlying issue over growing ignore lists.** Ignores and
   exceptions remain targeted and justified.

## Consequences

**Positive:**

- Agents and maintainers see repeatable, machine-checkable quality feedback.
- Dead exports and orphaned files surface before they become historical clutter.
- Private structural cruft is caught before it becomes invisible maintenance debt.
- The ADR stays stable even as exact thresholds evolve.

**Negative / risks:**

- Stricter gates increase short-term authoring friction.
- Workspace-aware tools can produce false positives if entries and ignores drift from
  reality.

## Alternatives considered

- **ESLint only:** Rejected because it does not reliably cover unused exports and orphan
  files across the monorepo.
- **Document exact thresholds in the ADR:** Rejected because those values are volatile
  and belong in config plus `AGENTS.md`.
- **Keep gates advisory for agents:** Rejected because this repo intentionally uses
  deterministic blocking feedback.

## References

- Legacy provenance: ADR-0008, ADR-0009, ADR-0010, ADR-0031
- Living sources: [../../AGENTS.md](../../AGENTS.md), [../../eslint.config.mjs](../../eslint.config.mjs), [../../knip.json](../../knip.json)
