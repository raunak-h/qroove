import type { Candidate, HistoryState, SchedulerRules } from '@qroove/scheduler';
import { FALLBACK_RUN_CAP } from '@qroove/scheduler';
import { genreOf, genresOf } from '@qroove/config';
import type { RulesSnapshot } from '@qroove/contracts';
import type { HistoryDoc, RequestDoc } from '../db/types.js';

export const EMPTY_HISTORY_DOC: HistoryDoc = {
  lastStyle: null,
  runLength: 0,
  lastOwnerId: null,
  transitionCount: 0,
  ownerLastPlayTransition: {},
  ownerGate: {},
  playedKeys: [],
};

/** Adapter boundary: the stored array becomes the scheduler's Set. */
export const toSchedulerHistory = (h: HistoryDoc): HistoryState => ({
  ...h,
  ownerGate: h.ownerGate,
  playedKeys: new Set(h.playedKeys),
});

export const fromSchedulerHistory = (h: HistoryState): HistoryDoc => ({
  lastStyle: h.lastStyle,
  runLength: h.runLength,
  lastOwnerId: h.lastOwnerId,
  transitionCount: h.transitionCount,
  ownerLastPlayTransition: { ...h.ownerLastPlayTransition },
  ownerGate: Object.fromEntries(Object.entries(h.ownerGate).map(([k, v]) => [k, [...v]])),
  playedKeys: [...h.playedKeys].sort(),
});

/**
 * The scheduler's "style" is the genre: salsa and non-Latin salsa-compatible count as one, so a
 * change between them is not a style change. Run caps are keyed by genre in the rules snapshot.
 */
export function toSchedulerRules(rules: RulesSnapshot): SchedulerRules {
  const genres = genresOf(rules.enabledStyles);
  const runCaps: Record<string, number> = {};
  for (const g of genres) runCaps[g] = rules.runCaps[g] ?? FALLBACK_RUN_CAP;
  return { enabledStyles: genres, runCaps };
}

export const toCandidate = (r: RequestDoc): Candidate => ({
  requestId: r.id,
  ownerId: r.ownerId,
  style: genreOf(r.style),
  acceptedSeq: r.acceptedSeq,
  canonicalKey: r.canonicalKey,
  durationMs: r.durationMs,
  playable: r.playable,
});
