import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DURATION_MS,
  EMPTY_HISTORY,
  projectQueue,
  type Candidate,
  type SchedulerRules,
} from '../src/index.js';

const numRuns = Number(process.env['PROPERTY_RUNS'] ?? 2000);
const STYLES = ['salsa', 'bachata', 'chacha', 'kizomba'];

const scenario = fc.record({
  owners: fc.integer({ min: 1, max: 8 }),
  styleCount: fc.integer({ min: 1, max: 4 }),
  caps: fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 4, maxLength: 4 }),
  reqs: fc.array(
    fc.record({
      o: fc.nat(7),
      s: fc.nat(3),
      key: fc.nat(40),
      dur: fc.option(fc.integer({ min: 30_000, max: 400_000 }), { nil: null }),
    }),
    { maxLength: 60 },
  ),
  endOffset: fc.option(fc.integer({ min: 0, max: 3_600_000 }), { nil: null }),
});

describe('projection invariants', () => {
  it('holds hard constraints for random queues', () => {
    fc.assert(
      fc.property(scenario, (sc) => {
        const styles = STYLES.slice(0, sc.styleCount);
        const rules: SchedulerRules = {
          enabledStyles: styles,
          runCaps: Object.fromEntries(styles.map((s, i) => [s, sc.caps[i]!])),
        };
        const cands: Candidate[] = sc.reqs.map((r, i) => ({
          requestId: `r${String(i).padStart(3, '0')}`,
          ownerId: `o${r.o % sc.owners}`,
          style: styles[r.s % styles.length]!,
          acceptedSeq: i,
          canonicalKey: `k${r.key}`,
          durationMs: r.dur,
          playable: true,
        }));
        const endAtMs = sc.endOffset;
        const input = {
          candidates: cands,
          history: EMPTY_HISTORY,
          rules,
          nowMs: 0,
          endAtMs,
          currentRemainingMs: null,
          breaksRemainingSec: 0,
          overheadSec: 5,
          horizon: 100,
        };
        const p = projectQueue(input);
        expect(projectQueue(input)).toEqual(p); // determinism

        const byId = new Map(cands.map((c) => [c.requestId, c]));
        const played = p.items.filter((i) => !i.overflow).map((i) => byId.get(i.requestId)!);
        const lastTransitionOf = new Map<string, number>();
        const keys = new Set<string>();
        let transitions = 0,
          run = 0,
          prev: Candidate | null = null;
        for (const c of played) {
          if (prev) expect(c.ownerId).not.toBe(prev.ownerId);
          if (prev && prev.style !== c.style) {
            transitions += 1;
            run = 1;
          } else run += 1;
          expect(run).toBeLessThanOrEqual(rules.runCaps[c.style]!);
          const last = lastTransitionOf.get(c.ownerId);
          if (last !== undefined) expect(transitions).toBeGreaterThan(last);
          lastTransitionOf.set(c.ownerId, transitions);
          expect(keys.has(c.canonicalKey)).toBe(false);
          keys.add(c.canonicalKey);
          prev = c;
        }
        if (endAtMs !== null) {
          for (const i of p.items.filter((x) => !x.overflow)) {
            const dur = byId.get(i.requestId)!.durationMs ?? DEFAULT_DURATION_MS;
            expect(i.predictedStartMs! + dur).toBeLessThanOrEqual(endAtMs);
          }
        } else expect(p.overflowIds).toEqual([]);
      }),
      { numRuns },
    );
  }, 600_000);
});
