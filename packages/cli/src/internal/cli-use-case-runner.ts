import { formatOutput, shouldOutputJSON } from '@dbt-tools/core';
import { ArtifactWorkspace } from '@dbt-tools/core/node';

import { resolveEffectiveDbtTarget } from './cli-artifact-resolve.js';

import type { ArtifactRootCliOptions } from './cli-artifact-resolve.js';

export interface CliUseCaseRunOptions extends ArtifactRootCliOptions {
  json?: boolean;
  noJson?: boolean;
}

export interface CliUseCaseRunner {
  runUseCase<Out>(useCaseName: string, input: unknown): Promise<Out>;
}

export async function createCliUseCaseRunner(
  roots: ArtifactRootCliOptions,
  options?: { autoReloadOnPoll?: boolean },
): Promise<CliUseCaseRunner> {
  const workspace = new ArtifactWorkspace({
    dbtTarget: resolveEffectiveDbtTarget(roots.dbtTarget),
    maxCachedTargets: 1,
    autoReloadOnPoll: options?.autoReloadOnPoll ?? true,
  });
  await workspace.initialize();
  return {
    runUseCase<Out>(useCaseName: string, input: unknown): Promise<Out> {
      return workspace.runUseCase<unknown, Out>(useCaseName, input);
    },
  };
}

export function emitCliUseCaseOutput<T>(
  data: T,
  options: CliUseCaseRunOptions,
  humanFormatter?: (data: T) => string,
): void {
  const asJson = shouldOutputJSON(options.json, options.noJson);
  if (asJson) {
    console.log(formatOutput(data, true));
    return;
  }
  if (humanFormatter != null) {
    console.log(humanFormatter(data));
    return;
  }
  console.log(formatOutput(data, false));
}
