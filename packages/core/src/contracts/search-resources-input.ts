import * as z from 'zod/v4';

export const SEARCH_RESOURCES_DEFAULT_LIMIT = 20;
export const SEARCH_RESOURCES_MAX_LIMIT = 200;

export const searchResourcesInputSchema = z.object({
  query: z.string().optional(),
  type: z.string().optional(),
  package: z.string().optional(),
  tag: z.string().optional(),
  path: z.string().optional(),
  limit: z.number().int().min(1).max(SEARCH_RESOURCES_MAX_LIMIT).optional(),
  offset: z.number().int().min(0).optional(),
});

export type SearchResourcesInputContract = z.infer<typeof searchResourcesInputSchema>;

export function normalizeSearchResourcesInput(
  input: SearchResourcesInputContract,
): SearchResourcesInputContract {
  return {
    ...input,
    limit: input.limit ?? SEARCH_RESOURCES_DEFAULT_LIMIT,
    offset: input.offset ?? 0,
  };
}
