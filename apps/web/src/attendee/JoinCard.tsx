import { useState } from 'react';
import { api, ApiError, type Creds } from '../shared/api';
import { saveCreds } from '../shared/storage';

export function JoinCard({
  eventId,
  joinKey,
  onJoined,
}: {
  eventId: string;
  joinKey: string | null;
  onJoined: (c: Creds) => void;
}) {
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const j = await api.join(eventId, joinKey!, nickname.trim() || undefined);
      const c = { participantId: j.participantId, token: j.token };
      saveCreds(eventId, c);
      onJoined(c);
    } catch (e) {
      setError(e instanceof ApiError ? e : null);
    } finally {
      setBusy(false);
    }
  }

  if (!joinKey) {
    return (
      <section className="card" aria-labelledby="jn-h">
        <h2 id="jn-h">Scan to join</h2>
        <p>
          You can watch the queue, but joining needs the organiser’s QR code. Scan it with your
          phone camera.
        </p>
      </section>
    );
  }
  return (
    <section className="card" aria-labelledby="jn-h">
      <h2 id="jn-h">Join to add songs</h2>
      <p className="muted">
        No account needed. This device gets a private pass for this event only.
      </p>
      <details>
        <summary>Add a nickname (optional)</summary>
        <label htmlFor="nick">Shown next to your songs</label>
        <input
          id="nick"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={30}
        />
      </details>
      {error ? (
        <p className="error" role="alert">
          {error.message} {error.action}
        </p>
      ) : null}
      <button type="button" className="btn primary" onClick={() => void join()} disabled={busy}>
        {busy ? 'Joining…' : 'Join this event'}
      </button>
    </section>
  );
}
