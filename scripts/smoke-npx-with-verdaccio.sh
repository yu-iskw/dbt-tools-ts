#!/usr/bin/env bash
# Local Verdaccio: publish the workspace @dbt-tools packages needed by the
# packed web tarball, while dbt-artifacts-parser resolves from npm through Verdaccio proxy.
set -euo pipefail

if [[ -n ${REPO_ROOT-} ]]; then
	:
elif [[ -n ${1-} ]]; then
	REPO_ROOT="$1"
else
	if ! REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
		echo "smoke-npx-with-verdaccio.sh: set REPO_ROOT or pass the monorepo root as the first argument, or run inside a git repository." >&2
		exit 1
	fi
fi

cd "${REPO_ROOT}" || exit 1

VERDACCIO_VERSION=${VERDACCIO_VERSION:-6.0.5}
REGISTRY_URL=${REGISTRY_URL:-http://127.0.0.1:4873}

verdaccio_pid=""
npmrc_smoke=""

assert_core_byte_cap_export() {
	local label=$1
	local file=$2
	if ! grep -q 'readStreamWithByteCap' "${file}"; then
		echo "smoke: ${label} missing readStreamWithByteCap" >&2
		exit 1
	fi
}

cleanup() {
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

mkdir -p /tmp/verdaccio-smoke-storage
rm -rf /tmp/verdaccio-smoke-storage/*

# Do not set NPM_CONFIG_USERCONFIG before npx fetches Verdaccio (registry would point at localhost).
npx --yes "verdaccio@${VERDACCIO_VERSION}" \
	--config "${REPO_ROOT}/scripts/verdaccio-smoke.yaml" \
	--listen 127.0.0.1:4873 >/tmp/verdaccio-smoke.log 2>&1 &
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

# npm 10+ may refuse publish without a token; Verdaccio accepts any token when publish is $all.
npmrc_smoke="$(mktemp)"
{
	printf 'registry=%s/\n' "${REGISTRY_URL}"
	printf '@dbt-tools:registry=%s/\n' "${REGISTRY_URL}"
	printf '//127.0.0.1:4873/:_authToken=smoke-ci-placeholder\n'
} >"${npmrc_smoke}"
export NPM_CONFIG_USERCONFIG="${npmrc_smoke}"
export NPM_CONFIG_REGISTRY="${REGISTRY_URL}"

pnpm --filter @dbt-tools/core run build

assert_core_byte_cap_export \
	"workspace @dbt-tools/core build" \
	"${REPO_ROOT}/packages/core/dist/io/read-bytes-capped.js"

(
	cd packages/core
	npm publish --registry "${REGISTRY_URL}" --access public
)
core_ver="$(node -p "require('./packages/core/package.json').version")"
core_tgz="$(npm pack "@dbt-tools/core@${core_ver}" \
	--registry "${REGISTRY_URL}" --pack-destination /tmp | tail -1)"
assert_core_byte_cap_export \
	"published @dbt-tools/core" \
	<(tar -xOf "/tmp/${core_tgz}" package/dist/io/read-bytes-capped.js)
rm -f "/tmp/${core_tgz}"
(
	cd packages/web
	npm publish --registry "${REGISTRY_URL}" --access public
)

rm -f "${REPO_ROOT}"/dbt-tools-web-*.tgz
pnpm --filter @dbt-tools/web pack

export REPO_ROOT
pnpm --filter @dbt-tools/web run smoke:npx-tgz
