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
  // With one genre there is nothing to change to, so a run cap could only stop the music.
  if (
    !isSingleGenre(rules) &&
    history.lastStyle === c.style &&
    history.runLength >= runCapFor(rules, c.style)
  ) {
    return { ok: false, reason: 'RUN_CAP' };
  }
  if (ctx.remainingMs != null && (c.durationMs ?? DEFAULT_DURATION_MS) > ctx.remainingMs) {
    return { ok: false, reason: 'WOULD_EXCEED_END' };
  }
  return { ok: true };
}

/** Pure history update for a started play (a skipped-after-start track counts as a play). */
export function applyPlay(history: HistoryState, c: Candidate): HistoryState {
  const changed = history.lastStyle !== null && history.lastStyle !== c.style;
  const playedKeys = new Set(history.playedKeys);
  playedKeys.add(c.canonicalKey);
  return {
    lastStyle: c.style,
    runLength: history.lastStyle === c.style ? history.runLength + 1 : 1,
    transitionCount: history.transitionCount + (changed ? 1 : 0),
    playedKeys,
  };
}
