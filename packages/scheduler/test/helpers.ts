import { EMPTY_HISTORY, type Candidate, type SchedulerRules } from '../src/index.js';

export const RULES: SchedulerRules = {
  enabledStyles: ['salsa', 'bachata'],
  runCaps: { salsa: 2, bachata: 2 },
};

let n = 0;
export function cand(
  owner: string,
  style: string,
  seq: number,
  over: Partial<Candidate> = {},
): Candidate {
  n += 1;
  const id = `${owner}-${style[0]}${seq}`;
  return {
    requestId: id,
    ownerId: owner,
    style,
    acceptedSeq: seq,
    canonicalKey: `key-${id}-${n}`,
    durationMs: 180_000,
    playable: true,
    ...over,
  };
}

export { EMPTY_HISTORY };
