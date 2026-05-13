#!/bin/bash
# Hook: Auto-format TypeScript/JavaScript files after edits
# Triggered by: PostToolUse (Edit|Write) on .ts, .tsx, .js, .jsx files

set -e

INPUT=$(cat)
# Note: Cursor's Edit/Write tools might use 'path' instead of 'file_path'
FILE_PATH=$(echo "${INPUT}" | jq -r '.tool_input.path // empty')

# Resolve repository root: Claude Code sets CLAUDE_PROJECT_DIR; otherwise use git or hook location.
resolve_repo_root() {
	if [[ -n ${CLAUDE_PROJECT_DIR-} ]]; then
		echo "${CLAUDE_PROJECT_DIR}"
		return
	fi
	local hook_dir
	hook_dir=$(cd "$(dirname "$0")" && pwd)
	# .claude/hooks -> two levels up is repo root
	if git -C "${hook_dir}/../.." rev-parse --show-toplevel &>/dev/null; then
		git -C "${hook_dir}/../.." rev-parse --show-toplevel
		return
	fi
	echo "${hook_dir}/../.."
}

run_trunk_fmt() {
	local root="$1"
	local file="$2"
	if [[ -x "${root}/node_modules/.bin/trunk" ]]; then
		"${root}/node_modules/.bin/trunk" fmt "${file}" 2>/dev/null || true
	elif command -v trunk &>/dev/null; then
		trunk fmt "${file}" 2>/dev/null || true
	else
		(cd "${root}" && pnpm exec trunk fmt "${file}" 2>/dev/null) || true
	fi
}

# Only process TS/JS files
if [[ ${FILE_PATH} == *.ts || ${FILE_PATH} == *.tsx || ${FILE_PATH} == *.js || ${FILE_PATH} == *.jsx ]]; then
	REPO_ROOT=$(resolve_repo_root)
	run_trunk_fmt "${REPO_ROOT}" "${FILE_PATH}"
fi

exit 0
