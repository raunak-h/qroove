import type { ExportSnapshot } from '@qroove/contracts';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { styleLabel } from '../attendee/NowPlaying';
import { api, ApiError } from '../shared/api';
import { adminApi } from './adminApi';

/** `/h/:slug` — read-only playlist from a past event. No nicknames, no identities. */
export default function Historical() {
  const { slug = '' } = useParams();
  const [data, setData] = useState<{
    slug: string;
    snap: ExportSnapshot | null;
    error: ApiError | null;
  } | null>(null);

  useEffect(() => {
    let live = true;
    api
      .bySlug(slug)
      .then((r) => adminApi.exportSnapshot(r.eventId))
      .then((snap) => live && setData({ slug, snap, error: null }))
      .catch(
        (e: unknown) =>
          live && setData({ slug, snap: null, error: e instanceof ApiError ? e : null }),
      );
    return () => {
      live = false;
    };
  }, [slug]);

  const cur = data?.slug === slug ? data : null;
  if (!cur) return <p role="status">Loading…</p>;
  if (!cur.snap) {
    return (
      <section className="card" role="alert">
        <h1>We could not find that playlist</h1>
        <p>
          {cur.error ? `${cur.error.message} ${cur.error.action}` : 'Check the link and try again.'}
        </p>
        <Link to="/">Back to the start</Link>
      </section>
    );
  }
  return (
    <section className="card">
      <h1>{cur.snap.name}</h1>
      <p className="muted">A read-only list of the songs requested at this event.</p>
      <p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const blob = new Blob([JSON.stringify(cur.snap, null, 2)], {
              type: 'application/json',
            });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${cur.slug}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          Download as JSON
        </button>{' '}
        <Link to="/import">Start a new event from a saved playlist</Link>
      </p>
      <ol className="list">
        {cur.snap.recommendations.map((r, i) => (
          <li key={i}>
            <span className="title">{r.title}</span>
            <span className="muted small">
              {[r.artist, styleLabel(r.style)].filter(Boolean).join(' · ')}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
