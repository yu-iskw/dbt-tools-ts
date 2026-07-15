import * as z from 'zod/v4';

export const getResourceInputSchema = z.object({
  uniqueId: z.string().min(1),
  includeCode: z.boolean().optional(),
});

export type GetResourceInputContract = z.infer<typeof getResourceInputSchema>;
