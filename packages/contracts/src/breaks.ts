import {
  EVENT_LIMITS,
  RULE_DEFAULTS,
  genreOf,
  genresOf,
  type StyleId,
} from '@qroove/config';

export interface BreakSlot {
  /** Minutes from the start of the event to the start of the break (a multiple of 10). */
  startMin: number;
  durationMin: number;
}

/** Snaps a position (minutes) to the 10-minute grid used on the timeline. */
export const snapStart = (min: number) =>
  Math.round(min / EVENT_LIMITS.breakStartStepMin) * EVENT_LIMITS.breakStartStepMin;

/** The stretches of music between breaks, as [from, to) minutes. */
export function segmentSpans(
  plannedMin: number,
  breaks: readonly BreakSlot[],
): Array<[number, number]> {
  const sorted = [...breaks].sort((a, b) => a.startMin - b.startMin);
  const spans: Array<[number, number]> = [];
  let from = 0;
  for (const b of sorted) {
    spans.push([from, b.startMin]);
    from = b.startMin + b.durationMin;
  }
  spans.push([from, plannedMin]);
  return spans;
}

/** Returns a plain-language problem, or null when the breaks fit. Hard limits, enforced server-side. */
export function validateBreaks(
  plannedMin: number | null,
  breaks: readonly BreakSlot[],
): string | null {
  if (breaks.length === 0) return null;
  if (plannedMin === null) return 'Set a planned time before adding breaks.';
  if (breaks.length > EVENT_LIMITS.maxBreaks) return `At most ${EVENT_LIMITS.maxBreaks} breaks.`;
  for (const b of breaks) {
    const d = b.durationMin;
    if (
      !Number.isInteger(d) ||
      d % EVENT_LIMITS.breakStepMin !== 0 ||
      d <= 0 ||
      d > EVENT_LIMITS.maxBreakMin
    ) {
      return `Breaks are ${EVENT_LIMITS.breakStepMin} to ${EVENT_LIMITS.maxBreakMin} minutes, in steps of ${EVENT_LIMITS.breakStepMin}.`;
    }
    if (!Number.isInteger(b.startMin) || b.startMin % EVENT_LIMITS.breakStartStepMin !== 0) {
      return `Breaks start on a ${EVENT_LIMITS.breakStartStepMin}-minute mark.`;
    }
  }
  const total = breaks.reduce((a, b) => a + b.durationMin, 0);
  if (total > plannedMin * EVENT_LIMITS.maxBreakShare) {
    return `Breaks can take at most half of the planned time (${Math.floor(plannedMin * EVENT_LIMITS.maxBreakShare)} min here).`;
  }
  // Breaks may never run back to back: music must fill every stretch between them.
  const sorted = [...breaks].sort((a, b) => a.startMin - b.startMin);
  let cursor = 0;
  for (const s of sorted) {
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

/**
 * Playlists must cover every genre that is active somewhere in the evening. One playlist per
 * style is allowed, and either a Latin style's playlist or its non-Latin counterpart's covers the
 * genre. With no playlists at all there is nothing to check.
 */
export function playlistCoverageProblem(
  allowed: readonly StyleId[],
  playlistStyles: readonly StyleId[],
): string | null {
  if (playlistStyles.length === 0) return null;
  if (new Set(playlistStyles).size !== playlistStyles.length) return 'One playlist per style.';
  for (const s of playlistStyles) {
    if (!allowed.includes(s)) return 'A playlist is for a style that is not part of the event.';
  }
  const have = new Set(playlistStyles.map(genreOf));
  const missing = genresOf(allowed).filter((g) => !have.has(g));
  return missing.length > 0 ? 'Add a playlist for every genre, or remove them all.' : null;
}
