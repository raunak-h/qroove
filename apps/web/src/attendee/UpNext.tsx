import type { EventPublicView } from '@qroove/contracts';
import { styleLabel } from './NowPlaying';

/** Titles only: other attendees' names are deliberately not shown (SPEC §6). */
export function UpNext({ view, mineIds }: { view: EventPublicView; mineIds: ReadonlySet<string> }) {
  return (
    <section className="card" aria-labelledby="un-h">
      <h2 id="un-h">Up next</h2>
      {view.queue.length === 0 ? (
        <p className="muted">The queue is empty. Be the first to add a song.</p>
      ) : (
        <ol className="list">
          {view.queue.map((q) => (
            <li key={q.requestId} className={q.overflow ? 'overflow' : undefined}>
              <span className="title">{q.title}</span>
              <span className="muted small">
                {[q.artist, styleLabel(q.style)].filter(Boolean).join(' · ')}
              </span>
              {mineIds.has(q.requestId) ? <span className="badge mine">Yours</span> : null}
              {q.overflow ? <span className="badge warn">After end time</span> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
