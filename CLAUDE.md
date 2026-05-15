# Claude Code — project context

## Canonical instructions

[`AGENTS.md`](AGENTS.md) is canonical for repository layout, package boundaries, quality gates, commands, and cross-tool notes. If this file and `AGENTS.md` disagree, `AGENTS.md` wins.

## Environment

- **Security posture** (trust model, env-gated web APIs, remote read caps): see **Security posture** in [`AGENTS.md`](AGENTS.md).
- Package manager: `pnpm` workspace.
- Node.js: version in [`.node-version`](.node-version).
- Packages: `@dbt-tools/core` in [`packages/core`](packages/core), `@dbt-tools/cli` in [`packages/cli`](packages/cli), `@dbt-tools/mcp` in [`packages/mcp`](packages/mcp), and `@dbt-tools/web` in [`packages/web`](packages/web).
- Parser boundary: `dbt-artifacts-parser` is an external npm dependency, not a workspace package in this repository.

## Quality gates

Use `AGENTS.md` for the full ordered gate policy. High-signal commands are:

```bash
pnpm test
pnpm lint:report
pnpm knip
pnpm coverage:report
pnpm build
pnpm lint:security
pnpm test:e2e
```

Documentation-only and agent-resource edits normally still require `lint:report`, `knip`, and `coverage:report` unless the user explicitly narrows verification. Cursor mirror: [`.cursor/rules/coverage-and-lint-reports.mdc`](.cursor/rules/coverage-and-lint-reports.mdc).

## Claude Code resources

| Item                                                                                                           | Purpose                                                                                |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`.claude/skills/bump-workspace-versions/SKILL.md`](.claude/skills/bump-workspace-versions/SKILL.md)           | Bump synchronized `version` fields across workspace `package.json` files for releases. |
| [`.claude/skills/dbt-tools-web-e2e/SKILL.md`](.claude/skills/dbt-tools-web-e2e/SKILL.md)                       | Author deterministic Playwright E2E specs for `@dbt-tools/web`.                        |
| [`.claude/skills/dbt-tools-web-e2e-fix/SKILL.md`](.claude/skills/dbt-tools-web-e2e-fix/SKILL.md)               | Run and fix Playwright E2E failures.                                                   |
| [`.claude/skills/dbt-tools-web-pack-npx-smoke/SKILL.md`](.claude/skills/dbt-tools-web-pack-npx-smoke/SKILL.md) | Pack `@dbt-tools/web` and smoke the published-shaped `dbt-tools-web` binary.           |
| [`.claude/skills/dbt-tools-cli-plugin-skill/SKILL.md`](.claude/skills/dbt-tools-cli-plugin-skill/SKILL.md)     | Author and verify first-party `dbt-tools-cli` agent plugin skills.                     |
| [`.claude/skills/ui-feature-verify/SKILL.md`](.claude/skills/ui-feature-verify/SKILL.md)                       | Lightweight verification path for UI-only web changes.                                 |
| [`.claude/agents/verifier.md`](.claude/agents/verifier.md)                                                     | Full verification orchestration prompt.                                                |

## Coordination

When multiple agents run concurrently, avoid overlapping writes. Do not invoke the verifier while another worker has uncommitted edits on files it may normalize or format. Do not edit GitHub workflow files unless the current task explicitly owns CI.
