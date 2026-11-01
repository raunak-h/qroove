import type { EventPublicView } from '@qroove/contracts';
import { TrackMeta } from './NowPlaying';

/** "~4 min" from a predicted start; null when there is no reliable prediction to show. */
export function etaText(startMs: number | null, uncertain: boolean, serverNow: number) {
  if (startMs === null || uncertain) return null;
  return `~${Math.max(1, Math.round((startMs - serverNow) / 60_000))} min`;
}

/** The next song in the queue the whole room shares, with a time only when the scheduler is sure. */
export function NextUp({ view, serverNow }: { view: EventPublicView; serverNow: number }) {
  const next = view.queue.find((q) => !q.overflow) ?? null;
  const item = next ? view.preview.items.find((i) => i.requestId === next.requestId) : undefined;
  const eta =
    next && item && view.state === 'ACTIVE'
      ? etaText(item.predictedStartMs, item.uncertain, serverNow)
      : null;
  return (
    <section className="card status-next" aria-labelledby="nu-h">
      <div className="status-next-head">
        <h2 id="nu-h" className="deck-title">
          Next up
        </h2>
        {eta ? <span className="eta">{eta}</span> : null}
      </div>
      {next ? (
        <div key={next.requestId} className="swap-in">
          <p className="next-title" title={next.title}>
            {next.title}
          </p>
          <TrackMeta style={next.style} artist={null} />
        </div>
      ) : (
        <p className="muted small">No upcoming song.</p>
      )}
    </section>
  );
}
