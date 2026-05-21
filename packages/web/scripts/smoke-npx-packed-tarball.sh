#!/usr/bin/env bash
# Smoke-test dbt-tools-web via a packed tarball at the monorepo root
# (pnpm --filter @dbt-tools/web pack writes dbt-tools-web-<version>.tgz there).
# Uses npm install (not npx --package) so @dbt-tools/core resolves from NPM_CONFIG_REGISTRY when set.
set -euo pipefail
shopt -s nullglob

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../../scripts/lib/repo-root.sh"
resolve_repo_root "smoke-npx-packed-tarball.sh" "${1-}"

mapfile -t tgzs < <(printf '%s\n' "${REPO_ROOT}"/dbt-tools-web-*.tgz)
if [[ ${#tgzs[@]} -ne 1 ]]; then
	echo "Expected exactly one dbt-tools-web-*.tgz at repo root, got ${#tgzs[@]}" >&2
	ls -la "${REPO_ROOT}"/*.tgz 2>/dev/null || true
	exit 1
fi
TGZ="${tgzs[0]}"

registry_args=()
if [[ -n ${NPM_CONFIG_REGISTRY-} ]]; then
	registry_args=(--registry "${NPM_CONFIG_REGISTRY}")
fi

tmpdir="$(mktemp -d)"
cd "${tmpdir}" || exit 1
npm init -y >/dev/null 2>&1
npm install "${TGZ}" "${registry_args[@]}"

node --input-type=module -e \
	"import * as c from '@dbt-tools/core'; if (typeof c.applyEntrypointRemoteOptionsToEnv !== 'function') process.exit(1)"

./node_modules/.bin/dbt-tools-web --help
./node_modules/.bin/dbt-tools-web --version
