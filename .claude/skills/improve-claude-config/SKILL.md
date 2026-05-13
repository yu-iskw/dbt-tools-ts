---
name: improve-claude-config
description: Self-improvement skill for evolving Claude Code configuration. Use when you notice repeated mistakes, want to add new workflows, or optimize the development experience.
---

# Improve Claude Configuration

## Purpose

This skill enables Claude Code to evolve and improve its own configuration based on observed patterns, user feedback, and development needs.

## When to Use

Invoke this skill when:

- You've explained the same concept to Claude multiple times
- Claude repeatedly makes the same type of mistake
- A new workflow pattern has emerged that should be automated
- Hooks could prevent recurring issues
- New skills would benefit the project

## Self-Improvement Workflow

### 1. Analyze Current State

Read and understand the current configuration:

```bash
# Shared instructions (all agents)
read_file AGENTS.md

# Claude-only tail (skills, agents, learnings)
read_file CLAUDE.md

# List all skills
list_dir .claude/skills/

# List all agents
list_dir .claude/agents/

# View current hooks
read_file .claude/settings.json
```

### 2. Identify Improvement Opportunity

| Pattern                     | Action                                             |
| --------------------------- | -------------------------------------------------- |
| Repeated explanation        | Add to `AGENTS.md` or create a skill               |
| Recurring mistake           | Add rule to `AGENTS.md` (shared) or create a skill |
| Manual repetitive task      | Create a hook                                      |
| Complex workflow            | Create a skill                                     |
| Specialized task delegation | Create an agent                                    |

### 3. Implement Improvement

#### Adding shared rules

For repo-wide conventions or gotchas every agent should follow, edit **`AGENTS.md`**.

For Claude-only notes (slash commands, hook behavior), append under **`## Claude Code`** or **Recent learnings** in **`CLAUDE.md`**.

#### Creating a New Skill

1. Create directory: `.claude/skills/<skill-name>/`
2. Create `SKILL.md` with standard structure.

#### Creating a New Hook

Add to `.claude/settings.json` and create the corresponding script in `.claude/hooks/`.

### 4. Validate Changes

1. Verify JSON syntax in `settings.json`.
2. Test hooks if added.
3. Verify skill loads correctly.

## Best Practices

1. **Be minimal**: Only add what's necessary
2. **Be specific**: Vague rules are ignored
3. **Test changes**: Validate hooks and skills work
4. **Version control**: Commit configuration changes with clear messages
