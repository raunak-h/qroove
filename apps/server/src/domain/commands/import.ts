import { DomainError, RulesSnapshot, type ExportSnapshot } from '@qroove/contracts';
import { capPlaytime } from '../../ingestion/playlist.js';
import type { Deps } from '../context.js';
import { MAX_SEEDS, SYSTEM_SEED_ID, type SeedSong } from '../draft.js';
import { mulberry32 } from '../ids.js';
import { createEvent, type CreatedEvent } from './event.js';

export { MAX_SEEDS, SYSTEM_SEED_ID };

/** The new session keeps one minute free at the end, so imported songs never fill all of it. */
export const SESSION_HEADROOM_MS = 60_000;

export interface ImportInput {
  snapshot: ExportSnapshot;
  selectedIndexes?: readonly number[];
  /** Shuffle independently within each style; the seed is stored on the event. */
  shuffle?: boolean;
  seed?: number;
  name?: string;
  timezone: string;
  /** Planned time of the new session; queued songs fit in this minus one minute. */
  plannedDurationMin: number;
}

/** Deterministic Fisher–Yates over a copy. */
function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * New DRAFT from an ended event's leftover songs (carry-over). Songs belong to the synthetic
 * `system-seed` participant, which follows the same owner-spacing rule as anyone else.
 */
export async function importSnapshot(
  deps: Deps,
  input: ImportInput,
): Promise<CreatedEvent & { seeded: number }> {
  const parsedRules = RulesSnapshot.safeParse(input.snapshot.rules);
  if (!parsedRules.success)
    throw new DomainError('VALIDATION', parsedRules.error.issues[0]?.message);
  const r = parsedRules.data;

  const picked = (input.selectedIndexes ?? input.snapshot.recommendations.map((_, i) => i))
    .filter((i, n, all) => all.indexOf(i) === n)
    .map((i) => input.snapshot.recommendations[i])
    .filter(
      (s): s is NonNullable<typeof s> => s !== undefined && r.enabledStyles.includes(s.style),
    );
  let songs: SeedSong[] = picked.map((s) => ({ ...s }));

  const seed = input.seed ?? deps.ids.seed();
  if (input.shuffle) {
    const rand = mulberry32(seed);
    const perStyle = new Map<string, SeedSong[]>();
    for (const s of songs) perStyle.set(s.style, [...(perStyle.get(s.style) ?? []), s]);
    const mixed = new Map([...perStyle].sort().map(([k, v]) => [k, shuffled(v, rand)] as const));
    // Style slots keep their original positions; only the songs within a style are permuted.
    songs = songs.map((s) => mixed.get(s.style)!.shift()!);
  }
  songs = capPlaytime(songs, input.plannedDurationMin * 60_000 - SESSION_HEADROOM_MS, MAX_SEEDS);

  return createEvent(
    deps,
    {
      name: input.name ?? input.snapshot.name,
      timezone: input.timezone,
      enabledStyles: r.enabledStyles,
      masterRunCap: r.masterRunCap,
      ratio: r.runCaps,
      submissionLimit: r.submissionLimit,
      plannedDurationMin: input.plannedDurationMin,
    },
    { seeds: songs, importSeed: input.shuffle ? seed : null },
  );
}
