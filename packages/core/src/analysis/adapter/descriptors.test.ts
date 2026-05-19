import { describe, expect, it } from 'vitest';
import type { AdapterResponseField, AdapterResponseMetrics } from './metrics';
import { getAdapterResponseFieldsBeyondNormalized } from './descriptors';

function field(
  key: string,
  displayValue: string,
  overrides: Partial<AdapterResponseField> = {},
): AdapterResponseField {
  return {
    key,
    label: key,
    kind: 'string',
    displayValue,
    isScalar: true,
    ...overrides,
  };
}

describe('getAdapterResponseFieldsBeyondNormalized', () => {
  it('drops raw rows that match a populated normalized metric', () => {
    const metrics: AdapterResponseMetrics = {
      rawKeys: ['bytes_processed', 'location'],
      bytesProcessed: 100,
      location: 'US',
    };
    const fields = [field('bytes_processed', '100', { kind: 'number' }), field('location', 'US')];
    expect(getAdapterResponseFieldsBeyondNormalized(metrics, fields)).toEqual([]);
  });

  it('keeps unknown top-level keys', () => {
    const metrics: AdapterResponseMetrics = {
      rawKeys: ['bytes_processed', 'custom_thing'],
      bytesProcessed: 1,
    };
    const fields = [
      field('bytes_processed', '1', { kind: 'number' }),
      field('custom_thing', 'extra'),
    ];
    expect(getAdapterResponseFieldsBeyondNormalized(metrics, fields)).toEqual([fields[1]]);
  });

  it('keeps nested keys', () => {
    const metrics: AdapterResponseMetrics = {
      rawKeys: ['nested'],
      bytesProcessed: 1,
    };
    const nested = field('nested.prop', 'x');
    expect(getAdapterResponseFieldsBeyondNormalized(metrics, [nested])).toEqual([nested]);
  });

  it('keeps job_id when queryId was not normalized', () => {
    const metrics: AdapterResponseMetrics = {
      rawKeys: ['job_id'],
      bytesProcessed: 1,
    };
    const jobField = field('job_id', 'jid');
    expect(getAdapterResponseFieldsBeyondNormalized(metrics, [jobField])).toEqual([jobField]);
  });

  it('drops job_id when queryId is normalized', () => {
    const metrics: AdapterResponseMetrics = {
      rawKeys: ['job_id'],
      queryId: 'jid',
    };
    expect(getAdapterResponseFieldsBeyondNormalized(metrics, [field('job_id', 'jid')])).toEqual([]);
  });

  it('returns all fields when metrics are absent', () => {
    const f = [field('bytes_processed', '1')];
    expect(getAdapterResponseFieldsBeyondNormalized(undefined, f)).toEqual(f);
  });
});
