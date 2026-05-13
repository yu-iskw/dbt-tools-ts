---
name: security-scan
description: Scan for vulnerable dependencies and CVEs via pnpm lint:security (Trunk Trivy/OSV-scanner), optional pnpm security:grype or pnpm lint:all (Trunk-all plus Grype). Use for dependency CVE checks, security-scoped lint, or post-bump verification.
compatibility: Node and pnpm versions per `.node-version` and root `package.json` `engines`; run `pnpm install` from repo root. Run `pnpm exec trunk install` if Trunk-managed linters are missing (see AGENTS.md). `grype` must be on PATH for `pnpm security:grype` and the Grype step in `pnpm lint:all`.
---

# Security scan: vulnerable dependencies

## Purpose

Filesystem and dependency vulnerability checks for this TypeScript monorepo:

- **`pnpm lint:security`** — `trunk check --all --scope security` (Trivy, OSV-scanner, and other security-scoped linters in [`.trunk/trunk.yaml`](../../../.trunk/trunk.yaml)).
- **`pnpm security:grype`** — Anchore Grype on the repo root (`grype` on PATH; not installed via pnpm — see [`knip.json`](../../../knip.json) `ignoreBinaries`).
- **`pnpm lint:all`** (optional, slower) — full Trunk check across all files, then Grype — CI-style thoroughness.

Default incremental Trunk: **`pnpm lint`** (`trunk check -y`). Prefer **`pnpm lint:security`** when the goal is vulnerability scanning.

See [`AGENTS.md`](../../../AGENTS.md) for the layered harness (for example ESLint with `eslint-plugin-security` alongside Trivy/OSV).

## When to use

- Scan for CVEs or vulnerable dependencies
- Third-party / supply-chain review
- After dependency bumps: root and workspace `package.json` files, [`pnpm-lock.yaml`](../../../pnpm-lock.yaml), and root [`package.json`](../../../package.json) `pnpm.overrides` when triaging transitive issues

## How to run

From the repository root:

```bash
pnpm lint:security
pnpm security:grype
```

Thorough pass (Trunk-all plus Grype):

```bash
pnpm lint:all
```

If Trunk tools are missing: `pnpm exec trunk install` per [`AGENTS.md`](../../../AGENTS.md).

Debugging parity: `pnpm security:grype` matches `grype .`. For Trivy/OSV, prefer **`pnpm lint:security`** so versions match Trunk; use standalone CLIs only when reproducing or debugging outside Trunk.

## Fix loop

1. **Identify:** Parse tool output; note affected manifests (`pnpm-lock.yaml`, root or `packages/*/package.json`) and CVE IDs.
2. **Triage:** Direct versus transitive dependencies; confirm reachability when prioritizing.
3. **Fix:** Prefer `pnpm up`, targeted `pnpm add`, or root `pnpm.overrides` when appropriate; run **`pnpm install`** after lockfile changes so scans match what you ship.
4. **Verify:** Re-run **`pnpm lint:security`** and **`pnpm security:grype`** (or **`pnpm lint:all`**) until clean or remaining issues are accepted with rationale.

## Termination

- Checks exit zero with no actionable findings, or
- Residual risk is explicitly accepted, or
- Stop after a sensible iteration cap (default: 3) and summarize blockers.

## Related commands (repo)

- **`pnpm lint`** — default Trunk check
- **`pnpm lint:security`** — security-scoped Trunk (Trivy/OSV and related linters)
- **CodeQL:** [codeql-fix](../codeql-fix/) when CodeQL is configured for this repo
- **Workspace and bumps:** [`AGENTS.md`](../../../AGENTS.md) (pnpm workspace) and [`CLAUDE.md`](../../../CLAUDE.md) for agent-specific workflows
