# Pack + `npx` smoke — commands and pitfalls

## Why this workflow

For end users, `@dbt-tools/web` ships as an npm tarball with `bin` pointing to `dist-serve/server/cli.js`.

| Approach                        | Fidelity | Cost   | Notes                                                  |
| ------------------------------- | -------- | ------ | ------------------------------------------------------ |
| Tarball + `npx`                 | High     | Medium | Matches registry install semantics.                    |
| `npm install ./tgz` + bin       | High     | Medium | Extra install step.                                    |
| `npm link` / `pnpm link`        | Medium   | Low    | Differs from `npx` cache install.                      |
| `node dist-serve/server/cli.js` | Low      | Low    | Skips `files`, `bin`, and dependency rewrite behavior. |
| Local Verdaccio + scoped `npx`  | Highest  | High   | Matches full registry resolution for workspace peers.  |

**CI-style default:** [`scripts/smoke-npx-with-verdaccio.sh`](../../../../scripts/smoke-npx-with-verdaccio.sh) starts an ephemeral Verdaccio registry, publishes `@dbt-tools/core` and `@dbt-tools/web`, packs web, then runs `npx` with `NPM_CONFIG_REGISTRY` pointing at Verdaccio. `dbt-artifacts-parser` is resolved from npm; it is not built or published from this repository.

**Manual default:** pack with pnpm, then run `npx` from an empty directory using `--package` for absolute tarball paths. This only works without extra setup if `dbt-artifacts-parser` and `@dbt-tools/core` at the packed versions already exist on the registry you use.

## Commands (repository root)

### Same as CI: Verdaccio + publish + pack + `npx`

After `pnpm install`, from the repo root:

```bash
bash scripts/smoke-npx-with-verdaccio.sh
```

The script uses [`scripts/verdaccio-smoke.yaml`](../../../../scripts/verdaccio-smoke.yaml) and a temporary npm config. Do not set `NPM_CONFIG_USERCONFIG` before `npx verdaccio` starts, or `npx` may try to fetch Verdaccio from localhost.

### Parser package availability (manual pack path only)

Web `prepack` runs `@dbt-tools/core` `tsc`, which resolves `dbt-artifacts-parser/manifest` and related subpaths from the installed npm package. For manual `pnpm --filter @dbt-tools/web pack`, make sure dependencies are installed from a registry version that contains those package exports.

### Pack (manual path)

```bash
pnpm --filter @dbt-tools/web pack
```

This produces `dbt-tools-web-<version>.tgz` at the repo root.

### Tarball-only smoke

```bash
pnpm --filter @dbt-tools/web run smoke:npx-tgz
```

Smoke help from a clean directory with an absolute tarball path:

```bash
TGZ="$PWD/dbt-tools-web-0.4.1.tgz"   # adjust version
cd "$(mktemp -d)"
npx -y --package="$TGZ" -- dbt-tools-web --help
```

Or copy the tarball into the clean directory and use a relative path:

```bash
cd "$(mktemp -d)"
cp "$REPO_ROOT/dbt-tools-web-0.4.1.tgz" .
npx -y ./dbt-tools-web-0.4.1.tgz -- --help
```

## Pitfalls

- `npm error notarget` / `No matching version found for @dbt-tools/core@...`: the packed web tarball lists concrete semver peers. A clean-dir `npx` install hits the registry for those peers. Use the Verdaccio script or publish peers to the registry first.
- Bare absolute path to `.tgz` as the first `npx` argument can yield `Permission denied`; use `--package=/abs/path/... -- dbt-tools-web`, or a relative `./file.tgz`.
- `npm pack` without pnpm can mishandle `workspace:*` dependencies; prefer `pnpm --filter @dbt-tools/web pack`.

## Optional HTTP check

With a directory containing `manifest.json` and `run_results.json`:

```bash
# Example fixture dirs exist under packages/web/e2e/fixtures/dbt-artifacts/.
npx -y --package="$TGZ" -- dbt-tools-web --target "$ARTIFACT_DIR" --port 8765 &
# curl -s -o /dev/null -w "%{http_code}
" http://127.0.0.1:8765/
```

## Pointers

- Package README: [packages/web/README.md](../../../../packages/web/README.md) — Verify publish locally.
- Smoke script: [`scripts/smoke-npx-with-verdaccio.sh`](../../../../scripts/smoke-npx-with-verdaccio.sh).
