import { describe, expect, it } from 'vitest';

import {
  analyzeModelBlastRadiusArgsSchema,
  buildTriageDbtRunMessages,
  inspectDbtResourceArgsSchema,
} from './prompt-definitions.js';

describe('prompt definitions', () => {
  it('builds triage messages with defaults', () => {
    const messages = buildTriageDbtRunMessages({});
    expect(messages[0]?.content.text).toContain('dbt-tools://status');
    expect(messages[0]?.content.text).toContain('dbt_tools_status');
  });

  it('requires uniqueId for blast radius and inspect prompts', () => {
    expect(() => analyzeModelBlastRadiusArgsSchema.parse({})).toThrow();
    expect(() => inspectDbtResourceArgsSchema.parse({})).toThrow();
    expect(analyzeModelBlastRadiusArgsSchema.parse({ uniqueId: 'model.pkg.orders' }).uniqueId).toBe(
      'model.pkg.orders',
    );
  });
});
