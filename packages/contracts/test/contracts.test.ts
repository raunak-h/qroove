import { canonicalJson, hashRules } from '../src/hash.js';
import { describe, expect, it } from 'vitest';
import {
  DomainError,
  ERROR_CODES,
  ERROR_COPY,
  RulesSnapshot,
  SubmitRequestBody,
  defaultRules,
} from '../src/index.js';

describe('rules', () => {
  it('defaults match SPEC §3.1 and validate', () => {
    const r = defaultRules();
    expect(RulesSnapshot.parse(r)).toEqual(r);
    expect(r).toMatchObject({ submissionLimit: 5, runCaps: { salsa: 2, bachata: 2 } });
  });
  it('other styles default to cap 1', () => {
    expect(defaultRules(['salsa', 'bachata', 'kizomba']).runCaps['kizomba']).toBe(1);
  });
  it('rejects missing caps, duplicates and single-style events', () => {
    const r = defaultRules();
    expect(RulesSnapshot.safeParse({ ...r, runCaps: { salsa: 2 } }).success).toBe(false);
    expect(RulesSnapshot.safeParse({ ...r, enabledStyles: ['salsa', 'salsa'] }).success).toBe(
      false,
    );
    expect(RulesSnapshot.safeParse({ ...r, enabledStyles: ['salsa'] }).success).toBe(false);
    expect(RulesSnapshot.safeParse({ ...r, submissionLimit: 0 }).success).toBe(false);
  });
  it('hash is stable under key/style order and changes with any rule', () => {
    const r = defaultRules();
    const shuffled = { ...r, enabledStyles: [...r.enabledStyles].reverse() };
    expect(hashRules(shuffled)).toBe(hashRules(r));
    expect(hashRules(r)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRules({ ...r, submissionLimit: 4 })).not.toBe(hashRules(r));
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
  });
});

describe('errors', () => {
  it('has copy and an HTTP status for every code', () => {
    for (const c of ERROR_CODES) expect(ERROR_COPY[c].action.length).toBeGreaterThan(0);
  });
  it('DomainError serialises to the API shape', () => {
    expect(new DomainError('QUOTA_FULL').toBody().error).toMatchObject({
      code: 'QUOTA_FULL',
      action: ERROR_COPY.QUOTA_FULL.action,
    });
  });
});

describe('api bodies', () => {
  it('SubmitRequestBody needs a url or manual entry', () => {
    expect(SubmitRequestBody.safeParse({ style: 'salsa' }).success).toBe(false);
    expect(
      SubmitRequestBody.safeParse({ style: 'salsa', url: 'https://open.spotify.com/track/x' })
        .success,
    ).toBe(true);
    expect(SubmitRequestBody.safeParse({ style: 'salsa', manual: { title: 'x' } }).success).toBe(
      true,
    );
    expect(SubmitRequestBody.safeParse({ style: 'polka', url: 'https://a.b' }).success).toBe(false);
  });
});
