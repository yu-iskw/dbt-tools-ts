#!/usr/bin/env bash
# Local Verdaccio: publish the workspace @dbt-tools packages needed by the
# packed web tarball, while dbt-artifacts-parser resolves from npm through Verdaccio proxy.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/repo-root.sh"
resolve_repo_root "smoke-npx-with-verdaccio.sh" "${1-}"

cd "${REPO_ROOT}" || exit 1

VERDACCIO_VERSION=${VERDACCIO_VERSION:-6.0.5}
REGISTRY_URL=${REGISTRY_URL:-http://127.0.0.1:4873}
REGISTRY_HOST_PORT="${REGISTRY_URL#*://}"
REGISTRY_HOST_PORT="${REGISTRY_HOST_PORT%/}"

verdaccio_pid=""
npmrc_smoke=""
smoke_home=""

cleanup() {
	if [[ -n ${smoke_home} ]]; then
		rm -rf "${smoke_home}"
		smoke_home=""
	fi
	if [[ -n ${npmrc_smoke} ]]; then
		rm -f "${npmrc_smoke}"
		npmrc_smoke=""
	fi
	if [[ -n ${verdaccio_pid} ]] && kill -0 "${verdaccio_pid}" 2>/dev/null; then
		kill "${verdaccio_pid}" 2>/dev/null || true
		wait "${verdaccio_pid}" 2>/dev/null || true
	fi
}
trap cleanup EXIT

rm -rf /tmp/verdaccio-smoke-storage
mkdir -p /tmp/verdaccio-smoke-storage

# Do not set NPM_CONFIG_USERCONFIG before npx fetches Verdaccio (registry would point at localhost).
npx --yes "verdaccio@${VERDACCIO_VERSION}" \
	--config "${REPO_ROOT}/scripts/verdaccio-smoke.yaml" \
	--listen "${REGISTRY_HOST_PORT}" >/tmp/verdaccio-smoke.log 2>&1 &
verdaccio_pid=$!

for i in $(seq 1 60); do
	if curl -sf "${REGISTRY_URL}/-/ping" >/dev/null; then
		break
	fi
	if [[ ${i} -eq 60 ]]; then
		echo "smoke-npx-with-verdaccio.sh: Verdaccio did not become ready at ${REGISTRY_URL}" >&2
		tail -50 /tmp/verdaccio-smoke.log >&2 || true
		exit 1
	fi
	sleep 1
done

npmrc_smoke="$(mktemp)"
{
	printf 'registry=%s/\n' "${REGISTRY_URL}"
	printf '@dbt-tools:registry=%s/\n' "${REGISTRY_URL}"
	printf '//%s/:_authToken=smoke-ci-placeholder\n' "${REGISTRY_HOST_PORT}"
} >"${npmrc_smoke}"

smoke_home="$(mktemp -d)"
export HOME="${smoke_home}"
export NPM_CONFIG_USERCONFIG="${npmrc_smoke}"
export NPM_CONFIG_REGISTRY="${REGISTRY_URL}"

core_version="$(node -p "require('./packages/core/package.json').version")"
web_version="$(node -p "require('./packages/web/package.json').version")"
echo "smoke-npx-with-verdaccio: publishing @dbt-tools/core@${core_version} then @dbt-tools/web@${web_version}"

publish_packed() {
	local filter=$1
	local tarball_prefix=$2
	local version=$3
	rm -f "${REPO_ROOT}"/"${tarball_prefix}"-*.tgz
	pnpm --filter "${filter}" pack
	npm publish "${REPO_ROOT}/${tarball_prefix}-${version}.tgz" \
		--registry "${REGISTRY_URL}/" --access public
}

# Publish core before web: packed web depends on @dbt-tools/core at the same semver.
# pnpm publish targets registry.npmjs.org for @dbt-tools/*; pack + npm publish honors --registry.
publish_packed @dbt-tools/core dbt-tools-core "${core_version}"
publish_packed @dbt-tools/web dbt-tools-web "${web_version}"

export REPO_ROOT
pnpm --filter @dbt-tools/web run smoke:npx-tgz
