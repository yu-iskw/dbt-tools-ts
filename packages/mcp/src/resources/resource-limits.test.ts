import { describe, expect, it } from 'vitest';

import { truncateSqlText as truncateSqlResourceText } from '@dbt-tools/core/util/sql-truncation';

describe('truncateSqlResourceText', () => {
  it('truncates at utf-8 boundaries and appends notice', () => {
    const sql = 'select 1;\n'.repeat(40_000);
    const { text, truncated, originalBytes } = truncateSqlResourceText(sql, 100);
    expect(truncated).toBe(true);
    expect(originalBytes).toBeGreaterThan(100);
    expect(text).toContain('dbt-tools:');
    expect(new TextEncoder().encode(text).byteLength).toBeLessThanOrEqual(200);
  });
});
