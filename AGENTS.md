# Agent instructions (dbt-tools-ts)

## Agent documentation split

- **This file (`AGENTS.md`) is canonical** for humans and all agent tools: stack, package layout, quality gates, commands, and policy detail.
- **[`CLAUDE.md`](CLAUDE.md)** is a Claude Code entry digest that points back here and adds Claude-specific coordination notes.
- If anything disagrees, **this file wins**; update this file first, then adjust shorter mirrors such as `CLAUDE.md` or `.cursor/rules/*.mdc`.

## Tech stack

- **Package manager:** pnpm workspace.
- **Node.js:** use [`.node-version`](.node-version) for local development and CI. Published packages require Node.js 20+.
- **Language:** TypeScript. Unit tests use Vitest from the repository root.
- **Repository boundary:** this repo owns `@dbt-tools/core`, `@dbt-tools/cli`, `@dbt-tools/mcp`, and `@dbt-tools/web`. `dbt-artifacts-parser` is an external npm dependency and upstream parser package, not a workspace package here.

## Packages

| Package           | Path                             | Role                                                                                                                                                                                            |
| ----------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------- |
| `@dbt-tools/core` | [`packages/core`](packages/core) | Artifact analysis substrate: manifest graph, execution analysis, snapshots, discovery, exports, and browser-safe facade.                                                                        |
| `@dbt-tools/cli`  | [`packages/cli`](packages/cli)   | Structured CLI for operators, CI, scripts, and coding agents (`dbt-tools`). Default stdout is **`--format json`**; use **`--format text`** for human tables. **`deps`** uses \*\*`--layout tree | flat`** for listing shape (not `--format`). **`timeline`** uses **`--format json | table | csv`**. See [`packages/cli/README.md`](packages/cli/README.md). |
| `@dbt-tools/mcp`  | [`packages/mcp`](packages/mcp)   | Long-lived MCP server for interactive agent workflows over resident parsed artifacts (`dbt-tools-mcp`).                                                                                         |
| `@dbt-tools/web`  | [`packages/web`](packages/web)   | Deterministic investigation UI and local static server (`dbt-tools-web`).                                                                                                                       |

Product positioning is [ADR-0008](docs/adr/0008-dbt-tools-operational-intelligence-and-positioning-boundaries.md). Core/web/CLI scalability boundaries are [ADR-0003](docs/adr/0003-large-manifest-web-performance-dependency-index-and-lazy-sql.md), [ADR-0004](docs/adr/0004-remote-object-storage-artifact-sources-and-auto-reload.md), [ADR-0006](docs/adr/0006-timeline-includes-dbt-sources-via-snapshot-synthesis.md), and [ADR-0010](docs/adr/0010-shared-discovery-ranker-intent-commands-and-cli-web-deep-links.md).

## Security posture

- **Trust model:** CLI, MCP, and web run as **one OS user** on an operator-controlled workstation or CI runner. **MCP** uses **stdio** only ([`packages/mcp/src/server.ts`](packages/mcp/src/server.ts)). **Web** defaults to **loopback** (`127.0.0.1`) via **`LISTEN_HOST`** in [`packages/web/src/server/serve.ts`](packages/web/src/server/serve.ts).
- **Credentials:** S3/GCS reads use **ambient** AWS/GCP SDK credential chains in the Node process; never commit secrets (see **Secrets and suppressions** below).
- **Defense in depth:** Single-object reads (remote S3/GCS **and** local manifest/run_results/catalog/sources files loaded by [`ArtifactWorkspace`](packages/core/src/artifact-workspace/index.ts)) are capped by **`DBT_TOOLS_MAX_REMOTE_OBJECT_BYTES`** (parsed in [`packages/core/src/config/dbt-tools-env.ts`](packages/core/src/config/dbt-tools-env.ts), enforced in [`packages/core/src/io/remote-object-store.ts`](packages/core/src/io/remote-object-store.ts) and local reads via streaming cap helpers). S3/GCS prefix **listing** for discovery is bounded by **`DBT_TOOLS_MAX_REMOTE_LISTING_OBJECTS`** (default 50_000, clamped in env helper). Vite dev and published server artifact POST JSON bodies are size-capped. **Artifact POST token:** set **`DBT_TOOLS_WEB_REQUIRE_POST_TOKEN=1`** together with non-empty **`DBT_TOOLS_WEB_API_TOKEN`** to require header **`x-dbt-tools-api-token`** on `/api/artifact-source/*` POSTs ([`packages/web/src/artifact-source/viteArtifactRoutes.ts`](packages/web/src/artifact-source/viteArtifactRoutes.ts), also used from [`packages/web/src/server/serve.ts`](packages/web/src/server/serve.ts)). If only **`DBT_TOOLS_WEB_API_TOKEN`** is set, enforcement stays off and the process emits a **one-time** warning: the bundled UI does not send that header unless a reverse proxy injects it. For strict deployments, terminate TLS and inject the header at the edge; copy-paste **nginx** / **Caddy** patterns are under **Reverse proxy: inject `x-dbt-tools-api-token`** in [`packages/web/README.md`](packages/web/README.md#reverse-proxy-inject-x-dbt-tools-api-token).
- **Threat model and hardening notes:** `dbt-tools-ts-threat-model.md` (trust boundaries, TM-001–TM-006) and `security_best_practices_report.md` at the repository root when present.
- **Dependency scanning:** run **`pnpm lint:security`** (Trunk Trivy/OSV-scanner) and triage findings against lockfile and upgrade policy.

## Frontend application

- `@dbt-tools/web` is an artifact-driven investigation UI; it must remain useful without a chat surface or LLM dependency.
- Web app code lives in [`packages/web/src`](packages/web/src); Playwright specs live in [`packages/web/e2e`](packages/web/e2e).
- Use `@dbt-tools/core/browser` in workers and code that must avoid Node built-ins. Use the full `@dbt-tools/core` entry for Vite/Node-only code such as artifact-source middleware and server-side CLI wiring.
- Path alias `@web` maps to `packages/web/src`; keep package and root Vitest/Vite aliases in sync when it changes.

### Design tokens and styling

- Token source of truth: [`packages/web/src/styles/tokens.css`](packages/web/src/styles/tokens.css).
- TypeScript mirror: `packages/web/src/constants/themeColors.generated.ts` is generated by `pnpm tokens:sync`; never edit it manually.
- New CSS should use semantic `var(--*)` tokens for colors, spacing, typography, and radii. See [`.cursor/rules/design-tokens.mdc`](.cursor/rules/design-tokens.mdc).
- Run `pnpm lint:stylelint` after substantive CSS changes; `pnpm lint:report` is ESLint-only.

## Quality gates

Unless the user explicitly narrows scope, run the relevant gates from the repository root before claiming completion:

1. `pnpm test` for Vitest.
2. `pnpm lint:report` and `pnpm knip`.
3. `pnpm coverage:report`.
4. Full `pnpm lint` or scoped Trunk when touching Markdown, YAML, `.trunk/`, GitHub workflow files, or substantive CSS.
5. `pnpm build` when the change spans package exports, shared TypeScript, worker protocol, package manifests, or publish-shaped behavior.
6. `pnpm test:e2e` when changing `packages/web/e2e/` or material web journeys.
7. `pnpm verify:plugins` when changing `plugins/**`, `.agents/plugins/**`, `.cursor-plugin/**`, or `.claude/skills/dbt-tools-cli-plugin-skill/**`.
8. `pnpm lint:security` (Trunk Trivy/OSV-scanner) when changing dependencies or as part of security-hardening work; triage findings per **Security posture**.

For documentation-only and agent-resource edits, the default repo policy still expects `pnpm lint:report`, `pnpm knip`, and `pnpm coverage:report`; a user may explicitly narrow verification for migration or review work. Cursor mirror: [`.cursor/rules/coverage-and-lint-reports.mdc`](.cursor/rules/coverage-and-lint-reports.mdc).

## Commands

```bash
pnpm install
pnpm build
pnpm test
pnpm lint:report
pnpm coverage:report
pnpm knip
pnpm verify:plugins
pnpm lint:security
pnpm dev:web
pnpm test:e2e
pnpm --filter @dbt-tools/web build
```

Pack and `npx` smoke for the web package is documented in [`.claude/skills/dbt-tools-web-pack-npx-smoke/SKILL.md`](.claude/skills/dbt-tools-web-pack-npx-smoke/SKILL.md).

## Agent resources

- CLI plugin authoring: [`.claude/skills/dbt-tools-cli-plugin-skill/SKILL.md`](.claude/skills/dbt-tools-cli-plugin-skill/SKILL.md).
- E2E authoring: [`.claude/skills/dbt-tools-web-e2e/SKILL.md`](.claude/skills/dbt-tools-web-e2e/SKILL.md).
- E2E fix loop: [`.claude/skills/dbt-tools-web-e2e-fix/SKILL.md`](.claude/skills/dbt-tools-web-e2e-fix/SKILL.md).
- UI-scope verification: [`.claude/skills/ui-feature-verify/SKILL.md`](.claude/skills/ui-feature-verify/SKILL.md).
- Workspace package version bump (release semver sync): [`.claude/skills/bump-workspace-versions/SKILL.md`](.claude/skills/bump-workspace-versions/SKILL.md).
- Full verification prompt: [`.claude/agents/verifier.md`](.claude/agents/verifier.md).

## Documentation boundaries

- Parser schema generation, parser package publishing, and parser-only development guidance belong in the external `dbt-artifacts-parser` repository. Keep only the context needed to explain that `@dbt-tools/*` depends on the published parser package.
- ADRs should describe durable decisions and invariants, not volatile file inventories or generated tables. Operational details belong in this file, package READMEs, code, and tests.
- Do not edit GitHub workflow files unless the task explicitly owns CI.

## Secrets and suppressions

Do not commit API keys, tokens, or passwords into docs, prompts, rules, or tracked config. Reference environment variable names only. Fix lint/static-analysis findings at the root cause; inline suppressions are a last resort and must be narrow and justified.
