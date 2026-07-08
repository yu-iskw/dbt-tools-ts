import { getRunSummaryFromSnapshot } from '../analysis/snapshot/run-summary.js';
import { emptyUseCaseInputSchema } from '../contracts/empty-input.js';
import { runSummaryOutputSchema } from '../contracts/run-summary.js';

import type { UseCase } from './types.js';
import type { LoadedArtifactWorkspace } from '../artifact-workspace/types.js';
import type { EmptyUseCaseInput } from '../contracts/empty-input.js';
import type { RunSummaryOutput } from '../contracts/run-summary.js';

export const getRunSummaryUseCase: UseCase<EmptyUseCaseInput, RunSummaryOutput> = {
  name: 'runs.summary',
  title: 'Get run summary',
  input: emptyUseCaseInputSchema,
  output: runSummaryOutputSchema,
  read: 'snapshot',
  run(snapshot: LoadedArtifactWorkspace, _input: EmptyUseCaseInput) {
    return getRunSummaryFromSnapshot(snapshot.analysis);
  },
};
