# Claude Code: .claude-plugin + claude plugin validate (sourced by verify-agent-plugins.sh).
# shellcheck shell=bash

claude_validate_manifest_structure() {
	local plugin_id="$1"
	local plugin_root="$2"

	local claude_m
	claude_m="${plugin_root}/.claude-plugin/plugin.json"
	[[ -f ${claude_m} ]] || fail "Missing Claude plugin manifest (${plugin_id})"

	local cname
	cname="$(jq -r '.name' "${claude_m}")"
	if [[ ${cname} != "${plugin_id}" ]]; then
		fail "Claude manifest name must be \"${plugin_id}\", got \"${cname}\""
	fi
}

claude_run_plugin_validation() {
	echo "verify-agent-plugins: Claude Code verification (claude plugin validate)…"

	if ! command -v claude >/dev/null 2>&1; then
		echo "verify-agent-plugins: Claude Code CLI not found (expected claude on PATH). Run: pnpm verify:agent-plugins (Docker) or install Claude Code CLI." >&2
		return 1
	fi

	if ! claude plugin validate -h >/dev/null 2>&1; then
		echo "verify-agent-plugins: preflight — claude plugin validate is not available; skipping Claude Code CLI validation (see plugins/CONTRIBUTING.md)." >&2
		return 0
	fi

	local i pid proot
	for i in "${!RESOLVED_IDS[@]}"; do
		pid="${RESOLVED_IDS[${i}]}"
		proot="${RESOLVED_ROOTS[${i}]}"
		echo "  … ${pid}"
		if ! (cd "${REPO_ROOT}" && claude plugin validate "${proot}"); then
			echo "verify-agent-plugins: claude plugin validate failed for ${pid}" >&2
			return 1
		fi
	done

	echo "verify-agent-plugins: Claude Code verification OK."
}
