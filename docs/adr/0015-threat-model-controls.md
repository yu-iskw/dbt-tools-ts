# ADR-0015: Threat model and security controls

## Status

Accepted

## Context

Security controls were spread across AGENTS.md policy, per-call-site helpers, and surface-specific code. [RFC-0001](../rfc/RFC-0001-clean-slate-redesign.md) §6–§7 requires a written threat model with traceable controls and a change policy for security-relevant PRs.

## Decision

1. **Canonical threat model:** [docs/security/threat-model.md](../security/threat-model.md) — assets, trust boundaries (TB1–TB5), threat register (T1–T9), accepted out-of-scope risks, and PR update policy.
2. **Controls are constructive, not advisory:**

   | Threat                 | Primary control                                          |
   | ---------------------- | -------------------------------------------------------- |
   | T1 Path traversal      | `ArtifactRoot` / root-scoped fs capability (`core/node`) |
   | T2 Prototype pollution | `parseUntrustedJson`, `Map` collections, Zod at edges    |
   | T3 Resource exhaustion | Size caps, bounded output envelopes, server timeouts     |
   | T4 Stored XSS          | React escaping, no raw HTML in markdown, CSP             |
   | T5 Stale snapshots     | `SessionBinding` in unified `Workspace`                  |
   | T6 Local web abuse     | Loopback bind, Host/Origin checks, POST-only mutations   |
   | T7 MCP abuse           | stdio-only v1, read-only tool surface, schema validation |
   | T8 Supply chain        | Lockfile, `ignore-scripts`, OIDC publishing, CI scanners |
   | T9 Credential leakage  | Server-side providers only, redacted logging             |

3. **v1 product is read-only by construction** over user data (exports to user-chosen paths excepted); writable use cases require an ADR.
4. **Security-relevant PRs** (new deps, listeners, `core/node` boundary, publish pipeline) must update the threat-model doc or state why not.
5. **End-user hardening guidance** lives in [docs/site/trust/](../site/trust/) (not ADRs).

## Consequences

- Contributors review one threat register instead of inferring controls from RFC prose.
- ADRs record durable invariants; operational detail and tables stay in `docs/security/threat-model.md`.
- Node.js permission model (`--permission`) is docs-recommended smoke hardening, not default bin behavior (see production-hardening page).

## Related

- [docs/security/threat-model.md](../security/threat-model.md)
- [RFC-0001 §6–§8](../rfc/RFC-0001-clean-slate-redesign.md)
- [ADR-0013](0013-pure-default-core-and-node-boundary.md) — `core/node` boundary
- [ADR-0009](0009-npm-releases-authenticate-via-github-actions-oidc-trusted-publishing.md) — outbound supply chain
