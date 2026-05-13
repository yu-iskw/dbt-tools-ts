# Web Investigation Workspace Evolution

This note preserves useful **non-canonical** history from the legacy ADR migration.
It is intentionally explanatory, not normative. The canonical architectural decisions
live in `docs/adr/`.

## Why this exists

Several legacy ADRs documented tactical evolution of `@dbt-tools/web`: the first MVP,
controller/view layering, responsive behavior, information architecture changes,
styling/token work, decomposition of oversized views, and timeline interaction details.

Those records were useful context, but they were too implementation-shaped to remain in
the curated ADR canon.

## Main takeaways from the legacy set

### Workspace shape

- The web app evolved from a simple artifact viewer into a workflow-oriented
  investigation workspace.
- Shared controller state and cross-view selection mattered more than route count or
  page taxonomy.
- Dense inspection surfaces outperformed dashboard-like decoration for real dbt
  investigation tasks.

### Workflow-first workspace evolution

- The product shifted from page-oriented artifact viewing toward an investigation flow
  where selection, filters, and provenance remain meaningful across multiple surfaces.
- The app shell, inspector, and shared actions became part of the workflow model rather
  than mere chrome around disconnected screens.
- The web stack itself was not the problem to replace; the information flow and shared
  controller state were the primary design levers.

### Catalog and runs information architecture

- The legacy UI moved toward a hybrid model with a clearer split between:
  - **catalog-style asset discovery and inspection**
  - **runs-style execution triage and timeline analysis**
- This was driven by recurring user questions:
  what is unhealthy, what is this asset, and where should I investigate next.
- The product direction favored dbt-native terminology and artifact-grounded inspection
  rather than cloning observability control planes.

### Why dense inspection beat dashboard framing

- Investigation tasks benefited more from tables, inspectors, lineage context, and
  direct next-step cues than from large decorative summary cards.
- The most useful overview surfaces were the ones that routed a user toward failures,
  bottlenecks, critical-path nodes, or downstream impact rather than trying to become a
  generic dashboard.

### Scalable UI behavior

- Large runs required bounded default rendering, progressive disclosure, and worker-backed
  derivation to stay usable.
- Timeline interaction benefited from explicit zoom/filter controls and readable
  dependency context rather than exhaustive always-on detail.

### Timeline scaling rationale

- Tests became lower-value default timeline detail than model and source execution
  context, so hiding them by default improved readability and performance.
- Time-window zoom was introduced because long runs compress meaningful timing detail
  beyond usefulness when forced into one fixed full-run width.
- The timeline remained an investigation surface, not a raw artifact dump, so bounded
  context and focused controls were preferable to exhaustive always-on rendering.

### Design-system direction

- Semantic tokens, clearer hierarchy, and restrained status color improved analytical
  clarity.
- Styling and component layout changed often enough that those details should remain in
  code and design tokens, not canonical ADRs.

### Design-system concepts worth preserving

- Strong hierarchy and explicit selected states mattered more than novelty styling.
- Status color worked best when reserved for meaning instead of becoming a general visual
  accent system.
- Non-SQL resources and future trust/governance metadata were expected to fit into the
  investigation workspace without being forced through SQL-shaped panels.

## Legacy ADRs captured here

- 0011, 0015, 0016, 0017, 0019, 0021, 0022, 0026

Use this note for historical orientation. Use the canonical ADRs for enduring
architectural rules.
