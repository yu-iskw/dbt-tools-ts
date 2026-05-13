# Layout and verification (dbt-tools-cli plugin skills)

## Decision record

[ADR-0007: First-party coding agent plugins and repository verification](../../../../docs/adr/0007-first-party-coding-agent-plugins-and-repository-verification.md) — one plugin tree under `plugins/<plugin-id>/`, parallel manifests (`.claude-plugin`, `.codex-plugin`, `.cursor-plugin`), and `skills/` at the plugin root.

## Structural checks (Codex)

[`plugins/tests/verify-codex-plugins.sh`](../../../../plugins/tests/verify-codex-plugins.sh) enforces for each plugin that:

- The Codex manifest sets **`skills`** to a string path (e.g. `./skills/`).
- That directory exists.
- Every **immediate subdirectory** of `skills/` contains a **`SKILL.md`** (one skill per folder).
- There is **at least one** skill directory.

So each new workflow must be `plugins/dbt-tools-cli/skills/<id>/SKILL.md`, not a loose file under `skills/`.

## Orchestrator

[`plugins/tests/verify-agent-plugins.sh`](../../../../plugins/tests/verify-agent-plugins.sh) runs **structural** verification (marketplaces, manifests, skills layout) and optional vendor `plugin validate` phases. From the repo root:

```bash
./plugins/tests/verify-agent-plugins.sh structural
```

Operational detail and Docker image: [`plugins/CONTRIBUTING.md`](../../../../plugins/CONTRIBUTING.md).

## What structural does not replace

After adding or editing skills, still run the repository quality gates from the root:

```bash
pnpm lint:report
pnpm coverage:report
pnpm knip
```

Markdown-only changes usually do not affect coverage; keep the suite green before merging.

## FQH vs YAML `name` (plugin skills)

- **FQH:** Logical handle `dbt-tools-cli:<skill-folder>` for READMEs and disambiguation — see [`plugins/dbt-tools-cli/README.md`](../../../../plugins/dbt-tools-cli/README.md) (**Skill handles** and **Host compatibility**).
- **YAML `name` in `SKILL.md`:** Must match the folder name only (`status`, `discover`, …). Per [Agent Skills](https://agentskills.io/specification) and [VS Code Agent Skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills), do **not** put colons, slashes, or namespace prefixes in `name` (invalid skills may **silently** fail to load in VS Code).
- **Gate vs investigation:** [`dbt-artifacts-status`](../../../../plugins/dbt-tools-cli/skills/dbt-artifacts-status/SKILL.md) links to [`status`](../../../../plugins/dbt-tools-cli/skills/status/SKILL.md) for field-level JSON; command matrix stays in [`references/readiness.md`](../../../../plugins/dbt-tools-cli/skills/dbt-artifacts-status/references/readiness.md).
