import { describe, expect, it } from 'vitest';
import {
  applyPlay,
  EMPTY_HISTORY,
  selectNext,
  type Candidate,
  type HistoryState,
} from '../src/index.js';
import { RULES, cand } from './helpers.js';

function drain(cs: Candidate[]): string[] {
  let h: HistoryState = EMPTY_HISTORY;
  let rest = cs;
  const out: string[] = [];
  for (;;) {
    const { pick } = selectNext(rest, h, RULES);
    if (!pick) return out;
    out.push(pick.requestId);
    h = applyPlay(h, pick);
    rest = rest.filter((c) => c !== pick);
  }
}

describe('selectNext', () => {
  it('SPEC §3.4 impossibility example: A all salsa, B all bachata alternate', () => {
    const cs = [
      cand('A', 'salsa', 1),
      cand('A', 'salsa', 2),
      cand('B', 'bachata', 3),
      cand('B', 'bachata', 4),
    ];
    expect(drain(cs)).toEqual(['A-s1', 'B-b3', 'A-s2', 'B-b4']);
  });
  it('single owner plays one then waits', () => {
    const cs = [cand('A', 'salsa', 1), cand('A', 'bachata', 2), cand('A', 'salsa', 3)];
    expect(drain(cs)).toEqual(['A-s1']);
    const sel = selectNext(cs.slice(1), applyPlay(EMPTY_HISTORY, cs[0]!), RULES);
    expect(sel.pick).toBeNull();
    expect(sel.reason).toContain('Waiting for another contributor or a style change');
  });
  it('no candidates', () => {
    expect(selectNext([], EMPTY_HISTORY, RULES).reason).toBe('NO_CANDIDATES');
  });
  it('cap 2 blocks a third salsa, then the oldest eligible request wins', () => {
    const cs = [
      cand('A', 'salsa', 1),
      cand('B', 'salsa', 2),
      cand('C', 'salsa', 3),
      cand('D', 'bachata', 4),
      cand('E', 'bachata', 5),
      cand('F', 'bachata', 6),
    ];
    expect(drain(cs)).toEqual(['A-s1', 'B-s2', 'D-b4', 'C-s3', 'E-b5', 'F-b6']);
  });
  it('scenario 1: A/B/C salsa, D/E bachata', () => {
    const cs = [
      cand('A', 'salsa', 1),
      cand('B', 'salsa', 2),
      cand('D', 'bachata', 3),
      cand('E', 'bachata', 4),
      cand('C', 'salsa', 5),
    ];
    expect(drain(cs)).toEqual(['A-s1', 'B-s2', 'D-b3', 'E-b4', 'C-s5']);
  });
  it('a skipped-after-start track counts as a play', () => {
    const a = cand('A', 'salsa', 1);
    const h = applyPlay(EMPTY_HISTORY, a);
    const sel = selectNext([cand('A', 'bachata', 2), cand('B', 'salsa', 3)], h, RULES);
    expect(sel.pick?.requestId).toBe('B-s3');
    expect(sel.blocked).toEqual([{ requestId: 'A-b2', reason: 'SAME_OWNER_ADJACENT' }]);
  });
  it('tie-break prefers a style different from the last', () => {
    const h = applyPlay(EMPTY_HISTORY, cand('Z', 'salsa', 0));
    const a = cand('A', 'salsa', 5);
    const b = cand('B', 'bachata', 5);
    expect(selectNext([a, b], h, RULES).pick?.style).toBe('bachata');
  });
  it('is deterministic and independent of input order', () => {
    const cs = [
      cand('A', 'salsa', 1),
      cand('B', 'bachata', 2),
      cand('C', 'salsa', 3),
      cand('D', 'bachata', 4),
    ];
    expect(drain(cs)).toEqual(drain([...cs].reverse()));
    expect(drain(cs)).toEqual(drain(cs));
  });
});
