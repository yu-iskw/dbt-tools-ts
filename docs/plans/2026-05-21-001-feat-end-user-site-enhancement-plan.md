---
title: 'feat: End-user goal-oriented docs site enhancement'
type: feat
status: active
date: 2026-05-21
origin: user RFC (end-user site enhancement for docs/site)
deepened: 2026-05-21
---

## Summary

Evolve the existing VitePress site at `docs/site/` by adding a goal-oriented layer—Start Here, Recipes, Deploy, and Trust & Safety—above the current package-oriented Guide/Concepts/Reference structure. Preserve all `/workflows/*` URLs, ship a trimmed synthetic demo target under `public/demo/` (v11 manifest + v6 run_results, with injected failure rows), and land the work in phased PRs with mandatory quickstart verification.

---

## Problem Frame

End users arrive with job questions (“why did my run fail?”, “can I use S3?”, “is this safe with agents?”) while the site is organized primarily by package and surface. The site already has strong workflow pages and reference material; the gap is onboarding, production deployment narrative, trust boundaries, and top-level navigation that routes by goal first.

---

## Assumptions

_This plan was authored without synchronous user confirmation. Review these bets before implementation._

- **Recipes vs workflows (Option B+):** `recipes/*.md` owns goal-oriented prose; `workflows/*.md` keeps stable URLs with a short footer linking to the matching recipe (not full duplicate bodies long-term). Bookmarks stay on `/workflows/*` until a redirect pass.
- **Demo artifacts:** U0 builds `docs/site/public/demo/` as a **single artifact root** (both files at the directory root). Source pair: `manifest/v11/jaffle_shop/manifest.json` + `run_results/v6/jaffle_shop/run_results.json` (there is **no** `manifest.json` under `manifest/v12/jaffle_shop/`). The sync step **trims** large graphs if needed, **sanitizes** project/env metadata per `concepts/dbt-artifacts.md`, and **injects** at least one `error`/`fail`/`skipped` result so `debug-failed-run` is runnable (stock jaffle `run_results` is all `success`).
- **Quickstart commands:** Examples use `dbt-tools` / `npx @dbt-tools/cli`. Success criterion: `dbt-tools status --dbt-target <demo> --json` → `readiness: "full"`. Prerequisites: Node **20+** for published packages; repo development uses `.node-version` (currently 24.x).
- **Readiness gate naming:** Human docs use `dbt-tools status --json` and `readiness` values. Agent docs map skill handle `dbt-tools-cli:check-session` → same `status` JSON (no `dbt-tools check-session` subcommand).
- **Debug-failed-run recipe:** `status` → `query-executions` (failure filters) → `discover`/`explain` on a failing `unique_id`; `deps` for lineage without promising `web_url`. Branch on `manifest-only` before execution commands.
- **CLI→Web handoff recipe:** `web_url` / `review_url` only for **`discover`**, **`explain`**, and **`impact`** (per `packages/cli/README.md`). `query-executions` and `deps` have no `web_url`—document manual Web steps for execution/lineage views.
- **Generated reference (Phase 4):** Deferred unless a low-cost generator exists; U6 is hand-maintained.
- **Phase 1 verification:** `scripts/verify-docs-quickstart.sh` (U7) is **required** before the first site content PR merges; PR-time `pnpm site:build` on `docs/site/**` is strongly recommended in the same PR that adds U7.

---

## Requirements

- R1. First-time users can complete a five-minute path without a real dbt project, using synthetic demo artifacts.
- R2. Homepage and top nav route users by goal (debug, slow models, lineage, CI, agents, deploy, trust) into the new layers and existing package docs.
- R3. `recipes/` provides at least six job-oriented recipes with CLI, Web, and MCP/agent paths where applicable, expected output shapes, and failure-mode tables.
- R4. `deploy/` documents local `target/`, S3, GCS, GitHub Actions, and credential precedence without duplicating full env tables (link to `reference/configuration.md`).
- R5. `trust/` documents data boundaries, agent/MCP safety, production hardening, and licensing in plain language; no links to `docs/adr/` on the published site.
- R6. All existing URLs under `guide/`, `workflows/`, `concepts/`, and `reference/` remain reachable; `/workflows/*` paths are not moved without VitePress `redirect` frontmatter.
- R7. `pnpm site:build` succeeds; new internal links pass Trunk `markdown-link-check` (use disable comments only for npm/GitHub URLs per existing pattern).
- R8. Public examples use synthetic data only; command examples are verifiable against `public/demo/` via the U7 verify script.
- R11. Human-facing docs use `dbt-tools status --json` for readiness; agent skill sections may reference `dbt-tools-cli:check-session` with an explicit CLI mapping.
- R9. Wording follows AGENTS.md: “coding agent” and “agent skills”; avoid generic “AI agent” on the site.
- R10. Full CLI/MCP flag reference remains in `packages/*/README.md`; site pages link deliberately rather than mirroring reference dumps.

---

## Scope Boundaries

- Rebuilding the docs platform or replacing VitePress
- Changing package APIs, names, or GitHub Pages deployment model (`base: '/dbt-tools-ts/'` stays)
- Hosted SaaS, warehouse connectivity docs, or replacing dbt Docs
- Documenting `@dbt-tools/core` on the end-user site
- Linking ADRs from GitHub Pages
- Renaming `workflows/` to `recipes/` in the first iteration (no mass URL moves)

### Deferred to Follow-Up Work

- Doc generators (`scripts/docs/generate-*-reference.ts`) and full reference auto-sync from CLI/MCP/Web source
- VitePress server-side redirects for renamed paths (beyond frontmatter `redirect`)
- Bundled downloadable `.zip` of demo artifacts (if `public/demo/` path is insufficient)
- Product work to add `web_url` on `query-executions` / `diagnose` for execution deep links
- Screenshots under `public/screenshots/` (annotate sparingly per release)
- PR workflow `site:build` gate only when explicitly out of scope for the implementing PR

---

## Context & Research

### Relevant Code and Patterns

- VitePress config: `docs/site/.vitepress/config.ts` — nav, sidebar, `base`, `esnext` esbuild overrides (required for monorepo)
- Homepage: `docs/site/index.md` — `layout: home`, “Pick your path”
- Workflow recipe template: Outcome → When to use (surface table) → Steps → Example → Next (`docs/site/workflows/check-run-health.md`)
- Interface router: `docs/site/guide/overview.md` (“Choose your interface”)
- Remote artifacts: `docs/site/concepts/local-and-remote-artifacts.md`, `docs/site/reference/configuration.md`
- Deep links: `docs/site/reference/deep-links.md`, `DBT_TOOLS_WEB_BASE_URL`
- Redirect precedent: `docs/site/workflows/wire-your-ide-agent.md` → `wire-your-coding-agent`
- Site scripts: root `pnpm site:build` → `@dbt-tools/site` → `vitepress build .`
- Fixture source (copy **into one target dir**): `packages/test-fixtures/dbt-artifacts-parser/resources/manifest/v11/jaffle_shop/manifest.json` + `run_results/v6/jaffle_shop/run_results.json`; U0 script writes `docs/site/public/demo/{manifest.json,run_results.json}`

### Institutional Learnings

- `AGENTS.md`: task-oriented workflows/recipes over package README mirrors; no ADR links on site; remote config via `--dbt-target` / `DBT_TOOLS_*` (not removed env names)
- `docs/solutions/` empty — no prior captured learnings
- Deploy today: `pages.yml` builds on `main` only; no PR-time `site:build` gate

### External References

- User RFC (attached): information architecture, phased PRs, quality bar, migration strategy
- dbt artifact reference (for trust copy only, linked externally—not `docs/adr/`)

---

## Key Technical Decisions

- **Layered IA, not rewrite:** Add top nav entries Start Here (quickstart), Recipes, Deploy, Trust & Safety; keep Packages dropdown and per-surface guide depth.
- **Option B+ for recipes:** `recipes/*` is the promoted learning path in nav; `workflows/*` keeps legacy URLs with footers pointing to recipes. Avoid maintaining two full copies—recipes are content owners after Phase 1.
- **Demo artifact delivery:** `docs/site/public/demo/` is a filesystem `--dbt-target` root (not a URL). Quickstart documents clone path `docs/site/public/demo` and `npx` users copy that folder or run from a repo checkout; optional `.zip` remains deferred.
- **Deploy hub defers duplication:** `deploy/*` pages are procedural; env matrices stay in `reference/configuration.md` and `concepts/local-and-remote-artifacts.md`.
- **Trust before MCP install:** Reorder funnel links in `guide/mcp/getting-started.md` and `guide/agents/install.md` to surface `trust/` first.
- **Reference filename:** Use existing `reference/web-cli.md` (RFC’s `web-server-cli.md` does not exist).

---

## Open Questions

### Resolved During Planning

- **Recipes vs workflows naming?** Add `recipes/` as promoted job layer; keep `workflows/` URLs (RFC Option B).
- **Where do demo artifacts live?** `docs/site/public/demo/` served under `/demo/` with VitePress `base`.
- **Debug failed run commands?** `status` → `query-executions` → `discover`/`explain` on failure `unique_id`; demo `run_results` must include ≥1 non-success node (U0).
- **MCP manifest-only?** MCP requires manifest + run_results; human gate is `dbt-tools status --json` (`manifest-only` vs `full`); agents use `dbt-tools-cli:check-session` → same command.

### Deferred to Implementation

- Exact JSON field excerpts for quickstart (capture once against demo target during U1 verification)
- Whether `workflows/explain-failure.md` gains a short redirect-style intro or only a recipe footer link
- Target size budget for `public/demo/` after trim (aim under 500KB combined unless trim script cannot reach that)

---

## High-Level Technical Design

> _This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce._

```mermaid
flowchart TD
  Home[index.md] --> Start[guide/quickstart + choose-by-goal]
  Home --> Recipes[recipes/]
  Home --> Deploy[deploy/]
  Home --> Trust[trust/]
  Home --> Packages[guide/cli|web|mcp|agents]
  Recipes --> Workflows[workflows/ legacy URLs]
  Recipes --> Ref[reference/]
  Deploy --> Concepts[concepts/local-and-remote-artifacts]
  Trust --> MCP[guide/mcp]
  Packages --> Workflows
```

**Content flow (user question order):** goal → interface choice → commands/UI → expected JSON → deploy/trust → package README for flags.

---

## Output Structure

```text
docs/site/
├── guide/
│   ├── quickstart.md              # new
│   ├── choose-by-goal.md          # new
│   ├── demo-artifacts.md          # new
│   ├── overview.md                # modify
│   └── ecosystem.md               # modify
├── recipes/                       # new
│   ├── index.md
│   ├── debug-failed-run.md
│   ├── investigate-slow-models.md
│   ├── find-model-impact.md
│   ├── generate-ci-health-summary.md
│   ├── open-cli-result-in-web.md
│   └── ask-agent-about-dbt-run.md
├── deploy/                        # new
│   ├── index.md
│   ├── local-target.md
│   ├── s3.md
│   ├── gcs.md
│   ├── github-actions.md
│   └── credentials.md
├── trust/                         # new
│   ├── index.md
│   ├── data-boundaries.md
│   ├── agent-safety.md
│   ├── production-hardening.md
│   └── licensing.md
├── public/demo/                   # new
│   ├── manifest.json
│   └── run_results.json
├── _templates/                    # new (optional)
│   ├── recipe.md
│   ├── deploy.md
│   └── trust.md
├── index.md                       # modify
└── .vitepress/config.ts           # modify
```

---

## Implementation Units

- U0. **Scaffolding, templates, and demo artifact pipeline**

**Goal:** Create directories, author-facing templates, and a repeatable way to refresh synthetic demo artifacts.

**Requirements:** R6, R8

**Dependencies:** None

**Files:**

- Create: `docs/site/recipes/.gitkeep` (or `index.md` stub), `docs/site/deploy/`, `docs/site/trust/`, `docs/site/public/demo/`
- Create: `docs/site/_templates/recipe.md`, `deploy.md`, `trust.md` (optional but RFC-requested)
- Create: `scripts/sync-docs-demo-artifacts.mjs` (or document manual copy steps in `guide/demo-artifacts.md` if script deferred)
- Modify: `docs/site/workflows/index.md` (placeholder link to upcoming recipes hub)

**Approach:**

- Template headings match existing workflow shape plus RFC fields (symptom table, expected output JSON block).
- `scripts/sync-docs-demo-artifacts.mjs` copies v11 manifest + v6 run_results into `docs/site/public/demo/`, sanitizes metadata, trims node count if needed, and ensures ≥1 failed/skipped execution for debug recipes. Script is the single source of truth for demo refresh.

**Test scenarios:**

- Happy path: sync script exits 0; `public/demo/manifest.json` and `run_results.json` parse as JSON
- Happy path: `dbt-tools status --dbt-target docs/site/public/demo --json` reports `readiness: "full"`
- Happy path: demo `run_results` contains at least one non-`success` execution status

**Verification:**

- `docs/site/public/demo/manifest.json` and `run_results.json` exist and parse as JSON
- `pnpm site:build` still passes

---

- U1. **Synthetic demo artifacts, quickstart, and demo-artifacts page**

**Goal:** Enable a five-minute successful CLI path without a real dbt project.

**Requirements:** R1, R8

**Dependencies:** U0

**Files:**

- Create: `docs/site/guide/quickstart.md`, `docs/site/guide/demo-artifacts.md`
- Modify: `docs/site/concepts/dbt-artifacts.md` (link to demo artifacts)
- Modify: `docs/site/public/demo/*` (via sync script)

**Approach:**

- Quickstart: prerequisites (Node 20+; link `.node-version` for repo dev), Option A own `target/`, Option B `--dbt-target` pointing at `docs/site/public/demo` (after U0), minimal `status`, `discover`, `explain`; optional one-liner Web/MCP.
- `demo-artifacts.md`: how to refresh via sync script, synthetic-only policy, and copy path for `npx` users without full monorepo context.

**Test scenarios:**

- Happy path: `dbt-tools status --dbt-target <demo> --json` returns `readiness: "full"` with manifest and run_results present
- Edge case: wrong `--dbt-target` → `unavailable`; quickstart documents fix
- Error path: Node below 20 called out with link to published package engines and `.node-version`
- Integration: quickstart links to `recipes/`, `deploy/`, `trust/`, and package getting-started pages

**Verification:**

- Commands in quickstart run against `public/demo/` in a clean environment
- `scripts/verify-docs-quickstart.sh` passes (add in U7; required before Phase 1 PR merge)
- `pnpm site:build` passes

---

- U2. **Homepage, navigation Phase 1, and choose-by-goal**

**Goal:** Make the site entry action-oriented and add the goal routing page.

**Requirements:** R2, R9

**Dependencies:** U1

**Files:**

- Create: `docs/site/guide/choose-by-goal.md`
- Create (if nav/homepage links ahead of U4/U5): `docs/site/deploy/index.md`, `docs/site/trust/index.md` as minimal stubs (“coming soon” sections with links to `concepts/` and `reference/configuration` only)
- Modify: `docs/site/index.md`, `docs/site/.vitepress/config.ts`, `docs/site/guide/overview.md`, `docs/site/guide/ecosystem.md`

**Approach:**

- Homepage hero copy per RFC; primary CTA → `/guide/quickstart`; goal cards linking to recipes/deploy/trust.
- Nav (Phase 1): add Start Here → quickstart, Recipes → `/recipes/`. Do **not** add Deploy/Trust top-nav entries until U4/U5 unless minimal stub index pages (`deploy/index.md`, `trust/index.md`) ship in the same PR—homepage goal cards must not 404.
- `choose-by-goal.md`: decision table (goal → best interface → start link); distinguish from `overview.md` (interface) vs `ecosystem.md` (package map).
- Fix homepage wording: “coding agent” not “AI coding agents” where applicable.

**Test scenarios:**

- Happy path: every homepage goal card resolves to an existing or newly created route (no 404 after build)
- Edge case: `guide/getting-started.md` redirect to overview still works
- Integration: overview and ecosystem link to quickstart and choose-by-goal

**Verification:**

- `pnpm site:build` passes
- Sidebar Start Here group lists quickstart, choose-by-goal, ecosystem, demo-artifacts

---

- U3. **Recipes hub and six initial recipe pages (Option B cross-links)**

**Goal:** Establish job-oriented recipes as the primary learning path while preserving workflow URLs.

**Requirements:** R3, R6, R10

**Dependencies:** U1, U2

**Files:**

- Create: `docs/site/recipes/index.md`, `debug-failed-run.md`, `investigate-slow-models.md`, `find-model-impact.md`, `generate-ci-health-summary.md`, `open-cli-result-in-web.md`, `ask-agent-about-dbt-run.md`
- Modify: each related `docs/site/workflows/*.md` (footer: “Goal-oriented recipe: …”)
- Modify: `docs/site/.vitepress/config.ts` (Recipes sidebar group + nav)
- Modify: `docs/site/guide/ecosystem.md`, `docs/site/workflows/index.md`

**Approach:**

- Follow `_templates/recipe.md` and existing workflow structure.
- Map goals to legacy workflows: debug ↔ check-run-health + explain-failure; slow ↔ investigate-slow-runs; impact ↔ find-a-model; CI ↔ check-run-health + summary; web handoff ↔ open-in-web; agent ↔ wire-your-coding-agent.
- `debug-failed-run`: requires U0 failure injection; `query-executions` with `--status error,fail,skipped`; manifest-only branch; agent section cites `dbt-tools-cli:check-session` → `status --json`.
- `open-cli-result-in-web`: `DBT_TOOLS_WEB_BASE_URL`; only `discover`/`explain`/`impact` emit `web_url`; `deps` + manual Web for lineage.
- `ask-agent-about-dbt-run`: MCP vs skills vs CLI; trust links required once U5 lands (U5 can follow in next PR).

**Test scenarios:**

- Happy path: recipes index table links to all six recipe pages
- Happy path: each recipe includes CLI example block runnable against demo target where applicable
- Happy path: `debug-failed-run` `query-executions --json` returns ≥1 failed/skipped row against demo target
- Edge case: recipe documents `manifest-only` stopping before execution commands
- Error path: symptom → cause → fix table (missing manifest, empty run_results, remote auth)
- Integration: reciprocal link from `workflows/check-run-health.md` to `recipes/debug-failed-run.md` (and siblings)

**Verification:**

- No removed workflow sidebar entries
- `pnpm site:build` passes; markdown links from recipes to workflows resolve

---

- U4. **Deploy section and reference cross-links**

**Goal:** Production-oriented deployment narrative for local, S3, GCS, and CI.

**Requirements:** R4, R7

**Dependencies:** U2

**Files:**

- Create: `docs/site/deploy/index.md`, `local-target.md`, `s3.md`, `gcs.md`, `github-actions.md`, `credentials.md`
- Modify: `docs/site/.vitepress/config.ts` (Deploy nav + sidebar)
- Modify: `docs/site/reference/configuration.md`, `docs/site/reference/troubleshooting.md`, `docs/site/concepts/local-and-remote-artifacts.md` (links to deploy hub, avoid duplicate env tables)

**Approach:**

- Minimal examples per RFC; read-only IAM guidance; same `--dbt-target` across CLI/Web/MCP.
- `github-actions.md`: upload JSON artifact pattern; link `recipes/generate-ci-health-summary.md`.
- Credentials page: dbt-tools env vs standard cloud auth; precedence pointer to configuration reference.

**Test scenarios:**

- Happy path: deploy index links to all five child pages
- Edge case: GCS page mentions impersonation env var with link to configuration table
- Error path: troubleshooting rows for remote auth failures cross-link from deploy pages
- Test expectation: none for S3 live integration in CI — document manual V13-style verification separately

**Verification:**

- Deploy appears in top nav and sidebar
- `pnpm site:build` passes

---

- U5. **Trust & Safety and agent/MCP funnel updates**

**Goal:** Make trust, licensing, and agent boundaries explicit before production and MCP adoption.

**Requirements:** R5, R9

**Dependencies:** U3 (agent recipe links)

**Files:**

- Create: `docs/site/trust/index.md`, `data-boundaries.md`, `agent-safety.md`, `production-hardening.md`, `licensing.md`
- Modify: `docs/site/.vitepress/config.ts` (Trust nav + sidebar)
- Modify: `docs/site/guide/mcp/getting-started.md`, `guide/mcp/connecting-clients.md`, `guide/agents/index.md`, `recipes/ask-agent-about-dbt-run.md`
- Modify: `docs/site/index.md` (Trust section link)

**Approach:**

- data-boundaries: artifacts-only, no warehouse requirement, Web upload/server behavior per actual product, JSON/MCP exposure.
- agent-safety: MCP stdio, client persistence risk, read-only roots, untrusted content in prompts.
- licensing: source-available, not OSI OSS, dependency licenses; link repository LICENSE.
- MCP getting started: link trust before install; state manifest+run_results requirement.

**Test scenarios:**

- Happy path: trust index links to four child pages
- Happy path: MCP getting started page links to agent-safety before client setup steps
- Edge case: licensing page does not overclaim OSI status
- Integration: agent recipe links trust and MCP tools reference

**Verification:**

- Trust in top nav; homepage Trust & Safety section present
- `pnpm site:build` passes

---

- U6. **Reference expansion (hand-maintained)**

**Goal:** Close reference gaps cited in the RFC without requiring generators in v1.

**Requirements:** R10

**Dependencies:** U4, U5

**Files:**

- Create: `docs/site/reference/json-output.md`, `version-compatibility.md`, `glossary.md`
- Optional: `reference/core.md` — one paragraph + link to GitHub `@dbt-tools/core` only (no on-site API reference; satisfies scope boundary)
- Modify: `docs/site/reference/cli-cheatsheet.md`, `mcp-tools.md`, `troubleshooting.md`, `docs/site/.vitepress/config.ts` (Reference sidebar items)

**Approach:**

- json-output: `readiness`, `web_url`/`review_url` on discover/explain/impact only; link to deep-links.
- version-compatibility: Node 20+ (24+ for monorepo dev per `.node-version`), artifact schema assumptions, `npx -y` pinning.
- Defer generator scripts to Deferred to Follow-Up Work unless low effort discovered during implementation.

**Test scenarios:**

- Happy path: new reference pages linked from sidebar
- Integration: recipes and deploy link to json-output and configuration where relevant
- Test expectation: none for generator automation in v1

**Verification:**

- `pnpm site:build` passes

---

- U7. **Validation harness and CI hardening**

**Goal:** Prevent regressions in site build and quickstart command accuracy.

**Requirements:** R7, R8

**Dependencies:** U1–U6 (incrementally runnable earlier)

**Files:**

- Create: `scripts/verify-docs-quickstart.sh` (required gate; invoked locally and in CI)
- Modify: `.github/workflows/build.yml` or `trunk_check.yml` (if task owns CI) to run `pnpm site:build` when `docs/site/**` changes

**Approach:**

- Shell script: `status --json` → assert `readiness: full`; optional `discover` smoke; assert demo `run_results` has ≥1 non-success if testing debug docs.
- Same PR (or immediate follow-up) adds `pnpm site:build` when `docs/site/**` changes in `build.yml` or `trunk_check.yml` if task owns CI.

**Test scenarios:**

- Happy path: verify script exits 0 on main branch after U1
- Error path: script fails if demo artifacts removed
- Integration: `pnpm site:build` in CI on docs PRs

**Verification:**

- `scripts/verify-docs-quickstart.sh` is required in Phase 1 Definition of Done
- Script runs in CI when workflow change is in scope; otherwise documented mandatory local gate before merge
- Agent completion: `pnpm lint:report`, `pnpm knip`, `pnpm coverage:report` per AGENTS.md for doc-only changes

---

## System-Wide Impact

- **Interaction graph:** Homepage, nav, sidebar, ecosystem tables, workflow footers, MCP/agents install order, and reference cross-links all gain new edges; search index includes new sections.
- **Error propagation:** Incorrect demo paths break quickstart and all recipes using demo; remote deploy misconfig surfaces in troubleshooting cross-links.
- **State lifecycle risks:** Stale MCP cache and mismatched CLI/Web `--dbt-target` called out in trust and open-cli-result recipe.
- **API surface parity:** No CLI/MCP/Web code changes; docs must reflect actual commands (`status`, `query-executions`, `discover`, `explain`, `deps`, `impact`) and `web_url` only on discover/explain/impact.
- **Integration coverage:** U1 command smoke + U7 script prove docs/examples against real binaries; site build proves VitePress graph.
- **Unchanged invariants:** Package READMEs remain authoritative for flags; `workflows/*` URLs; `base: '/dbt-tools-ts/'`; VitePress `esnext` config; no ADR links on site.

---

## Risks & Dependencies

| Risk                                       | Mitigation                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Docs drift from CLI/MCP/Web                | Link to package READMEs; U6 json-output; defer generators to follow-up |
| Demo artifacts too large or “real-looking” | U0 trim + sanitize; document provenance in `demo-artifacts.md`         |
| Duplicate recipes vs workflows             | Recipes own prose; workflows footers only; dedup in follow-up          |
| Debug recipe with all-success fixture      | U0 inject ≥1 failure; verify script asserts non-success row            |
| Broken internal links at scale             | `pnpm site:build`; Trunk link-check; U7 required verify script         |
| `check-session` documented as CLI command  | Map skill handle → `status --json` in trust/agent/recipe pages         |
| Agent safety expectations                  | U5 trust pages; MCP manifest-only invariant                            |
| PR merges broken site                      | U7 CI `site:build` on `docs/site/**`                                   |
| RFC command names wrong                    | Verify every bash block in U1/U3 against demo target                   |

---

## Documentation / Operational Notes

- Build: `pnpm site:build` from repository root (preferred) or `pnpm --filter @dbt-tools/site build`.
- Preview: `pnpm site:preview` after build.
- Deploy: existing `pages.yml` on push to `main` when `docs/site/**` changes.
- Post-implementation: capture learnings in `docs/solutions/` via `/ce-compound` (VitePress esnext, link-check, demo artifact policy).
- Quality gates for agents: `pnpm lint:report`, `pnpm knip`, `pnpm coverage:report` even for documentation-only edits.

---

## Phased Delivery

### Phase 1 — Onboarding PR (RFC “Recommended First PR”)

Land **U0 + U1 + U2 + U3 + U7** (verify script is part of Phase 1, not a later optional add-on).

**MVP slice:** New user runs quickstart against `public/demo/` (`readiness: full`), `scripts/verify-docs-quickstart.sh` passes, and homepage/recipe routes build without 404.

### Phase 2 — Deployment PR

Land **U4** + remaining recipes (`generate-ci-health-summary`, `open-cli-result-in-web`).

### Phase 3 — Trust PR

Land **U5** + `ask-agent-about-dbt-run` recipe polish.

### Phase 4 — Reference PR

Land **U6** + **U7**.

---

## Sources & References

- **Origin:** User RFC — end-user site enhancement for `docs/site` (2026-05-21)
- Site config: `docs/site/.vitepress/config.ts`
- Agent policy: `AGENTS.md` (docs/site section, Learned Workspace Facts)
- ADR messaging (contributors only, not linked from site): `docs/adr/0008-dbt-tools-operational-intelligence-and-positioning-boundaries.md`, `docs/adr/0010-shared-discovery-ranker-intent-commands-and-cli-web-deep-links.md`
<!-- markdown-link-check-disable -->

- Live site baseline: [yu-iskw.github.io/dbt-tools-ts](https://yu-iskw.github.io/dbt-tools-ts/)

<!-- markdown-link-check-enable -->

- Test fixtures: `packages/test-fixtures/dbt-artifacts-parser/resources/`
