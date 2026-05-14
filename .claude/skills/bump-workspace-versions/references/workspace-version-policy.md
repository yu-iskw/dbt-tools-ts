# Workspace version policy (dbt-tools-ts)

## Files to bump (exactly five)

From the **repository root**, these `package.json` files must carry the **same** top-level `"version"` string for a coordinated release:

| Order | Path                         |
| ----- | ---------------------------- |
| 1     | `package.json`               |
| 2     | `packages/core/package.json` |
| 3     | `packages/cli/package.json`  |
| 4     | `packages/web/package.json`  |
| 5     | `packages/mcp/package.json`  |

## Invariant

- All five `version` fields match the chosen release semver (e.g. `0.5.8`).
- Do **not** edit copies under `.claude/worktrees/**` or other sandboxes unless the user explicitly owns that worktree.

## Semver input

- Default: `MAJOR.MINOR.PATCH` only (stable release).
- Prerelease or build metadata (e.g. `1.0.0-rc.1`) only when the user explicitly requests it.

## Optional copy-paste: list current versions

```bash
rg '"version":' \
  package.json \
  packages/core/package.json \
  packages/cli/package.json \
  packages/web/package.json \
  packages/mcp/package.json
```

## Optional copy-paste: replace old with new (example)

Replace `OLD` and `NEW` before running (example: `OLD=0.5.7` `NEW=0.5.8`):

```bash
OLD=0.5.7 NEW=0.5.8 perl -pi -e 's/"version": "\Q$ENV{OLD}\E"/"version": "$ENV{NEW}"/' \
  package.json \
  packages/core/package.json \
  packages/cli/package.json \
  packages/web/package.json \
  packages/mcp/package.json
```

On macOS, `perl` in `/usr/bin` is available; if `OLD` contains regex metacharacters, prefer manual edits or escape carefully.

## Post-bump sanity

1. Confirm no stray `OLD` in those five files:

   ```bash
   rg 'OLD' package.json packages/core/package.json packages/cli/package.json packages/web/package.json packages/mcp/package.json
   ```

   (Substitute the literal old version string for `OLD`.)

2. Run `pnpm install` from the repo root if the workspace or lockfile tooling reports drift.

## Out of scope

Dependency upgrades: [node-upgrade/SKILL.md](../../node-upgrade/SKILL.md).

## Verification commands (repo root)

```bash
pnpm install
pnpm lint:report
pnpm knip
pnpm coverage:report
pnpm build
```

See [AGENTS.md](../../../../AGENTS.md) for the full quality-gate policy.
