import { describe, expect, it } from 'vitest';
import { applyPlay, checkEligibility, countsTowardQuota, EMPTY_HISTORY } from '../src/index.js';
import { RULES, cand } from './helpers.js';

describe('applyPlay', () => {
  it('tracks runs, transitions and owner spacing', () => {
    let h = applyPlay(EMPTY_HISTORY, cand('A', 'salsa', 1));
    expect(h).toMatchObject({ runLength: 1, transitionCount: 0, lastOwnerId: 'A' });
    h = applyPlay(h, cand('B', 'salsa', 2));
    expect(h.runLength).toBe(2);
    h = applyPlay(h, cand('C', 'bachata', 3));
    expect(h).toMatchObject({ runLength: 1, transitionCount: 1 });
    h = applyPlay(h, cand('D', 'salsa', 4));
    expect(h.transitionCount).toBe(2);
    expect(h.ownerLastPlayTransition).toEqual({ A: 0, B: 0, C: 1, D: 2 });
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
  it('blocks same owner adjacent, then needs a transition', () => {
    const h = applyPlay(EMPTY_HISTORY, cand('A', 'salsa', 1));
    expect(checkEligibility(cand('A', 'bachata', 2), h, RULES)).toEqual({
      ok: false,
      reason: 'SAME_OWNER_ADJACENT',
    });
    const h2 = applyPlay(h, cand('B', 'salsa', 3));
    expect(checkEligibility(cand('A', 'salsa', 4), h2, RULES)).toEqual({
      ok: false,
      reason: 'NEEDS_STYLE_TRANSITION',
    });
    const h3 = applyPlay(h2, cand('C', 'bachata', 5));
    expect(checkEligibility(cand('A', 'bachata', 6), h3, RULES)).toEqual({ ok: true });
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

describe('single-genre spacing', () => {
  const single = { enabledStyles: ['salsa'], runCaps: { salsa: 10 } };
  it('holds a returning requester until half of the others’ waiting songs have played', () => {
    const a1 = cand('A', 'salsa', 1);
    const a2 = cand('A', 'salsa', 5);
    const others = [2, 3, 4, 6].map((n) => cand(`B${n}`, 'salsa', n));
    // A's first song starts with four others waiting: the oldest two must play first.
    let h = applyPlay(EMPTY_HISTORY, a1, { pool: [a2, ...others], gate: true });
    const pool = [a2, ...others];
    const blocked = (hist: typeof h) =>
      checkEligibility(a2, hist, single, { poolKeys: new Set(pool.map((c) => c.canonicalKey)) });
    h = applyPlay(h, others[0]!, { pool, gate: true }); // B2 plays: adjacency aside, A still waits
    expect(blocked(h)).toEqual({ ok: false, reason: 'NEEDS_OTHERS_PLAYED' });
    h = applyPlay(h, others[1]!, { pool, gate: true }); // B3 plays: half done
    expect(blocked(h)).toEqual({ ok: true });
  });
  it('stops waiting for a song that was withdrawn', () => {
    const a1 = cand('A', 'salsa', 1);
    const a2 = cand('A', 'salsa', 4);
    const b = cand('B', 'salsa', 2);
    const c = cand('C', 'salsa', 3);
    let h = applyPlay(EMPTY_HISTORY, a1, { pool: [a2, b, c], gate: true });
    h = applyPlay(h, cand('D', 'salsa', 9)); // someone else plays in between
    const withoutB = new Set([a2, c].map((x) => x.canonicalKey));
    expect(checkEligibility(a2, h, single, { poolKeys: withoutB })).toEqual({ ok: true });
  });
  it('does not use the style-transition rule', () => {
    const a1 = cand('A', 'salsa', 1);
    const a2 = cand('A', 'salsa', 3);
    const b = cand('B', 'salsa', 2);
    let h = applyPlay(EMPTY_HISTORY, a1);
    h = applyPlay(h, b);
    expect(checkEligibility(a2, h, single)).toEqual({ ok: true });
  });
});
