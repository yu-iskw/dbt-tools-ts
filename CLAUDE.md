# Claude Code

@AGENTS.md

Repo-wide instructions load via **`@AGENTS.md`** above; on first use in a clone, approve **external file includes** if prompted, or check **`/memory`** and [Anthropic: importing memory files](https://docs.anthropic.com/en/docs/claude-code/claude-md#import-additional-files). Directory layout for **`.claude/`**: [`.claude/README.md`](.claude/README.md).

## Parallel task execution

For large tasks that benefit from concurrent work:

```bash
/parallel-executor Add comprehensive logging to all modules
```

This pattern expects matching agent definitions under `.claude/agents/` (for example `parallel-executor`, `task-worker`); add those files to enable it.

## Available agents

Invoked via the Task tool (markdown definitions in `.claude/agents/`). Checked in: **`verifier`**.

| Agent      | Purpose                       |
| ---------- | ----------------------------- |
| `verifier` | Run build → lint → test cycle |

Add more agents as `.claude/agents/<name>.md` (see [`.claude/README.md`](.claude/README.md)).

## Available skills

Invoke with `/skill-name` when the skill is installed in this project:

| Skill                          | Purpose                                                                     |
| ------------------------------ | --------------------------------------------------------------------------- |
| `build-and-fix`                | Fix build errors, type errors, compilation failures                         |
| `check-directory-structure`    | After bulk edits; audit layout; fix flat or misplaced files                 |
| `codeql-fix`                   | CodeQL database create/analyze and SARIF-driven fixes when CodeQL is set up |
| `improve-claude-config`        | Evolve `.claude/` configuration                                             |
| `initialize-project`           | Bootstrap a new repo from this template                                     |
| `lint-and-fix`                 | Fix lint/format issues via Trunk                                            |
| `manage-adr`                   | ADRs in `docs/adr`                                                          |
| `node-upgrade`                 | Upgrade Node dependencies in pnpm workspaces                                |
| `postmortem`                   | End-of-session capture to improve rules, hooks, skills (see `AGENTS.md`)    |
| `security-scan`                | `pnpm lint:security` and `pnpm security:grype`                              |
| `security-vulnerability-audit` | Structured Trunk security audit (Trivy, OSV-scanner) and reporting          |
| `setup-dev-env`                | Node, pnpm, Trunk setup                                                     |
| `test-and-fix`                 | Fix failing tests                                                           |

## Instruction maintenance

For **when** to capture learnings, **how** to classify improvements, and **where** to edit shared vs Claude-only files, see **`AGENTS.md`** (**Session closure and postmortems**, **Improving agent behavior**). To change **`.claude/`** from Claude Code, use **`/improve-claude-config`**.
