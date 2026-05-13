#!/usr/bin/env bash
# Orchestrator: structural verification (Codex + Claude + Cursor on-disk), then CLI verification by mode.
# Sources: verify-codex-plugins.sh, verify-claude-plugins.sh, verify-cursor-plugins.sh
# PLUGIN_FILTER=<id> limits validation to one marketplace entry.
#
# Modes (first argument, or VERIFY_TARGET when argv is empty): structural | codex | claude | cursor | all
#   structural — marketplaces + on-disk layout only
#   codex|claude|cursor — structural + that vendor's plugin validate
#   all — structural + all three vendor CLIs (aggregated failure list)
#
# Each vendor runs preflight probes; unsupported CLIs soft-skip. In mode "all", a vendor failure does not
# stop the others; the script exits 1 if any vendor phase failed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# Read by verify-codex-plugins.sh (sourced below).
# shellcheck disable=SC2034
PLUGINS_ROOT="${REPO_ROOT}/plugins"
# shellcheck disable=SC2034
MARKET="${REPO_ROOT}/.agents/plugins/marketplace.json"
# shellcheck disable=SC2034
CURSOR_MARKET="${REPO_ROOT}/.cursor-plugin/marketplace.json"

declare -a RESOLVED_IDS=()
declare -a RESOLVED_ROOTS=()

fail() {
	echo "$1" >&2
	exit 1
}

trim_whitespace() {
	local s="${1-}"
	s="${s#"${s%%[![:space:]]*}"}"
	s="${s%"${s##*[![:space:]]}"}"
	printf '%s' "${s}"
}

# shellcheck disable=SC1091
source "${SCRIPT_DIR}/verify-codex-plugins.sh"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/verify-claude-plugins.sh"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/verify-cursor-plugins.sh"

run_structural_verification() {
	local i pid proot rel
	for i in "${!RESOLVED_IDS[@]}"; do
		pid="${RESOLVED_IDS[${i}]}"
		proot="${RESOLVED_ROOTS[${i}]}"
		rel="${proot#"${REPO_ROOT}/"}"
		echo "  … ${pid} (${rel})"
		# Codex, then Claude, then Cursor (per-plugin structural order).
		[[ -d ${proot} ]] || fail "Missing plugin root (${pid}): ${proot}"
		codex_validate_plugin_structure "${pid}" "${proot}"
		claude_validate_manifest_structure "${pid}" "${proot}"
		cursor_validate_plugin_structure "${pid}" "${proot}"
	done
}

run_structural_phase() {
	precheck_marketplace
	precheck_cursor_marketplace

	echo "verify-agent-plugins: structural verification (marketplaces + manifests + skills)…"
	PLUGIN_FILTER="$(trim_whitespace "${PLUGIN_FILTER-}")"

	collect_resolved_plugins
	cursor_marketplace_matches_codex_resolution
	run_structural_verification

	echo "verify-agent-plugins: structural verification OK."
}

run_vendor_cli_validations() {
	local -a failed_vendors=()
	local rc

	echo "== START: Codex CLI plugin validation"
	set +e
	codex_run_plugin_validation
	rc=$?
	set -e
	((rc == 0)) || failed_vendors+=(codex)

	echo "== START: Claude Code CLI plugin validation"
	set +e
	claude_run_plugin_validation
	rc=$?
	set -e
	((rc == 0)) || failed_vendors+=(claude)

	echo "== START: Cursor Agent CLI plugin validation"
	set +e
	cursor_run_plugin_validation
	rc=$?
	set -e
	((rc == 0)) || failed_vendors+=(cursor)

	if ((${#failed_vendors[@]})); then
		echo "verify-agent-plugins: vendor CLI validation failed for: ${failed_vendors[*]}" >&2
		exit 1
	fi
}

dispatch() {
	local mode
	mode="${1:-${VERIFY_TARGET:-all}}"
	case "${mode}" in
	structural)
		run_structural_phase
		;;
	codex)
		run_structural_phase
		codex_run_plugin_validation
		;;
	claude)
		run_structural_phase
		claude_run_plugin_validation
		;;
	cursor)
		run_structural_phase
		cursor_run_plugin_validation
		;;
	all)
		run_structural_phase
		run_vendor_cli_validations
		;;
	*)
		echo "usage: $(basename "$0") structural|codex|claude|cursor|all" >&2
		exit 1
		;;
	esac
}

dispatch "$@"
