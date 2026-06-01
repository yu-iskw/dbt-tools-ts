import * as z from 'zod/v4';

import { jsonValueSchema } from './shared.js';

export const dependencyNodeSchema = z
  .object({
    unique_id: z.string(),
    resource_type: z.string(),
    name: z.string(),
    package_name: z.string(),
    depth: z.number().int(),
  })
  .catchall(jsonValueSchema);

export const dependencyQueryOutputSchema = z
  .object({
    resource_id: z.string(),
    direction: z.enum(['downstream', 'upstream']),
    build_order: z.boolean().optional(),
    dependencies: z.array(dependencyNodeSchema),
    count: z.number().int(),
  })
  .passthrough();

export type DependencyQueryOutputContract = z.infer<typeof dependencyQueryOutputSchema>;
