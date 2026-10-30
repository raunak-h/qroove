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
  /** Rules in force when `ruleWindows` is absent or has not started yet. */
  rules: SchedulerRules;
  /** Per-segment rules, sorted by `fromMs`; the last one with `fromMs <= t` applies at time `t`. */
  ruleWindows?: readonly RuleWindow[];
  nowMs: number;
  endAtMs: number | null;
  /** Time left on the song currently playing; null when nothing is playing. */
  currentRemainingMs: number | null;
  /** Breaks still to come (or in progress), as absolute times. Songs must end before one starts. */
  breaks: readonly BreakWindow[];
  overheadSec: number;
  horizon?: number;
}

/** The rules that apply from `fromMs` until the next window starts (one per segment of the evening). */
export interface RuleWindow {
  fromMs: number;
  rules: SchedulerRules;
}

export interface BreakWindow {
  startMs: number;
  endMs: number;
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
  const breaks = [...input.breaks].sort((a, b) => a.startMs - b.startMs);
  const rulesAt = (t: number): SchedulerRules => {
    let r = input.rules;
    for (const w of input.ruleWindows ?? []) if (w.fromMs <= t) r = w.rules;
    return r;
  };
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
    // Find the stretch of music we are in: skip a break we are inside, stop at the next one.
    let windowEnd: number | null = input.endAtMs;
    let limitedBy: BreakWindow | null = null;
    for (const b of breaks) {
      if (b.endMs <= t) continue;
      if (b.startMs <= t) {
        t = b.endMs;
        continue;
      }
      if (windowEnd === null || b.startMs < windowEnd) {
        windowEnd = b.startMs;
        limitedBy = b;
      }
      break;
    }
    const rules = rulesAt(t);
    const sel = selectNext(remaining, history, rules, {
      remainingMs: windowEnd === null ? null : windowEnd - t,
    });
    if (!sel.pick) {
      // Nothing fits before the break: the room waits, and music resumes after it.
      if (
        limitedBy &&
        sel.blocked.length > 0 &&
        // Songs that do not fit, or whose style is not allowed in this part of the evening, wait.
        sel.blocked.every((b) => b.reason === 'WOULD_EXCEED_END' || b.reason === 'STYLE_DISABLED')
      ) {
        t = limitedBy.endMs;
        continue;
      }
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
    remaining = remaining.filter((r) => r.requestId !== c.requestId);
    history = applyPlay(history, c);
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
