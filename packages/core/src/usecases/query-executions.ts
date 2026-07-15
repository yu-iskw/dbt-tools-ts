import { queryExecutions } from '../analysis/search/run-results.js';
import { queryExecutionsOutputSchema } from '../contracts/execution-query.js';
import {
  queryExecutionsInputSchema,
  toQueryExecutionsRequest,
} from '../contracts/query-executions-input.js';

import type { UseCase } from './types.js';
import type { LoadedArtifactWorkspace } from '../artifact-workspace/types.js';
import type { QueryExecutionsOutputContract } from '../contracts/execution-query.js';
import type { z } from 'zod/v4';

type QueryExecutionsInputContract = z.infer<typeof queryExecutionsInputSchema>;

export const queryExecutionsUseCase: UseCase<
  QueryExecutionsInputContract,
  QueryExecutionsOutputContract
> = {
  name: 'runs.query',
  title: 'Query executions',
  input: queryExecutionsInputSchema,
  output: queryExecutionsOutputSchema,
  read: 'snapshot',
  run(snapshot: LoadedArtifactWorkspace, input: QueryExecutionsInputContract) {
    return queryExecutions(snapshot.analysis.executions, toQueryExecutionsRequest(input), {
      warehouseType: snapshot.analysis.warehouseType,
      graph: snapshot.graph,
    });
  },
};
