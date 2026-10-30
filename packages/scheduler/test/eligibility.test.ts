import { describe, expect, it } from 'vitest';
import { applyPlay, checkEligibility, countsTowardQuota, EMPTY_HISTORY } from '../src/index.js';
import { RULES, cand } from './helpers.js';

describe('applyPlay', () => {
  it('tracks runs and transitions', () => {
    let h = applyPlay(EMPTY_HISTORY, cand('A', 'salsa', 1));
    expect(h).toMatchObject({ runLength: 1, transitionCount: 0 });
    h = applyPlay(h, cand('B', 'salsa', 2));
    expect(h.runLength).toBe(2);
    h = applyPlay(h, cand('C', 'bachata', 3));
    expect(h).toMatchObject({ runLength: 1, transitionCount: 1 });
    h = applyPlay(h, cand('D', 'salsa', 4));
    expect(h.transitionCount).toBe(2);
  });
  it('does not mutate its input', () => {
    const before = EMPTY_HISTORY;
    applyPlay(before, cand('A', 'salsa', 1));
    expect(before.playedKeys.size).toBe(0);
  });
});

describe('checkEligibility', () => {
  it('first play of an owner is eligible', () => {
    expect(checkEligibility(cand('A', 'salsa', 1), EMPTY_HISTORY, RULES)).toEqual({ ok: true });
  });
  it('ignores who added a song: one person may play back to back', () => {
    const h = applyPlay(EMPTY_HISTORY, cand('A', 'salsa', 1));
    expect(checkEligibility(cand('A', 'salsa', 2), h, RULES)).toEqual({ ok: true });
    expect(checkEligibility(cand('A', 'bachata', 3), h, RULES)).toEqual({ ok: true });
  });
  it('enforces run cap, disabled styles, playability, duplicates and end window', () => {
    let h = applyPlay(EMPTY_HISTORY, cand('A', 'salsa', 1));
    h = applyPlay(h, cand('B', 'salsa', 2));
    expect(checkEligibility(cand('C', 'salsa', 3), h, RULES)).toEqual({
      ok: false,
      reason: 'RUN_CAP',
    });
    expect(checkEligibility(cand('C', 'kizomba', 3), h, RULES)).toEqual({
      ok: false,
      reason: 'STYLE_DISABLED',
    });
    expect(checkEligibility(cand('C', 'bachata', 3, { playable: false }), h, RULES)).toEqual({
      ok: false,
      reason: 'NOT_PLAYABLE',
    });
    const dup = cand('C', 'bachata', 3);
    expect(checkEligibility(dup, applyPlay(h, { ...dup, ownerId: 'Z' }), RULES)).toEqual({
      ok: false,
      reason: 'ALREADY_PLAYED',
    });
    expect(checkEligibility(cand('C', 'bachata', 3), h, RULES, { remainingMs: 100_000 })).toEqual({
      ok: false,
      reason: 'WOULD_EXCEED_END',
    });
  });
});

describe('quota', () => {
  it('counts per SPEC §3.3', () => {
    for (const s of [
      'PENDING_METADATA',
      'QUEUED',
      'INELIGIBLE_TEMPORARILY',
      'RESERVED_NEXT',
      'OVERFLOW',
      'PLAYING',
      'PLAYED',
      'SKIPPED',
    ] as const)
      expect(countsTowardQuota(s)).toBe(true);
    for (const s of ['WITHDRAWN', 'REJECTED', 'UNAVAILABLE'] as const)
      expect(countsTowardQuota(s)).toBe(false);
  });
});

describe('single genre', () => {
  it('has no run cap, because there is no other genre to change to', () => {
    const single = { enabledStyles: ['salsa'], runCaps: { salsa: 1 } };
    const h = applyPlay(EMPTY_HISTORY, cand('A', 'salsa', 1));
    expect(checkEligibility(cand('A', 'salsa', 2), h, single)).toEqual({ ok: true });
  });
});
