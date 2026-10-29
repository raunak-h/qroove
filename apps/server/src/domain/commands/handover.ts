import { DomainError } from '@qroove/contracts';
import type { AdminGrantDoc } from '../../db/types.js';
import {
  HANDOVER_TTL_MS,
  audit,
  commit,
  loadWork,
  requireAdmin,
  runCommand,
  type CommandOpts,
  type Ctx,
  type Deps,
} from '../context.js';
import { sha256 } from '../ids.js';
import { closePlaying, readPlaying } from '../lifecycle.js';

/** Two-phase handover, phase 1: the current admin offers a short-lived single-use code. */
export function createHandoverOffer(
  deps: Deps,
  input: CommandOpts & { eventId: string; adminSecret: string },
) {
  return runCommand(deps, input.eventId, { expectedVersion: input.expectedVersion }, async (c) => {
    await requireAdmin(c.tx, input.adminSecret);
    const s = c.event.state;
    if (s === 'ENDED' || s === 'ARCHIVED') throw new DomainError('EVENT_ENDED');
    if (s === 'DRAFT') throw new DomainError('EVENT_NOT_ACTIVE');
    const w = await loadWork(c);
    const code = deps.ids.handoverCode();
    const offerId = sha256(code);
    const expiresAt = c.now + HANDOVER_TTL_MS;
    c.tx.putHandoverOffer({ id: offerId, expiresAt, usedAt: null });
    w.event = { ...c.event, state: 'TRANSFERRING', transferOfferId: offerId };
    audit(c, 'handover.offer', 'admin');
    return { code, expiresAt, version: commit(c, w) };
  });
}

/** Revokes every live admin grant (not recovery) and mints a fresh one. */
function rotateAdmin(c: Ctx, grants: AdminGrantDoc[]): { secret: string; id: string } {
  for (const g of grants) {
    if (g.role === 'admin' && g.revokedAt === null) c.tx.putAdminGrant({ ...g, revokedAt: c.now });
  }
  const secret = c.deps.ids.secret();
  const id = sha256(secret);
  c.tx.putAdminGrant({ id, role: 'admin', issuedAt: c.now, revokedAt: null });
  return { secret, id };
}

/**
 * Phase 2: the recipient presents the code. The server owns revocation, so a stale admin cannot
 * come back. The track that was playing counts as consumed; playback resumes with the next one
 * after the recipient claims the player and resumes.
 */
export function claimHandover(deps: Deps, input: { eventId: string; code: string }) {
  return runCommand(deps, input.eventId, {}, async (c) => {
    const offer = await c.tx.getHandoverOffer(sha256(input.code));
    if (
      !offer ||
      offer.usedAt !== null ||
      offer.expiresAt <= c.now ||
      c.event.state !== 'TRANSFERRING' ||
      c.event.transferOfferId !== offer.id
    ) {
      throw new DomainError('UNAUTHORISED');
    }
    const grants = await c.tx.listAdminGrants();
    const pb = await readPlaying(c);
    const w = await loadWork(c);
    c.tx.putHandoverOffer({ ...offer, usedAt: c.now });
    const next = rotateAdmin(c, grants);
    w.event = {
      ...c.event,
      state: 'PAUSED',
      lease: null,
      transferOfferId: null,
      adminGrantVersion: c.event.adminGrantVersion + 1,
    };
    closePlaying(c, w, pb, 'PLAYED', 'PLAYED');
    audit(c, 'handover.claim', 'admin');
    return { adminSecret: next.secret, version: commit(c, w) };
  });
}

/** Owner-held recovery secret: replaces all admin access. Always audited. */
export function recoverAdmin(deps: Deps, input: { eventId: string; recoverySecret: string }) {
  return runCommand(deps, input.eventId, {}, async (c) => {
    const grant = await requireAdmin(c.tx, input.recoverySecret, true);
    if (grant.role !== 'recovery') throw new DomainError('UNAUTHORISED');
    if (c.event.state === 'ARCHIVED') throw new DomainError('EVENT_ENDED');
    const grants = await c.tx.listAdminGrants();
    const next = rotateAdmin(c, grants);
    audit(c, 'admin.recover', 'recovery');
    const version = c.tx.putEvent({
      ...c.event,
      adminGrantVersion: c.event.adminGrantVersion + 1,
      transferOfferId: null,
    });
    return { adminSecret: next.secret, version };
  });
}
