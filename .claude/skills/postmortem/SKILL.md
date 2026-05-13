---
name: postmortem
description: End-of-session capture of failures, surprises, and lessons so agent behavior and repo config improve. Use after non-trivial work; skip trivial sessions unless something went wrong.
---

# Postmortem

## Purpose

Record what broke, what was confusing, and what should change so the same mistake is less likely next time. Prefer **small, concrete** follow-ups (one rule, one hook, one skill tweak) over large rewrites.

## When to use

- After debugging, CI/test failures, or repeated tool friction
- After non-obvious design or dependency decisions
- When you would want a one-paragraph “what we learned” for the next session

## When to skip

- Trivial sessions (typo, one-line fix, format-only) **with no** unexpected failure or surprise

## Steps

1. **Outcome:** What shipped or what state was reached (one or two sentences).
2. **What went wrong or surprised you:** Facts only — errors, false assumptions, wasted loops.
3. **Root cause (best guess):** Missing doc, wrong default, flaky test, unclear rule, etc.
4. **Action items:** Classify each as **rule** (`AGENTS.md` / `.cursor/rules/`), **hook** (`.claude/settings.json`), **skill** (`.claude/skills/`), **agent** (`.claude/agents/`), or **no change** if noise. Prefer one high-value change over a list of maybes.
5. **Optional:** Add a dated one-line bullet under **Recent learnings** in root `CLAUDE.md` when the lesson is stable and repo-wide.

Use **`/improve-claude-config`** when the follow-up is primarily evolving `.claude/` layout or automation.
