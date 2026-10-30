import { useEffect, useRef, useState } from 'react';
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

type Page = 'live' | 'invite' | 'more';
type Sub = 'handover' | 'time' | 'rules' | 'end';

const PAGES: Array<[Page, string]> = [
  ['live', 'Playing'],
  ['invite', 'Invite'],
  ['more', 'More'],
];

/**
 * A fixed-height console. Swipe sideways between three pages: what is playing with the queue, the
 * QR code to join, and the less-used controls (player, hand over, time, rules, end). Only the queue
 * list scrolls vertically, so a swipe never fights a scroll.
 */
export default function AdminPage() {
  const { eventId = '' } = useParams();
  const { state, csrf, connection, error, refresh } = useAdminStream(eventId);
  const [page, setPage] = useState<Page>('live');
  const [sub, setSub] = useState<Sub | null>(null);
  const pager = useRef<HTMLDivElement>(null);
  useLockedPage();
  useMenuRules(state?.rules);
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
  const ended = v.state === 'ENDED' || v.state === 'ARCHIVED';
  const cmd = commands(eventId, csrf ?? state.csrf);
  const props = { s: state, cmd, refresh };
  const live = v.state === 'ACTIVE' || v.state === 'PAUSED' || v.state === 'TRANSFERRING';
  const SUBS: Array<[Sub, string]> = [
    ['handover', 'Hand over'],
    ['time', 'Time'],
    ['rules', 'Rules'],
    ['end', 'End the event'],
  ];
  const go = (i: number) => {
    const el = pager.current;
    if (el) el.scrollTo?.({ left: i * el.clientWidth, behavior: 'smooth' });
    setPage(PAGES[i]![0]);
  };
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
      <div
        ref={pager}
        className="pager"
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          const next = PAGES[Math.min(PAGES.length - 1, Math.max(0, i))]![0];
          if (next !== page) setPage(next);
        }}
      >
        <section className="page live" role="tabpanel" aria-label="Playing" id="page-live">
          {ended ? (
            <div className="queue-wrap scroll">
              <CarryOverPanel s={state} eventId={eventId} />
            </div>
          ) : (
            <>
              <PlaybackPanel {...props} />
              <ModerationPanel {...props} />
            </>
          )}
        </section>
        <section className="page" role="tabpanel" aria-label="Invite" id="page-invite">
          <SharePanel joinUrl={state.joinUrl} name={v.name} />
        </section>
        <section className="page more" role="tabpanel" aria-label="More" id="page-more">
          <div className="stack">
            <PlayerPanel s={state} eventId={eventId} />
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
        </section>
      </div>
      <nav className="pager-dots" role="tablist" aria-label="Organiser sections">
        {PAGES.map(([id, label], i) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={page === id}
            aria-label={label}
            aria-controls={`page-${id}`}
            className="dot"
            onClick={() => go(i)}
          />
        ))}
      </nav>
    </div>
  );
}
