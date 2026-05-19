---
name: explain
description: Explain a dbt resource and downstream blast radius using dbt-tools explain
  and deps --direction downstream. Use for resource context or change impact.
compatibility: dbt-tools on PATH; manifest.json required under --dbt-target.
---

# dbt-tools explain

**Skill handle (FQH):** `dbt-tools-cli:explain` (plugin `dbt-tools-cli`, skill directory `explain`). Use for documentation only; YAML `name` remains `explain` per [Agent Skills](https://agentskills.io/specification).

## When to use

- "What does this model do?"
- "What breaks if I change this resource?"
- Blast radius before a refactor

## Workflow

1. Resolve `unique_id` with [`discover`](../discover/SKILL.md) when needed.
2. `dbt-tools explain <unique_id> --dbt-target ./target --json`
3. `dbt-tools deps <unique_id> --dbt-target ./target --direction downstream --json`
4. For run cost context, use [`query-executions`](../query-executions/SKILL.md).

The removed `dbt-tools impact` command is replaced by **`deps --direction downstream`**.

## Related documentation

- [references/commands.md](references/commands.md)
- [`deps`](../deps/SKILL.md)
