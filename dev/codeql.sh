#!/usr/bin/env bash
# Local CodeQL: pnpm install → database create → analyze (SARIF).
# Requires: codeql on PATH, Node/pnpm per .node-version and package.json.
# Set CODEQL_PNPM_INSTALL_FLAGS="--frozen-lockfile" for CI-like installs.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "${ROOT}"

if [[ -n ${CODEQL_PNPM_INSTALL_FLAGS-} ]]; then
	# shellcheck disable=SC2086
	pnpm install ${CODEQL_PNPM_INSTALL_FLAGS}
else
	pnpm install
fi

codeql database create .codeql_db \
	--language=javascript-typescript \
	--source-root . \
	--overwrite

codeql database analyze .codeql_db \
	"codeql/javascript-queries:codeql-suites/javascript-security-and-quality.qls" \
	--format=sarif-latest \
	--output=codeql-results.sarif \
	--download

echo "Wrote codeql-results.sarif" >&2
