import { useState } from 'react';
import { api, ApiError, type Creds } from '../shared/api';
import { saveCreds } from '../shared/storage';

export function JoinCard({ eventId, onJoined }: { eventId: string; onJoined: (c: Creds) => void }) {
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const name = nickname.trim();

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const j = await api.join(eventId, name);
      const c = { participantId: j.participantId, token: j.token };
      saveCreds(eventId, c);
      onJoined(c);
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="jn-h">
      <h2 id="jn-h">Join to add songs</h2>
      <form onSubmit={(e) => void join(e)}>
        <label htmlFor="nick">Your name</label>
        <input
          id="nick"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={30}
          autoComplete="given-name"
          required
        />
        <p className="muted small">So the organiser can see who added which song.</p>
        {error ? (
          <p className="error" role="alert">
            {error.message} {error.action}
          </p>
        ) : null}
        <button type="submit" className="btn primary" disabled={busy || !name}>
          {busy ? 'Joining…' : 'Join this event'}
        </button>
      </form>
    </section>
  );
}
