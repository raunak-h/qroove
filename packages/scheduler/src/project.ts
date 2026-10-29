import { applyPlay } from './eligibility.js';
import { selectNext } from './select.js';
import {
  DEFAULT_DURATION_MS,
  type Candidate,
  type HistoryState,
  type SchedulerRules,
} from './types.js';

export interface ProjectInput {
  candidates: readonly Candidate[];
  history: HistoryState;
  rules: SchedulerRules;
  nowMs: number;
  endAtMs: number | null;
  /** Time left on the song currently playing; null when nothing is playing. */
  currentRemainingMs: number | null;
  breaksRemainingSec: number;
  overheadSec: number;
  horizon?: number;
}

export interface ProjectedItem {
  requestId: string;
  position: number;
  predictedStartMs: number | null;
  uncertain: boolean;
  overflow: boolean;
}

export interface Projection {
  items: ProjectedItem[];
  stoppedReason: 'EXHAUSTED' | 'WAITING_FAIRNESS' | 'HORIZON';
  overflowIds: string[];
  waitingIds: string[];
}

/** SPEC §4: simulate future plays on a copy of history. Never mutates inputs. */
export function projectQueue(input: ProjectInput): Projection {
  const horizon = input.horizon ?? 50;
  const overheadMs = input.overheadSec * 1000;
  const endEff = input.endAtMs === null ? null : input.endAtMs - input.breaksRemainingSec * 1000;
  let remaining = [...input.candidates];
  let history = input.history;
  let t =
    input.nowMs +
    Math.max(0, input.currentRemainingMs ?? 0) +
    (input.currentRemainingMs ? overheadMs : 0);
  let uncertain = false;
  const items: ProjectedItem[] = [];

  let stoppedReason: Projection['stoppedReason'] = 'EXHAUSTED';
  let terminalBlocked: Array<{ requestId: string; reason: string }> = [];

  for (;;) {
    if (remaining.length === 0) break;
    if (items.length >= horizon) {
      stoppedReason = 'HORIZON';
      break;
    }
    const sel = selectNext(remaining, history, input.rules, {
      remainingMs: endEff === null ? null : endEff - t,
    });
    if (!sel.pick) {
      terminalBlocked = sel.blocked;
      break;
    }
    const c = sel.pick;
    items.push({
      requestId: c.requestId,
      position: items.length + 1,
      predictedStartMs: t,
      uncertain,
      overflow: false,
    });
    if (c.durationMs === null) uncertain = true;
    t += (c.durationMs ?? DEFAULT_DURATION_MS) + overheadMs;
    history = applyPlay(history, c);
    remaining = remaining.filter((r) => r.requestId !== c.requestId);
  }

  const overflowIds: string[] = [];
  const waitingIds: string[] = [];
  if (stoppedReason !== 'HORIZON') {
    for (const b of terminalBlocked) {
      (b.reason === 'WOULD_EXCEED_END' ? overflowIds : waitingIds).push(b.requestId);
    }
    if (waitingIds.length > 0) stoppedReason = 'WAITING_FAIRNESS';
  }

  const bySeq = new Map(input.candidates.map((c) => [c.requestId, c]));
  overflowIds.sort(
    (a, b) => bySeq.get(a)!.acceptedSeq - bySeq.get(b)!.acceptedSeq || (a < b ? -1 : 1),
  );
  for (const id of overflowIds) {
    items.push({
      requestId: id,
      position: items.length + 1,
      predictedStartMs: null,
      uncertain: true,
      overflow: true,
    });
  }
  return { items, stoppedReason, overflowIds, waitingIds };
}
