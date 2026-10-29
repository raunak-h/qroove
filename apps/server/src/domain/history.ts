import type { Candidate, HistoryState, SchedulerRules } from '@qroove/scheduler';
import { FALLBACK_RUN_CAP } from '@qroove/scheduler';
import type { RulesSnapshot } from '@qroove/contracts';
import type { HistoryDoc, RequestDoc } from '../db/types.js';

export const EMPTY_HISTORY_DOC: HistoryDoc = {
  lastStyle: null,
  runLength: 0,
  lastOwnerId: null,
  transitionCount: 0,
  ownerLastPlayTransition: {},
  playedKeys: [],
};

/** Adapter boundary: the stored array becomes the scheduler's Set. */
export const toSchedulerHistory = (h: HistoryDoc): HistoryState => ({
  ...h,
  playedKeys: new Set(h.playedKeys),
});

export const fromSchedulerHistory = (h: HistoryState): HistoryDoc => ({
  lastStyle: h.lastStyle,
  runLength: h.runLength,
  lastOwnerId: h.lastOwnerId,
  transitionCount: h.transitionCount,
  ownerLastPlayTransition: { ...h.ownerLastPlayTransition },
  playedKeys: [...h.playedKeys].sort(),
});

/** Contracts' rules have a partial `runCaps`; the scheduler wants every enabled style covered. */
export function toSchedulerRules(rules: RulesSnapshot): SchedulerRules {
  const runCaps: Record<string, number> = {};
  for (const s of rules.enabledStyles) runCaps[s] = rules.runCaps[s] ?? FALLBACK_RUN_CAP;
  return { enabledStyles: rules.enabledStyles, runCaps };
}

export const toCandidate = (r: RequestDoc): Candidate => ({
  requestId: r.id,
  ownerId: r.ownerId,
  style: r.style,
  acceptedSeq: r.acceptedSeq,
  canonicalKey: r.canonicalKey,
  durationMs: r.durationMs,
  playable: r.playable,
});
