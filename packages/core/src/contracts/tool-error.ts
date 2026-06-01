import * as z from 'zod/v4';

export const toolErrorSchema = z
  .object({
    error: z.string(),
    hint: z.string().optional(),
    code: z.literal('output_schema_validation').optional(),
    allowed_sorts: z.array(z.string()).optional(),
    allowed_min_filters: z.array(z.string()).optional(),
  })
  .passthrough();

export type ToolErrorContract = z.infer<typeof toolErrorSchema>;
