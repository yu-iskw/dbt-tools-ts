import path from 'node:path';

import { existsValidated, getDbtToolsTargetDirFromEnv, statValidatedSync } from '@dbt-tools/core';

export function expandDbtTargetDirFromEnvValue(targetDir: string): string {
  return targetDir.replace(/^~($|\/)/, `${process.env.HOME ?? ''}$1`).trim();
}

export function resolveLocalArtifactTargetDirFromEnv(cwd: string, rawTargetDir: string): string {
  return path.resolve(cwd, expandDbtTargetDirFromEnvValue(rawTargetDir));
}

/**
 * Resolve `DBT_TOOLS_TARGET_DIR` for `fs.watch`: must exist as a directory and,
 * when relative, must not escape `cwd` (matches Vite dev plugin behavior).
 */
export function resolveWatchableLocalTargetDir(cwd: string): string | null {
  const raw = getDbtToolsTargetDirFromEnv() ?? '';
  const targetDir = expandDbtTargetDirFromEnvValue(raw);
  if (!targetDir) return null;

  const resolved = path.resolve(cwd, targetDir);

  if (!path.isAbsolute(targetDir)) {
    const relative = path.relative(cwd, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      console.warn('[dbt-target] DBT_TOOLS_TARGET_DIR resolved outside cwd, skipping:', resolved);
      return null;
    }
  }

  if (!existsValidated(resolved) || !statValidatedSync(resolved).isDirectory()) {
    console.warn('[dbt-target] DBT_TOOLS_TARGET_DIR is not a directory:', resolved);
    return null;
  }

  return resolved;
}
