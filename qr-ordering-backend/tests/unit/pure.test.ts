import { describe, it, expect } from 'vitest';

import { slugify } from '../../src/lib/slug';
import { randomTableCode } from '../../src/lib/code';
import { compareNatural } from '../../src/lib/sort';
import { idempotencyKeyFrom } from '../../src/lib/idempotency';

describe('slugify', () => {
  it('lowercases words and joins with dashes', () => {
    expect(slugify('Nova Cafe 23')).toBe('nova-cafe-23');
  });
  it('trims surrounding separators', () => {
    expect(slugify('  --Hello World--  ')).toBe('hello-world');
  });
  it('returns empty for input with no usable ASCII', () => {
    expect(slugify('日本語')).toBe('');
  });
  it('caps the length at 40', () => {
    expect(slugify('a'.repeat(80)).length).toBeLessThanOrEqual(40);
  });
});

describe('randomTableCode', () => {
  it('uses 8 chars from the unambiguous alphabet by default', () => {
    expect(randomTableCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  });
  it('is unique across many draws', () => {
    const set = new Set(Array.from({ length: 1000 }, () => randomTableCode()));
    expect(set.size).toBe(1000);
  });
});

describe('compareNatural', () => {
  it('orders Table 2 before Table 10', () => {
    expect(['Table 10', 'Table 2', 'Table 1'].sort(compareNatural)).toEqual([
      'Table 1',
      'Table 2',
      'Table 10',
    ]);
  });
});

describe('idempotencyKeyFrom', () => {
  it('accepts a valid key', () => {
    expect(idempotencyKeyFrom('a-valid-key-1234')).toBe('a-valid-key-1234');
  });
  it('rejects too-short, too-long, missing, or non-string values', () => {
    expect(idempotencyKeyFrom('short')).toBeUndefined();
    expect(idempotencyKeyFrom('x'.repeat(201))).toBeUndefined();
    expect(idempotencyKeyFrom(undefined)).toBeUndefined();
    expect(idempotencyKeyFrom(123)).toBeUndefined();
  });
});
