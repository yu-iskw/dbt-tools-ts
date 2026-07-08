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
