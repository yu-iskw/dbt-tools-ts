import * as z from 'zod/v4';

export const searchResourceResultSchema = z
  .object({
    unique_id: z.string(),
    resource_type: z.string(),
    name: z.string(),
    package_name: z.string(),
    path: z.string().optional(),
    tags: z.array(z.string()).optional(),
    description: z.string().optional(),
  })
  .passthrough();

export const searchResourcesOutputSchema = z
  .object({
    query: z.string().optional(),
    total: z.number().int(),
    results: z.array(searchResourceResultSchema),
    limit: z.number().int().optional(),
    offset: z.number().int(),
    has_more: z.boolean().optional(),
  })
  .passthrough();

export type SearchResourcesOutputContract = z.infer<typeof searchResourcesOutputSchema>;
