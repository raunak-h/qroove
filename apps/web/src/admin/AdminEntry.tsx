import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { ApiError } from '../shared/api';
import { adminApi } from './adminApi';
import { ErrorLine } from './useAction';

/** `/a/:id#k=secret` and `/claim/:id#c=code` both end here: exchange once, then drop the fragment. */
export default function AdminEntry({ mode }: { mode: 'link' | 'claim' }) {
  const { eventId = '' } = useParams();
  const { hash } = useLocation();
  const go = useNavigate();
  const value = new URLSearchParams(hash.slice(1)).get(mode === 'link' ? 'k' : 'c');
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!value) return;
    let live = true;
    (mode === 'link' ? adminApi.session(eventId, value) : adminApi.claim(eventId, value))
      .then(() => {
        // Remove the secret from the address bar and history before anything else renders.
        history.replaceState(null, '', location.pathname);
        go(`/admin/${eventId}`, { replace: true });
      })
      .catch((e: unknown) => live && setError(e instanceof ApiError ? e : null));
    return () => {
      live = false;
    };
  }, [eventId, value, mode, go]);

  if (!value) {
    return (
      <section className="card" role="alert">
        <h1>This link is incomplete</h1>
        <p>
          The {mode === 'link' ? 'organiser' : 'handover'} link must include everything after the
          “#”. Copy the whole link again and open it.
        </p>
      </section>
    );
  }
  return error ? (
    <section className="card">
      <h1>We could not open that link</h1>
      <ErrorLine error={error} />
    </section>
  ) : (
    <p role="status">Opening…</p>
  );
}
