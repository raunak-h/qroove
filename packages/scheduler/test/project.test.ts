import { describe, expect, it } from 'vitest';
import { EMPTY_HISTORY, projectQueue, type ProjectInput } from '../src/index.js';
import { RULES, cand } from './helpers.js';

const base = (over: Partial<ProjectInput>): ProjectInput => ({
  candidates: [],
  history: EMPTY_HISTORY,
  rules: RULES,
  nowMs: 0,
  endAtMs: null,
  currentRemainingMs: null,
  breaks: [],
  overheadSec: 5,
  ...over,
});

describe('projectQueue', () => {
  it('predicts starts including overhead', () => {
    const p = projectQueue(
      base({
        candidates: [cand('A', 'salsa', 1), cand('B', 'bachata', 2)],
        currentRemainingMs: 60_000,
      }),
    );
    expect(p.items.map((i) => [i.requestId, i.predictedStartMs])).toEqual([
      ['A-s1', 65_000],
      ['B-b2', 65_000 + 185_000],
    ]);
    expect(p.stoppedReason).toBe('EXHAUSTED');
  });
  it('flags later items uncertain after an unknown duration', () => {
    const p = projectQueue(
      base({ candidates: [cand('A', 'salsa', 1, { durationMs: null }), cand('B', 'bachata', 2)] }),
    );
    expect(p.items.map((i) => i.uncertain)).toEqual([false, true]);
  });
  it('single owner: WAITING_FAIRNESS, not overflow', () => {
    const p = projectQueue(base({ candidates: [cand('A', 'salsa', 1), cand('A', 'bachata', 2)] }));
    expect(p.items).toHaveLength(1);
    expect(p.stoppedReason).toBe('WAITING_FAIRNESS');
    expect(p.waitingIds).toEqual(['A-b2']);
    expect(p.overflowIds).toEqual([]);
  });
  it('scenario 9: song that cannot finish before end is overflow; extension admits it', () => {
    const min = 60_000;
    const cs = [cand('A', 'salsa', 1, { durationMs: 4 * min })];
    const tight = projectQueue(
      base({ candidates: cs, nowMs: 0, endAtMs: 6 * min, currentRemainingMs: 3 * min }),
    );
    expect(tight.overflowIds).toEqual(['A-s1']);
    expect(tight.items[0]).toMatchObject({ overflow: true, predictedStartMs: null });
    const extended = projectQueue(
      base({ candidates: cs, nowMs: 0, endAtMs: 10 * min, currentRemainingMs: 3 * min }),
    );
    expect(extended.overflowIds).toEqual([]);
    expect(extended.items[0]?.overflow).toBe(false);
  });
  it('scenario 10: no end time means no overflow', () => {
    const cs = Array.from({ length: 8 }, (_, i) => cand(`O${i}`, i % 2 ? 'bachata' : 'salsa', i));
    expect(projectQueue(base({ candidates: cs })).overflowIds).toEqual([]);
  });
  it('a break before the end leaves too little room for a song', () => {
    const cs = [cand('A', 'salsa', 1)];
    const p = projectQueue(
      base({ candidates: cs, endAtMs: 300_000, breaks: [{ startMs: 100_000, endMs: 160_000 }] }),
    );
    expect(p.overflowIds).toEqual(['A-s1']); // 180 s does not fit before the break, nor after it
  });
  it('songs end before a break and music resumes after it', () => {
    // 2 h event, 10 min break centred on the midpoint: 55-65 min, three-minute songs.
    const min = 60_000;
    const cs = Array.from({ length: 30 }, (_, i) =>
      cand(`o${i}`, i % 2 ? 'bachata' : 'salsa', i + 1),
    );
    const p = projectQueue(
      base({
        candidates: cs,
        endAtMs: 120 * min,
        breaks: [{ startMs: 55 * min, endMs: 65 * min }],
        horizon: 100,
      }),
    );
    const by = new Map(cs.map((c) => [c.requestId, c]));
    for (const it of p.items.filter((i) => !i.overflow)) {
      const start = it.predictedStartMs!;
      const end = start + by.get(it.requestId)!.durationMs!;
      expect(end <= 55 * min || start >= 65 * min).toBe(true);
    }
    expect(p.items.some((i) => i.predictedStartMs! >= 65 * min)).toBe(true);
  });
  it('respects the horizon and does not mutate inputs', () => {
    const cs = Array.from({ length: 10 }, (_, i) => cand(`O${i}`, i % 2 ? 'bachata' : 'salsa', i));
    const copy = JSON.stringify(cs);
    const p = projectQueue(base({ candidates: cs, horizon: 3 }));
    expect(p.items).toHaveLength(3);
    expect(p.stoppedReason).toBe('HORIZON');
    expect(JSON.stringify(cs)).toBe(copy);
    expect(EMPTY_HISTORY.playedKeys.size).toBe(0);
  });
});

describe('segments with their own styles', () => {
  const min = 60_000;
  const all = { enabledStyles: ['salsa', 'bachata'], runCaps: { salsa: 5, bachata: 5 } };
  const chachaOnly = { enabledStyles: ['chacha'], runCaps: { chacha: 5 } };
  const base2 = (over: Partial<Parameters<typeof projectQueue>[0]>) => ({
    candidates: [],
    history: EMPTY_HISTORY,
    rules: all,
    nowMs: 0,
    endAtMs: 120 * min,
    currentRemainingMs: null,
    breaks: [{ startMs: 55 * min, endMs: 65 * min }],
    overheadSec: 5,
    horizon: 100,
    ruleWindows: [
      { fromMs: 0, rules: all },
      { fromMs: 65 * min, rules: chachaOnly },
    ],
    ...over,
  });
  it('plays a style only in the part of the evening that allows it', () => {
    const early = cand('A', 'chacha', 1);
    const salsa = cand('B', 'salsa', 2);
    const p = projectQueue(base2({ candidates: [early, salsa] }));
    // The cha-cha song was requested first but waits for segment 2; salsa plays at once.
    expect(p.items.map((i) => i.requestId)).toEqual([salsa.requestId, early.requestId]);
    expect(p.items[1]!.predictedStartMs!).toBeGreaterThanOrEqual(65 * min);
  });
  it('does not mark a song as overflow just because its style is not allowed yet', () => {
    const p = projectQueue(base2({ candidates: [cand('A', 'chacha', 1)] }));
    expect(p.overflowIds).toEqual([]);
    expect(p.items).toHaveLength(1);
  });
  it('lists a style that no segment allows as waiting', () => {
    const p = projectQueue(
      base2({
        candidates: [cand('A', 'bachata', 1)],
        ruleWindows: [{ fromMs: 0, rules: chachaOnly }],
      }),
    );
    expect(p.items).toHaveLength(0);
    expect(p.waitingIds).toHaveLength(1);
  });
  it('uses single-genre spacing only in the single-genre segment', () => {
    const a1 = cand('A', 'chacha', 1);
    const a2 = cand('A', 'chacha', 4);
    const others = [cand('B', 'chacha', 2), cand('C', 'chacha', 3)];
    const p = projectQueue(
      base2({
        candidates: [a1, a2, ...others],
        ruleWindows: [{ fromMs: 0, rules: chachaOnly }],
        breaks: [],
      }),
    );
    const order = p.items.map((i) => i.requestId);
    expect(order[0]).toBe(a1.requestId);
    expect(order.indexOf(a2.requestId)).toBeGreaterThan(order.indexOf(others[0]!.requestId));
  });
});
