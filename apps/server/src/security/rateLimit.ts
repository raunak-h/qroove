import { DomainError } from '@qroove/contracts';

/** In-process sliding-window limiter. Production runs one instance (ADR 0002). */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly sweeper: NodeJS.Timeout;

  constructor(private readonly now: () => number = Date.now) {
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref();
  }

  /** Throws RATE_LIMITED when `key` has already used `max` hits inside `windowMs`. */
  check(key: string, max: number, windowMs: number): void {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((x) => x > t - windowMs);
    if (recent.length >= max) {
      this.hits.set(key, recent);
      throw new DomainError('RATE_LIMITED');
    }
    recent.push(t);
    this.hits.set(key, recent);
  }

  private sweep() {
    const cutoff = this.now() - 3_600_000;
    for (const [k, v] of this.hits) {
      if ((v.at(-1) ?? 0) < cutoff) this.hits.delete(k);
    }
  }

  close() {
    clearInterval(this.sweeper);
  }
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
