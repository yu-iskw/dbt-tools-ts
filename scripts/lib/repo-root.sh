#!/usr/bin/env bash
# Shared REPO_ROOT resolution for bash scripts at the monorepo root.
# Usage: source this file, then call resolve_repo_root "<script-name>" ["<path>"].
resolve_repo_root() {
	local script_name=$1
	local arg_path=${2-}

	if [[ -n ${REPO_ROOT-} ]]; then
		:
	elif [[ -n ${arg_path} ]]; then
		REPO_ROOT="${arg_path}"
	elif REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
		:
	else
		echo "${script_name}: set REPO_ROOT or pass the monorepo root as the first argument, or run inside a git repository." >&2
		exit 1
	fi
}
