# 7. First-party coding agent plugins and repository verification

Date: 2026-04-18

## Status

Accepted

## Context

This repository ships first-party skills and plugin layouts for multiple coding-agent
engines. Those engines differ in manifest shape and discovery conventions, but the repo
still needs one coherent plugin source tree and one repeatable verification story.

## Decision

We keep **one repository-owned plugin tree** with **engine-specific manifests** and a
verification model that always enforces structural checks while treating optional
vendor-specific validation as additive.

### Durable invariants

1. **Plugin source lives once.** Shared skills stay under one plugin root rather than
   being duplicated per vendor.
2. **Vendor manifest differences and discovery paths are explicit.** Each engine can
   have its own manifest shape and marketplace or configuration flow while sharing the
   same underlying skill tree.
3. **Codex and Cursor catalog alignment is itself an invariant.** When repository
   verification checks both catalogs, plugin ids and local paths must stay aligned.
4. **Structural verification is mandatory.** Repository layout, catalog alignment, and
   manifest integrity must be checked even when vendor CLIs are unavailable.
5. **Vendor validation is gated by preflight.** Run vendor-specific `plugin validate`
   style checks only when the relevant tool surface is actually available.
6. **Unavailable vendor validation soft-skips instead of failing structural checks.**
   If a vendor does not expose a usable validation surface, the repository still
   requires structural guarantees but does not fail solely for that absence.

## Consequences

**Positive:**

- The repo avoids duplicated plugin content across engines.
- Verification remains useful even when vendor tooling is uneven.
- Contributors have one place to maintain first-party agent skills.
- Catalog drift between Codex and Cursor is caught as a repository concern rather than a
  later integration surprise.

**Negative / risks:**

- Manifest divergence across vendors still creates maintenance cost.
- Marketplace alignment rules require discipline when adding or renaming plugins.
- Soft-skip behavior requires contributors to distinguish missing validation surfaces
  from real validation failures.

## Alternatives considered

- **Separate repository or tree per engine:** Rejected because it duplicates content and
  increases drift.
- **Require vendor CLI validation for every engine:** Rejected because the repo should
  not block on missing or immature upstream validation surfaces.

## References

- Legacy provenance: ADR-0034
- Operational docs: [../../plugins/README.md](../../plugins/README.md), [../../plugins/CONTRIBUTING.md](../../plugins/CONTRIBUTING.md)
