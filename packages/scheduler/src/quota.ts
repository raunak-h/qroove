export type RequestState =
  | 'PENDING_METADATA'
  | 'QUEUED'
  | 'INELIGIBLE_TEMPORARILY'
  | 'RESERVED_NEXT'
  | 'PLAYING'
  | 'PLAYED'
  | 'SKIPPED'
  | 'WITHDRAWN'
  | 'REJECTED'
  | 'UNAVAILABLE'
  | 'OVERFLOW';

const COUNTED: ReadonlySet<RequestState> = new Set([
  'PENDING_METADATA',
  'QUEUED',
  'INELIGIBLE_TEMPORARILY',
  'RESERVED_NEXT',
  'OVERFLOW',
  'PLAYING',
  'PLAYED',
  'SKIPPED',
]);

/** SPEC §3.3: which request states use up one of a participant's accepted-song slots. */
export function countsTowardQuota(state: RequestState): boolean {
  return COUNTED.has(state);
}
