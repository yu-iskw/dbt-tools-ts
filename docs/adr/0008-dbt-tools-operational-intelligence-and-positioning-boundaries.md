# 8. dbt-tools operational intelligence positioning and category boundaries

Date: 2026-04-18

## Status

Accepted

## Context

dbt-tools needs a durable product and architecture story that matches what the software
actually does and keeps future docs honest. The legacy ADR set expressed this through a
mix of package naming, artifact-first positioning, web-workspace evolution, and public
messaging. That history was valuable, but split across too many records.

## Decision

dbt-tools is a **dbt operational intelligence layer** built from dbt artifacts, and this repository's packages align around that role, while `dbt-artifacts-parser` remains an external parser dependency.

### Product thesis

dbt-tools turns dbt artifacts into **deterministic operational intelligence** for humans
and agents.

### Package roles

| Package                | Role                                                                                                                                            |
| :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| `dbt-artifacts-parser` | External npm dependency and upstream parser package for dbt artifacts.                                                                          |
| `@dbt-tools/core`      | Reusable analysis substrate: graph construction, execution analysis, snapshots, exports, and shared logic.                                      |
| `@dbt-tools/cli`       | Structured interface for operators, CI, scripts, and coding agents: machine-readable output, introspection, bounded payloads, validated inputs. |
| `@dbt-tools/web`       | Deterministic investigation UI for dependency, lineage, execution, inventory, and health analysis.                                              |

### Messaging pillars

1. **Structured artifact intelligence** — dbt artifacts become dependency, execution,
   inventory, and readiness answers rather than static files.
2. **Human + agent interface** — the same substrate serves operators, automation, CI,
   scripts, and coding-agent workflows.
3. **Actionable without AI** — the web app must remain valuable without a chat surface
   or LLM dependency.
4. **Local-first / controlled-environment operation** — local artifact paths are the
   default, and remote access is explicit configuration rather than a hosted SaaS model.

### Durable invariants

1. **Artifact-first by default.** Core value comes from `manifest.json`,
   `run_results.json`, `catalog.json`, and related artifacts rather than live platform
   APIs or LSP-backed editor features.
2. **Artifact-only scope remains explicit.** The product is designed for offline, local,
   CI, and archived-artifact workflows without dbt CLI passthrough, Cloud APIs, or
   LSP dependencies as core requirements.
3. **Useful without an LLM.** `@dbt-tools/web` is a deterministic investigation UI, not
   a chat surface as its primary value proposition.
4. **Human and agent interfaces share one substrate.** `@dbt-tools/core` is a reusable
   analysis engine; `@dbt-tools/cli` and `@dbt-tools/web` are structured interfaces on
   top of that same substrate.
5. **Non-overlap with official dbt tools stays explicit.** dbt-tools does not replace
   dbt-mcp, the dbt VS Code extension, Semantic Layer tooling, SQL execution, or hosted
   platform capabilities.
6. **Category boundaries stay explicit.** dbt-tools is not a hosted dbt platform clone,
   not an observability SaaS clone, and not "AI for dbt" as the headline.

## Consequences

**Positive:**

- Contributors and readers have one clear answer to "what is this project?"
- The web app, CLI, and core package can evolve without drifting into conflicting
  product stories.
- Docs can distinguish complementary tools from true product scope.
- Package boundaries stay legible for both maintainers and future integrators.

**Negative / risks:**

- Positioning language must be refreshed when capabilities materially expand.
- Historical tactical UX records no longer stand alone as canonical ADRs.
- Stronger scope statements mean future feature work has to remain honest about what the
  project does not own.

## Alternatives considered

- **Keep separate product, package, and workspace-shape ADRs as the main canon:**
  Rejected because the signal is fragmented and repetitive.
- **Define the project primarily as an AI/copilot product:** Rejected because the core
  value is deterministic artifact analysis, with AI as an additive interface.
- **Position the web app as a hosted platform or observability control plane:** Rejected
  because it implies product scope the repository does not own.

## References

- Legacy provenance: ADR-0003, ADR-0006, ADR-0011, ADR-0017, ADR-0018, ADR-0035
- Supporting note: [../architecture/artifact-console-boundaries.md](../architecture/artifact-console-boundaries.md)
