#!/usr/bin/env bash
# Generate real jaffle_shop_duckdb artifacts for a pinned dbt Core version.
# Usage: bash scripts/generate-jaffle-fixtures.sh [dbt-core-version]
# Default Core version: 1.12.3
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/repo-root.sh
source "${SCRIPT_DIR}/lib/repo-root.sh"
resolve_repo_root "generate-jaffle-fixtures.sh"

DBT_CORE_VERSION="${DBT_CORE_VERSION:-${1:-1.12.3}}"

if [[ ! ${DBT_CORE_VERSION} =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
	echo "generate-jaffle-fixtures.sh: expected dbt Core x.y.z, got ${DBT_CORE_VERSION}" >&2
	exit 1
fi

DBT_MINOR="${DBT_CORE_VERSION%.*}"
JAFFLE_REPO="${JAFFLE_REPO:-https://github.com/dbt-labs/jaffle_shop_duckdb.git}"
RESOURCES="${REPO_ROOT}/packages/test-fixtures/dbt-artifacts-parser/resources"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/jaffle-fixtures.XXXXXX")"
cleanup() {
	rm -rf "${WORK}"
}
trap cleanup EXIT

echo "generate-jaffle-fixtures.sh: dbt-core==${DBT_CORE_VERSION} (minor ${DBT_MINOR})"
echo "generate-jaffle-fixtures.sh: workdir ${WORK}"

git clone --depth 1 "${JAFFLE_REPO}" "${WORK}/jaffle"
if python3 -c 'import ensurepip, venv' >/dev/null 2>&1; then
	python3 -m venv "${WORK}/venv"
else
	python3 -m virtualenv "${WORK}/venv"
fi
# shellcheck disable=SC1091
source "${WORK}/venv/bin/activate"
python -m pip install --upgrade pip
python -m pip install "dbt-core==${DBT_CORE_VERSION}" "dbt-duckdb"

cd "${WORK}/jaffle"
export DBT_PROFILES_DIR="${WORK}/jaffle"
dbt --version
dbt build --profiles-dir .
dbt docs generate --profiles-dir .

python - "${WORK}/jaffle/target" "${DBT_CORE_VERSION}" <<'PY'
import json
import sys
from pathlib import Path

target = Path(sys.argv[1])
major_minor = ".".join(sys.argv[2].split(".")[:2])

required = {
    "manifest.json": "manifest",
    "run_results.json": "run-results",
    "catalog.json": "catalog",
}
for filename, kind in required.items():
    path = target / filename
    if not path.is_file():
        raise SystemExit(f"missing {path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    metadata = payload.get("metadata") or {}
    dbt_version = str(metadata.get("dbt_version") or "")
    if not dbt_version.startswith(major_minor):
        raise SystemExit(f"{filename} dbt_version={dbt_version!r} does not start with {major_minor}")
    schema = str(metadata.get("dbt_schema_version") or "")
    if kind not in schema:
        raise SystemExit(f"{filename} unexpected schema {schema!r}")
    print(f"{filename}: dbt_version={dbt_version} schema={schema}")
PY

install -d "${RESOURCES}/manifest/v12/jaffle_shop"
install -d "${RESOURCES}/run_results/v6/jaffle_shop"
install -d "${RESOURCES}/catalog/v1/jaffle_shop"

cp "${WORK}/jaffle/target/manifest.json" \
	"${RESOURCES}/manifest/v12/jaffle_shop/manifest_${DBT_MINOR}.json"
cp "${WORK}/jaffle/target/run_results.json" \
	"${RESOURCES}/run_results/v6/jaffle_shop/run_results_${DBT_MINOR}.json"
cp "${WORK}/jaffle/target/catalog.json" \
	"${RESOURCES}/catalog/v1/jaffle_shop/catalog_${DBT_MINOR}.json"

echo "generate-jaffle-fixtures.sh: wrote"
echo "  ${RESOURCES}/manifest/v12/jaffle_shop/manifest_${DBT_MINOR}.json"
echo "  ${RESOURCES}/run_results/v6/jaffle_shop/run_results_${DBT_MINOR}.json"
echo "  ${RESOURCES}/catalog/v1/jaffle_shop/catalog_${DBT_MINOR}.json"
