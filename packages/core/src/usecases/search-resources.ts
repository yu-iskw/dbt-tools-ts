import {
  normalizeSearchResourcesInput,
  searchResourcesInputSchema,
  type SearchResourcesInputContract,
} from '../contracts/search-resources-input.js';
import {
  searchResourcesOutputSchema,
  type SearchResourcesOutputContract,
} from '../contracts/search-resources.js';
import { searchResourcesInGraph } from '../discovery/graph-search.js';

import type { UseCase } from './types.js';
import type { LoadedArtifactWorkspace } from '../artifact-workspace/types.js';

export const searchResourcesUseCase: UseCase<
  SearchResourcesInputContract,
  SearchResourcesOutputContract
> = {
  name: 'resource.search',
  title: 'Search resources',
  input: searchResourcesInputSchema,
  output: searchResourcesOutputSchema,
  read: 'snapshot',
  run(snapshot: LoadedArtifactWorkspace, input: SearchResourcesInputContract) {
    return searchResourcesInGraph(snapshot.graph, normalizeSearchResourcesInput(input));
  },
};
