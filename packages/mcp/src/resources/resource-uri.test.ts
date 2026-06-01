import { describe, expect, it } from 'vitest';

import { DbtToolsResourceUriError, parseDbtToolsResourceUri } from './resource-uri.js';

describe('parseDbtToolsResourceUri', () => {
  it('parses status and run summary URIs', () => {
    expect(parseDbtToolsResourceUri('dbt-tools://status')).toEqual({ kind: 'status' });
    expect(parseDbtToolsResourceUri('dbt-tools://runs/current/summary')).toEqual({
      kind: 'run-summary',
      runId: 'current',
    });
  });

  it('parses resource templates', () => {
    expect(parseDbtToolsResourceUri('dbt-tools://resources/model.pkg.orders')).toEqual({
      kind: 'resource-details',
      uniqueId: 'model.pkg.orders',
    });
    expect(parseDbtToolsResourceUri('dbt-tools://resources/model.pkg.orders/sql/raw')).toEqual({
      kind: 'resource-sql',
      uniqueId: 'model.pkg.orders',
      sqlKind: 'raw',
    });
    expect(
      parseDbtToolsResourceUri('dbt-tools://resources/model.pkg.orders/dependencies/downstream'),
    ).toEqual({
      kind: 'resource-dependencies',
      uniqueId: 'model.pkg.orders',
      direction: 'downstream',
    });
  });

  it('parses percent-encoded uniqueId segments', () => {
    const uniqueId = 'model.jaffle_shop.stg_orders';
    expect(
      parseDbtToolsResourceUri(`dbt-tools://resources/${encodeURIComponent(uniqueId)}`),
    ).toEqual({
      kind: 'resource-details',
      uniqueId,
    });
  });

  it('rejects malformed URIs', () => {
    expect(() => parseDbtToolsResourceUri('https://example.com')).toThrow(DbtToolsResourceUriError);
    expect(() => parseDbtToolsResourceUri('dbt-tools://status/extra')).toThrow(
      DbtToolsResourceUriError,
    );
    expect(() => parseDbtToolsResourceUri('dbt-tools://resources/a?x=1')).toThrow(
      DbtToolsResourceUriError,
    );
  });
});
