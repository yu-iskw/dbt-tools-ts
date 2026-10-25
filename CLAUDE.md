# CLAUDE.md

@AGENTS.md

<!-- AGENTS.md is canonical for every coding agent. Put only Claude Code–specific notes below. -->

## Claude Code

| Item                                                                                                           | Purpose                                                                                |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`.claude/skills/bump-workspace-versions/SKILL.md`](.claude/skills/bump-workspace-versions/SKILL.md)           | Bump synchronized `version` fields across workspace `package.json` files for releases. |
| [`.claude/skills/dbt-tools-web-e2e/SKILL.md`](.claude/skills/dbt-tools-web-e2e/SKILL.md)                       | Author deterministic Playwright E2E specs for `@dbt-tools/web`.                        |
| [`.claude/skills/dbt-tools-web-e2e-fix/SKILL.md`](.claude/skills/dbt-tools-web-e2e-fix/SKILL.md)               | Run and fix Playwright E2E failures.                                                   |
| [`.claude/skills/dbt-tools-web-pack-npx-smoke/SKILL.md`](.claude/skills/dbt-tools-web-pack-npx-smoke/SKILL.md) | Pack `@dbt-tools/web` and smoke the published-shaped `dbt-tools-web` binary.           |
| [`.claude/skills/dbt-tools-cli-plugin-skill/SKILL.md`](.claude/skills/dbt-tools-cli-plugin-skill/SKILL.md)     | Author and verify first-party `dbt-tools-cli` agent plugin skills.                     |
| [`.claude/skills/ui-feature-verify/SKILL.md`](.claude/skills/ui-feature-verify/SKILL.md)                       | Lightweight verification path for UI-only web changes.                                 |
| [`.claude/agents/verifier.md`](.claude/agents/verifier.md)                                                     | Full verification orchestration prompt.                                                |

When multiple agents run concurrently, avoid overlapping writes. Do not invoke the verifier while another worker has uncommitted edits on files it may normalize or format. Do not edit GitHub workflow files unless the current task explicitly owns CI.
