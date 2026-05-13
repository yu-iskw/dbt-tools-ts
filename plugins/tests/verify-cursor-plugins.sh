# Cursor: .cursor-plugin marketplace + per-plugin manifest (sourced by verify-agent-plugins.sh).
# shellcheck shell=bash
# Schema reference: https://github.com/cursor/plugins

precheck_cursor_marketplace() {
	if [[ ! -f ${CURSOR_MARKET} ]]; then
		fail "Missing Cursor marketplace.json: ${CURSOR_MARKET}"
	fi

	if ! jq -e '.plugins | length > 0' "${CURSOR_MARKET}" >/dev/null 2>&1; then
		fail ".cursor-plugin/marketplace.json plugins array must not be empty"
	fi

	local dup
	dup="$(jq -r '.plugins[].name' "${CURSOR_MARKET}" | sort | uniq -d | head -1 || true)"
	if [[ -n ${dup} ]]; then
		fail "Duplicate Cursor marketplace plugin name: \"${dup}\""
	fi
}

cursor_marketplace_matches_codex_resolution() {
	if [[ -z ${PLUGIN_FILTER} ]]; then
		local f1 f2
		f1="$(mktemp)"
		f2="$(mktemp)"
		jq -r '.plugins[].name' "${MARKET}" >"${f1}.raw"
		sort <"${f1}.raw" >"${f1}"
		rm -f "${f1}.raw"
		jq -r '.plugins[].name' "${CURSOR_MARKET}" >"${f2}.raw"
		sort <"${f2}.raw" >"${f2}"
		rm -f "${f2}.raw"
		if ! diff -q "${f1}" "${f2}" >/dev/null; then
			rm -f "${f1}" "${f2}"
			fail "Codex and Cursor marketplace plugin name sets must match when PLUGIN_FILTER is unset (see ${MARKET} and ${CURSOR_MARKET})"
		fi
		rm -f "${f1}" "${f2}"
	fi

	local i name want_root src normalized got
	for i in "${!RESOLVED_IDS[@]}"; do
		name="${RESOLVED_IDS[${i}]}"
		want_root="${RESOLVED_ROOTS[${i}]}"
		src="$(jq -r --arg n "${name}" '.plugins[] | select(.name == $n) | .source // empty' "${CURSOR_MARKET}")"
		if [[ -z ${src} ]]; then
			fail "Cursor marketplace missing plugin \"${name}\" (add it to ${CURSOR_MARKET})"
		fi
		if [[ ${src} != ./* ]]; then
			fail "Cursor marketplace entry \"${name}\" must use a ./-prefixed source path, got \"${src}\""
		fi
		normalized="${src#./}"
		if [[ ${normalized} == *..* ]]; then
			fail "Cursor marketplace path for \"${name}\" must not contain .."
		fi
		if [[ ! -d "${REPO_ROOT}/${normalized}" ]]; then
			fail "Cursor marketplace-resolved directory missing: ${REPO_ROOT}/${normalized}"
		fi
		got="$(cd "${REPO_ROOT}/${normalized}" && pwd -P)"
		if [[ ${got} != "${want_root}" ]]; then
			fail "Cursor marketplace path for \"${name}\" does not match Codex resolution (expected ${want_root}, got ${got} from source \"${src}\")"
		fi
	done
}

cursor_validate_plugin_structure() {
	local plugin_id="$1"
	local plugin_root="$2"

	local cursor_m
	cursor_m="${plugin_root}/.cursor-plugin/plugin.json"
	[[ -f ${cursor_m} ]] || fail "Missing Cursor plugin manifest (${plugin_id})"

	local cname
	cname="$(jq -r '.name' "${cursor_m}")"
	if [[ ${cname} != "${plugin_id}" ]]; then
		fail "Cursor manifest name must be \"${plugin_id}\", got \"${cname}\""
	fi

	local p
	for p in skills rules agents; do
		local raw
		raw="$(jq -r --arg k "${p}" '.[$k] // empty | if type == "string" then . else empty end' "${cursor_m}")"
		if [[ -n ${raw} ]]; then
			local rel="${raw#./}"
			local target="${plugin_root}/${rel}"
			[[ -d ${target} ]] || fail "Cursor manifest ${p} path missing or not a directory (${plugin_id}): ${target}"
		fi
	done

	local logo_raw
	logo_raw="$(jq -r '.logo // empty | if type == "string" then . else empty end' "${cursor_m}")"
	if [[ -n ${logo_raw} ]]; then
		local lrel="${logo_raw#./}"
		local lpath="${plugin_root}/${lrel}"
		[[ -f ${lpath} ]] || fail "Cursor manifest logo path missing or not a file (${plugin_id}): ${lpath}"
	fi
}

# Cursor Agent CLI: per-plugin validation when preflight passes (see plugins/CONTRIBUTING.md).
# Preflight failure → soft-skip (return 0). Validate failure after preflight succeeds → return 1.
cursor_run_plugin_validation() {
	echo "verify-agent-plugins: Cursor Agent CLI verification (cursor-agent plugin validate)…"

	if ! command -v cursor-agent >/dev/null 2>&1; then
		echo "verify-agent-plugins: preflight — Cursor Agent CLI not found; skipping Cursor Agent CLI validation (see plugins/CONTRIBUTING.md)." >&2
		return 0
	fi

	# cursor-agent may exit 0 for unknown tokens that look like subcommands; require an explicit `plugin` line in --help.
	local cursor_help
	if ! cursor_help="$(cursor-agent --help 2>&1)"; then
		echo "verify-agent-plugins: preflight — cursor-agent --help failed; skipping Cursor Agent CLI validation (see plugins/CONTRIBUTING.md)." >&2
		return 0
	fi

	if ! printf '%s\n' "${cursor_help}" | grep -qE '^[[:space:]]{2}plugin[[:space:]]'; then
		echo "verify-agent-plugins: preflight — cursor-agent does not list a top-level plugin command; skipping Cursor Agent CLI validation (see plugins/CONTRIBUTING.md)." >&2
		return 0
	fi

	if ! cursor-agent plugin validate -h >/dev/null 2>&1; then
		echo "verify-agent-plugins: preflight — cursor-agent plugin validate is not available; skipping Cursor Agent CLI validation (see plugins/CONTRIBUTING.md)." >&2
		return 0
	fi

	local i pid proot
	for i in "${!RESOLVED_IDS[@]}"; do
		pid="${RESOLVED_IDS[${i}]}"
		proot="${RESOLVED_ROOTS[${i}]}"
		echo "  … ${pid}"
		if ! (cd "${REPO_ROOT}" && cursor-agent plugin validate "${proot}"); then
			echo "verify-agent-plugins: cursor-agent plugin validate failed for ${pid}" >&2
			return 1
		fi
	done

	echo "verify-agent-plugins: Cursor Agent CLI verification OK."
}
