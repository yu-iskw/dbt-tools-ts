---
name: dbt-tools-cli-plugin-skill
description: Author a new agent skill under plugins/dbt-tools-cli/skills for @dbt-tools/cli; layout, plugin README index, and structural verification.
compatibility: Repository dbt-tools-ts; skills under plugins/dbt-tools-cli/skills/.
---

# dbt-tools-cli plugin skill (authoring)

## Triggers

Use this skill when the user asks or implies:

- Add, scaffold, or document a **new skill** for **`@dbt-tools/cli`** / `dbt-tools`
- Extend **`plugins/dbt-tools-cli/skills/`** with another workflow
- Make plugin skills **pass** repo verification or align with **ADR-0007** layout

This is a **meta-skill** (how to add plugin skills). It does not replace the CLI reference in [`packages/cli/README.md`](../../../packages/cli/README.md).

## What you are adding

**Plugin skills** live here:

- `plugins/dbt-tools-cli/skills/<kebab-case-id>/SKILL.md`

They ship with the **dbt-tools-cli** agent plugin ([`plugins/dbt-tools-cli/`](../../../plugins/dbt-tools-cli/)). Per-engine manifests already set `skills` to `./skills/`—**you do not edit** `.codex-plugin`, `.cursor-plugin`, or `.claude-plugin` just to add another subdirectory skill.

**Do not** add or edit **marketplace** entries ([`.agents/plugins/marketplace.json`](../../../.agents/plugins/marketplace.json), [`.cursor-plugin/marketplace.json`](../../../.cursor-plugin/marketplace.json)) for a new skill inside an **existing** plugin; marketplaces list **plugins**, not individual skills.

## FQH vs YAML `name`

- **FQH (documentation only):** `<plugin-id>:<skill-folder>` — for this plugin, `dbt-tools-cli:` plus the kebab-case directory under `skills/` (example: `dbt-tools-cli:discover`). Plugin id matches [`plugins/dbt-tools-cli/.claude-plugin/plugin.json`](../../../plugins/dbt-tools-cli/.claude-plugin/plugin.json) `name` (same across engine manifests). Use FQH in the plugin README **Handle** column, runbooks, and a single **Skill handle (FQH)** line under each skill’s main `#` title.
- **YAML `name`:** Must **equal the folder name only** (e.g. `name: discover`). [Agent Skills](https://agentskills.io/specification) allows lowercase letters, numbers, hyphens only; no `:` or `/`. [VS Code Agent Skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills) forbid namespace prefixes in `name` and may **silently** skip invalid skills.
- **Slash / picker tokens:** Hosts apply their own rules (Claude Code plugin namespace, VS Code `/plugin:skill`, Codex `$`, etc.). See **Host compatibility** in [`plugins/dbt-tools-cli/README.md`](../../../plugins/dbt-tools-cli/README.md).

## Authoring steps

1. **Pick an id** — kebab-case folder name (e.g. `my-workflow`). Use the **same** string for YAML **`name:`** in `SKILL.md`. Avoid clashing with existing skills (for example [`dbt-artifacts-status`](../../../plugins/dbt-tools-cli/skills/dbt-artifacts-status/SKILL.md)).

2. **Create** `plugins/dbt-tools-cli/skills/<id>/SKILL.md` with frontmatter and body (see skeleton below).

3. **Content rules**
   - **Triggers** and **when to use** — help agents discover the skill.
   - **Commands** — link to [`packages/cli/README.md`](../../../packages/cli/README.md) for flags and options; prefer `dbt-tools schema` for discovery. JSON is the default stdout format; document `--format text` when human output is needed.
   - **Workflow order** — e.g. artifact check → search → deps; do not paste the full CLI reference.
   - **Artifact readiness** — if the workflow needs `manifest.json` / `run_results.json`, point to or compose with [`dbt-artifacts-status`](../../../plugins/dbt-tools-cli/skills/dbt-artifacts-status/SKILL.md) instead of duplicating readiness rules.
   - **Progressive disclosure** — long tables in `references/` under the same skill directory (see exemplar [`references/readiness.md`](../../../plugins/dbt-tools-cli/skills/dbt-artifacts-status/references/readiness.md)).

4. **Link depth** — From `plugins/dbt-tools-cli/skills/<id>/SKILL.md`, the repo root is **four** levels up (`../../../../`). Example: `../../../../packages/cli/README.md` for flags and extended topics.

5. **Index** — Add a row to [`plugins/dbt-tools-cli/README.md`](../../../plugins/dbt-tools-cli/README.md) skills table: **Handle** (`dbt-tools-cli:<id>`), **Skill** (link to `skills/<id>/SKILL.md`), **Purpose** (one line). Keep the table’s **Skill handles** and **Host compatibility** sections accurate if you change plugin id or add skills.

6. **Verify** — From repository root:

```bash
./plugins/tests/verify-agent-plugins.sh structural
pnpm lint:report
pnpm coverage:report
pnpm knip
```

Structural rules and ADR pointer: [references/layout-and-verification.md](references/layout-and-verification.md).

## Skeleton for a new plugin skill

Use as a starting point (replace `my-workflow` and fill sections):

```yaml
---
name: my-workflow
description: One or two sentences for agent discovery; mention dbt-tools and the task.
---

# My workflow

**Skill handle (FQH):** `dbt-tools-cli:my-workflow` (plugin `dbt-tools-cli`, skill directory `my-workflow`). Documentation only; YAML `name` stays `my-workflow`.

## When to use

## Commands

Link to [packages/cli/README.md](../../../../packages/cli/README.md) for flags; prefer `dbt-tools schema`. Default output is JSON; mention `--format text` only when human-readable stdout is required.

## Related

- [packages/cli/README.md](../../../../packages/cli/README.md) — Field Filtering, Input Validation, Error handling, Automation
```

**README table row** example (match [`plugins/dbt-tools-cli/README.md`](../../../plugins/dbt-tools-cli/README.md)):

```markdown
| `dbt-tools-cli:my-workflow` | [`my-workflow`](skills/my-workflow/SKILL.md) | Short purpose line. |
```

## Related

- Plugin discovery (end users): [`plugins/README.md`](../../../plugins/README.md)
- Verification and CI (contributors): [`plugins/CONTRIBUTING.md`](../../../plugins/CONTRIBUTING.md)
- Exemplar skill: [`dbt-artifacts-status`](../../../plugins/dbt-tools-cli/skills/dbt-artifacts-status/SKILL.md)
