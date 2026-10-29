import { DomainError, RulesSnapshot, type ExportSnapshot } from '@qroove/contracts';
import type { ParticipantDoc, RecordingKeyDoc, RequestDoc } from '../../db/types.js';
import type { Deps } from '../context.js';
import { buildRules, insertDraft, newDraft } from '../draft.js';
import { mulberry32 } from '../ids.js';
import { manualKey } from '../keys.js';
import type { CreatedEvent } from './event.js';

export const SYSTEM_SEED_ID = 'system-seed';
export const MAX_SEEDS = 150;

export interface ImportInput {
  snapshot: ExportSnapshot;
  selectedIndexes?: readonly number[];
  /** Shuffle independently within each style; the seed is stored on the event. */
  shuffle?: boolean;
  seed?: number;
  name?: string;
  timezone: string;
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
 * New DRAFT from a snapshot. Songs belong to the synthetic `system-seed` participant, which is
 * subject to the same owner-spacing rule as anyone else, so seeds cannot monopolise the night.
 */
export async function importSnapshot(
  deps: Deps,
  input: ImportInput,
): Promise<CreatedEvent & { seeded: number }> {
  const parsedRules = RulesSnapshot.safeParse(input.snapshot.rules);
  if (!parsedRules.success)
    throw new DomainError('VALIDATION', parsedRules.error.issues[0]?.message);
  const r = parsedRules.data;
  const rules = buildRules({
    enabledStyles: r.enabledStyles,
    runCaps: r.runCaps,
    submissionLimit: r.submissionLimit,
  });

  const picked = (input.selectedIndexes ?? input.snapshot.recommendations.map((_, i) => i))
    .filter((i, n, all) => all.indexOf(i) === n)
    .map((i) => input.snapshot.recommendations[i])
    .filter(
      (s): s is NonNullable<typeof s> => s !== undefined && rules.enabledStyles.includes(s.style),
    );
  const seen = new Set<string>();
  let songs = picked.filter((s) => {
    const k = manualKey(s.title, s.artist);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (songs.length > MAX_SEEDS)
    throw new DomainError('VALIDATION', `Import at most ${MAX_SEEDS} songs.`);

  const seed = input.seed ?? deps.ids.seed();
  if (input.shuffle) {
    const rand = mulberry32(seed);
    const perStyle = new Map<string, typeof songs>();
    for (const s of songs) perStyle.set(s.style, [...(perStyle.get(s.style) ?? []), s]);
    const mixed = new Map([...perStyle].sort().map(([k, v]) => [k, shuffled(v, rand)] as const));
    // Style slots keep their original positions; only the songs within a style are permuted.
    songs = songs.map((s) => mixed.get(s.style)!.shift()!);
  }

  const { bundle, secrets } = await insertDraft(deps, () => {
    const d = newDraft(deps, {
      name: input.name ?? input.snapshot.name,
      timezone: input.timezone,
      rules,
      endAt: null,
      breaks: [],
      importSeed: input.shuffle ? seed : null,
    });
    const now = d.event.createdAt;
    const requests: RequestDoc[] = songs.map((s, i) => ({
      id: deps.ids.requestId(),
      ownerId: SYSTEM_SEED_ID,
      state: 'QUEUED',
      title: s.title,
      artist: s.artist,
      style: s.style,
      provider: 'manual',
      canonicalKey: manualKey(s.title, s.artist),
      sourceUrl: s.sourceUrl,
      durationMs: s.durationMs,
      artworkUrl: null,
      playable: true,
      acceptedSeq: i + 1,
      createdAt: now,
      updatedAt: now,
      removedReason: null,
    }));
    d.event.acceptedSeq = requests.length;
    const participant: ParticipantDoc = {
      id: SYSTEM_SEED_ID,
      tokenHash: '',
      nickname: null,
      joinedAt: now,
      lastSeenAt: now,
      acceptedCount: requests.length,
    };
    const recordingKeys: RecordingKeyDoc[] = requests.map((q) => ({
      key: q.canonicalKey,
      requestId: q.id,
      state: 'active',
    }));
    return {
      event: d.event,
      adminGrants: d.adminGrants,
      participants: [participant],
      requests,
      recordingKeys,
      secrets: d.secrets,
    };
  });
  return {
    eventId: bundle.event.id,
    slug: bundle.event.publicSlug,
    rules: bundle.event.rules,
    seeded: songs.length,
    ...secrets,
  };
}
