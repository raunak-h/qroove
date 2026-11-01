import type { EventPublicView } from '@qroove/contracts';
import { formatClock } from '../shared/time';
import { GenreSwatch } from '../shared/Genre';
import { breakMinutes, queueRows } from './queueRows';

/** Titles only: other attendees' names are deliberately not shown (SPEC §6). */
export function UpNext({ view, mineIds }: { view: EventPublicView; mineIds: ReadonlySet<string> }) {
  return (
    <details className="card whole-queue">
      <summary>
        <h2 id="un-h">Whole queue ({view.queue.length})</h2>
      </summary>
      {view.queue.length === 0 && view.breaks.every((b) => b.actualEnd !== null) ? (
        <p className="muted">The queue is empty. Be the first to add a song.</p>
      ) : (
        <ol className="list" aria-labelledby="un-h">
          {queueRows(view).map((row) =>
            row.kind === 'break' ? (
              <li key={row.b.id} className="break-row">
                Break · {breakMinutes(row.b)} min
                {row.b.startsAt !== null
                  ? ` · about ${formatClock(row.b.startsAt, view.timezone)}`
                  : ''}
              </li>
            ) : (
              <li key={row.q.requestId} className={row.q.overflow ? 'overflow' : undefined}>
                <span className="title">{row.q.title}</span>
                <span className="muted small">
                  {row.q.artist ? `${row.q.artist} ` : ''}
                  <GenreSwatch style={row.q.style} size={14} />
                </span>
                {mineIds.has(row.q.requestId) ? <span className="badge mine">Yours</span> : null}
                {row.q.overflow ? <span className="badge warn">After end time</span> : null}
              </li>
            ),
          )}
        </ol>
      )}
    </details>
  );
}
