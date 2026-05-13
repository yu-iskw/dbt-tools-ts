# Codex: marketplace.json + .codex-plugin + skills layout (sourced by verify-agent-plugins.sh).
# shellcheck shell=bash

precheck_marketplace() {
	if [[ ! -f ${MARKET} ]]; then
		fail "Missing Codex marketplace.json: ${MARKET}"
	fi

	if ! jq -e '.plugins | length > 0' "${MARKET}" >/dev/null 2>&1; then
		fail "marketplace.json plugins array must not be empty"
	fi

	local dup
	dup="$(jq -r '.plugins[].name' "${MARKET}" | sort | uniq -d | head -1 || true)"
	if [[ -n ${dup} ]]; then
		fail "Duplicate marketplace plugin name: \"${dup}\""
	fi
}

collect_resolved_plugins() {
	local n idx pjson name src_source src_path normalized resolved
	n="$(jq '.plugins | length' "${MARKET}")"
	for ((idx = 0; idx < n; idx++)); do
		pjson="$(jq -c ".plugins[${idx}]" "${MARKET}")"
		name="$(jq -r '.name // empty' <<<"${pjson}")"
		if [[ -z ${name} ]]; then
			fail "Each marketplace entry must have a non-empty name"
		fi

		src_source="$(jq -r '.source.source // empty' <<<"${pjson}")"
		if [[ -z ${src_source} ]]; then
			fail "marketplace entry \"${name}\" must include source.source"
		fi
		if [[ ${src_source} != "local" ]]; then
			fail "marketplace entry \"${name}\" has unsupported source.source \"${src_source}\" (only \"local\" is supported)"
		fi

		src_path="$(jq -r '.source.path // empty' <<<"${pjson}")"
		if [[ -z ${PLUGIN_FILTER} ]] || [[ ${name} == "${PLUGIN_FILTER}" ]]; then
			if [[ ${src_path} != ./* ]]; then
				fail "marketplace entry \"${name}\" must set source.path to a ./-prefixed string"
			fi
			normalized="${src_path#./}"
			if [[ ${normalized} == *..* ]]; then
				fail "marketplace path for \"${name}\" must not contain .."
			fi
			if [[ ! -d "${REPO_ROOT}/${normalized}" ]]; then
				fail "marketplace-resolved plugin directory missing: ${REPO_ROOT}/${normalized}"
			fi
			resolved="$(cd "${REPO_ROOT}/${normalized}" && pwd -P)"
			if [[ ${resolved} != "${PLUGINS_ROOT}" && ${resolved} != "${PLUGINS_ROOT}/"* ]]; then
				fail "marketplace entry \"${name}\" must resolve to a directory under plugins/"
			fi
			RESOLVED_IDS+=("${name}")
			RESOLVED_ROOTS+=("${resolved}")
		fi
	done

	if [[ -n ${PLUGIN_FILTER} && ${#RESOLVED_IDS[@]} -eq 0 ]]; then
		fail "PLUGIN_FILTER=\"${PLUGIN_FILTER}\" did not match any local marketplace entry"
	fi
}

codex_validate_plugin_structure() {
	local plugin_id="$1"
	local plugin_root="$2"

	local codex_m
	codex_m="${plugin_root}/.codex-plugin/plugin.json"
	[[ -f ${codex_m} ]] || fail "Missing Codex plugin manifest (${plugin_id})"

	local xname
	xname="$(jq -r '.name' "${codex_m}")"
	if [[ ${xname} != "${plugin_id}" ]]; then
		fail "Codex manifest name must be \"${plugin_id}\", got \"${xname}\""
	fi

	local skills_raw
	skills_raw="$(jq -r '.skills // empty | if type == "string" then . else empty end' "${codex_m}")"
	if [[ -z ${skills_raw} ]]; then
		fail "Codex manifest must set skills to a string path (${plugin_id})"
	fi
	local skills_rel="${skills_raw#./}"
	local skills_root="${plugin_root}/${skills_rel}"
	[[ -d ${skills_root} ]] || fail "Codex skills directory missing (${plugin_id}): ${skills_root}"

	local -a skill_names=()
	local d base
	shopt -s nullglob
	for d in "${skills_root}"/*/; do
		[[ -d ${d} ]] || continue
		base="${d%/}"
		[[ -f "${base}/SKILL.md" ]] || fail "Missing skill $(basename "${base}")/SKILL.md (${plugin_id})"
		skill_names+=("$(basename "${base}")")
	done
	shopt -u nullglob
	((${#skill_names[@]})) || fail "No skill directories under ${skills_root}"
	echo "  skills (${plugin_id}): ${skill_names[*]}"
}

# Codex CLI: per-plugin validation when `codex plugin validate` preflight passes (see plugins/CONTRIBUTING.md).
# Preflight failure → soft-skip (return 0). Missing codex binary → return 1. Validate failure → return 1.
# Does not call fail/exit — orchestrator runs Codex, Claude, and Cursor independently.
codex_run_plugin_validation() {
	echo "verify-agent-plugins: Codex CLI verification (codex plugin validate)…"

	if ! command -v codex >/dev/null 2>&1; then
		echo "verify-agent-plugins: Codex CLI not found (expected codex on PATH). Rebuild the agent-plugins image." >&2
		return 1
	fi

	if ! codex plugin validate -h >/dev/null 2>&1; then
		echo "verify-agent-plugins: preflight — codex plugin validate is not available; skipping Codex CLI validation (see plugins/CONTRIBUTING.md)." >&2
		return 0
	fi

	local i pid proot
	for i in "${!RESOLVED_IDS[@]}"; do
		pid="${RESOLVED_IDS[${i}]}"
		proot="${RESOLVED_ROOTS[${i}]}"
		echo "  … ${pid}"
		if ! (cd "${REPO_ROOT}" && codex plugin validate "${proot}"); then
			echo "verify-agent-plugins: codex plugin validate failed for ${pid}" >&2
			return 1
		fi
	done

	echo "verify-agent-plugins: Codex CLI verification OK."
}
