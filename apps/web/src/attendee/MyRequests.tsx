import type { MyRequests as Mine, RequestView } from '@qroove/contracts';
import { useState } from 'react';
import { ApiError } from '../shared/api';
import { GenreSwatch } from '../shared/Genre';

const LABEL: Record<string, { text: string; tone: 'ok' | 'warn' | 'info' | 'done' }> = {
  PENDING_METADATA: { text: 'Checking', tone: 'info' },
  QUEUED: { text: 'In queue', tone: 'ok' },
  INELIGIBLE_TEMPORARILY: { text: 'Waiting for its turn', tone: 'warn' },
  RESERVED_NEXT: { text: 'Up next', tone: 'ok' },
  OVERFLOW: { text: 'After end time', tone: 'warn' },
  PLAYING: { text: 'Playing', tone: 'ok' },
  PLAYED: { text: 'Played', tone: 'done' },
  SKIPPED: { text: 'Skipped', tone: 'done' },
  REJECTED: { text: 'Removed', tone: 'warn' },
  UNAVAILABLE: { text: 'Not found', tone: 'warn' },
};
const STARTED = new Set(['PLAYING', 'PLAYED', 'SKIPPED']);
const HIDDEN = new Set(['WITHDRAWN']);

export function MyRequests({
  mine,
  onWithdraw,
}: {
  mine: Mine;
  onWithdraw: (r: RequestView) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const shown = mine.requests.filter((r) => !HIDDEN.has(r.state));

  async function withdraw(r: RequestView) {
    setError(null);
    try {
      await onWithdraw(r);
      setConfirming(null);
    } catch (e) {
      setError(e instanceof ApiError ? e : null);
    }
  }

  return (
    <section className="card" aria-labelledby="mr-h">
      <h2 id="mr-h">My songs</h2>
      <p className="muted" id="quota">
        {mine.accepted} of {mine.limit} accepted songs this event. Removing a song that has not
        started frees its slot.
      </p>
      {error ? (
        <p className="error" role="alert">
          {error.message} {error.action}
        </p>
      ) : null}
      {shown.length === 0 ? (
        <p className="muted">You have not added any songs yet.</p>
      ) : (
        <ul className="list">
          {shown.map((r) => {
            const l = LABEL[r.state] ?? { text: r.state, tone: 'info' as const };
            const canWithdraw = !STARTED.has(r.state) && r.state !== 'REJECTED';
            return (
              <li key={r.id}>
                <span className="title">{r.title}</span>
                <span className="muted small">
                  {r.artist ? `${r.artist} ` : ''}
                  <GenreSwatch style={r.style} size={14} />
                </span>
                <span className={`badge ${l.tone}`}>{l.text}</span>
                {r.statusText && r.statusText !== l.text ? (
                  <span className="muted small">{r.statusText}</span>
                ) : null}
                {canWithdraw ? (
                  confirming === r.id ? (
                    <span className="row">
                      <button type="button" className="btn danger" onClick={() => void withdraw(r)}>
                        Yes, remove
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => setConfirming(null)}
                      >
                        Keep it
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn ghost"
                      aria-label={`Withdraw ${r.title}`}
                      onClick={() => setConfirming(r.id)}
                    >
                      Withdraw
                    </button>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
