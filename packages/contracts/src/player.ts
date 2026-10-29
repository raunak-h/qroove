import { z } from 'zod';

export const PlaybackOutcome = z.enum(['PLAYED', 'SKIPPED', 'FAILED']);
export type PlaybackOutcome = z.infer<typeof PlaybackOutcome>;

export const Lease = z.object({
  epoch: z.number().int(),
  expiresAt: z.number().int(),
});
export type Lease = z.infer<typeof Lease>;
