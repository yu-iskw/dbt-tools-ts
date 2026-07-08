import * as z from 'zod/v4';

export const queryDependenciesInputSchema = z.object({
  uniqueId: z.string().min(1),
  direction: z.enum(['upstream', 'downstream']).default('upstream'),
  depth: z.number().int().min(1).optional(),
  buildOrder: z.boolean().optional(),
});

export type QueryDependenciesInputContract = z.infer<typeof queryDependenciesInputSchema>;
