# ADR-0013: Pure default core and Node boundary

## Status

Accepted

## Context

`@dbt-tools/core` historically exposed a Node-flavored default entry plus a `browser` facade. Surfaces that must stay browser-safe (web workers) depend on import discipline and lint to avoid pulling `node:fs` or cloud SDKs. [RFC-0001](../rfc/RFC-0001-clean-slate-redesign.md) proposes inverting this: browser-safety is the default; Node I/O is an explicit opt-in subpath.

## Decision

1. **Default `@dbt-tools/core` entry is pure and browser-safe.** No `node:*` imports, no cloud SDKs, no dynamic filesystem paths in the default export graph.
2. **`@dbt-tools/core/node` is the only Node I/O boundary.** Filesystem (`ArtifactRoot`), artifact sources (local, S3, GCS), `Workspace`, `SessionBinding`, and env config live under `core/node` and are exported via the `./node` subpath.
3. **Layer imports are enforced structurally:**

   | Layer        | May import                             | Must never import             |
   | ------------ | -------------------------------------- | ----------------------------- |
   | `contracts/` | Zod only                               | anything else                 |
   | `domain/`    | `contracts/`, graphology, parser types | `node:*`, cloud SDKs, `node/` |
   | `usecases/`  | `contracts/`, `domain/`                | `node:*`, cloud SDKs          |
   | `node/`      | layers above + `node:*`, cloud SDKs    | UI code                       |

4. **Surface import rules:** CLI, MCP, and web server import `core` + `core/node`. Web browser code and analysis workers import the pure `core` entry only (or `./browser` where that alias remains).
5. **Enforcement:** export map + ESLint `import-x/no-restricted-paths` + knip verify the table; we do not split into a second npm package.

`./browser` may remain as a documented alias of the safe subset during migration; new code should prefer the default pure entry.

## Consequences

- Wrong imports fail at build/lint time instead of breaking workers at runtime.
- Node-only code concentrates in `core/node`, shrinking the per-call-site `resolveSafePath` review surface.
- A second `@dbt-tools/core-runtime` package is rejected: subpath exports give the same boundary without version-sync overhead.

## Related

- [RFC-0001 §4.2](../rfc/RFC-0001-clean-slate-redesign.md) — package and layer design
- [ADR-0011](0011-session-binding-for-artifact-investigation.md) — `SessionBinding` in `core/node`
- [ADR-0004](0004-remote-object-storage-artifact-sources-and-auto-reload.md) — remote providers behind server boundary
