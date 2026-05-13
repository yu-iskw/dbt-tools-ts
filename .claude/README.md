# Claude Code Configuration

This directory contains the Claude Code configuration for AI-assisted development.

**Shared project instructions** for all coding agents live in the repository root **`AGENTS.md`**. Root **`CLAUDE.md`** imports that file with **`@AGENTS.md`** (see [Anthropic: AGENTS.md](https://docs.anthropic.com/en/docs/claude-code/claude-md#agentsmd)) and then adds **Claude-only** sections (skills, agents, hooks). The first time you open the project, Claude may ask you to **approve external file includes** so `@AGENTS.md` is expanded into context.

## Structure

```text
.claude/
├── README.md              # This file
├── settings.json          # Hooks, permissions, and environment
├── agents/                # Specialized subagents (Cursor-compatible markdown)
│   └── verifier.md
├── skills/                # Reusable workflows (slash commands)
│   ├── build-and-fix/
│   ├── check-directory-structure/
│   ├── codeql-fix/
│   ├── improve-claude-config/
│   ├── initialize-project/
│   ├── lint-and-fix/
│   ├── manage-adr/
│   ├── node-upgrade/
│   ├── postmortem/
│   ├── security-scan/
│   ├── security-vulnerability-audit/
│   ├── setup-dev-env/
│   └── test-and-fix/
└── hooks/
    ├── block-dangerous.sh
    ├── format-ts.sh
    └── validate-commit.sh
```

## Quick Start

### Using Skills

Invoke skills with slash commands:

```bash
/setup-dev-env
/lint-and-fix
/test-and-fix
```

### Using Agents

Agents are specialized assistants invoked via the Task tool:
The `verifier` agent is skill-driven and must delegate each phase to the listed skills in `.claude/agents/verifier.md`.

| Agent        | Purpose                        |
| ------------ | ------------------------------ |
| **verifier** | Runs build → lint → test cycle |

### Self-Improvement

This configuration supports self-evolution. Use `/improve-claude-config` when:

- Claude makes repeated mistakes
- You want to automate a recurring workflow
- New conventions should be documented

## Configuration Files

### settings.json

Contains:

- **permissions**: Allowed and denied commands
- **hooks**: Automatic triggers for tool events

### AGENTS.md (repository root)

Canonical instructions for **all** coding agents (stack, commands, quality gates, style). Update this file when repo-wide behavior should change for everyone.

### CLAUDE.md (repository root)

Composes **`@AGENTS.md`** plus Claude-specific tables (skills, agents, self-improvement). Keep the Claude-only portion concise; prefer **`AGENTS.md`** for shared guidance.

## Best Practices

1. **Keep shared guidance in `AGENTS.md`** so Cursor, Codex, Copilot, and Gemini stay aligned.
2. **Keep the Claude-only tail of `CLAUDE.md` small**; move long procedural detail into `.claude/skills/`.
3. **Test hooks** before committing changes to `.claude/hooks/`.
4. **Version control** `.claude/` and root instruction files together with clear commit messages.

## Customization

### Adding a New Skill

1. Create directory: `.claude/skills/<skill-name>/`
2. Create `SKILL.md` with YAML frontmatter and markdown content
3. Invoke with `/<skill-name>`

### Adding a New Hook

1. Create script in `.claude/hooks/`
2. Make executable: `chmod +x .claude/hooks/<script>.sh`
3. Register in `.claude/settings.json` under the appropriate event

### Adding a New Agent

1. Create `.claude/agents/<agent-name>.md`
2. Define name, description, tools, and model in frontmatter
3. Write agent instructions in markdown body
