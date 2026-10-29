import { DEFAULT_ENABLED_STYLES } from '@qroove/config';
import {
  DomainError,
  RulesSnapshot,
  defaultRules,
  type BreakSpec,
  type StyleId,
} from '@qroove/contracts';
import type { AdminGrantDoc, EventDoc, NewEventBundle } from '../db/types.js';
import type { Deps } from './context.js';
import { EMPTY_HISTORY_DOC } from './history.js';
import { sha256 } from './ids.js';

export interface RuleInput {
  enabledStyles?: readonly StyleId[] | undefined;
  runCaps?: Partial<Record<StyleId, number>> | undefined;
  submissionLimit?: number | undefined;
}

/** Builds and validates a rules snapshot: defaults, then `base`'s caps, then explicit overrides. */
export function buildRules(input: RuleInput, base?: RulesSnapshot): RulesSnapshot {
  const enabled = input.enabledStyles ?? base?.enabledStyles ?? DEFAULT_ENABLED_STYLES;
  const rules = defaultRules(enabled);
  if (base) {
    for (const s of enabled) if (base.runCaps[s] !== undefined) rules.runCaps[s] = base.runCaps[s];
    rules.submissionLimit = base.submissionLimit;
  }
  Object.assign(rules.runCaps, input.runCaps);
  if (input.submissionLimit !== undefined) rules.submissionLimit = input.submissionLimit;
  // Drop caps for styles that are not enabled so the snapshot stays canonical.
  for (const k of Object.keys(rules.runCaps)) {
    if (!enabled.includes(k as StyleId)) delete rules.runCaps[k as StyleId];
  }
  const parsed = RulesSnapshot.safeParse(rules);
  if (!parsed.success) throw new DomainError('VALIDATION', parsed.error.issues[0]?.message);
  return parsed.data;
}

export function buildBreaks(
  deps: Deps,
  breaks: ReadonlyArray<{ label: string; durationSec: number }> = [],
): BreakSpec[] {
  return breaks.map((b) => ({
    id: deps.ids.breakId(),
    label: b.label,
    durationSec: b.durationSec,
    startsAt: null,
    actualStart: null,
    actualEnd: null,
  }));
}

export interface DraftInput {
  name: string;
  timezone: string;
  rules: RulesSnapshot;
  endAt: number | null;
  breaks: BreakSpec[];
  importSeed?: number | null;
}

export interface DraftSecrets {
  adminSecret: string;
  recoverySecret: string;
}

export function newDraft(
  deps: Deps,
  input: DraftInput,
): {
  event: EventDoc;
  adminGrants: AdminGrantDoc[];
  secrets: DraftSecrets;
} {
  const now = deps.clock.now();
  const secrets = { adminSecret: deps.ids.secret(), recoverySecret: deps.ids.secret() };
  const event: EventDoc = {
    id: deps.ids.eventId(),
    name: input.name,
    publicSlug: deps.ids.slug(),
    state: 'DRAFT',
    timezone: input.timezone,
    createdAt: now,
    startedAt: null,
    endedAt: null,
    endAt: input.endAt,
    breaks: input.breaks,
    rules: input.rules,
    rulesHash: null,
    version: 1,
    acceptedSeq: 0,
    playbackSeq: 0,
    leaseEpoch: 0,
    history: structuredClone(EMPTY_HISTORY_DOC),
    reservation: null,
    nowPlaying: null,
    lease: null,
    waitingReason: null,
    preview: { revision: 1, items: [], stoppedReason: 'EXHAUSTED', computedAt: now },
    adminGrantVersion: 1,
    transferOfferId: null,
    importSeed: input.importSeed ?? null,
  };
  const grant = (secret: string, role: AdminGrantDoc['role']): AdminGrantDoc => ({
    id: sha256(secret),
    role,
    issuedAt: now,
    revokedAt: null,
  });
  return {
    event,
    adminGrants: [grant(secrets.adminSecret, 'admin'), grant(secrets.recoverySecret, 'recovery')],
    secrets,
  };
}

/** Inserts a draft, regenerating the slug on the (rare) collision. */
export async function insertDraft(
  deps: Deps,
  make: () => NewEventBundle & { secrets: DraftSecrets },
): Promise<{ bundle: NewEventBundle; secrets: DraftSecrets }> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const { secrets, ...bundle } = make();
    if (await deps.repo.createEvent(bundle)) return { bundle, secrets };
  }
  throw new Error('Could not allocate a unique event slug');
}
