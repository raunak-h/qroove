import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const AUTO_ID = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
/** Crockford base32 (no I, L, O, U). */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function pick(alphabet: string, n: number): string {
  let out = '';
  for (let i = 0; i < n; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

export interface Ids {
  eventId(): string;
  requestId(): string;
  participantId(): string;
  breakId(): string;
  slug(): string;
  /** 32 random bytes, base64url — participant, admin, recovery and lease secrets. */
  secret(): string;
  handoverCode(): string;
  seed(): number;
}

export const randomIds: Ids = {
  eventId: () => pick(AUTO_ID, 20),
  requestId: () => pick(AUTO_ID, 20),
  participantId: () => pick(AUTO_ID, 20),
  breakId: () => pick(AUTO_ID, 8),
  slug: () => pick(CROCKFORD, 6),
  secret: () => randomBytes(32).toString('base64url'),
  handoverCode: () => pick(CROCKFORD, 16),
  seed: () => randomInt(2 ** 31),
};

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Constant-time comparison of two hex digests. */
export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Small deterministic PRNG for reproducible per-style shuffles. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
