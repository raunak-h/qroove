import { DomainError, type Provider, type StyleId } from '@qroove/contracts';
import { countsTowardQuota } from '@qroove/scheduler';
import type { ParticipantDoc, RecordingKeyDoc, RequestDoc } from '../../db/types.js';
import {
  audit,
  commit,
  loadWork,
  requireAdmin,
  requireParticipant,
  runCommand,
  type Ctx,
  type CommandOpts,
  type Deps,
  type Work,
} from '../context.js';
import { sha256 } from '../ids.js';

export async function joinEvent(deps: Deps, input: { eventId: string; nickname?: string }) {
  return deps.repo.runInTransaction(input.eventId, async (tx) => {
    const event = await tx.getEvent();
    if (!event) throw new DomainError('NOT_FOUND');
    if (event.state === 'ENDED' || event.state === 'ARCHIVED') throw new DomainError('EVENT_ENDED');
    const now = deps.clock.now();
    const token = deps.ids.secret();
    const p: ParticipantDoc = {
      id: deps.ids.participantId(),
      tokenHash: sha256(token),
      nickname: input.nickname?.trim() || null,
      joinedAt: now,
      lastSeenAt: now,
      acceptedCount: 0,
    };
    tx.putParticipant(p);
    tx.appendAudit({
      action: 'participant.join',
      actorRole: 'participant',
      at: now,
      payload: { participantId: p.id },
      idempotencyKey: null,
    });
    return { participantId: p.id, token };
  });
}

/** Track metadata is resolved by ingestion (Phase 4) before the domain sees it. */
export interface TrackInput {
  canonicalKey: string;
  provider: Provider;
  title: string;
  artist: string | null;
  durationMs: number | null;
  artworkUrl: string | null;
  sourceUrl: string | null;
  /** Set when metadata will arrive later via `resolveMetadata`. */
  metadataPending?: boolean;
  playable?: boolean;
}

export interface SubmitInput extends CommandOpts {
  eventId: string;
  participantId: string;
  token: string;
  style: StyleId;
  track: TrackInput;
}

const OPEN_FOR_SUBMIT = new Set(['ACTIVE', 'PAUSED']);

export function submitRequest(deps: Deps, input: SubmitInput) {
  return runCommand(deps, input.eventId, input, async (c) => {
    const p = await requireParticipant(c.tx, input.participantId, input.token);
    const e = c.event;
    if (e.state === 'ENDED' || e.state === 'ARCHIVED') throw new DomainError('EVENT_ENDED');
    if (!OPEN_FOR_SUBMIT.has(e.state)) throw new DomainError('EVENT_NOT_ACTIVE');
    if (!e.rules.enabledStyles.includes(input.style)) {
      throw new DomainError('VALIDATION', 'That style is not part of this event.');
    }
    const key = await c.tx.getRecordingKey(input.track.canonicalKey);
    // Duplicates are rejected before quota is looked at, so a rejected duplicate costs nothing.
    if (key && key.state !== 'released') throw new DomainError('DUPLICATE');
    // Recount from the requests themselves as a guard against a drifted counter.
    const mine = await c.tx.listRequests({ ownerId: p.id });
    const used = mine.filter((r) => countsTowardQuota(r.state)).length;
    if (used >= e.rules.submissionLimit) throw new DomainError('QUOTA_FULL');

    const w = await loadWork(c);
    const t = input.track;
    const req: RequestDoc = {
      id: deps.ids.requestId(),
      ownerId: p.id,
      state: t.metadataPending ? 'PENDING_METADATA' : 'QUEUED',
      title: t.title,
      artist: t.artist,
      style: input.style,
      provider: t.provider,
      canonicalKey: t.canonicalKey,
      sourceUrl: t.sourceUrl,
      durationMs: t.durationMs,
      artworkUrl: t.artworkUrl,
      playable: t.playable ?? !t.metadataPending,
      acceptedSeq: e.acceptedSeq + 1,
      createdAt: c.now,
      updatedAt: c.now,
      removedReason: null,
    };
    w.event = { ...e, acceptedSeq: req.acceptedSeq };
    w.putRequest(req);
    c.tx.putRecordingKey({ key: t.canonicalKey, requestId: req.id, state: 'active' });
    c.tx.putParticipant({ ...p, acceptedCount: used + 1, lastSeenAt: c.now });
    audit(
      c,
      'request.submit',
      'participant',
      { requestId: req.id, style: req.style },
      input.idempotencyKey ?? null,
    );
    const version = commit(c, w);
    return { request: w.requests.get(req.id)!, version };
  });
}

const STARTED = new Set(['PLAYING', 'PLAYED', 'SKIPPED']);

/** Shared by owner withdrawal and admin removal. `after` runs once all reads are done. */
async function takeOut(
  c: Ctx,
  w: Work,
  req: RequestDoc,
  to: 'WITHDRAWN' | 'REJECTED' | 'UNAVAILABLE',
  reason: string | null,
) {
  const owner = await c.tx.getParticipant(req.ownerId);
  w.putRequest({ ...req, state: to, removedReason: reason, updatedAt: c.now });
  c.tx.putRecordingKey({
    key: req.canonicalKey,
    requestId: req.id,
    state: 'released',
  } satisfies RecordingKeyDoc);
  if (owner) {
    const remaining = [...w.requests.values()].filter(
      (r) => r.ownerId === owner.id && countsTowardQuota(r.state),
    ).length;
    c.tx.putParticipant({ ...owner, acceptedCount: remaining });
  }
  // The reservation (if this was it) is cleared by recompute, which then picks the next song.
}

export function withdrawRequest(
  deps: Deps,
  input: CommandOpts & { eventId: string; participantId: string; token: string; requestId: string },
) {
  return runCommand(deps, input.eventId, input, async (c) => {
    const p = await requireParticipant(c.tx, input.participantId, input.token);
    if (c.event.state === 'ENDED' || c.event.state === 'ARCHIVED')
      throw new DomainError('EVENT_ENDED');
    const req = await c.tx.getRequest(input.requestId);
    if (!req) throw new DomainError('NOT_FOUND');
    if (req.ownerId !== p.id) throw new DomainError('NOT_OWNER');
    if (req.state === 'WITHDRAWN') return { ok: true as const, version: c.event.version };
    if (STARTED.has(req.state) || req.state === 'REJECTED')
      throw new DomainError('ALREADY_STARTED');
    const w = await loadWork(c);
    await takeOut(c, w, req, 'WITHDRAWN', null);
    audit(
      c,
      'request.withdraw',
      'participant',
      { requestId: req.id },
      input.idempotencyKey ?? null,
    );
    return { ok: true as const, version: commit(c, w) };
  });
}

export function adminRemove(
  deps: Deps,
  input: CommandOpts & { eventId: string; adminSecret: string; requestId: string; reason?: string },
) {
  return runCommand(deps, input.eventId, input, async (c) => {
    await requireAdmin(c.tx, input.adminSecret);
    if (c.event.state === 'ENDED' || c.event.state === 'ARCHIVED')
      throw new DomainError('EVENT_ENDED');
    const req = await c.tx.getRequest(input.requestId);
    if (!req) throw new DomainError('NOT_FOUND');
    if (req.state === 'REJECTED') return { ok: true as const, version: c.event.version };
    // Played records are the anti-duplicate history and cannot be erased.
    if (STARTED.has(req.state) || req.state === 'WITHDRAWN')
      throw new DomainError('ALREADY_STARTED');
    const w = await loadWork(c);
    await takeOut(c, w, req, 'REJECTED', input.reason ?? null);
    audit(
      c,
      'request.remove',
      'admin',
      { requestId: req.id, reason: input.reason ?? null },
      input.idempotencyKey ?? null,
    );
    return { ok: true as const, version: commit(c, w) };
  });
}

/** Called by ingestion when a PENDING_METADATA lookup finishes; `null` means it failed for good. */
export function resolveMetadata(
  deps: Deps,
  input: {
    eventId: string;
    requestId: string;
    metadata: Partial<Pick<RequestDoc, 'title' | 'artist' | 'durationMs' | 'artworkUrl'>> | null;
  },
) {
  return runCommand(deps, input.eventId, {}, async (c) => {
    const req = await c.tx.getRequest(input.requestId);
    if (!req) throw new DomainError('NOT_FOUND');
    if (req.state !== 'PENDING_METADATA') return { ok: true as const, version: c.event.version };
    const w = await loadWork(c);
    if (input.metadata === null) {
      await takeOut(c, w, req, 'UNAVAILABLE', 'metadata unavailable');
    } else {
      w.putRequest({
        ...req,
        ...input.metadata,
        state: 'QUEUED',
        playable: true,
        updatedAt: c.now,
      });
    }
    audit(c, 'request.metadata', 'system', { requestId: req.id, ok: input.metadata !== null });
    return { ok: true as const, version: commit(c, w) };
  });
}
