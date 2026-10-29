import { STYLE_PRESETS } from '@qroove/config';
import type { AdminRequestView, ExportSnapshot } from '@qroove/contracts';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { styleLabel } from '../attendee/NowPlaying';
import { ApiError } from '../shared/api';
import { formatClock, fromLocalInput, pluralise, toLocalInput } from '../shared/time';
import { ConfirmButton, CopyButton, QrCode } from '../shared/widgets';
import { adminApi, type AdminStateResponse, type Commands, type Created } from './adminApi';
import { CreatedPanel } from './CreateEvent';
import { ErrorLine, useAction } from './useAction';

interface PanelProps {
  s: AdminStateResponse;
  cmd: Commands;
  refresh: () => void;
}

const LIVE = new Set(['ACTIVE', 'PAUSED', 'TRANSFERRING']);

export function PlaybackPanel({ s, cmd, refresh }: PanelProps) {
  const { run, busy, error } = useAction(refresh);
  const v = s.view;
  const next = v.queue.find((q) => !q.overflow);
  const overflow = v.preview.items.filter((i) => i.overflow).length;
  return (
    <section className="card stack" aria-labelledby="pb-h">
      <h2 id="pb-h">Playback</h2>
      <p className="big">{v.nowPlaying ? v.nowPlaying.track.title : 'Nothing playing'}</p>
      {v.nowPlaying ? (
        <p className="muted">
          {[v.nowPlaying.track.artist, styleLabel(v.nowPlaying.track.style)]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
      <p>
        <strong>Next:</strong> {next ? next.title : 'nothing reserved yet'}
      </p>
      {v.runIndicator && v.state === 'ACTIVE' ? (
        <p className="muted">
          {styleLabel(v.runIndicator.style)} run: {v.runIndicator.runLength} of {v.runIndicator.cap}
        </p>
      ) : null}
      {v.waitingReason ? <p className="notice">Waiting: {v.waitingReason}</p> : null}
      {overflow > 0 ? (
        <p className="notice">
          {overflow} {pluralise(overflow, 'song')} would run past the end time. Extend the end time
          to fit them.
        </p>
      ) : null}
      <div className="row">
        {v.state === 'DRAFT' ? (
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => void run(cmd.start)}
          >
            Start event
          </button>
        ) : null}
        {v.state === 'ACTIVE' ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void run(cmd.pause)}>
            Pause
          </button>
        ) : null}
        {v.state === 'PAUSED' || v.state === 'TRANSFERRING' ? (
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => void run(cmd.resume)}
          >
            {v.state === 'TRANSFERRING' ? 'Cancel handover and resume' : 'Resume'}
          </button>
        ) : null}
        {LIVE.has(v.state) && v.nowPlaying ? (
          <ConfirmButton
            label="Skip"
            confirmLabel="Yes, skip this song"
            onConfirm={() => run(cmd.skip)}
          />
        ) : null}
      </div>
      {v.state === 'DRAFT' ? (
        <p className="muted">
          Starting locks the rules below. Attendees can already see the event code.
        </p>
      ) : null}
      <ErrorLine error={error} />
    </section>
  );
}

export function ModerationPanel({ s, cmd, refresh }: PanelProps) {
  const { run, error } = useAction(refresh);
  const shown = s.requests.filter(
    (r) => !['WITHDRAWN', 'REJECTED', 'UNAVAILABLE'].includes(r.state),
  );
  const started = new Set(['PLAYING', 'PLAYED', 'SKIPPED']);
  const row = (r: AdminRequestView) => (
    <li key={r.id} className={started.has(r.state) ? 'overflow' : undefined}>
      <span className="title">{r.title}</span>
      <span className="muted small">
        {[r.artist, styleLabel(r.style)].filter(Boolean).join(' · ')} ·{' '}
        {r.ownerNickname ?? 'No nickname'} (#{r.ownerLabel})
      </span>
      <span className="badge info">
        {r.possibleDuplicate ? 'Possible duplicate' : r.state.replaceAll('_', ' ').toLowerCase()}
      </span>
      {r.possibleDuplicate ? (
        <span className="row">
          <button
            type="button"
            className="btn"
            onClick={() => void run(() => cmd.duplicate(r.id, 'approve'))}
          >
            Distinct
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void run(() => cmd.duplicate(r.id, 'reject'))}
          >
            Reject
          </button>
        </span>
      ) : null}
      {!started.has(r.state) && s.view.state !== 'ENDED' && s.view.state !== 'ARCHIVED' ? (
        <ConfirmButton
          label="Remove"
          ariaLabel={`Remove ${r.title}`}
          confirmLabel="Yes, remove"
          danger
          onConfirm={() => run(() => cmd.remove(r.id))}
        />
      ) : null}
    </li>
  );
  return (
    <section className="card" aria-labelledby="mod-h">
      <h2 id="mod-h">Moderation</h2>
      <ErrorLine error={error} />
      {shown.length === 0 ? (
        <p className="muted">No requests yet.</p>
      ) : (
        <ul className="list">{shown.map(row)}</ul>
      )}
      <p className="muted small">
        Removing a song that has not started frees the contributor’s slot. Played songs stay on
        record.
      </p>
    </section>
  );
}

export function SchedulePanel({ s, cmd, refresh }: PanelProps) {
  const { run, busy, error } = useAction(refresh);
  const [value, setValue] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const v = s.view;
  const ms = fromLocalInput(value);
  const invalid = value !== '' && (ms === null || ms <= now || (v.endAt !== null && ms <= v.endAt));
  const live = v.state === 'ACTIVE' || v.state === 'PAUSED';
  return (
    <section className="card stack" aria-labelledby="sc-h">
      <h2 id="sc-h">End time and breaks</h2>
      <p>
        {v.endAt ? (
          <>
            Planned end: <strong>{formatClock(v.endAt, v.timezone)}</strong>
          </>
        ) : (
          'No fixed end time.'
        )}
      </p>
      {live ? (
        <div>
          <label htmlFor="extend">{v.endAt ? 'Extend until' : 'Set an end time'}</label>
          <div className="row">
            <input
              id="extend"
              type="datetime-local"
              value={value}
              min={toLocalInput(now)}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={invalid}
            />
            <button
              type="button"
              className="btn"
              disabled={busy || ms === null || invalid}
              onClick={() => ms && void run(() => cmd.extend(ms)).then(() => setValue(''))}
            >
              {v.endAt ? 'Extend' : 'Set'}
            </button>
          </div>
          {invalid ? (
            <p className="error">
              Pick a real time later than {v.endAt ? 'the current end' : 'now'}.
            </p>
          ) : null}
        </div>
      ) : null}
      {v.breaks.length > 0 ? (
        <ul className="list">
          {v.breaks.map((b) => (
            <li key={b.id}>
              <span className="title">
                {b.label} · {Math.round(b.durationSec / 60)} min
              </span>
              {b.actualEnd !== null ? (
                <span className="badge done">Done</span>
              ) : b.actualStart !== null ? (
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy}
                  onClick={() => void run(() => cmd.endBreak(b.id))}
                >
                  End break
                </button>
              ) : live ? (
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void run(() => cmd.startBreak(b.id))}
                >
                  Start break
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <ErrorLine error={error} />
    </section>
  );
}

export function SharePanel({ slug }: { slug: string }) {
  const url = `${location.origin}/e/${slug}`;
  return (
    <section className="card stack" aria-labelledby="sh-h">
      <h2 id="sh-h">Invite people</h2>
      <QrCode text={url} label={`QR code that opens ${url}`} />
      <p className="big code" aria-label={`Event code ${slug.split('').join(' ')}`}>
        {slug}
      </p>
      <p className="mono">{url}</p>
      <CopyButton text={url} label="Copy join link" />
      <p className="muted small">
        This is the public join link. It never contains organiser access.
      </p>
    </section>
  );
}

export function HandoverPanel({ s, cmd, refresh, eventId }: PanelProps & { eventId: string }) {
  const { run, busy, error } = useAction(refresh);
  const [offer, setOffer] = useState<{ code: string; expiresAt: number } | null>(null);
  const live = LIVE.has(s.view.state);
  const link = offer ? `${location.origin}/claim/${eventId}#c=${offer.code}` : '';
  return (
    <section className="card stack" aria-labelledby="ho-h">
      <h2 id="ho-h">Hand over</h2>
      <p className="muted">
        Give control to someone else. Their link works once, for 10 minutes. The moment they open
        it, your access stops, playback pauses, and the song in progress counts as played.
      </p>
      {live ? (
        <ConfirmButton
          label="Hand over admin"
          confirmLabel="Yes, create a handover link"
          onConfirm={async () => {
            const r = await run(cmd.handover);
            if (r) setOffer(r);
          }}
          disabled={busy}
        />
      ) : null}
      {offer ? (
        <div className="stack">
          <p className="warning">
            Send this to the new organiser privately. It expires at{' '}
            {formatClock(offer.expiresAt, s.view.timezone)}.
          </p>
          <p className="big code">{offer.code}</p>
          <p className="mono">{link}</p>
          <CopyButton text={link} label="Copy handover link" />
        </div>
      ) : null}
      <ErrorLine error={error} />
    </section>
  );
}

export function PlayerPanel({ s, eventId }: { s: AdminStateResponse; eventId: string }) {
  return (
    <section className="card stack" aria-labelledby="pl-h">
      <h2 id="pl-h">Player</h2>
      {s.lease ? (
        <p>A device is controlling playback (session {s.lease.epoch}).</p>
      ) : (
        <p className="muted">No device is controlling playback.</p>
      )}
      <p>
        <Link className="btn" to={`/player/${eventId}`}>
          Open the player on the speaker device
        </Link>
      </p>
      <p className="muted small">
        Opening it on another device takes over playback; the previous device is stopped and the
        song it was playing counts as played.
      </p>
    </section>
  );
}

export function RulesPanel({ s }: { s: AdminStateResponse }) {
  const r = s.rules;
  const frozen = s.view.state !== 'DRAFT';
  return (
    <section className="card" aria-labelledby="ru-h">
      <h2 id="ru-h">Rules</h2>
      <p className="muted">
        {frozen
          ? `Locked since the event started. Fingerprint ${s.rulesHash?.slice(0, 12) ?? ''}.`
          : 'These are locked when you start the event.'}
      </p>
      <ul className="plain">
        <li>
          Styles:{' '}
          {r.enabledStyles
            .map(
              (id) =>
                `${STYLE_PRESETS.find((p) => p.id === id)?.label ?? id} (max ${r.runCaps[id]} in a row)`,
            )
            .join(', ')}
        </li>
        <li>Songs per person: {r.submissionLimit}</li>
        <li>Spacing: nobody twice in a row, and not again until the style has changed once.</li>
        <li>Each recording once per event. First come, first served within a style.</li>
      </ul>
    </section>
  );
}

export function EndPanel({ s, cmd, refresh }: PanelProps) {
  const { run, busy, error } = useAction(refresh);
  const [typed, setTyped] = useState('');
  if (s.view.state === 'ENDED' || s.view.state === 'ARCHIVED') return null;
  return (
    <section className="card stack" aria-labelledby="en-h">
      <h2 id="en-h">End the event</h2>
      <p className="muted">
        Ending is permanent. Songs that did not play can be carried over to a new event.
      </p>
      <label htmlFor="end-confirm">Type END to confirm</label>
      <input
        id="end-confirm"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
      />
      <button
        type="button"
        className="btn danger"
        disabled={busy || typed.trim().toUpperCase() !== 'END'}
        onClick={() => void run(cmd.end)}
      >
        End event
      </button>
      <ErrorLine error={error} />
    </section>
  );
}

/** Song picker + "create event from these"; shared by carry-over and the JSON import page. */
export function ImportPicker({
  snapshot,
  timezone,
  name,
  intro,
  onCreated,
}: {
  snapshot: ExportSnapshot;
  timezone: string;
  name: string;
  intro: string;
  onCreated: (c: Created) => void;
}) {
  const [picked, setPicked] = useState<Set<number>>(
    () => new Set(snapshot.recommendations.map((_, i) => i)),
  );
  const [shuffle, setShuffle] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <p className="muted">{intro}</p>
      <ul className="list">
        {snapshot.recommendations.map((r, i) => (
          <li key={i}>
            <label className="check">
              <input
                type="checkbox"
                checked={picked.has(i)}
                onChange={(e) =>
                  setPicked((cur) => {
                    const n = new Set(cur);
                    if (e.target.checked) n.add(i);
                    else n.delete(i);
                    return n;
                  })
                }
              />
              <span>
                <strong>{r.title}</strong>{' '}
                <span className="muted small">
                  {[r.artist, styleLabel(r.style)].filter(Boolean).join(' · ')}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <label className="check">
        <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
        <span>Shuffle within each style</span>
      </label>
      <button
        type="button"
        className="btn primary"
        disabled={busy || picked.size === 0}
        onClick={() => {
          setBusy(true);
          setError(null);
          adminApi
            .importSnapshot({
              snapshot,
              timezone,
              shuffle,
              selectedIndexes: [...picked],
              name,
            })
            .then(onCreated)
            .catch((e: unknown) => setError(e instanceof ApiError ? e : null))
            .finally(() => setBusy(false));
        }}
      >
        Create event from these
      </button>
      <ErrorLine error={error} />
    </>
  );
}

export function CarryOverPanel({ s, eventId }: { s: AdminStateResponse; eventId: string }) {
  const [songs, setSongs] = useState<ExportSnapshot | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const ended = s.view.state === 'ENDED' || s.view.state === 'ARCHIVED';

  useEffect(() => {
    if (!ended) return;
    let live = true;
    adminApi
      .carryOver(eventId)
      .then((x) => live && setSongs(x))
      .catch((e: unknown) => live && setError(e instanceof ApiError ? e : null));
    return () => {
      live = false;
    };
  }, [ended, eventId]);

  if (!ended) return null;
  if (created) return <CreatedPanel created={created} />;
  return (
    <section className="card stack" aria-labelledby="co-h">
      <h2 id="co-h">Carry over to a new event</h2>
      <ErrorLine error={error} />
      {songs && songs.recommendations.length === 0 ? (
        <p className="muted">Everything in the queue was played.</p>
      ) : null}
      {songs && songs.recommendations.length > 0 ? (
        <ImportPicker
          snapshot={songs}
          timezone={s.view.timezone}
          name={`${s.view.name} (next)`.slice(0, 80)}
          intro="These songs never played. They join the new event owned by a neutral “system” contributor and follow the same fairness rules; you can remove any of them before starting."
          onCreated={setCreated}
        />
      ) : null}
    </section>
  );
}
