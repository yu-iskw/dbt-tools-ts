---
name: dbt-tools-web-pack-npx-smoke
description: Pack @dbt-tools/web to a tarball and smoke-test the published dbt-tools-web CLI via npx without npm publish. Use when verifying the npm distribution, pre-release checks, bin/dist-serve layout, or fixing pack/npx failures for the web package.
compatibility: Requires pnpm and Node as in repo .node-version; npx (npm). Run from repository root unless noted.
---

# @dbt-tools/web pack + `npx` smoke

## Trigger scenarios

Use this skill when the user or task implies:

- Verify **packed** / **published-shaped** **`@dbt-tools/web`** (tarball, `bin`, `dist` + `dist-serve`).
- Smoke-test **`dbt-tools-web`** via **`npx`** **without publishing** to the public registry.
- Debug **`npx`** + local **`.tgz`** failures (`Permission denied`, missing `dist-serve`, wrong deps in tarball, `ETARGET` for workspace peers).
- Pre-release or CI parity with the web pack + `npx` smoke job.

Do **not** substitute this for Playwright E2E (`pnpm test:e2e`) or full UI regression; use **`dbt-tools-web-e2e-fix`** for browser E2E.

## Purpose

Ensure the npm pack artifact installs and exposes the `dbt-tools-web` binary correctly. This catches mistakes in `package.json` `bin`, `files`, `prepack` build, and workspace dependency rewriting that unit tests and Vite dev do not cover.

## Commands (summary)

From the **repository root** after `pnpm install`:

**CI parity (recommended):** `bash scripts/smoke-npx-with-verdaccio.sh` starts Verdaccio, publishes `@dbt-tools/core` and `@dbt-tools/web` into the local registry, packs web, and runs [`smoke:npx-tgz`](../../../packages/web/package.json) with `NPM_CONFIG_REGISTRY` pointed at Verdaccio. The `dbt-artifacts-parser` dependency is resolved from npm; this repository does not build or publish the parser package.

**Manual tarball-only path** (only if `dbt-artifacts-parser` and `@dbt-tools/core` versions exist on the registry you use, or you set `NPM_CONFIG_REGISTRY` after publishing peers elsewhere):

1. `pnpm --filter @dbt-tools/web pack` — creates `dbt-tools-web-<version>.tgz` at the repo root.
2. `pnpm --filter @dbt-tools/web run smoke:npx-tgz` or `npx -y --package="$TGZ" -- dbt-tools-web --help` from a clean temp dir (see [references/commands-and-pitfalls.md](references/commands-and-pitfalls.md)).

Details, optional HTTP smoke, `ETARGET` / missing peers, and the absolute-path `npx` pitfall are in [references/commands-and-pitfalls.md](references/commands-and-pitfalls.md).

## Verification loop

1. Prefer `bash scripts/smoke-npx-with-verdaccio.sh` from the repo root; it must exit 0.
2. Or run the manual path: pack → exactly one `dbt-tools-web-*.tgz` at repo root → smoke with a registry that has `dbt-artifacts-parser` and `@dbt-tools/core` at the packed versions.
3. On failure, read stderr (`ETARGET`, `Permission denied`, missing `dist-serve`). Fix web `package.json`, Vite server build (`vite.server.config.ts`), prepack/build scripts, or Verdaccio/publish wiring, then rerun.

`pack` triggers `prepack` and may rebuild the web package even after `pnpm build`; that is expected and matches publish behavior.

## Related skills and docs

- Playwright E2E: [`dbt-tools-web-e2e-fix`](../dbt-tools-web-e2e-fix/SKILL.md)
- Monorepo build errors: [`build-and-fix`](../build-and-fix/SKILL.md)
- End-user README: [packages/web/README.md](../../../packages/web/README.md)

## Verifier agent

When invoked as part of verification, run this smoke after `pnpm build` succeeds so TypeScript/Vite issues are caught first. Prefer `bash scripts/smoke-npx-with-verdaccio.sh` for CI parity. Report whether the script, or pack + `npx --help`, passed.

Full gate order and reporting live in [`.claude/agents/verifier.md`](../../agents/verifier.md).
