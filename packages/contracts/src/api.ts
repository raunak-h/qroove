import { z } from 'zod';
import { EventPublicView, BreakSpec, RequestState } from './event.js';
import { MyRequests, RequestView } from './request.js';
import { RulesSnapshot, StyleId } from './rules.js';
import { Lease } from './player.js';

const Id = z.string().min(1).max(64);
const Nickname = z.string().trim().min(1).max(30);
const Ms = z.number().int().nonnegative();

// POST /api/events
export const CreateEventBody = z.object({
  name: z.string().trim().min(1).max(80),
  timezone: z.string().min(1).max(64),
  enabledStyles: z.array(StyleId).min(2).optional(),
  runCaps: z.partialRecord(StyleId, z.number().int().min(1).max(10)).optional(),
  submissionLimit: z.number().int().min(1).max(20).optional(),
  endAt: Ms.nullable().optional(),
  breaks: z
    .array(BreakSpec.pick({ label: true, durationSec: true }))
    .max(10)
    .optional(),
});
export type CreateEventBody = z.infer<typeof CreateEventBody>;
export const CreateEventResponse = z.object({
  eventId: Id,
  slug: z.string(),
  joinUrl: z.string(),
  /** Shown once; the client keeps it in the URL fragment only. */
  adminUrl: z.string(),
  recoverySecret: z.string(),
  rules: RulesSnapshot,
});
export type CreateEventResponse = z.infer<typeof CreateEventResponse>;

// POST /api/events/:id/start, admin/pause, admin/resume, admin/end, admin/skip
export const VersionedBody = z.object({ expectedVersion: z.number().int().optional() });
export const OkResponse = z.object({ ok: z.literal(true), version: z.number().int() });
export type OkResponse = z.infer<typeof OkResponse>;

// GET /api/events/:slug/public
export const PublicResponse = EventPublicView;

// POST /api/events/:id/join
export const JoinBody = z.object({ nickname: Nickname.optional() });
export const JoinResponse = z.object({ participantId: Id, token: z.string() });
export type JoinResponse = z.infer<typeof JoinResponse>;

// POST /api/events/:id/requests
export const SubmitRequestBody = z
  .object({
    url: z.string().url().max(500).optional(),
    manual: z
      .object({
        title: z.string().trim().min(1).max(120),
        artist: z.string().trim().max(120).optional(),
        durationMs: z.number().int().min(1000).max(3_600_000).optional(),
      })
      .optional(),
    style: StyleId,
  })
  .refine((b) => b.url !== undefined || b.manual !== undefined, {
    message: 'url or manual is required',
  });
export type SubmitRequestBody = z.infer<typeof SubmitRequestBody>;
export const SubmitRequestResponse = z.object({ request: RequestView });

// GET /api/events/:id/my-requests
export const MyRequestsResponse = MyRequests;

// DELETE /api/events/:id/requests/:rid
export const WithdrawResponse = OkResponse;

// POST /api/events/:id/admin/session
export const AdminSessionBody = z.object({ secret: z.string().min(16).max(128) });
export const AdminSessionResponse = z.object({ ok: z.literal(true), csrf: z.string() });

// POST /api/events/:id/admin/end-time
export const EndTimeBody = z.object({ endAt: Ms, expectedVersion: z.number().int().optional() });

// POST /api/events/:id/admin/remove/:rid
export const RemoveBody = z.object({ reason: z.string().max(200).optional() });

// POST /api/events/:id/admin/handover (+ /claim)
export const HandoverResponse = z.object({ code: z.string(), expiresAt: Ms });
export const HandoverClaimBody = z.object({ code: z.string().min(8).max(64) });

// POST /api/events/:id/player/*
export const PlayerClaimBody = z.object({ takeover: z.boolean().optional() });
export const PlayerClaimResponse = z.object({ leaseToken: z.string(), lease: Lease });
export const PlayerHeartbeatBody = z.object({ leaseToken: z.string(), epoch: z.number().int() });
export const PlayerStartedBody = z.object({
  leaseToken: z.string(),
  epoch: z.number().int(),
  requestId: Id,
  durationMs: z.number().int().positive().nullable().optional(),
});
export const PlayerFinishedBody = z.object({
  leaseToken: z.string(),
  epoch: z.number().int(),
  requestId: Id,
  outcome: z.enum(['PLAYED', 'FAILED']),
});
export const PlayerReleaseBody = z.object({ leaseToken: z.string(), epoch: z.number().int() });

// GET /api/events/:id/admin/state (and /admin/stream)
export const AdminRequestView = z.object({
  id: z.string(),
  state: RequestState,
  title: z.string(),
  artist: z.string().nullable(),
  style: StyleId,
  ownerNickname: z.string().nullable(),
  /** Short label so the admin can tell contributors apart; not a usable identifier. */
  ownerLabel: z.string(),
  acceptedSeq: z.number().int(),
  possibleDuplicate: z.boolean(),
  removedReason: z.string().nullable(),
});
export type AdminRequestView = z.infer<typeof AdminRequestView>;
export const AdminState = z.object({
  view: EventPublicView,
  requests: z.array(AdminRequestView),
  lease: Lease.nullable(),
  rulesHash: z.string().nullable(),
  rules: RulesSnapshot,
  /** Only on `GET /admin/state`: the page cannot read the cookie (its path is the API's), so it is echoed here. */
  csrf: z.string().optional(),
});
export type AdminState = z.infer<typeof AdminState>;

// POST /api/resolve-link
export const ResolveLinkBody = z.object({ url: z.string().url().max(500) });
export const ResolveLinkResponse = z.object({
  title: z.string(),
  artist: z.string().nullable(),
  durationMs: z.number().int().nullable(),
  artworkUrl: z.string().nullable(),
  provider: z.string(),
  confidence: z.enum(['high', 'medium', 'low', 'manual']),
  suggestedStyle: StyleId.nullable(),
});

// PATCH /api/events/:id/admin/draft
export const UpdateDraftBody = CreateEventBody.partial().extend({
  expectedVersion: z.number().int().optional(),
});

// POST /api/events/:id/admin/duplicate/:rid
export const DuplicateDecisionBody = z.object({ decision: z.enum(['approve', 'reject']) });

// POST /api/events/:id/admin/recover
export const RecoverBody = z.object({ recoverySecret: z.string().min(16).max(128) });

// GET /api/events/:id/export, POST /api/events/import
export const ExportSnapshot = z.object({
  formatVersion: z.literal(1),
  name: z.string(),
  rules: RulesSnapshot,
  recommendations: z.array(
    z.object({
      title: z.string(),
      artist: z.string().nullable(),
      style: StyleId,
      durationMs: z.number().int().nullable(),
      sourceUrl: z.string().nullable(),
    }),
  ),
});
export type ExportSnapshot = z.infer<typeof ExportSnapshot>;
export const ImportBody = z.object({
  snapshot: ExportSnapshot,
  selectedIndexes: z.array(z.number().int().nonnegative()).optional(),
});

// GET /api/events/:id/stream (SSE) messages
export const StreamMessage = z.object({ type: z.literal('revision'), version: z.number().int() });
export type StreamMessage = z.infer<typeof StreamMessage>;
