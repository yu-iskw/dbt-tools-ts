import {
  getResourceToolOutputSchema,
  resourceDetailsSchema,
  type GetResourceToolOutput,
  type ResourceDetailsContract,
} from '@dbt-tools/core/contracts';
import { truncateSqlText } from '@dbt-tools/core/util/sql-truncation';

import { truncateResourceCodeFields } from '../tools/truncate-resource-code.js';

import type { DbtToolsUseCases } from '@dbt-tools/core/artifact-workspace';

export type ResourceCodeMode = 'omit' | 'truncate-for-json';

export async function loadResourceNode(
  useCases: DbtToolsUseCases,
  uniqueId: string,
  mode: ResourceCodeMode,
): Promise<ResourceDetailsContract | null> {
  const resource = await useCases.getResource({
    uniqueId,
    includeCode: mode !== 'omit',
  });
  if (resource == null) {
    return null;
  }
  if (mode === 'truncate-for-json') {
    return resourceDetailsSchema.parse(truncateResourceCodeFields(resource));
  }
  return resourceDetailsSchema.parse(resource);
}

export function toGetResourceToolOutput(
  resource: ResourceDetailsContract | null,
): GetResourceToolOutput {
  return getResourceToolOutputSchema.parse({ resource });
}

export async function loadResourceSqlText(
  useCases: DbtToolsUseCases,
  uniqueId: string,
  sqlKind: 'raw' | 'compiled',
): Promise<string | null> {
  const resource = await useCases.getResource({ uniqueId, includeCode: true });
  if (resource == null) {
    return null;
  }
  const sql = sqlKind === 'raw' ? (resource.rawCode ?? null) : (resource.compiledCode ?? null);
  if (sql == null || sql === '') {
    return null;
  }
  return truncateSqlText(sql).text;
}
