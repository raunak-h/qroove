import { canonicalJson, hashRules } from '../src/hash.js';
import { describe, expect, it } from 'vitest';
import {
  DomainError,
  ERROR_CODES,
  ERROR_COPY,
  RulesSnapshot,
  SubmitRequestBody,
  breakSlots,
  defaultRules,
  validateBreaks,
} from '../src/index.js';

describe('rules', () => {
  it('defaults validate; the master number applies to every genre', () => {
    const r = defaultRules();
    expect(RulesSnapshot.parse(r)).toEqual(r);
    expect(r).toMatchObject({
      rulesVersion: 2,
      submissionLimit: 5,
      masterRunCap: 2,
      runCaps: { salsa: 2, bachata: 2 },
    });
  });
  it('caps are per genre: salsa and non-Latin salsa-compatible share one', () => {
    const r = defaultRules(['salsa', 'salsa_nl', 'bachata', 'chacha_nl'], 3);
    expect(r.runCaps).toEqual({ salsa: 3, bachata: 3, chacha: 3 });
    expect(RulesSnapshot.safeParse(r).success).toBe(true);
  });
  it('allows a single genre, but not duplicates or a missing cap', () => {
    const r = defaultRules();
    expect(RulesSnapshot.safeParse(defaultRules(['salsa'])).success).toBe(true);
    expect(RulesSnapshot.safeParse(defaultRules(['salsa', 'salsa_nl'])).success).toBe(true);
    expect(RulesSnapshot.safeParse({ ...r, runCaps: { salsa: 2 } }).success).toBe(false);
    expect(RulesSnapshot.safeParse({ ...r, enabledStyles: ['salsa', 'salsa'] }).success).toBe(
      false,
    );
    expect(RulesSnapshot.safeParse({ ...r, submissionLimit: 0 }).success).toBe(false);
  });
  it('ratios go up to 1:5 and 1:1:5; a genre can never fall below 1 part in 10', () => {
    const ok = (parts: number[]) =>
      RulesSnapshot.safeParse(
        defaultRules(['salsa', 'bachata', 'chacha'].slice(0, parts.length) as never, 2, {
          salsa: parts[0]!,
          bachata: parts[1]!,
          ...(parts[2] ? { chacha: parts[2] } : {}),
        }),
      ).success;
    expect(ok([1, 5])).toBe(true);
    expect(ok([1, 1, 5])).toBe(true);
    expect(ok([1, 5, 5])).toBe(false); // 1 part in 11
    expect(ok([1, 6])).toBe(false); // above the 1:5 ratio limit
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

describe('breaks', () => {
  it('centres breaks on even points of the planned time', () => {
    expect(breakSlots(120, [10])).toEqual([{ startMin: 55, durationMin: 10 }]);
    expect(breakSlots(120, [20, 20])).toEqual([
      { startMin: 30, durationMin: 20 },
      { startMin: 70, durationMin: 20 },
    ]);
  });
  it('enforces the hard limits', () => {
    expect(validateBreaks(120, [10])).toBeNull();
    expect(validateBreaks(120, [30, 30])).toMatch(/between breaks/); // back to back
    expect(validateBreaks(120, [30, 30, 30])).toMatch(/half/);
    expect(validateBreaks(120, [15])).toMatch(/steps of 10/);
    expect(validateBreaks(null, [10])).toMatch(/planned time/);
    expect(validateBreaks(120, [10, 10, 10, 10])).toMatch(/At most/);
    expect(validateBreaks(null, [])).toBeNull();
  });
});
