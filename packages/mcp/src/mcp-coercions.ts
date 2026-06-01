import * as z from 'zod/v4';

/** MCP prompt/tool args often arrive as strings; only accept explicit true/false literals. */
export const mcpOptionalBooleanSchema = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean().optional());
