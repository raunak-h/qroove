import { DomainError } from '@qroove/contracts';
import type { Deps } from './context.js';
import { requireAdmin, requireParticipant } from './context.js';

/** Read-only credential checks for the API layer (cookie exchange, streams, my-requests). */
export function verifyAdmin(deps: Deps, eventId: string, adminSecret: string): Promise<void> {
  return deps.repo.runInTransaction(eventId, async (tx) => {
    if (!(await tx.getEvent())) throw new DomainError('NOT_FOUND');
    await requireAdmin(tx, adminSecret);
  });
}

export function verifyParticipant(
  deps: Deps,
  eventId: string,
  participantId: string,
  token: string,
): Promise<void> {
  return deps.repo.runInTransaction(eventId, async (tx) => {
    if (!(await tx.getEvent())) throw new DomainError('NOT_FOUND');
    await requireParticipant(tx, participantId, token);
  });
}
