import type { MyRequests as Mine, RequestView } from '@qroove/contracts';
import { useState } from 'react';
import { ApiError } from '../shared/api';
import { TrackMeta } from './NowPlaying';
import { etaText } from './NextUp';

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
/** Finished songs go into the history below the list. */
const HISTORY = new Set(['PLAYED', 'SKIPPED']);
const HIDDEN = new Set(['WITHDRAWN']);
/** Songs that will still be played, in the queue's order. */
const WAITING = new Set([
  'PENDING_METADATA',
  'QUEUED',
  'INELIGIBLE_TEMPORARILY',
  'RESERVED_NEXT',
  'OVERFLOW',
]);

/** Playing first, then the queue's own positions, then the ones without a position by age. */
const byPlayOrder = (a: RequestView, b: RequestView) =>
  Number(b.state === 'PLAYING') - Number(a.state === 'PLAYING') ||
  (a.position ?? Infinity) - (b.position ?? Infinity) ||
  a.acceptedSeq - b.acceptedSeq;

export function MyRequests({
  mine,
  live,
  serverNow,
  onWithdraw,
}: {
  mine: Mine;
  /** True while the event is running, the only time a predicted start means anything. */
  live: boolean;
  serverNow: number;
  onWithdraw: (r: RequestView) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [showPlayed, setShowPlayed] = useState(false);
  const shown = mine.requests.filter((r) => !HIDDEN.has(r.state));
  const played = shown
    .filter((r) => HISTORY.has(r.state))
    .sort((a, b) => b.acceptedSeq - a.acceptedSeq);
  // Songs that need attention (removed, not found) stay in the list after the queued ones.
  const active = shown.filter((r) => !HISTORY.has(r.state)).sort(byPlayOrder);
  const orderOf = new Map(
    active.filter((r) => WAITING.has(r.state)).map((r, i) => [r.id, i + 1] as const),
  );

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
      <div className="card-head">
        <h2 id="mr-h">My songs</h2>
        <span className="muted small">Scheduled play order</span>
      </div>
      <p className="muted small" id="quota">
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
        <ul className="tracks">
          {active.map((r) => {
            const l = LABEL[r.state] ?? { text: r.state, tone: 'info' as const };
            const canWithdraw = !STARTED.has(r.state) && r.state !== 'REJECTED';
            const eta =
              live && WAITING.has(r.state) ? etaText(r.predictedStartMs, false, serverNow) : null;
            const order = orderOf.get(r.id);
            return (
              <li key={r.id} className={`track${r.state === 'PLAYING' ? ' playing' : ''}`}>
                <span className="track-no" aria-hidden="true">
                  {r.state === 'PLAYING' ? '▶' : (order ?? '–')}
                </span>
                <span className="track-info">
                  <span className="title">{r.title}</span>
                  <TrackMeta style={r.style} artist={r.artist} />
                </span>
                <span className="track-side">
                  {r.state === 'PLAYING' ? (
                    <span className="eta">Now</span>
                  ) : eta ? (
                    <span className="eta">
                      Est. in {eta}
                      {r.uncertain ? ' (rough)' : ''}
                    </span>
                  ) : null}
                  <span className={`badge ${l.tone}`}>{l.text}</span>
                </span>
                {r.statusText && r.statusText !== l.text ? (
                  <span className="muted small track-note">{r.statusText}</span>
                ) : null}
                {canWithdraw ? (
                  <span className="track-actions">
                    {confirming === r.id ? (
                      <>
                        <button
                          type="button"
                          className="btn danger"
                          onClick={() => void withdraw(r)}
                        >
                          Yes, remove
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => setConfirming(null)}
                        >
                          Keep it
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn ghost"
                        aria-label={`Withdraw ${r.title}`}
                        onClick={() => setConfirming(r.id)}
                      >
                        Withdraw
                      </button>
                    )}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {played.length > 0 ? (
        <div className="played">
          <button
            type="button"
            className="played-toggle"
            aria-expanded={showPlayed}
            aria-controls="played-list"
            onClick={() => setShowPlayed(!showPlayed)}
          >
            <span>Played songs ({played.length})</span>
            <span aria-hidden="true">{showPlayed ? '▴' : '▾'}</span>
          </button>
          <ul id="played-list" className="tracks history" hidden={!showPlayed}>
            {played.map((r) => (
              <li key={r.id} className="track">
                <span className="track-no" aria-hidden="true">
                  ✓
                </span>
                <span className="track-info">
                  <span className="title">{r.title}</span>
                  <TrackMeta style={r.style} artist={r.artist} />
                </span>
                <span className="track-side">
                  <span className="badge done">{LABEL[r.state]!.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
