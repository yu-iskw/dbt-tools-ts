# 10. Shared discovery ranker, intent commands, and CLI-web deep links

Date: 2026-04-19

## Status

Accepted

## Context

Operators, CI, and coding agents need a **single artifact-grounded contract** to resolve
ambiguous resource names, understand _why_ a node ranked, and chain into follow-up
analysis without re-implementing scoring in each interface.

Previously, CLI **`search`** and ad-hoc lookups did not share one explainable ranker with
the web app, there was no first-class **discover** workspace, and there was no stable
pattern for **intent-shaped** commands (summarize, impact, diagnose, export) with
provenance, optional transcripts, or **deterministic deep links** back into the web UI.

This ADR records how dbt-tools addresses that gap while staying consistent with
[ADR 8](./0008-dbt-tools-operational-intelligence-and-positioning-boundaries.md): one
core substrate, structured CLI, deterministic web.

## Decision

### 1. Shared discovery in `@dbt-tools/core`

- A **discovery** module owns normalized types, query token parsing (`type:`, `tag:`,
  etc.), ranking (`discoverResources`), and machine-stable **`reasons`**, optional
  disambiguation peers, related graph hints, **`next_actions`**, and
  **`primitive_commands`** for reproducible follow-ups.
- The ranker is **browser-safe** where feasible (exported via the package `browser`
  entry) so the web worker can apply the **same contract** as the CLI without divergent
  logic.
- **Filter-only** queries (empty free text with structured filters) are supported when
  at least one structured filter is present, so list-like discovery stays coherent with
  CLI flags and inline tokens.

### 2. CLI: discover, refactored search, intents, handoff

- **`dbt-tools discover`** exposes the shared ranker; **`search`** reuses shared parsing
  / filtering primitives without breaking its existing output shape where required.
- **Intent commands** (`explain`, `impact`, nested `diagnose`, `export`) sit _above_
  primitives: they resolve targets via **`resolveIntentTarget`** (full `unique_id` or
  discover-backed resolution), emit **structured JSON envelopes** (contract version,
  provenance steps, suggested primitives), and stay suitable for agents.
- **Deep links:** when **`DBT_TOOLS_WEB_BASE_URL`** is set, JSON (and human output where
  applicable) may include **`web_url`** / **`review_url`** built from small URL helpers
  so operators can open the same resource or discover query in **`@dbt-tools/web`**.
- **`--trace`** may attach a minimal **`investigation_transcript`** for debugging and
  agent audits without changing the default payload shape.

### 3. Web: discover workspace and worker parity

- The web app exposes **`view=discover`** with URL **`q=`** state kept in sync with the
  workspace navigation model.
- The analysis **worker** implements a **`discover-resources`** message that runs the
  same ranking entry point as the CLI, preserving **CLI ↔ web parity** for discovery
  results.
- The discover UI offers lightweight **handoff** affordances (e.g. copy equivalent CLI
  and page URL) so humans can move between browser and terminal without retyping queries.

### 4. Introspection and stability

- Command schemas from **`dbt-tools schema`** carry a **`stability`** label
  (**core** / **evolving** / **experimental**) so consumers can treat **intent** commands
  as more volatile than long-stable primitives where appropriate.

## Consequences

**Positive:**

- One ranking and explainability story across **CLI, worker, and UI**.
- Intent outputs are easier for **agents** to consume (envelope, provenance, primitives,
  optional transcript, optional web URLs).
- Deep links reduce friction between **terminal and investigation UI** when a base URL
  is configured.

**Negative / risks:**

- **Contract evolution** (`discover_schema_version`, intent `contract_version`) must stay
  explicit when fields are added or renamed; clients should tolerate unknown keys.
- **Web base URL** is deployment-specific; misconfiguration yields broken links rather
  than silent fixes.
- **Test and worker surface area** grows (URL sync, worker protocol, intent JSON); CI
  must keep covering these paths.

## Amendment — Web discover workspace removed

The dedicated browser **Discover** workspace (`view=discover`) and the analysis worker **`discover-resources`** message were **removed** from `@dbt-tools/web`. **Shared ranking in `@dbt-tools/core`**, **`dbt-tools discover`**, and **CLI JSON `web_url` / `review_url`** remain; deep links from `discover` now target **`view=inventory`** with optional **`q=`**. Legacy bookmarks **`?view=discover`** are mapped to **Inventory**, and **`q`** seeds the inventory list filter when present.

## References

- [0008 — dbt-tools operational intelligence and positioning boundaries](./0008-dbt-tools-operational-intelligence-and-positioning-boundaries.md)
- [0003 — Large manifest web performance, dependency index, and lazy SQL](./0003-large-manifest-web-performance-dependency-index-and-lazy-sql.md)
- [0005 — Knip and ESLint layers for monorepo dead-code detection](./0005-knip-and-eslint-layers-for-monorepo-dead-code-detection.md)
