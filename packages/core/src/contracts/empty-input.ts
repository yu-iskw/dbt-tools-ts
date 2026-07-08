import * as z from 'zod/v4';

/** Read-only use cases with no input parameters. */
export const emptyUseCaseInputSchema = z.object({}).strict();

export type EmptyUseCaseInput = z.infer<typeof emptyUseCaseInputSchema>;
