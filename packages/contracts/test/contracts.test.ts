import { canonicalJson, hashRules } from '../src/hash.js';
import { describe, expect, it } from 'vitest';
import {
  DomainError,
  ERROR_CODES,
  ERROR_COPY,
  RulesSnapshot,
  SubmitRequestBody,
  allowedStyles,
  defaultRules,
  defaultSegment,
  segmentSpans,
  snapStart,
  validateBreaks,
} from '../src/index.js';

describe('rules', () => {
  const seg = (r: ReturnType<typeof defaultRules>, i = 0) => r.segments[i]!;
  it('defaults: salsa and bachata with their non-Latin styles; the master number is the cap', () => {
    const r = defaultRules();
    expect(RulesSnapshot.parse(r)).toEqual(r);
    expect(r).toMatchObject({ rulesVersion: 3, submissionLimit: 20 });
    expect(seg(r).enabledStyles).toEqual(['salsa', 'salsa_nl', 'bachata', 'bachata_nl']);
    expect(seg(r)).toMatchObject({ masterRunCap: 1, runCaps: { salsa: 1, bachata: 1 } });
  });
  it('caps are per genre: a style and its non-Latin version share one', () => {
    const r = defaultRules(['salsa', 'salsa_nl', 'bachata', 'chacha_nl', 'other'], 3);
    expect(seg(r).runCaps).toEqual({ salsa: 3, bachata: 3, chacha: 3, other: 3 });
    expect(RulesSnapshot.safeParse(r).success).toBe(true);
  });
  it('allows a single genre, but not duplicates or a missing cap', () => {
    const r = defaultRules();
    expect(RulesSnapshot.safeParse(defaultRules(['salsa'])).success).toBe(true);
    expect(RulesSnapshot.safeParse(defaultRules(['other'])).success).toBe(true);
    const bad = (seg0: object) =>
      RulesSnapshot.safeParse({ ...r, segments: [{ ...seg(r), ...seg0 }] }).success;
    expect(bad({ runCaps: { salsa: 2 } })).toBe(false);
    expect(bad({ enabledStyles: ['salsa', 'salsa'] })).toBe(false);
    expect(RulesSnapshot.safeParse({ ...r, submissionLimit: 0 }).success).toBe(false);
  });
  it('each segment has its own styles; allowedStyles is their union', () => {
    const r = defaultRules(['salsa'], 2, {}, 2);
    r.segments[1] = defaultSegment(['chacha', 'other']);
    expect(RulesSnapshot.safeParse(r).success).toBe(true);
    expect(allowedStyles(r)).toEqual(['salsa', 'chacha', 'other']);
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
    const shuffled = {
      ...r,
      segments: r.segments.map((g) => ({ ...g, enabledStyles: [...g.enabledStyles].reverse() })),
    };
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
  const b = (startMin: number, durationMin: number) => ({ startMin, durationMin });
  it('snaps to the 10-minute grid and lists the stretches between breaks', () => {
    expect(snapStart(54)).toBe(50);
    expect(snapStart(56)).toBe(60);
    expect(segmentSpans(120, [b(60, 10)])).toEqual([
      [0, 60],
      [70, 120],
    ]);
    expect(segmentSpans(120, [])).toEqual([[0, 120]]);
  });
  it('enforces the hard limits', () => {
    expect(validateBreaks(120, [b(55 + 5, 10)])).toBeNull(); // on the grid, 60 to 70
    expect(validateBreaks(120, [b(40, 30), b(70, 30)])).toMatch(/between breaks/); // back to back
    expect(validateBreaks(120, [b(20, 30), b(60, 30), b(100, 30)])).toMatch(/half|at most/i);
    expect(validateBreaks(120, [b(60, 15)])).toMatch(/steps of 10/);
    expect(validateBreaks(120, [b(55, 10)])).toMatch(/10-minute mark/);
    expect(validateBreaks(120, [b(10, 10)])).toMatch(/before the first/);
    expect(validateBreaks(120, [b(100, 10)])).toMatch(/after the last/);
    expect(validateBreaks(null, [b(60, 10)])).toMatch(/planned time/);
    expect(validateBreaks(480, [b(20, 10), b(60, 10), b(100, 10), b(140, 10)])).toMatch(/At most/);
    expect(validateBreaks(null, [])).toBeNull();
  });
});
