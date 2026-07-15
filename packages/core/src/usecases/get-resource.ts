import {
  type GetResourceInputContract,
  getResourceInputSchema,
} from '../contracts/get-resource-input.js';
import { getResourceToolOutputSchema } from '../contracts/resource-details.js';
import { copyResourceForOutput } from '../discovery/graph-search.js';

import type { UseCase } from './types.js';
import type { LoadedArtifactWorkspace } from '../artifact-workspace/types.js';
import type { GetResourceToolOutput } from '../contracts/resource-details.js';

export const getResourceUseCase: UseCase<GetResourceInputContract, GetResourceToolOutput> = {
  name: 'resource.details',
  title: 'Get resource details',
  input: getResourceInputSchema,
  output: getResourceToolOutputSchema,
  read: 'snapshot',
  run(snapshot: LoadedArtifactWorkspace, input: GetResourceInputContract): GetResourceToolOutput {
    const resource =
      snapshot.analysis.resources.find((candidate) => candidate.uniqueId === input.uniqueId) ??
      null;
    return {
      resource:
        resource == null
          ? null
          : (copyResourceForOutput(
              resource,
              input.includeCode === true,
            ) as GetResourceToolOutput['resource']),
    };
  },
};
