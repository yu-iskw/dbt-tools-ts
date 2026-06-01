import * as z from 'zod/v4';

/** Permissive JSON value for adapter metrics, definitions, and nested snapshot fields. */
export const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const statusToneSchema = z.enum(['danger', 'neutral', 'positive', 'skipped', 'warning']);

export const warehouseTypeSchema = z.enum([
  'athena',
  'bigquery',
  'postgres',
  'redshift',
  'snowflake',
  'spark',
  'unknown',
]);
