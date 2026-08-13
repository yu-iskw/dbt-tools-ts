# Threat model (dbt-tools)

Distilled from [RFC-0001](../rfc/RFC-0001-clean-slate-redesign.md) §6–§7. This document is for contributors and security reviewers; end-user trust guidance lives in the [published trust docs](https://yu-iskw.github.io/dbt-tools-ts/trust/).

## Assets (value order)

1. **User machine and account** — CLI, MCP, and web-server run with invoking-user privileges.
2. **Cloud credentials** in the server process (S3/GCS provider chains).
3. **Artifact contents** — manifests may embed schema names, SQL, and business logic.
4. **Published package integrity** — four npm packages executed via `npx` by strangers.

## Trust boundaries

| Boundary         | Untrusted side              | Trusted side      | Primary controls                                                   |
| ---------------- | --------------------------- | ----------------- | ------------------------------------------------------------------ |
| TB1 Parse        | Artifact JSON/SQL           | dbt-tools process | Parser dispatch, `parseUntrustedJson`, Zod validation              |
| TB2 MCP input    | Agent-driven tool args      | MCP server        | stdio transport (SDK 2.0 dual-era), input/output schema validation |
| TB3 Local HTTP   | LAN / other local processes | Web server API    | Loopback bind, Host/Origin checks, POST-only mutations             |
| TB4 Supply chain | npm dependencies            | Installed tree    | Lockfile, `ignore-scripts`, release-age cooldown, scanners         |
| TB5 Filesystem   | User-supplied paths         | Read scope        | `ArtifactRoot` / `resolveSafePath` containment                     |

## Threat register

| ID  | Threat                                | Vector                                      | Control                                                                                               |
| --- | ------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| T1  | Path traversal / arbitrary file read  | CLI flags, MCP `set_target`, web source API | Root-scoped `ArtifactRoot`; realpath before containment check                                         |
| T2  | Prototype pollution from hostile JSON | `manifest.json` keys like `__proto__`       | Null-prototype parse; `Map` collections; Zod at edges                                                 |
| T3  | Resource exhaustion                   | Large artifacts, unbounded outputs          | Size caps, bounded output envelopes, server timeouts                                                  |
| T4  | Stored XSS in web UI                  | Artifact-sourced strings                    | React escaping; no raw HTML in markdown; CSP                                                          |
| T5  | Stale-snapshot answers                | Concurrent loads, remote polling            | `SessionBinding` in unified `Workspace`                                                               |
| T6  | Abuse of local web server             | DNS rebinding, cross-origin POST            | `127.0.0.1` default bind; Host/Origin validation                                                      |
| T7  | MCP abuse                             | Token passthrough, over-broad tools         | stdio-only (product v1, not MCP 2025-only); dual-era SDK 2.0; no listener; read-only analysis surface |
| T8  | Supply-chain compromise               | Dependencies or published packages          | OIDC trusted publishing; provenance; CI scanners                                                      |
| T9  | Credential leakage                    | Remote sources, debug logs                  | Server-side providers only; structured logging with redaction                                         |

## Out of scope (accepted risks)

- Malicious dbt project attacking the user who runs dbt (dbt's trust model).
- Attacker with the user's own OS privileges.
- Side-channel confidentiality between local processes.

## Change policy

PRs that add dependencies, open network listeners, touch `core/node` boundaries, or change the publish pipeline should update this table or document why not.
