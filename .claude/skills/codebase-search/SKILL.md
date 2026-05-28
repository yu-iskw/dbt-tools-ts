---
name: codebase-search
description: Explore this monorepo with mise-pinned fd, ripgrep (rg), and ast-grep (sg). Use when finding files, searching text or symbols, or matching TypeScript AST shapes during investigation—not for quality gates.
compatibility: Requires mise-installed tools from repository root mise.toml (fd, ripgrep, ast-grep). Run from repo root unless a path argument is shown.
---

# Codebase search

Fast, gitignore-aware exploration for coding agents. Tools are pinned in [`mise.toml`](../../../mise.toml) ([mise registry](https://mise.jdx.dev/registry.html)).

## When to use

Invoke this skill when the task involves:

- **Finding files** by name, extension, or path segment → **fd**
- **Searching contents** (strings, regex, env vars, error text) → **ripgrep** (`rg`)
- **Structural queries** (exports, imports, class/function shapes, refactor targets) → **ast-grep** (`sg run`)

Also use when replacing ad-hoc `grep`/`find`, or when the user asks how to search this repo.

**Do not** substitute these tools for quality gates — run `pnpm test`, `pnpm lint:report`, etc. from [`AGENTS.md`](../../../AGENTS.md) before claiming work complete.

## Install (once per machine)

See [references/mise-install.md](references/mise-install.md). Summary:

```bash
mise trust    # first time in this repo
mise install
eval "$(mise activate bash)"   # or mise shims on PATH
```

## Which tool?

| Goal | Tool | Binary |
| ---- | ---- | ------ |
| Which files exist? | fd | `fd` |
| What text appears inside files? | ripgrep | `rg` |
| What does the code look like syntactically? | ast-grep | `sg`, `ast-grep` |

**Rule of thumb:** `fd` → files; `rg` → contents; `sg` → structure.

All three respect `.gitignore` by default (`node_modules/`, `dist/`, etc. are skipped).

## Agent defaults (non-interactive)

Use these flags in automation (from each tool's `--help`):

| Tool | Defaults |
| ---- | -------- |
| **rg** | `--no-config --color=never`; add `--no-heading` for line parsing; `--json --no-heading` for JSON Lines |
| **fd** | Pass `.` or `-g` when the search root is a separate path; put `-x`/`-X` **last** |
| **sg run** | `-l typescript` or `-l tsx`; `--json=stream --color=never --heading=never` (note `=` after `--json`) |

## Workflow

1. **Install** — confirm `fd`, `rg`, and `sg` are on PATH ([mise-install](references/mise-install.md)).
2. **Scope** — pick a package path (`packages/core`, `packages/web/src`, …) before searching the whole tree.
3. **Find files** — [fd recipes](references/fd.md).
4. **Search text** — [ripgrep recipes](references/ripgrep.md).
5. **Match AST shapes** — [ast-grep recipes](references/ast-grep.md); patterns must be valid code snippets, not regex.
6. **Combine** — `fd … -X rg …` to search only selected files ([fd pipelines](references/fd.md)).

## Progressive disclosure

| Reference | Contents |
| --------- | -------- |
| [references/mise-install.md](references/mise-install.md) | Trust, install, activate, verify |
| [references/fd.md](references/fd.md) | File discovery, globs, `-X` pipelines, pitfalls |
| [references/ripgrep.md](references/ripgrep.md) | Content search, types, JSON output, pitfalls |
| [references/ast-grep.md](references/ast-grep.md) | `sg run`/`scan`, metavariables, repo examples, pitfalls |
| [references/official-docs.md](references/official-docs.md) | Upstream documentation links |

## Related skills

- [setup-dev-env](../setup-dev-env/SKILL.md) — optional mise step during environment setup
- [check-directory-structure](../check-directory-structure/SKILL.md) — layout audit (uses `find`/`tree`; pair with `fd` for file discovery)
