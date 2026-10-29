import {
  DEFAULT_DURATION_MS,
  FALLBACK_RUN_CAP,
  type Candidate,
  type Eligibility,
  type EligibilityContext,
  type HistoryState,
  type SchedulerRules,
} from './types.js';

export const isSingleGenre = (rules: SchedulerRules) => rules.enabledStyles.length === 1;

export function runCapFor(rules: SchedulerRules, style: string): number {
  return rules.runCaps[style] ?? FALLBACK_RUN_CAP;
}

/** SPEC §3.4. Checks run in a fixed order so the reported reason is deterministic. */
export function checkEligibility(
  c: Candidate,
  history: HistoryState,
  rules: SchedulerRules,
  ctx: EligibilityContext = {},
): Eligibility {
  if (!c.playable) return { ok: false, reason: 'NOT_PLAYABLE' };
  if (!rules.enabledStyles.includes(c.style)) return { ok: false, reason: 'STYLE_DISABLED' };
  if (rules.allowedVariants && c.variant && !rules.allowedVariants.includes(c.variant)) {
    return { ok: false, reason: 'STYLE_DISABLED' };
  }
  if (history.playedKeys.has(c.canonicalKey)) return { ok: false, reason: 'ALREADY_PLAYED' };
  if (history.lastOwnerId !== null && c.ownerId === history.lastOwnerId) {
    return { ok: false, reason: 'SAME_OWNER_ADJACENT' };
  }
  if (isSingleGenre(rules)) {
    // The genre never changes, so a returning requester waits for half of the others' songs instead.
    const gate = history.ownerGate[c.ownerId];
    if (gate?.some((k) => !history.playedKeys.has(k) && (ctx.poolKeys?.has(k) ?? true))) {
      return { ok: false, reason: 'NEEDS_OTHERS_PLAYED' };
    }
  } else {
    const last = history.ownerLastPlayTransition[c.ownerId];
    if (last !== undefined && history.transitionCount <= last) {
      return { ok: false, reason: 'NEEDS_STYLE_TRANSITION' };
    }
  }
  if (history.lastStyle === c.style && history.runLength >= runCapFor(rules, c.style)) {
    return { ok: false, reason: 'RUN_CAP' };
  }
  if (ctx.remainingMs != null && (c.durationMs ?? DEFAULT_DURATION_MS) > ctx.remainingMs) {
    return { ok: false, reason: 'WOULD_EXCEED_END' };
  }
  return { ok: true };
}

export interface PlayOptions {
  /** Songs still waiting at the moment of this play. */
  pool?: readonly Candidate[];
  /** Build the single-genre gate for this owner (see `HistoryState.ownerGate`). */
  gate?: boolean;
}

/** Pure history update for a started play (a skipped-after-start track counts as a play). */
export function applyPlay(
  history: HistoryState,
  c: Candidate,
  opts: PlayOptions = {},
): HistoryState {
  const changed = history.lastStyle !== null && history.lastStyle !== c.style;
  const transitionCount = history.transitionCount + (changed ? 1 : 0);
  const runLength = history.lastStyle === c.style ? history.runLength + 1 : 1;
  const playedKeys = new Set(history.playedKeys);
  playedKeys.add(c.canonicalKey);
  let ownerGate = history.ownerGate;
  if (opts.gate) {
    const others = (opts.pool ?? [])
      .filter((o) => o.ownerId !== c.ownerId && !playedKeys.has(o.canonicalKey))
      .sort((a, b) => a.acceptedSeq - b.acceptedSeq || (a.requestId < b.requestId ? -1 : 1));
    ownerGate = {
      ...ownerGate,
      [c.ownerId]: others.slice(0, Math.ceil(others.length / 2)).map((o) => o.canonicalKey),
    };
  }
  return {
    lastStyle: c.style,
    runLength,
    lastOwnerId: c.ownerId,
    transitionCount,
    ownerLastPlayTransition: { ...history.ownerLastPlayTransition, [c.ownerId]: transitionCount },
    ownerGate,
    playedKeys,
  };
}
