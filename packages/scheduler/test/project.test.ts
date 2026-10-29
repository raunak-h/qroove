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
  breaksRemainingSec: 0,
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
  it('reserved breaks shrink the window', () => {
    const cs = [cand('A', 'salsa', 1)];
    const p = projectQueue(base({ candidates: cs, endAtMs: 200_000, breaksRemainingSec: 60 }));
    expect(p.overflowIds).toEqual(['A-s1']);
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
