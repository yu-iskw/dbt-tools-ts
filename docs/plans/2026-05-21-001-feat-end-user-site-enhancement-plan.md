---
title: "feat: End-user goal-oriented docs site enhancement"
type: feat
status: active
date: 2026-05-21
origin: user RFC (end-user site enhancement for docs/site)
---

# feat: End-user goal-oriented docs site enhancement

## Summary

Evolve the existing VitePress site at `docs/site/` by adding a goal-oriented layer—Start Here, Recipes, Deploy, and Trust & Safety—above the current package-oriented Guide/Concepts/Reference structure. Preserve all `/workflows/*` URLs, use synthetic demo artifacts for a five-minute quickstart, and land the work in phased PRs aligned with the user RFC.

---

## Problem Frame

End users arrive with job questions (“why did my run fail?”, “can I use S3?”, “is this safe with agents?”) while the site is organized primarily by package and surface. The site already has strong workflow pages and reference material; the gap is onboarding, production deployment narrative, trust boundaries, and top-level navigation that routes by goal first.

---

## Assumptions

*This plan was authored without synchronous user confirmation. Review these bets before implementation.*

- **Recipes vs workflows:** First iteration adds full content at `recipes/*.md` for RFC job titles while keeping `workflows/*.md` unchanged with reciprocal cross-links (Option B+), accepting short-term overlap until a later dedup pass—rather than hub-only stubs with no new recipe bodies.
- **Demo artifacts:** A minimal `manifest.json` + `run_results.json` pair is copied from `packages/test-fixtures/dbt-artifacts-parser/resources/*/jaffle_shop/` into `docs/site/public/demo/`, with project/metadata names sanitized for public docs per `concepts/dbt-artifacts.md`.
- **Quickstart commands:** Examples use `dbt-tools` / `npx @dbt-tools/cli` interchangeably where both work; success criterion is `readiness: "full"` JSON from `status --json` against the demo target.
- **Debug-failed-run recipe:** Canonical CLI sequence includes `query-executions` for failure triage (aligned with `guide/agents/skill-catalog.md`), not only the existing `explain-failure` workflow steps.
- **CLI→Web handoff recipe:** Documents `web_url` only for commands that implement handoff today (`discover`, `explain`, `deps`/`impact`); execution triage without `web_url` is called out explicitly.
- **Generated reference (Phase 4):** Deferred to follow-up unless an implementer already has a low-cost generator; hand-maintained reference updates are in scope for U6.
- **PR CI:** Adding `pnpm site:build` on PRs touching `docs/site/**` is recommended but may ship in U7 as a separate small change (workflow file edit requires explicit CI ownership).

---

## Requirements

- R1. First-time users can complete a five-minute path without a real dbt project, using synthetic demo artifacts.
- R2. Homepage and top nav route users by goal (debug, slow models, lineage, CI, agents, deploy, trust) into the new layers and existing package docs.
- R3. `recipes/` provides at least six job-oriented recipes with CLI, Web, and MCP/agent paths where applicable, expected output shapes, and failure-mode tables.
- R4. `deploy/` documents local `target/`, S3, GCS, GitHub Actions, and credential precedence without duplicating full env tables (link to `reference/configuration.md`).
- R5. `trust/` documents data boundaries, agent/MCP safety, production hardening, and licensing in plain language; no links to `docs/adr/` on the published site.
- R6. All existing URLs under `guide/`, `workflows/`, `concepts/`, and `reference/` remain reachable; `/workflows/*` paths are not moved without VitePress `redirect` frontmatter.
- R7. `pnpm site:build` succeeds; new internal links pass Trunk `markdown-link-check` (use disable comments only for npm/GitHub URLs per existing pattern).
- R8. Public examples use synthetic data only; command examples are verifiable against `public/demo/`.
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
- PR workflow change in `.github/workflows/build.yml` if this task does not own CI

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
- Fixture source: `packages/test-fixtures/dbt-artifacts-parser/resources/manifest/v12/jaffle_shop/` + matching `run_results/v6/jaffle_shop/`

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
- **Option B+ for recipes:** New `recipes/*.md` job pages plus unchanged `workflows/*.md` with bidirectional cross-links; canonical URLs for bookmarks remain `/workflows/*` until a later redirect pass.
- **Demo artifact delivery:** Checked-in `docs/site/public/demo/` directory used as `--dbt-target` path in quickstart (e.g. relative path documented from repo clone or copy instructions)—not “clone monorepo to run.”
- **Deploy hub defers duplication:** `deploy/*` pages are procedural; env matrices stay in `reference/configuration.md` and `concepts/local-and-remote-artifacts.md`.
- **Trust before MCP install:** Reorder funnel links in `guide/mcp/getting-started.md` and `guide/agents/install.md` to surface `trust/` first.
- **Reference filename:** Use existing `reference/web-cli.md` (RFC’s `web-server-cli.md` does not exist).

---

## Open Questions

### Resolved During Planning

- **Recipes vs workflows naming?** Add `recipes/` as promoted job layer; keep `workflows/` URLs (RFC Option B).
- **Where do demo artifacts live?** `docs/site/public/demo/` served under `/demo/` with VitePress `base`.
- **Debug failed run commands?** `status` → `query-executions` (failures) → `discover`/`explain`/`deps` on top failure; branch on `manifest-only` readiness.
- **MCP manifest-only?** Document in trust + MCP getting started: MCP requires manifest and run_results; CLI `check-session` for manifest-only readiness.

### Deferred to Implementation

- Exact JSON field excerpts for quickstart (capture once against demo target during U1 verification)
- Whether `recipes/debug-failed-run.md` subsumes content updates to `workflows/explain-failure.md` or only cross-links
- Size budget for committed JSON under `public/demo/` (may need minified fixture vs full jaffle_shop)

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

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

```
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
- Script copies v12 manifest + v6 run_results from test-fixtures; implementer sanitizes `project_name` / env metadata strings if needed.

**Test scenarios:**
- Test expectation: none — scaffolding and copy script only; verify script exits 0 and output files exist.

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
- Quickstart: prerequisites (Node 20+), Option A own `target/`, Option B demo path, minimal `status`, `discover`, `explain`, `dbt-tools-web`, `dbt-tools-mcp` invocations with expected `readiness` / output shape notes.
- Document demo path relative to clone: e.g. `docs/site/public/demo` or copy to a temp dir.

**Test scenarios:**
- Happy path: `dbt-tools status --dbt-target <demo> --json` returns `readiness: "full"` with manifest and run_results present
- Edge case: wrong `--dbt-target` → `unavailable`; quickstart documents fix
- Error path: Node &lt; 20 called out with link to `.node-version`
- Integration: quickstart links to `recipes/`, `deploy/`, `trust/`, and package getting-started pages

**Verification:**
- Commands in quickstart run against `public/demo/` in a clean environment
- `pnpm site:build` passes

---

- U2. **Homepage, navigation Phase 1, and choose-by-goal**

**Goal:** Make the site entry action-oriented and add the goal routing page.

**Requirements:** R2, R9

**Dependencies:** U1

**Files:**
- Create: `docs/site/guide/choose-by-goal.md`
- Modify: `docs/site/index.md`, `docs/site/.vitepress/config.ts`, `docs/site/guide/overview.md`, `docs/site/guide/ecosystem.md`

**Approach:**
- Homepage hero copy per RFC; primary CTA → `/guide/quickstart`; goal cards linking to recipes/deploy/trust.
- Nav (Phase 1): add Start Here → quickstart, Recipes → `/recipes/`; full Deploy/Trust nav can land in U4/U5 or stub links if pages not ready.
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
- `debug-failed-run`: include `query-executions` and manifest-only branch; link trust for agents.
- `open-cli-result-in-web`: document `DBT_TOOLS_WEB_BASE_URL` and which commands emit `web_url`.
- `ask-agent-about-dbt-run`: MCP vs skills vs CLI; link trust/agent-safety (stub ok until U5).

**Test scenarios:**
- Happy path: recipes index table links to all six recipe pages
- Happy path: each recipe includes CLI example block runnable against demo target where applicable
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
- Create: `docs/site/reference/json-output.md`, `version-compatibility.md`, `glossary.md` (optional `core.md` stub pointing to GitHub only if no end-user core docs)
- Modify: `docs/site/reference/cli-cheatsheet.md`, `mcp-tools.md`, `troubleshooting.md`, `docs/site/.vitepress/config.ts` (Reference sidebar items)

**Approach:**
- json-output: common CLI JSON fields (`readiness`, `web_url`, intent blocks) with link to deep-links.
- version-compatibility: Node 20+, artifact schema assumptions, package version pinning for `npx -y`.
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
- Create: `docs/site/guide/quickstart.verify.sh` or root script `scripts/verify-docs-quickstart.sh` (optional)
- Modify: `.github/workflows/build.yml` or `trunk_check.yml` (if task owns CI) to run `pnpm site:build` when `docs/site/**` changes

**Approach:**
- Minimal shell script: run status/discover against `public/demo/` with `--json` and assert `readiness`/`ok` via `jq` or node -e.
- Document verification in plan handoff for `ce-work` / `pnpm lint:report` on doc edits.

**Test scenarios:**
- Happy path: verify script exits 0 on main branch after U1
- Error path: script fails if demo artifacts removed
- Integration: `pnpm site:build` in CI on docs PRs

**Verification:**
- Script runs in repo root CI or documented local gate
- Agent completion: `pnpm lint:report`, `pnpm knip`, `pnpm coverage:report` per AGENTS.md for doc-only changes

---

## System-Wide Impact

- **Interaction graph:** Homepage, nav, sidebar, ecosystem tables, workflow footers, MCP/agents install order, and reference cross-links all gain new edges; search index includes new sections.
- **Error propagation:** Incorrect demo paths break quickstart and all recipes using demo; remote deploy misconfig surfaces in troubleshooting cross-links.
- **State lifecycle risks:** Stale MCP cache and mismatched CLI/Web `--dbt-target` called out in trust and open-cli-result recipe.
- **API surface parity:** No CLI/MCP/Web code changes; docs must reflect actual commands (`status`, `query-executions`, `discover`, `explain`, `deps`) and handoff support in `packages/core/src/intent/web-handoff.ts`.
- **Integration coverage:** U1 command smoke + U7 script prove docs/examples against real binaries; site build proves VitePress graph.
- **Unchanged invariants:** Package READMEs remain authoritative for flags; `workflows/*` URLs; `base: '/dbt-tools-ts/'`; VitePress `esnext` config; no ADR links on site.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Docs drift from CLI/MCP/Web | Link to package READMEs; U6 json-output; defer generators to follow-up |
| Demo artifacts too large or “real-looking” | Sanitize names; minimal fixture pair; document synthetic provenance |
| Duplicate recipes vs workflows | Option B+ cross-links; later dedup/redirect pass |
| Broken internal links at scale | `pnpm site:build`; Trunk markdown-link-check; U7 optional script |
| Agent safety expectations | U5 trust pages; MCP manifest-only invariant |
| PR merges broken site | U7 CI `site:build` on `docs/site/**` |
| RFC command names wrong | Verify every bash block in U1/U3 against demo target |

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

Land **U0 (minimal) + U1 + U2 + U3** (recipes index + three core recipes minimum if scope trimming needed: debug, slow, impact).

**MVP slice:** New user runs quickstart against `public/demo/` and reaches a recipe from homepage goal card; `pnpm site:build` green.

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
- Live site baseline: https://yu-iskw.github.io/dbt-tools-ts/
- Test fixtures: `packages/test-fixtures/dbt-artifacts-parser/resources/`
