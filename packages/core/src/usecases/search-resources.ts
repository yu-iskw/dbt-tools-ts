import {
  type SearchResourcesInputContract,
  searchResourcesInputSchema,
} from '../contracts/search-resources-input.js';
import { searchResourcesOutputSchema } from '../contracts/search-resources.js';
import { searchResourcesInGraph } from '../discovery/graph-search.js';

import type { UseCase } from './types.js';
import type { LoadedArtifactWorkspace, SearchResourcesInput  } from '../artifact-workspace/types.js';
import type { SearchResourcesOutputContract } from '../contracts/search-resources.js';

function toSearchResourcesInput(parsed: SearchResourcesInputContract): SearchResourcesInput {
  return {
    query: parsed.query,
    type: parsed.type,
    package: parsed.package,
    tag: parsed.tag,
    path: parsed.path,
    limit: parsed.limit,
    offset: parsed.offset ?? 0,
  };
}

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
    return searchResourcesInGraph(
      snapshot.graph,
      toSearchResourcesInput(input),
    ) as SearchResourcesOutputContract;
  },
};
