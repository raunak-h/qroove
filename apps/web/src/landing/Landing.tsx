import { BRAND } from '@qroove/config';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, ApiError } from '../shared/api';
import { CodeInput } from '../shared/CodeInput';

type Found = { name: string } | { error: string } | null;

/** Everything fits one phone screen: the code boxes come first, like a quiz app. */
export function Landing() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Found>(null);

  async function check(c: string) {
    setBusy(true);
    setFound(null);
    try {
      const r = await api.bySlug(c);
      setFound({ name: r.name });
    } catch (e) {
      setFound({
        error:
          e instanceof ApiError && e.status === 404
            ? 'No event has that code.'
            : 'Could not check that code. Try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="landing">
      <h1>Enter code</h1>
      <CodeInput
        value={code}
        onChange={(v) => {
          setCode(v);
          if (v.length < 6) setFound(null);
        }}
        onComplete={(v) => void check(v)}
        disabled={busy}
      />
      <div className="landing-msg" role="status" aria-live="polite">
        {found && 'name' in found ? (
          <p>
            <strong>{found.name}</strong>
            <br />
            To join, scan the organiser’s QR code with your phone camera. A code alone cannot join.
          </p>
        ) : found && 'error' in found ? (
          <p className="error">{found.error}</p>
        ) : (
          <p className="muted">Then scan the QR code shown by the organiser to join.</p>
        )}
      </div>
      <div className="landing-actions">
        <Link to="/new" className="btn primary">
          Create an event
        </Link>
        <Link to="/new#playlist" className="btn ghost">
          Start from a playlist
        </Link>
      </div>
      <p className="muted small">
        {BRAND.tagline} <Link to="/privacy">Privacy</Link>
      </p>
    </div>
  );
}
