---
name: check-directory-structure
description: Inspect repository layout with tree and find, compare to AGENTS.md conventions, and fix misplaced or overly flat generated files. Use when auditing folder structure, after scaffolding or bulk file generation, when output looks flat, or when asked where code/tests/docs should live. Supports inspecting the repository root or a specified subdirectory.
compatibility: Unix-like shell. POSIX find required; optional tree for readability (install via OS package manager if missing). Run from inside the working tree; set TARGET to the directory to inspect (default `.` for the current directory, often the repo root after `cd`).
---

# Check directory structure

## Purpose

Ground work in the **actual** on-disk layout and catch **flat or misplaced** output (for example many new files at the repository root) before finishing a task.

## When to use

- After scaffolding, renaming packages, or generating several new files
- When imports or paths feel wrong compared to where files really live
- When the user asks where code, tests, or scripts should live
- When output looks like a **flat dump** instead of nested package layout

## How to run

Read **Architecture** and testing layout in [`AGENTS.md`](../../../AGENTS.md). Resolve workspace packages from [`pnpm-workspace.yaml`](../../../pnpm-workspace.yaml) and `packages/*/package.json` on disk (package names stay template placeholders until [`initialize-project`](../initialize-project/SKILL.md) runs).

**Target directory:** By default, inspect the **current directory** (after `cd` to the repository root, that is the whole repo). To inspect only a subtree—for example a single package—set `TARGET` to that path (repo-relative or absolute). Examples: `TARGET=.` (same as root after `cd` to repo root), `TARGET=packages/common`, `TARGET=packages/common/src`. Use the same `TARGET` in every command below.

```bash
# From repository root; inspect whole repo
TARGET=.

# Or inspect only a subtree (repo-relative or absolute path)
TARGET=packages/common
```

### 1. Snapshot layout

**Optional — readable tree** (skip if `tree` is not installed):

```bash
tree -L 3 -a -I '.git|node_modules|dist|build|coverage|.next|.turbo|.vite|out|.cache|*.tsbuildinfo' "${TARGET:-.}"
```

**POSIX `find` — works without `tree`:** run from inside `TARGET` and skip heavy or generated directories (same idea as the optional `tree -I` list: `node_modules`, `dist`, `build`, `coverage`, caches, and similar).

```bash
# Prune names match the tree -I set (directory basename -name, any depth)
# Immediate children of TARGET (plus `.` for the root of the scanned tree)
(cd "${TARGET:-.}" && find . \( -name '.git' -o -name 'node_modules' -o -name 'dist' -o -name 'build' -o -name 'coverage' -o -name '.next' -o -name '.turbo' -o -name '.vite' -o -name 'out' -o -name '.cache' \) -prune -o -maxdepth 1 -print)

# Sample of files under TARGET (cap output on large trees)
(cd "${TARGET:-.}" && find . \( -name '.git' -o -name 'node_modules' -o -name 'dist' -o -name 'build' -o -name 'coverage' -o -name '.next' -o -name '.turbo' -o -name '.vite' -o -name 'out' -o -name '.cache' \) -prune -o -type f -print | head -200)
```

**Optional — depth signal** (rough hint for flat vs nested paths under `TARGET`):

```bash
(cd "${TARGET:-.}" && find . \( -name '.git' -o -name 'node_modules' -o -name 'dist' -o -name 'build' -o -name 'coverage' -o -name '.next' -o -name '.turbo' -o -name '.vite' -o -name 'out' -o -name '.cache' \) -prune -o -type f -print | awk -F/ '{ print NF-1 }' | sort -n | tail -5)
```

If `TARGET` is not the repository root, map what you see back to the **full** repo layout in [`AGENTS.md`](../../../AGENTS.md) (for example `packages/*` vs root shared config).

### 2. Compare to this repository

- **Package code** lives under **`packages/*`** (and **`src/`** inside a package when used), not loose application modules dumped at the repository root.
- **Tests** live in **`tests/`** or as colocated **`*.test.ts`** (see [`AGENTS.md`](../../../AGENTS.md)).
- **Root:** shared scripts and repo-wide config; **CI:** `.github/workflows/`; **ADRs:** `docs/adr/` when used; agent/tooling **`.claude/`**, **`.cursor/`**, etc., per **Architecture** in `AGENTS.md`.

If packages still use template names but the project should use real scope names, follow [`initialize-project`](../initialize-project/SKILL.md).

### 3. Fix loop

1. **Move** misplaced files to match the conventions above.
2. **Update** imports, `package.json` / workspace references, and docs or CI if paths changed.
3. **Verify** with `pnpm lint && pnpm test` per [`AGENTS.md`](../../../AGENTS.md).

## Termination

- Layout matches documented conventions, or
- Remaining differences are **explicitly accepted** with a short rationale, or
- After **2** relocate/fix iterations, stop and list remaining items for the user.

## Related

- [`AGENTS.md`](../../../AGENTS.md) — Architecture, testing, quick commands
- [`CLAUDE.md`](../../../CLAUDE.md) — Claude Code entrypoint and `.claude/` layout
- [`initialize-project`](../initialize-project/SKILL.md) — Rename packages and bootstrap from this template
