import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, ApiError } from '../shared/api';
import { CodeInput } from '../shared/CodeInput';

/** Everything fits one phone screen: the code boxes come first, like a quiz app. */
export function Landing() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const go = useNavigate();

  async function enter(c: string) {
    setBusy(true);
    setProblem(null);
    try {
      await api.bySlug(c);
      go(`/e/${c}`);
    } catch (e) {
      setProblem(
        e instanceof ApiError && e.status === 404
          ? 'No event has that code.'
          : 'Could not check that code. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="landing">
      <h1>Enter code</h1>
      <CodeInput
        value={code}
        groupSize={3}
        onChange={(v) => {
          setCode(v);
          if (v.length < 6) setProblem(null);
        }}
        onComplete={(v) => void enter(v)}
        disabled={busy}
      />
      <div className="landing-msg" role="status" aria-live="polite">
        {problem ? (
          <p className="error">{problem}</p>
        ) : (
          <p className="muted">Or scan the organiser’s QR code with your camera.</p>
        )}
      </div>
      <div className="landing-actions">
        <Link to="/new" className="btn primary">
          Create an event
        </Link>
      </div>
    </div>
  );
}
