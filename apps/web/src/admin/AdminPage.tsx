import { useState } from 'react';
import { useParams } from 'react-router';
import { ConnectionBadge } from '../attendee/ConnectionBadge';
import { ApiError } from '../shared/api';
import { adminApi, commands } from './adminApi';
import {
  CarryOverPanel,
  EndPanel,
  HandoverPanel,
  ModerationPanel,
  PlayerPanel,
  PlaybackPanel,
  RulesPanel,
  SchedulePanel,
  SharePanel,
} from './panels';
import { ErrorLine } from './useAction';
import { useAdminStream } from './useAdminStream';

function AccessLost({
  eventId,
  error,
  onBack,
}: {
  eventId: string;
  error: ApiError;
  onBack: () => void;
}) {
  const [secret, setSecret] = useState('');
  const [err, setErr] = useState<ApiError | null>(null);
  return (
    <section className="card stack" role="alert">
      <h1>{error.status === 401 ? 'You do not have organiser access' : 'Something went wrong'}</h1>
      <p>
        {error.message} {error.action}
      </p>
      {error.status === 401 ? (
        <>
          <p className="muted">
            Open your organiser link again. If it was lost, or someone took over, the recovery
            secret you were given at creation restores access.
          </p>
          <label htmlFor="rec">Recovery secret</label>
          <input
            id="rec"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
          />
          <ErrorLine error={err} />
          <button
            type="button"
            className="btn primary"
            disabled={secret.trim().length < 16}
            onClick={() =>
              void adminApi
                .recover(eventId, secret.trim())
                .then(onBack)
                .catch((e: unknown) => setErr(e instanceof ApiError ? e : null))
            }
          >
            Recover access
          </button>
        </>
      ) : null}
    </section>
  );
}

export default function AdminPage() {
  const { eventId = '' } = useParams();
  const { state, csrf, connection, error, refresh } = useAdminStream(eventId);

  if (!state) {
    return error ? (
      <AccessLost eventId={eventId} error={error} onBack={refresh} />
    ) : (
      <p role="status">Loading…</p>
    );
  }
  if (error?.status === 401) return <AccessLost eventId={eventId} error={error} onBack={refresh} />;

  const v = state.view;
  const cmd = commands(eventId, csrf ?? state.csrf);
  const props = { s: state, cmd, refresh };
  return (
    <div className="stack">
      <header>
        <h1>{v.name}</h1>
        <p className="muted">
          Organiser · {v.state.toLowerCase()} · code <strong className="code">{v.slug}</strong>
        </p>
        <ConnectionBadge connection={connection} />
        <ErrorLine error={error} />
      </header>
      <PlaybackPanel {...props} />
      <ModerationPanel {...props} />
      <SchedulePanel {...props} />
      <SharePanel slug={v.slug} />
      <PlayerPanel s={state} eventId={eventId} />
      <HandoverPanel {...props} eventId={eventId} />
      <RulesPanel s={state} />
      <EndPanel {...props} />
      <CarryOverPanel s={state} eventId={eventId} />
    </div>
  );
}
