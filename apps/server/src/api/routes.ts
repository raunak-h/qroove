import {
  AdminSessionBody,
  CreateEventBody,
  DomainError,
  DuplicateDecisionBody,
  EndTimeBody,
  HandoverClaimBody,
  ImportBody,
  JoinBody,
  PlayerClaimBody,
  PlayerFinishedBody,
  PlayerHeartbeatBody,
  PlayerReleaseBody,
  PlayerStartedBody,
  RecoverBody,
  RemoveBody,
  ResolveLinkBody,
  SubmitRequestBody,
  UpdateDraftBody,
  VersionedBody,
  type ExportSnapshot,
} from '@qroove/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import * as cmd from '../domain/commands/index.js';
import { SESSION_HEADROOM_MS } from '../domain/commands/import.js';
import { MAX_SEEDS, type SeedSong } from '../domain/draft.js';
import { capPlaytime } from '../ingestion/playlist.js';
import { verifyAdmin, verifyParticipant } from '../domain/queries.js';
import { HOUR, MINUTE } from '../security/rateLimit.js';
import {
  adminFromRequest,
  participantFromRequest,
  requireSameOrigin,
  setAdminSession,
} from '../security/tokens.js';
import { openStream } from '../realtime/sse.js';
import type { ApiContext } from './context.js';
import { parse } from './errors.js';
import { adminState, myRequests, publicView, requestView } from './views.js';

const Id = z.string().min(1).max(64);
const idParams = z.object({ id: Id });
const ridParams = z.object({ id: Id, rid: Id });
const bidParams = z.object({ id: Id, bid: Id });

export function registerRoutes(app: FastifyInstance, ctx: ApiContext) {
  const { deps, env, ingestion, bus, sec, limiter } = ctx;
  const base = env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const idemKey = (req: FastifyRequest) => {
    const k = req.headers['idempotency-key'];
    return typeof k === 'string' && k.length > 0 && k.length <= 100 ? k : undefined;
  };
  const admin = (req: FastifyRequest, id: string) => ({
    eventId: id,
    adminSecret: adminFromRequest(sec, req, id),
  });
  const unlimited = env.RATE_LIMIT_OFF === '1' && env.NODE_ENV !== 'production';
  const limit = (key: string, max: number, windowMs: number) =>
    unlimited ? undefined : limiter.check(key, max, windowMs);

  // Global per-IP budget for the whole API.
  app.addHook('onRequest', async (req) => {
    if (req.url.startsWith('/api/')) limit(`g:${req.ip}`, 120, MINUTE);
  });

  const agg = async (eventId: string) => {
    const a = await deps.repo.getEventPublic(eventId);
    if (!a) throw new DomainError('NOT_FOUND');
    return a;
  };

  // ---- discovery & public ------------------------------------------------------------------
  app.get('/api/events/by-slug/:slug', async (req) => {
    const { slug } = parse(z.object({ slug: z.string().min(1).max(16) }), req.params);
    const e = await deps.repo.findEventBySlug(slug.toUpperCase());
    if (!e) throw new DomainError('NOT_FOUND');
    return { eventId: e.id, slug: e.publicSlug, name: e.name };
  });

  // `:id` is a slug here, per SPEC §8 (`/api/events/:slug/public`).
  app.get('/api/events/:id/public', async (req, reply) => {
    const { id } = parse(idParams, req.params);
    const e = await deps.repo.findEventBySlug(id.toUpperCase());
    if (!e) throw new DomainError('NOT_FOUND');
    reply.header('cache-control', 'no-store');
    return publicView(await agg(e.id), deps.clock.now());
  });

  app.get('/api/events/:id/stream', async (req, reply) => {
    const { id } = parse(idParams, req.params);
    await agg(id);
    await openStream(req, reply, bus, id, (a) => publicView(a, deps.clock.now()));
  });

  app.get('/api/events/:id/export', async (req) => {
    const { id } = parse(idParams, req.params);
    const a = await agg(id);
    const seen = new Set<string>();
    const recommendations: ExportSnapshot['recommendations'] = [];
    for (const r of a.requests) {
      if (['WITHDRAWN', 'REJECTED', 'UNAVAILABLE'].includes(r.state) || seen.has(r.canonicalKey))
        continue;
      seen.add(r.canonicalKey);
      recommendations.push({
        title: r.title,
        artist: r.artist,
        style: r.style,
        durationMs: r.durationMs,
        sourceUrl: r.sourceUrl,
      });
    }
    return {
      formatVersion: 1,
      name: a.event.name,
      rules: a.event.rules,
      recommendations,
    } satisfies ExportSnapshot;
  });

  // ---- link intake -------------------------------------------------------------------------
  app.post('/api/resolve-link', async (req) => {
    limit(`resolve:${req.ip}`, 20, MINUTE);
    const { url } = parse(ResolveLinkBody, req.body);
    const r = await ingestion.resolveUrl(url);
    return {
      title: r.track.title,
      artist: r.track.artist,
      durationMs: r.track.durationMs,
      artworkUrl: r.track.artworkUrl,
      provider: r.track.provider,
      confidence: r.confidence,
      suggestedStyle: r.suggestedStyle,
    };
  });

  // Reserved for a future user-auth Spotify adapter; client-credentials needs no redirect.
  app.get('/api/spotify/callback', async (_req, reply) => reply.code(204).send());

  // ---- creating events ---------------------------------------------------------------------
  const created = (r: {
    eventId: string;
    slug: string;
    adminSecret: string;
    recoverySecret: string;
    rules: unknown;
    joinKey: string;
  }) => ({
    eventId: r.eventId,
    slug: r.slug,
    // The key rides in the fragment (never logged); only the QR code should carry this URL.
    joinUrl: `${base}/e/${r.slug}#j=${r.joinKey}`,
    // The secret lives in the fragment, which browsers never send to a server.
    adminUrl: `${base}/a/${r.eventId}#k=${r.adminSecret}`,
    recoverySecret: r.recoverySecret,
    rules: r.rules,
  });

  app.post('/api/events', async (req, reply) => {
    limit(`create:${req.ip}`, 5, HOUR);
    const { playlist, ...body } = parse(CreateEventBody, req.body);
    let seeds: SeedSong[] = [];
    if (playlist) {
      if (!body.plannedDurationMin) {
        throw new DomainError('VALIDATION', 'Set a planned time before importing a playlist.');
      }
      limit(`playlist:${req.ip}`, 10, HOUR);
      const pl = await ingestion.resolvePlaylist(playlist.url);
      seeds = capPlaytime(
        pl.tracks.map((t) => ({ ...t, style: playlist.style })),
        body.plannedDurationMin * 60_000 - SESSION_HEADROOM_MS,
        MAX_SEEDS,
      );
      if (seeds.length === 0) {
        throw new DomainError(
          'VALIDATION',
          'None of the playlist’s songs fit in the planned time.',
        );
      }
    }
    const r = await cmd.createEvent(deps, body, { seeds });
    reply.header('cache-control', 'no-store');
    return reply.code(201).send({ ...created(r), seeded: r.seeded });
  });

  app.post('/api/events/import', async (req, reply) => {
    limit(`create:${req.ip}`, 5, HOUR);
    const body = parse(
      ImportBody.extend({
        timezone: z.string().min(1).max(64),
        shuffle: z.boolean().optional(),
        name: z.string().trim().min(1).max(80).optional(),
        plannedDurationMin: z.number().int().min(10).max(480).multipleOf(10),
      }),
      req.body,
    );
    const r = await cmd.importSnapshot(deps, {
      snapshot: body.snapshot,
      timezone: body.timezone,
      plannedDurationMin: body.plannedDurationMin,
      ...(body.selectedIndexes ? { selectedIndexes: body.selectedIndexes } : {}),
      ...(body.shuffle !== undefined ? { shuffle: body.shuffle } : {}),
      ...(body.name ? { name: body.name } : {}),
    });
    reply.header('cache-control', 'no-store');
    return reply.code(201).send({ ...created(r), seeded: r.seeded });
  });

  // ---- admin session -----------------------------------------------------------------------
  app.post('/api/events/:id/admin/session', async (req, reply) => {
    const { id } = parse(idParams, req.params);
    limit(`session:${req.ip}`, 10, MINUTE);
    requireSameOrigin(sec, req);
    const { secret } = parse(AdminSessionBody, req.body);
    await verifyAdmin(deps, id, secret);
    reply.header('cache-control', 'no-store');
    return { ok: true, csrf: setAdminSession(sec, reply, id, secret) };
  });

  app.get('/api/events/:id/admin/state', async (req, reply) => {
    const { id } = parse(idParams, req.params);
    const a = admin(req, id);
    await verifyAdmin(deps, id, a.adminSecret);
    reply.header('cache-control', 'no-store');
    return {
      ...adminState(await agg(id), deps.clock.now(), base),
      csrf: sec.csrfFor(a.adminSecret),
    };
  });

  // Unplayed songs as an importable snapshot, for "create the next event from these".
  app.get('/api/events/:id/admin/carry-over', async (req, reply) => {
    const { id } = parse(idParams, req.params);
    const a = admin(req, id);
    await verifyAdmin(deps, id, a.adminSecret);
    const x = await agg(id);
    const open = new Set([
      'PENDING_METADATA',
      'QUEUED',
      'INELIGIBLE_TEMPORARILY',
      'RESERVED_NEXT',
      'OVERFLOW',
    ]);
    const seen = new Set<string>();
    const recommendations: ExportSnapshot['recommendations'] = [];
    for (const r of x.requests) {
      if (!open.has(r.state) || r.possibleDuplicate || seen.has(r.canonicalKey)) continue;
      seen.add(r.canonicalKey);
      recommendations.push({
        title: r.title,
        artist: r.artist,
        style: r.style,
        durationMs: r.durationMs,
        sourceUrl: r.sourceUrl,
      });
    }
    reply.header('cache-control', 'no-store');
    return {
      formatVersion: 1,
      name: x.event.name,
      rules: x.event.rules,
      recommendations,
    } satisfies ExportSnapshot;
  });

  app.get('/api/events/:id/admin/stream', async (req, reply) => {
    const { id } = parse(idParams, req.params);
    const a = admin(req, id);
    await verifyAdmin(deps, id, a.adminSecret);
    await openStream(req, reply, bus, id, (x) => adminState(x, deps.clock.now(), base));
  });

  // ---- admin commands ----------------------------------------------------------------------
  const versioned = (req: FastifyRequest) => parse(VersionedBody, req.body ?? {}).expectedVersion;
  const simple = (
    path: string,
    run: (
      a: ReturnType<typeof admin> & {
        expectedVersion: number | undefined;
        idempotencyKey: string | undefined;
      },
    ) => Promise<object>,
  ) =>
    app.post(path, async (req) => {
      const { id } = parse(idParams, req.params);
      return run({
        ...admin(req, id),
        expectedVersion: versioned(req),
        idempotencyKey: idemKey(req),
      });
    });

  simple('/api/events/:id/start', (a) => cmd.startEvent(deps, a));
  simple('/api/events/:id/admin/pause', (a) => cmd.pause(deps, a));
  simple('/api/events/:id/admin/resume', (a) => cmd.resume(deps, a));
  simple('/api/events/:id/admin/skip', (a) => cmd.skip(deps, a));
  simple('/api/events/:id/admin/end', (a) => cmd.endEvent(deps, a));
  simple('/api/events/:id/admin/archive', (a) => cmd.archive(deps, a));
  simple('/api/events/:id/admin/handover', (a) => cmd.createHandoverOffer(deps, a));

  app.patch('/api/events/:id/admin/draft', async (req) => {
    const { id } = parse(idParams, req.params);
    const body = parse(UpdateDraftBody, req.body);
    return cmd.updateDraft(deps, { ...admin(req, id), ...body });
  });

  app.post('/api/events/:id/admin/end-time', async (req) => {
    const { id } = parse(idParams, req.params);
    const body = parse(EndTimeBody, req.body);
    return cmd.setEndTime(deps, { ...admin(req, id), ...body, idempotencyKey: idemKey(req) });
  });

  app.post('/api/events/:id/admin/remove/:rid', async (req) => {
    const { id, rid } = parse(ridParams, req.params);
    const { reason } = parse(RemoveBody, req.body ?? {});
    return cmd.adminRemove(deps, {
      ...admin(req, id),
      requestId: rid,
      ...(reason ? { reason } : {}),
      idempotencyKey: idemKey(req),
    });
  });

  app.post('/api/events/:id/admin/duplicate/:rid', async (req) => {
    const { id, rid } = parse(ridParams, req.params);
    const { decision } = parse(DuplicateDecisionBody, req.body);
    return cmd.reviewDuplicate(deps, { ...admin(req, id), requestId: rid, decision });
  });

  for (const [verb, run] of [
    ['start', cmd.startBreak],
    ['end', cmd.endBreak],
  ] as const) {
    app.post(`/api/events/:id/admin/breaks/:bid/${verb}`, async (req) => {
      const { id, bid } = parse(bidParams, req.params);
      return run(deps, { ...admin(req, id), breakId: bid });
    });
  }

  app.post('/api/events/:id/admin/handover/claim', async (req, reply) => {
    const { id } = parse(idParams, req.params);
    limit(`handover:${req.ip}`, 10, MINUTE);
    requireSameOrigin(sec, req);
    const { code } = parse(HandoverClaimBody, req.body);
    const r = await cmd.claimHandover(deps, { eventId: id, code });
    reply.header('cache-control', 'no-store');
    return { ok: true, version: r.version, csrf: setAdminSession(sec, reply, id, r.adminSecret) };
  });

  app.post('/api/events/:id/admin/recover', async (req, reply) => {
    const { id } = parse(idParams, req.params);
    limit(`handover:${req.ip}`, 10, MINUTE);
    requireSameOrigin(sec, req);
    const { recoverySecret } = parse(RecoverBody, req.body);
    const r = await cmd.recoverAdmin(deps, { eventId: id, recoverySecret });
    reply.header('cache-control', 'no-store');
    return { ok: true, version: r.version, csrf: setAdminSession(sec, reply, id, r.adminSecret) };
  });

  // ---- attendees ---------------------------------------------------------------------------
  app.post('/api/events/:id/join', async (req, reply) => {
    const { id } = parse(idParams, req.params);
    limit(`join:${req.ip}`, 20, MINUTE);
    const { nickname, joinKey } = parse(JoinBody, req.body ?? {});
    reply.header('cache-control', 'no-store');
    return cmd.joinEvent(deps, { eventId: id, joinKey, ...(nickname ? { nickname } : {}) });
  });

  app.post('/api/events/:id/requests', async (req) => {
    const { id } = parse(idParams, req.params);
    const who = participantFromRequest(req);
    limit(`submit:p:${who.participantId}`, 10, MINUTE);
    limit(`submit:ip:${req.ip}`, 30, MINUTE);
    const body = parse(SubmitRequestBody, req.body);
    const resolved = body.url
      ? await ingestion.resolveUrl(body.url)
      : ingestion.resolveManual(body.manual!);
    const r = await cmd.submitRequest(deps, {
      eventId: id,
      ...who,
      style: body.style,
      track: resolved.track,
      idempotencyKey: idemKey(req),
    });
    return { request: requestView(r.request, await agg(id)) };
  });

  app.get('/api/events/:id/my-requests', async (req, reply) => {
    const { id } = parse(idParams, req.params);
    const who = participantFromRequest(req);
    await verifyParticipant(deps, id, who.participantId, who.token);
    reply.header('cache-control', 'no-store');
    return myRequests(await agg(id), who.participantId);
  });

  app.delete('/api/events/:id/requests/:rid', async (req) => {
    const { id, rid } = parse(ridParams, req.params);
    return cmd.withdrawRequest(deps, {
      eventId: id,
      ...participantFromRequest(req),
      requestId: rid,
      idempotencyKey: idemKey(req),
    });
  });

  // ---- player ------------------------------------------------------------------------------
  app.post('/api/events/:id/player/claim', async (req, reply) => {
    const { id } = parse(idParams, req.params);
    const { takeover } = parse(PlayerClaimBody, req.body ?? {});
    const r = await cmd.claimLease(deps, {
      ...admin(req, id),
      ...(takeover !== undefined ? { takeover } : {}),
    });
    reply.header('cache-control', 'no-store');
    return { leaseToken: r.leaseToken, lease: r.lease };
  });

  app.post('/api/events/:id/player/heartbeat', async (req) => {
    const { id } = parse(idParams, req.params);
    return cmd.heartbeat(deps, { eventId: id, ...parse(PlayerHeartbeatBody, req.body) });
  });

  app.post('/api/events/:id/player/started', async (req) => {
    const { id } = parse(idParams, req.params);
    const b = parse(PlayerStartedBody, req.body);
    return cmd.reportStarted(deps, {
      eventId: id,
      leaseToken: b.leaseToken,
      epoch: b.epoch,
      requestId: b.requestId,
      durationMs: b.durationMs ?? null,
    });
  });

  app.post('/api/events/:id/player/finished', async (req) => {
    const { id } = parse(idParams, req.params);
    return cmd.reportFinished(deps, { eventId: id, ...parse(PlayerFinishedBody, req.body) });
  });

  app.post('/api/events/:id/player/release', async (req) => {
    const { id } = parse(idParams, req.params);
    return cmd.releaseLease(deps, { eventId: id, ...parse(PlayerReleaseBody, req.body) });
  });
}
