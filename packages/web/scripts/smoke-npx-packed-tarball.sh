#!/usr/bin/env bash
# Smoke-test dbt-tools-web via npx using a packed tarball at the monorepo root
# (pnpm --filter @dbt-tools/web pack writes dbt-tools-web-<version>.tgz there).
set -euo pipefail
shopt -s nullglob

if [[ -n ${REPO_ROOT-} ]]; then
	:
elif [[ -n ${1-} ]]; then
	REPO_ROOT="$1"
else
	if ! REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
		echo "smoke-npx-packed-tarball.sh: set REPO_ROOT or pass the monorepo root as the first argument, or run inside a git repository." >&2
		exit 1
	fi
fi

mapfile -t tgzs < <(printf '%s\n' "${REPO_ROOT}"/dbt-tools-web-*.tgz)
if [[ ${#tgzs[@]} -ne 1 ]]; then
	echo "Expected exactly one dbt-tools-web-*.tgz at repo root, got ${#tgzs[@]}" >&2
	ls -la "${REPO_ROOT}"/*.tgz 2>/dev/null || true
	exit 1
fi
TGZ="${tgzs[0]}"
tmpdir="$(mktemp -d)"
cd "${tmpdir}" || exit 1
npx -y --package="${TGZ}" -- dbt-tools-web --help
