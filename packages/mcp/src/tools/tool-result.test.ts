import {
  artifactWorkspaceStatusSchema,
  getResourceToolOutputSchema,
  toolErrorSchema,
} from '@dbt-tools/core/contracts';
import { normalizeObjectSchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { describe, expect, it } from 'vitest';

import { jsonResult, jsonToolError } from './tool-result.js';

describe('tool-result', () => {
  it('serializes validated payload to content and structuredContent', () => {
    const payload = {
      target: './target',
      selectedRunId: 'current',
      versionToken: 'v1',
      loadedAtMs: 100,
      stale: false,
      runs: [{ runId: 'current', versionToken: 'v1' }],
    };
    const result = jsonResult(artifactWorkspaceStatusSchema, payload);
    expect(result.content[0]?.text).toBe(JSON.stringify(payload, null, 2));
    expect(result.structuredContent).toEqual(payload);
  });

  it('returns isError when output validation fails', () => {
    const result = jsonResult(artifactWorkspaceStatusSchema, {
      target: './target',
      selectedRunId: null,
      versionToken: null,
      loadedAtMs: 'not-a-number',
      stale: false,
      runs: [],
    } as unknown as never);
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0]?.text ?? '{}')).toMatchObject({
      error: 'Internal tool output contract validation failed.',
      code: 'output_schema_validation',
    });
  });

  it('exposes get_resource output as an object schema for MCP SDK', () => {
    expect(normalizeObjectSchema(getResourceToolOutputSchema)).toBeDefined();
  });

  it('keeps legacy content text while structuredContent uses the resource envelope', () => {
    const result = jsonResult(
      getResourceToolOutputSchema,
      { resource: null },
      { contentPayload: null },
    );
    expect(JSON.parse(result.content[0]?.text ?? 'undefined')).toBeNull();
    expect(result.structuredContent).toEqual({ resource: null });
  });

  it('validates tool errors', () => {
    const result = jsonToolError({ error: 'failed', hint: 'try again' });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]?.text ?? '{}') as { error: string };
    expect(parsed.error).toBe('failed');
    expect(toolErrorSchema.parse(parsed).hint).toBe('try again');
  });
});
