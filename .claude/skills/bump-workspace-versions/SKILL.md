---
name: bump-workspace-versions
description: Bump synchronized semver versions across the root and @dbt-tools workspace package.json files. Use when asked to "bump package version", "release patch", "set all packages to X.Y.Z", "sync semver across workspace", or "prepare npm publish version bump".
---

# Bump workspace package versions

Markdown-only skill: there are **no** scripts under this skill directory. Perform edits with your editor or copy the optional shell snippets from the reference.

## Purpose

Keep the monorepo’s **workspace `version` fields** aligned before a release. This is **not** dependency management.

## Scope

1. Read the canonical file list and rules in [references/workspace-version-policy.md](references/workspace-version-policy.md).
2. Edit **only** those five `package.json` files. Do not bulk-replace versions under `.claude/worktrees/**` or other paths.

## Inputs

- Target version: `MAJOR.MINOR.PATCH` (stable semver only unless the user explicitly requests prerelease).

## Procedure

1. From the repository root, note the current version (for example list the five `"version"` lines):

   ```bash
   rg '"version":' package.json packages/core/package.json packages/cli/package.json packages/web/package.json packages/mcp/package.json
   ```

2. Set the top-level `"version"` field in each of the five files to the **same** new value (manual edit or optional one-liner in the reference).
3. Run the **sanity checks** in the reference (`rg` and optional `perl`).

## MCP server version

[`packages/mcp/src/package-version.ts`](../../../packages/mcp/src/package-version.ts) reads `packages/mcp/package.json` at runtime. After bumping package versions you do **not** need to edit [`packages/mcp/src/server.ts`](../../../packages/mcp/src/server.ts) for the MCP advertised version.

## Out of scope

- Upgrading **npm dependencies** or lockfile churn — use [node-upgrade](../node-upgrade/SKILL.md).

## Verification

Follow [AGENTS.md](../../../AGENTS.md): run `pnpm install` if needed, then `pnpm lint:report`, `pnpm knip`, `pnpm coverage:report`, and `pnpm build` when package manifests change.

## Commit message

Suggest: `chore(release): bump workspace packages to X.Y.Z`

## Related reference

- [Workspace version policy](references/workspace-version-policy.md)
