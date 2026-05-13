# 4. Remote object storage artifact sources and auto-reload

Date: 2026-04-18

## Status

Accepted

## Context

dbt-tools supports multiple ways to load artifacts: local developer workflows,
interactive browser-driven analysis, and remote scheduled-run investigation from
object storage. Legacy ADRs documented those paths in narrow slices such as default
target-directory handling, preload behavior, watch loops, environment-variable naming,
and remote object-store support.

The durable architecture is broader: artifact loading must preserve run integrity,
keep provider credentials out of the browser, and present one coherent source model to
humans and automation.

## Decision

We standardize artifact loading around a **shared discovery model** with **backend-owned
remote access** and **centralized dbt-tools configuration naming**.

### Source modes

The product recognizes three durable artifact-source modes:

1. **Upload** for ad hoc local analysis.
2. **Local preload** for trusted local development loops.
3. **Remote managed source** for backend-mediated object-storage discovery.

### Durable invariants

1. **dbt-tools-owned environment variables use the `DBT_TOOLS_` prefix.**
2. **Canonical and legacy env resolution can coexist during migration.** Implementations
   prefer canonical `DBT_TOOLS_*` names, but legacy `DBT_*` inputs may still be read
   with deprecation behavior rather than a hard break.
3. **Artifact discovery is location-oriented.** A source is expressed as a local
   directory or remote prefix, and the load flow standardizes on one source type plus
   one location string rather than ad hoc file picking.
4. **Remote providers stay behind a server-side adapter boundary.** The browser never
   needs S3 or GCS credentials and never talks to provider APIs directly.
5. **Artifact pairs are resolved as one run-scoped unit.** `manifest.json` and
   `run_results.json` must not be mixed across different runs.
6. **A remote run must be complete before it is eligible.** Newly discovered remote
   runs cannot become active until the backend confirms a complete artifact pair.
7. **Multi-run discovery requires explicit run choice.** When a location contains
   multiple complete pairs, the product does not silently pick one on the user's behalf.
8. **CLI and web share the discovery model but not the exact contract.** The interactive
   load flow supports discovery and run choice, while the CLI remains a stricter
   single-root loader for automation and CI.
9. **Local and remote freshness have different semantics.**
   Local dev flows may re-analyze immediately from trusted local files.
   Remote managed sources may detect a newer complete run automatically, but the active
   investigation switches only after explicit user confirmation.
10. **Discovery logic is shared where possible across surfaces.** The web app and CLI
    should align on artifact-resolution concepts even when the UI contract and CLI
    ergonomics differ.

## Consequences

**Positive:**

- One source model can serve local directories, S3, and GCS without leaking provider
  concerns into the browser.
- Users can investigate archived scheduled runs without manual file juggling.
- Configuration names are clearly owned by dbt-tools instead of being confused with dbt
  Core settings.
- Discovery remains safe for active investigations because remote freshness is
  detect-notify-confirm rather than silent session replacement.

**Negative / risks:**

- Remote-source support requires server-side infrastructure and polling behavior.
- Source discovery rules become a product contract that must stay consistent across
  packages.
- Local and remote refresh semantics differ, which must remain visible in the product.
- Backward-compatible env resolution must eventually be retired deliberately rather than
  drifting forever.

## Alternatives considered

- **Browser-direct cloud access:** Rejected because it pushes credentials and provider
  complexity into the client.
- **Fixed-object-only remote loading:** Rejected as the default because scheduled jobs
  often publish run-specific prefixes.
- **Keep legacy mixed `DBT_*` names indefinitely:** Rejected because they blur product
  ownership and create avoidable confusion.
- **Silently auto-select a run when discovery finds many:** Rejected because active
  investigation context should not change behind the user's back.

## References

- Legacy provenance: ADR-0012, ADR-0013, ADR-0014, ADR-0028, ADR-0029
- Product boundaries: [0008-dbt-tools-operational-intelligence-and-positioning-boundaries.md](./0008-dbt-tools-operational-intelligence-and-positioning-boundaries.md)
