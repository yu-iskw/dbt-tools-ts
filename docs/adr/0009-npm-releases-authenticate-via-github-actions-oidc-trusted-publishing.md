# 9. npm releases authenticate via GitHub Actions OIDC trusted publishing

Date: 2026-04-18

## Status

Accepted

## Context

Publishing npm packages from CI used to rely on long-lived automation tokens. Those
tokens increase blast radius, require rotation discipline, and are broader than a single
release actually needs.

This repository publishes `@dbt-tools/*` packages. Publish order still matters because these packages depend on a `dbt-artifacts-parser` version that must already exist on npm before the `@dbt-tools/*` release runs.

## Decision

We use **GitHub Actions OIDC trusted publishing** as the primary npm publish
authentication model.

### Durable invariants

1. **Publish authentication uses short-lived OIDC exchange instead of classic write
   tokens wherever trusted publishing is available.**
2. **Release jobs assume GitHub-hosted Actions for trusted publishing.** The publish
   path is designed around GitHub-hosted workflow support rather than self-hosted runner
   assumptions.
3. **Workflow trust stays intentionally scoped.** Publish workflows remain scoped so npm can bind package trust to exact workflow filenames with minimal surface area.
4. **Trusted publisher binding is exact-workflow scoped.** The specific workflow
   filename matters for npm trust, so workflow-file structure is part of the release
   architecture rather than an incidental implementation detail.
5. **Operational release order remains explicit.** `dbt-artifacts-parser` must already exist on npm before publishing dependent `@dbt-tools/*` releases.
6. **Publish jobs must assert a compatible npm CLI before release.** Minimum npm
   capability for trusted publishing should be checked explicitly rather than failing
   later with ambiguous auth errors.
7. **Registry-facing package metadata stays aligned with the publishing repository** so
   trusted-publisher validation succeeds.
8. **Trusted publishing improves downstream provenance.** The security model is not only
   about secret reduction; it also improves verifiability of public releases.

## Consequences

**Positive:**

- Publish credentials become short-lived and repository-bound.
- Trust is scoped to named release workflows instead of broad reusable secrets.
- The release model better matches npm's current security direction.
- Public releases gain clearer provenance and repo-bound trust signals.

**Negative / risks:**

- Trusted-publisher setup still requires correct off-repo npm configuration.
- Publish failures can occur if workflow filenames, npm CLI expectations, or package
  metadata drift from npm's requirements.
- The release path remains coupled to GitHub-hosted trusted-publishing support.

## Alternatives considered

- **Keep classic `NPM_TOKEN` as the default publish path:** Rejected because it leaves
  long-lived write secrets on the main release path.
- **Collapse all publish steps into one trusted workflow by default:** Rejected because
  it broadens the trusted workflow surface and couples unrelated release cadences.

## References

- Legacy provenance: ADR-0036
- Operational guidance: [../../AGENTS.md](../../AGENTS.md)
- Operational guidance: [../../AGENTS.md](../../AGENTS.md)
