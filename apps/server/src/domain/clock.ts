export interface Clock {
  now(): number;
}

/** The only wall-clock access; domain code receives a `Clock` and never reads time itself. */
export const systemClock: Clock = { now: () => Date.now() };

export class FakeClock implements Clock {
  constructor(private t = 1_800_000_000_000) {}
  now() {
    return this.t;
  }
  advance(ms: number) {
    this.t += ms;
  }
  set(t: number) {
    this.t = t;
  }
}
