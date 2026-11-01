import { RULE_DEFAULTS, genreOf, genresOf, type StyleId } from '@qroove/config';
import {
  FALLBACK_RUN_CAP,
  EMPTY_HISTORY,
  projectQueue,
  type Candidate,
  type RuleWindow,
  type SchedulerRules,
} from '@qroove/scheduler';

/** One part of the evening (between breaks) as the planner holds it. */
export interface PartRules {
  styles: readonly StyleId[];
  /** The cap for every genre unless `ratio` names one. */
  master: number;
  ratio: Partial<Record<string, number>>;
}

export interface PlannedBreak {
  startMin: number;
  durationMin: number;
}

export interface PlannedSong {
  style: StyleId;
  startMin: number;
  lengthMin: number;
}

/** A typical song; the real queue assumes the same for a song of unknown length. */
const SONG_MS = 4 * 60_000;
const MIN_MS = 60_000;

/**
 * Same mapping as the server's `toSchedulerRules` (apps/server/src/domain/history.ts): the
 * scheduler counts genres, and the exact styles of a part stay as `allowedVariants`.
 */
function schedulerRules(part: PartRules): SchedulerRules {
  const genres = genresOf([...part.styles]);
  const runCaps: Record<string, number> = {};
  for (const g of genres) runCaps[g] = part.ratio[g] ?? part.master ?? FALLBACK_RUN_CAP;
  return { enabledStyles: genres, allowedVariants: part.styles, runCaps };
}

/**
 * What the evening would play if every enabled style had plenty of songs waiting, taken from the
 * very scheduler the live queue uses (`projectQueue`), so the preview cannot drift from the real
 * rotation. The songs are assumed to have been added in blocks of each genre's "songs in a row"
 * size, which shows the rotation at its fullest: the real queue plays at most that many in a row,
 * and fewer when people add songs in a different order.
 */
export function previewRotation(
  plannedMin: number,
  breaks: readonly PlannedBreak[],
  parts: readonly PartRules[],
): PlannedSong[] {
  const styles = [...new Set(parts.flatMap((p) => p.styles))];
  if (styles.length === 0) return [];
  const genres = genresOf(styles);
  const capOf = (g: string) =>
    Math.max(
      1,
      ...parts.map((p) =>
        genresOf([...p.styles]).includes(g as never) ? (p.ratio[g] ?? p.master) : 1,
      ),
    );
  const perGenre = Math.ceil(plannedMin / 4) + 2;
  const pool: Candidate[] = [];
  const byId = new Map<string, StyleId>();
  const taken = new Map<string, number>();
  while (pool.length < perGenre * genres.length) {
    for (const g of genres) {
      const own = styles.filter((s) => genreOf(s) === g);
      for (let k = 0; k < capOf(g); k++) {
        // A genre's variants take turns, so a non-Latin song sits inside the same run.
        const n = taken.get(g) ?? 0;
        taken.set(g, n + 1);
        const style = own[n % own.length]!;
        const requestId = `${g}:${n}`;
        byId.set(requestId, style);
        pool.push({
          requestId,
          ownerId: 'preview',
          style: g,
          variant: style,
          acceptedSeq: pool.length,
          canonicalKey: requestId,
          durationMs: SONG_MS,
          playable: true,
        });
      }
    }
  }
  const windows = breaks.map((b) => ({
    startMs: b.startMin * MIN_MS,
    endMs: (b.startMin + b.durationMin) * MIN_MS,
  }));
  const ruleWindows: RuleWindow[] = parts.map((part, i) => ({
    fromMs:
      i === 0 ? Number.NEGATIVE_INFINITY : (windows[i - 1]?.endMs ?? Number.POSITIVE_INFINITY),
    rules: schedulerRules(part),
  }));
  const { items } = projectQueue({
    candidates: pool,
    history: EMPTY_HISTORY,
    rules: schedulerRules(parts[0]!),
    ruleWindows,
    nowMs: 0,
    endAtMs: plannedMin * MIN_MS,
    currentRemainingMs: null,
    breaks: windows,
    overheadSec: RULE_DEFAULTS.transitionOverheadSec,
    horizon: pool.length,
  });
  const overheadMs = RULE_DEFAULTS.transitionOverheadSec * 1000;
  return items.flatMap((item) =>
    item.predictedStartMs === null
      ? []
      : [
          {
            style: byId.get(item.requestId)!,
            startMin: item.predictedStartMs / MIN_MS,
            lengthMin: (SONG_MS + overheadMs) / MIN_MS,
          },
        ],
  );
}

/**
 * A rough count only: one song every 3.5 to 5 minutes of music. The real number depends on the
 * songs people add, so the planner always labels it approximate.
 */
export function trackEstimate(musicMin: number): { min: number; max: number } {
  return {
    min: Math.max(2, Math.floor(musicMin / 5)),
    max: Math.max(3, Math.ceil(musicMin / 3.5)),
  };
}

/**
 * Five songs per quarter hour of planned time, rounded to five and kept between 5 and 50 — and
 * never above what the event may hold (`maxSubmissionLimit`).
 */
export function syncedLimit(plannedMin: number, ceiling: number): number {
  const wanted = Math.round(plannedMin / 15) * 5;
  return Math.min(ceiling, Math.min(50, Math.max(5, wanted)));
}

/** Consecutive songs of one genre collapse to "Salsa ×2". */
export function runsOf(songs: readonly PlannedSong[]): Array<{ genre: string; count: number }> {
  const runs: Array<{ genre: string; count: number }> = [];
  for (const s of songs) {
    const g = genreOf(s.style);
    const last = runs[runs.length - 1];
    if (last && last.genre === g) last.count += 1;
    else runs.push({ genre: g, count: 1 });
  }
  return runs;
}
