import { timingSafeEqual } from 'node:crypto';
import type { Repository } from '../db/ports.js';
import type { PurgeReport } from '../db/types.js';
import type { Clock } from '../domain/clock.js';

const DAY = 24 * 60 * 60 * 1000;

/** Retention policy (SPEC §13; documented in the privacy page and runbook). */
export const RETENTION = {
  abandonedDraftMs: 7 * DAY,
  participantsAfterEndMs: 30 * DAY,
  auditMs: 90 * DAY,
  idempotencyMs: DAY,
} as const;

export const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function runPurge(repo: Repository, clock: Clock): Promise<PurgeReport> {
  const now = clock.now();
  return repo.purge({
    draftsBefore: now - RETENTION.abandonedDraftMs,
    participantsEndedBefore: now - RETENTION.participantsAfterEndMs,
    auditBefore: now - RETENTION.auditMs,
    idempotencyBefore: now - RETENTION.idempotencyMs,
  });
}

/** Single instance, so a timer is enough (a Railway cron service would cost extra). */
export function schedulePurge(
  repo: Repository,
  clock: Clock,
  log: { info: (o: object, m: string) => void; error: (o: object, m: string) => void },
): () => void {
  const tick = () =>
    runPurge(repo, clock).then(
      (report) => log.info({ report }, 'retention purge'),
      (err: unknown) => log.error({ err }, 'retention purge failed'),
    );
  void tick();
  const t = setInterval(() => void tick(), PURGE_INTERVAL_MS);
  t.unref();
  return () => clearInterval(t);
}

export function secretMatches(given: string | undefined, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
