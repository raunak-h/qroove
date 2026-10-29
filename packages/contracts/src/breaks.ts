import { EVENT_LIMITS, RULE_DEFAULTS } from '@qroove/config';

export interface BreakSlot {
  /** Minutes from the start of the event to the start of the break. */
  startMin: number;
  durationMin: number;
}

/**
 * Breaks are spread evenly and centred on their points: one break sits on the midpoint, two on the
 * thirds, and so on. A 10-minute break in a 2-hour event runs 55–65 min.
 */
export function breakSlots(plannedMin: number, durationsMin: readonly number[]): BreakSlot[] {
  const n = durationsMin.length;
  return durationsMin.map((d, i) => ({
    startMin: (plannedMin * (i + 1)) / (n + 1) - d / 2,
    durationMin: d,
  }));
}

/** Returns a plain-language problem, or null when the breaks fit. Hard limits, enforced server-side. */
export function validateBreaks(
  plannedMin: number | null,
  durationsMin: readonly number[],
): string | null {
  if (durationsMin.length === 0) return null;
  if (plannedMin === null) return 'Set a planned time before adding breaks.';
  if (durationsMin.length > EVENT_LIMITS.maxBreaks) {
    return `At most ${EVENT_LIMITS.maxBreaks} breaks.`;
  }
  for (const d of durationsMin) {
    if (
      !Number.isInteger(d) ||
      d % EVENT_LIMITS.breakStepMin !== 0 ||
      d <= 0 ||
      d > EVENT_LIMITS.maxBreakMin
    ) {
      return `Breaks are ${EVENT_LIMITS.breakStepMin} to ${EVENT_LIMITS.maxBreakMin} minutes, in steps of ${EVENT_LIMITS.breakStepMin}.`;
    }
  }
  const total = durationsMin.reduce((a, b) => a + b, 0);
  if (total > plannedMin * EVENT_LIMITS.maxBreakShare) {
    return `Breaks can take at most half of the planned time (${Math.floor(plannedMin * EVENT_LIMITS.maxBreakShare)} min here).`;
  }
  // Breaks may never run back to back: music must fill every stretch between them.
  const slots = breakSlots(plannedMin, durationsMin);
  let cursor = 0;
  for (const s of slots) {
    if (s.startMin - cursor < EVENT_LIMITS.minMusicSegmentMin) {
      return `Keep at least ${EVENT_LIMITS.minMusicSegmentMin} minutes of music between breaks and before the first one.`;
    }
    cursor = s.startMin + s.durationMin;
  }
  if (plannedMin - cursor < EVENT_LIMITS.minMusicSegmentMin) {
    return `Keep at least ${EVENT_LIMITS.minMusicSegmentMin} minutes of music after the last break.`;
  }
  return null;
}

/**
 * Hard limit: no genre may fall below 1 part in `minGenreShareOf` of the whole ratio, so a
 * multi-genre night can never starve a genre (1:5 and 1:1:5 are fine; 1:5:5 is not).
 */
export function ratioProblem(parts: readonly number[]): string | null {
  if (parts.length < 2) return null;
  const total = parts.reduce((a, b) => a + b, 0);
  const min = Math.min(...parts);
  if (min * RULE_DEFAULTS.minGenreShareOf < total) {
    return `Every genre needs at least 1 part in ${RULE_DEFAULTS.minGenreShareOf} of the ratio. Raise the smallest number or lower the largest.`;
  }
  return null;
}
