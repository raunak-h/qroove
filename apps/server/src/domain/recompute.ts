import { RULE_DEFAULTS } from '@qroove/config';
import type { PreviewItem } from '@qroove/contracts';
import {
  applyPlay,
  DEFAULT_DURATION_MS,
  projectQueue,
  selectNext,
  type Candidate,
} from '@qroove/scheduler';
import type { RequestDoc } from '../db/types.js';
import type { Work } from './context.js';
import {
  fromSchedulerHistory,
  toCandidate,
  toSchedulerHistory,
  toSchedulerRules,
} from './history.js';

const POOL_STATES: ReadonlySet<string> = new Set(['QUEUED', 'INELIGIBLE_TEMPORARILY', 'OVERFLOW']);

/** Seconds of break time still to come, counting the unelapsed part of one in progress. */
export function breaksRemainingSec(w: Work, now: number): number {
  let total = 0;
  for (const b of w.event.breaks) {
    if (b.actualEnd !== null) continue;
    if (b.actualStart === null) total += b.durationSec;
    else total += Math.max(0, b.durationSec - Math.floor((now - b.actualStart) / 1000));
  }
  return total;
}

export const breakInProgress = (w: Work) =>
  w.event.breaks.some((b) => b.actualStart !== null && b.actualEnd === null);

/**
 * After any mutation: keep a single next-track reservation, refresh request states that depend on
 * the projection, and rewrite the denormalised preview. Mutates `w` only.
 */
export function recompute(w: Work, now: number): void {
  const e = w.event;
  const live = e.state === 'ACTIVE' || e.state === 'PAUSED' || e.state === 'TRANSFERRING';
  if (!live) {
    e.reservation = null;
    e.waitingReason = null;
    e.preview = { revision: e.version + 1, items: [], stoppedReason: 'EXHAUSTED', computedAt: now };
    return;
  }

  const rules = toSchedulerRules(e.rules);
  const history = toSchedulerHistory(e.history);
  const overheadMs = RULE_DEFAULTS.transitionOverheadSec * 1000;
  const breakSec = breaksRemainingSec(w, now);
  const all = [...w.requests.values()];
  let reserved: RequestDoc | undefined = all.find((r) => r.state === 'RESERVED_NEXT');
  const playing = e.nowPlaying;

  // Invariant: `reservation` is set iff exactly one request is RESERVED_NEXT.
  if (!reserved) e.reservation = null;

  e.waitingReason = null;
  if (e.state === 'ACTIVE' && !reserved && !playing) {
    if (breakInProgress(w)) {
      e.waitingReason = 'On a break';
    } else {
      const pool: Candidate[] = all.filter((r) => POOL_STATES.has(r.state)).map(toCandidate);
      const remainingMs = e.endAt === null ? null : e.endAt - breakSec * 1000 - now;
      const sel = selectNext(pool, history, rules, { remainingMs });
      if (sel.pick) {
        reserved = w.setState(w.requests.get(sel.pick.requestId)!, 'RESERVED_NEXT', now);
        e.reservation = {
          requestId: reserved.id,
          reservedAt: now,
          leaseEpoch: e.lease?.epoch ?? 0,
        };
      } else if (pool.length === 0) {
        e.waitingReason = 'Waiting for songs to be requested';
      } else if (sel.blocked.every((b) => b.reason === 'WOULD_EXCEED_END')) {
        e.waitingReason = 'Beyond planned end — admin must extend';
      } else {
        e.waitingReason = sel.reason.replace(/^ALL_BLOCKED_FAIRNESS: /, '');
      }
    }
  }

  // Projection: the reservation (if any) is forced first, then the scheduler simulates the rest.
  const candidates = [...w.requests.values()]
    .filter((r) => POOL_STATES.has(r.state))
    .map(toCandidate);
  const playingLeft = playing
    ? Math.max(0, playing.startedAt + (playing.durationMs ?? DEFAULT_DURATION_MS) - now)
    : 0;
  let uncertain = playing !== null && playing.durationMs === null;
  const items: PreviewItem[] = [];
  let projHistory = history;
  let currentRemainingMs: number | null = playing ? playingLeft : null;

  if (reserved) {
    const startOffset = playingLeft + (playingLeft > 0 ? overheadMs : 0);
    items.push({
      requestId: reserved.id,
      position: 1,
      predictedStartMs: now + startOffset,
      uncertain,
      overflow: false,
    });
    projHistory = applyPlay(history, toCandidate(reserved));
    currentRemainingMs = startOffset + (reserved.durationMs ?? DEFAULT_DURATION_MS);
    if (reserved.durationMs === null) uncertain = true;
  }

  const proj = projectQueue({
    candidates,
    history: projHistory,
    rules,
    nowMs: now,
    endAtMs: e.endAt,
    currentRemainingMs,
    breaksRemainingSec: breakSec,
    overheadSec: RULE_DEFAULTS.transitionOverheadSec,
  });
  for (const it of proj.items) {
    items.push({ ...it, position: items.length + 1, uncertain: it.uncertain || uncertain });
  }

  const overflow = new Set(proj.overflowIds);
  const waiting = new Set(proj.waitingIds);
  for (const c of candidates) {
    const r = w.requests.get(c.requestId)!;
    w.setState(
      r,
      overflow.has(r.id) ? 'OVERFLOW' : waiting.has(r.id) ? 'INELIGIBLE_TEMPORARILY' : 'QUEUED',
      now,
    );
  }

  e.preview = {
    revision: e.version + 1,
    items,
    stoppedReason: proj.stoppedReason,
    computedAt: now,
  };
}

/** Applies a started play to the event's stored history. */
export function recordPlay(w: Work, r: RequestDoc): void {
  w.event.history = fromSchedulerHistory(
    applyPlay(toSchedulerHistory(w.event.history), toCandidate(r)),
  );
}
