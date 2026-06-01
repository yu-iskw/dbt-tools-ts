import { describe, expect, it } from 'vitest';

import {
  analyzeModelBlastRadiusArgsSchema,
  buildInspectDbtResourceMessages,
  buildTriageDbtRunMessages,
  inspectDbtResourceArgsSchema,
  inspectDbtResourceMcpArgsSchema,
} from './prompt-definitions.js';

describe('prompt definitions', () => {
  it('builds triage messages with defaults', () => {
    const messages = buildTriageDbtRunMessages({});
    expect(messages[0]?.content.text).toContain('dbt-tools://status');
    expect(messages[0]?.content.text).toContain('dbt_tools_status');
  });

  it('parses includeSql string literals for MCP prompt args', () => {
    expect(
      inspectDbtResourceMcpArgsSchema.parse({
        uniqueId: 'model.pkg.orders',
        includeSql: 'false',
      }).includeSql,
    ).toBe(false);
    expect(
      inspectDbtResourceMcpArgsSchema.parse({
        uniqueId: 'model.pkg.orders',
        includeSql: 'true',
      }).includeSql,
    ).toBe(true);
    expect(() =>
      inspectDbtResourceMcpArgsSchema.parse({
        uniqueId: 'model.pkg.orders',
        includeSql: 'no',
      }),
    ).toThrow();
  });

  it('omits SQL steps when includeSql is false from string args', () => {
    const messages = buildInspectDbtResourceMessages(
      inspectDbtResourceMcpArgsSchema.parse({
        uniqueId: 'model.pkg.orders',
        includeSql: 'false',
      }),
    );
    expect(messages[0]?.content.text).toContain('Do not fetch SQL');
    expect(messages[0]?.content.text).not.toContain('/sql/raw');
  });

  it('requires uniqueId for blast radius and inspect prompts', () => {
    expect(() => analyzeModelBlastRadiusArgsSchema.parse({})).toThrow();
    expect(() => inspectDbtResourceArgsSchema.parse({})).toThrow();
    expect(analyzeModelBlastRadiusArgsSchema.parse({ uniqueId: 'model.pkg.orders' }).uniqueId).toBe(
      'model.pkg.orders',
    );
  });
});
