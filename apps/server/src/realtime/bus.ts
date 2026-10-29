import type { Repository } from '../db/ports.js';
import type { EventAggregate } from '../db/types.js';

export interface Subscriber {
  /** Turns the freshly loaded aggregate into the payload for this client. */
  render(agg: EventAggregate): unknown;
  send(name: string, data: unknown): void;
}

interface Topic {
  subs: Set<Subscriber>;
  unsubscribe: () => void;
  version: number;
  loading: boolean;
  again: boolean;
}

/**
 * Fans one repository subscription per event out to many SSE clients. The aggregate is loaded
 * once per change, not once per client. Changes that arrive mid-load are coalesced.
 */
export class EventBus {
  private readonly topics = new Map<string, Topic>();

  constructor(private readonly repo: Repository) {}

  async subscribe(eventId: string, sub: Subscriber): Promise<() => void> {
    let topic = this.topics.get(eventId);
    if (!topic) {
      const t: Topic = {
        subs: new Set(),
        version: -1,
        loading: false,
        again: false,
        unsubscribe: () => {},
      };
      t.unsubscribe = this.repo.subscribe(eventId, (e) => {
        if (e.version !== t.version) void this.refresh(eventId, t);
      });
      this.topics.set(eventId, t);
      topic = t;
    }
    topic.subs.add(sub);
    const agg = await this.repo.getEventPublic(eventId);
    if (agg) {
      topic.version = Math.max(topic.version, agg.event.version);
      sub.send('state', sub.render(agg));
    }
    return () => {
      topic.subs.delete(sub);
      if (topic.subs.size === 0) {
        topic.unsubscribe();
        this.topics.delete(eventId);
      }
    };
  }

  private async refresh(eventId: string, t: Topic): Promise<void> {
    if (t.loading) {
      t.again = true;
      return;
    }
    t.loading = true;
    try {
      do {
        t.again = false;
        const agg = await this.repo.getEventPublic(eventId);
        if (!agg || agg.event.version === t.version) continue;
        t.version = agg.event.version;
        for (const s of t.subs) s.send('state', s.render(agg));
      } while (t.again);
    } finally {
      t.loading = false;
    }
  }

  get activeTopics() {
    return this.topics.size;
  }
}
