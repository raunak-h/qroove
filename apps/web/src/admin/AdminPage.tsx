import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { ConnectionBadge } from '../attendee/ConnectionBadge';
import { ApiError } from '../shared/api';
import { useMenuRules } from '../shared/menu';
import { useLockedPage } from '../shared/useLockedPage';
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

type Tab = 'queue' | 'invite' | 'player' | 'more';
type Sub = 'handover' | 'time' | 'rules' | 'end';

const TABS: Array<[Tab, string]> = [
  ['queue', 'Queue'],
  ['invite', 'Invite'],
  ['player', 'Player'],
  ['more', 'More'],
];

/**
 * A fixed-height console: controls on top, one tab body, tab bar at the bottom. Only the queue
 * list scrolls; every other tab fits a phone screen.
 */
export default function AdminPage() {
  const { eventId = '' } = useParams();
  const { state, csrf, connection, error, refresh } = useAdminStream(eventId);
  const [tab, setTab] = useState<Tab>('queue');
  const [sub, setSub] = useState<Sub | null>(null);
  useLockedPage();
  useMenuRules(state?.rules);
  // Once the event has ended the only thing left to do is carry songs over, which lives on Queue.
  const endedNow = state?.view.state === 'ENDED' || state?.view.state === 'ARCHIVED';
  useEffect(() => {
    document.body.classList.add('console');
    return () => document.body.classList.remove('console');
  }, []);

  if (!state) {
    return error ? (
      <AccessLost eventId={eventId} error={error} onBack={refresh} />
    ) : (
      <p role="status">Loading…</p>
    );
  }
  if (error?.status === 401) return <AccessLost eventId={eventId} error={error} onBack={refresh} />;

  const v = state.view;
  const ended = endedNow;
  const shownTab: Tab = ended ? 'queue' : tab;
  const cmd = commands(eventId, csrf ?? state.csrf);
  const props = { s: state, cmd, refresh };
  const live = v.state === 'ACTIVE' || v.state === 'PAUSED' || v.state === 'TRANSFERRING';
  const SUBS: Array<[Sub, string]> = [
    ['handover', 'Hand over'],
    ['time', 'Time'],
    ['rules', 'Rules'],
    ['end', 'End the event'],
  ];
  return (
    <div className="console">
      <header className="console-head">
        <h1>{v.name}</h1>
        <div className="row muted small">
          <span>{v.state.toLowerCase()}</span>
          <ConnectionBadge connection={connection} />
        </div>
        <ErrorLine error={error} />
      </header>
      {!ended ? <PlaybackPanel {...props} /> : null}
      <div className={`console-body${shownTab === 'queue' ? ' scroll' : ''}`} role="tabpanel">
        {shownTab === 'queue' ? (
          ended ? (
            <CarryOverPanel s={state} eventId={eventId} />
          ) : (
            <ModerationPanel {...props} />
          )
        ) : null}
        {shownTab === 'invite' ? <SharePanel joinUrl={state.joinUrl} name={v.name} /> : null}
        {shownTab === 'player' ? <PlayerPanel s={state} eventId={eventId} /> : null}
        {shownTab === 'more' ? (
          <div className="stack">
            <div className="row">
              {SUBS.filter(([id]) => (id === 'time' ? live : true)).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn${sub === id ? ' primary' : ''}`}
                  aria-pressed={sub === id}
                  onClick={() => setSub(sub === id ? null : id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {sub === 'handover' ? <HandoverPanel {...props} eventId={eventId} /> : null}
            {sub === 'time' ? <SchedulePanel {...props} /> : null}
            {sub === 'rules' ? <RulesPanel s={state} /> : null}
            {sub === 'end' ? <EndPanel {...props} /> : null}
          </div>
        ) : null}
      </div>
      <nav className="tabbar" role="tablist" aria-label="Organiser sections">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={shownTab === id}
            className={`btn${shownTab === id ? ' primary' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
