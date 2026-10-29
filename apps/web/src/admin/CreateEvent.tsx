import {
  DEFAULT_ENABLED_STYLES,
  EVENT_LIMITS,
  GENRES,
  RULE_DEFAULTS,
  STYLE_PRESETS,
  genreOf,
  genresOf,
  type GenreId,
  type StyleId,
} from '@qroove/config';
import { breakSlots, ratioProblem, validateBreaks } from '@qroove/contracts/breaks';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ApiError } from '../shared/api';
import { adminApi, type Created } from './adminApi';
import { ErrorLine } from './useAction';

/** The organiser link is shown exactly once; losing it means falling back to the recovery secret. */
export function CreatedPanel({ created }: { created: Created }) {
  const u = new URL(created.adminUrl);
  return (
    <section className="card stack" aria-labelledby="cr-h">
      <h1 id="cr-h">Your event is ready</h1>
      <p className="warning" role="note">
        <strong>Save this link — it is the only way to control the event.</strong> It is shown once
        and is not stored anywhere we can show you again.
      </p>
      <p className="mono">{created.adminUrl}</p>
      <div className="row">
        <Link className="btn primary" to={`${u.pathname}${u.hash}`}>
          Open organiser page
        </Link>
      </div>
      <details>
        <summary>Recovery secret</summary>
        <p className="muted">
          If you lose the link, this secret restores access. Keep it somewhere private and separate
          from the link.
        </p>
        <p className="mono">{created.recoverySecret}</p>
      </details>
      <p className="muted">
        {created.seeded ? `${created.seeded} songs from your playlist are queued. ` : ''}
        Guests join by scanning the QR code on your organiser page.
      </p>
    </section>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Oven-timer style: hours (0–8) and minutes in steps of ten, never more than eight hours. */
function TimerPicker({ minutes, onChange }: { minutes: number; onChange: (m: number) => void }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const clampTotal = (total: number) =>
    Math.min(EVENT_LIMITS.maxDurationMin, Math.max(EVENT_LIMITS.minDurationMin, total));
  return (
    <fieldset className="timer-picker">
      <legend>Planned time</legend>
      <div className="timer-display" role="status" aria-live="polite">
        {h}
        <small> h </small>
        {pad(m)}
        <small> min</small>
      </div>
      <div className="timer-buttons">
        <div className="row">
          <button
            type="button"
            className="btn"
            aria-label="Fewer hours"
            onClick={() => onChange(clampTotal(minutes - 60))}
            disabled={minutes - 60 < EVENT_LIMITS.minDurationMin}
          >
            − hour
          </button>
          <button
            type="button"
            className="btn"
            aria-label="More hours"
            onClick={() => onChange(clampTotal(minutes + 60))}
            disabled={minutes + 60 > EVENT_LIMITS.maxDurationMin}
          >
            + hour
          </button>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn"
            aria-label="Ten minutes less"
            onClick={() => onChange(clampTotal(minutes - 10))}
            disabled={minutes - 10 < EVENT_LIMITS.minDurationMin}
          >
            − 10 min
          </button>
          <button
            type="button"
            className="btn"
            aria-label="Ten minutes more"
            onClick={() => onChange(clampTotal(minutes + 10))}
            disabled={minutes + 10 > EVENT_LIMITS.maxDurationMin}
          >
            + 10 min
          </button>
        </div>
      </div>
    </fieldset>
  );
}

export default function CreateEvent() {
  const loc = useLocation();
  const [name, setName] = useState('');
  const [planned, setPlanned] = useState(120);
  const [styles, setStyles] = useState<Set<StyleId>>(new Set(DEFAULT_ENABLED_STYLES));
  const [master, setMaster] = useState<number>(RULE_DEFAULTS.masterRunCap);
  const [useRatio, setUseRatio] = useState(false);
  const [ratio, setRatio] = useState<Partial<Record<GenreId, number>>>({});
  const [limit, setLimit] = useState(String(RULE_DEFAULTS.submissionLimit));
  const [breaks, setBreaks] = useState<number[]>([]);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistStyle, setPlaylistStyle] = useState<StyleId | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  if (created) return <CreatedPanel created={created} />;

  const enabled = STYLE_PRESETS.filter((s) => styles.has(s.id)).map((s) => s.id);
  const genres = genresOf(enabled);
  const single = genres.length === 1;
  const parts = genres.map((g) => ratio[g] ?? master);
  const ratioIssue = useRatio ? ratioProblem(parts) : null;
  const breakIssue = validateBreaks(planned, breaks);
  const pStyle = playlistStyle && styles.has(playlistStyle) ? playlistStyle : (enabled[0] ?? '');
  const ready = name.trim() !== '' && enabled.length >= 1 && !ratioIssue && !breakIssue && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      setCreated(
        await adminApi.create({
          name: name.trim(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          enabledStyles: enabled,
          masterRunCap: master,
          ...(useRatio
            ? { ratio: Object.fromEntries(genres.map((g) => [g, ratio[g] ?? master])) }
            : {}),
          submissionLimit: Math.min(
            20,
            Math.max(1, Math.round(Number(limit)) || RULE_DEFAULTS.submissionLimit),
          ),
          plannedDurationMin: planned,
          ...(breaks.length
            ? { breaks: breaks.map((m) => ({ label: `${m}-minute break`, durationSec: m * 60 })) }
            : {}),
          ...(playlistUrl.trim() && pStyle
            ? { playlist: { url: playlistUrl.trim(), style: pStyle } }
            : {}),
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally {
      setBusy(false);
    }
  }

  const slots = breakSlots(planned, breaks);

  return (
    <form className="card stack" onSubmit={(e) => void submit(e)} noValidate>
      <h1>Create an event</h1>
      <div>
        <label htmlFor="ev-name">Event name</label>
        <input id="ev-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>

      <TimerPicker minutes={planned} onChange={setPlanned} />

      <fieldset className="chips">
        <legend>Dance styles</legend>
        {STYLE_PRESETS.map((s) => (
          <label key={s.id} className={`chip${styles.has(s.id) ? ' on' : ''}`}>
            <input
              type="checkbox"
              checked={styles.has(s.id)}
              onChange={(e) =>
                setStyles((cur) => {
                  const n = new Set(cur);
                  if (e.target.checked) n.add(s.id);
                  else n.delete(s.id);
                  return n;
                })
              }
            />
            {s.label}
          </label>
        ))}
        <p className="muted small">
          Salsa and its non-Latin-compatible style count as one genre; so do bachata and cha-cha
          with theirs. Choosing one genre changes the spacing rule: someone plays again only after
          half of the other people’s waiting songs have played.
        </p>
      </fieldset>

      <div>
        <label htmlFor="ev-master">Most songs in a row, per genre</label>
        <input
          id="ev-master"
          type="number"
          min={1}
          max={RULE_DEFAULTS.maxRunCap}
          value={master}
          onChange={(e) =>
            setMaster(
              Math.min(
                RULE_DEFAULTS.maxRunCap,
                Math.max(1, Math.round(Number(e.target.value)) || 1),
              ),
            )
          }
        />
      </div>

      {!single ? (
        <details>
          <summary>Advanced: set a ratio between genres</summary>
          <label className="check">
            <input
              type="checkbox"
              checked={useRatio}
              onChange={(e) => setUseRatio(e.target.checked)}
            />
            <span>Use a ratio instead of one number</span>
          </label>
          {useRatio ? (
            <div className="row">
              {GENRES.filter((g) => genres.includes(g.id)).map((g) => (
                <div key={g.id}>
                  <label htmlFor={`ratio-${g.id}`}>{g.label}</label>
                  <select
                    id={`ratio-${g.id}`}
                    value={ratio[g.id] ?? master}
                    onChange={(e) => setRatio({ ...ratio, [g.id]: Number(e.target.value) })}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ) : null}
          <p className="muted small">
            Ratio {parts.join(':')}. Parts go up to 5, and no genre may get less than 1 part in{' '}
            {RULE_DEFAULTS.minGenreShareOf}.
          </p>
          {ratioIssue ? (
            <p className="error" role="alert">
              {ratioIssue}
            </p>
          ) : null}
        </details>
      ) : null}

      <div>
        <label htmlFor="ev-limit">Accepted songs per person</label>
        <input
          id="ev-limit"
          type="number"
          min={1}
          max={20}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
      </div>

      <fieldset>
        <legend>Breaks (optional)</legend>
        <p className="muted small">
          Breaks sit on the midpoint of the planned time (several are spread evenly) and take at
          most half of it. Songs only start if they can finish before a break.
        </p>
        <div className="timeline" aria-hidden="true">
          {slots.map((s, i) => (
            <span
              key={i}
              className="timeline-break"
              style={{
                left: `${(s.startMin / planned) * 100}%`,
                width: `${(s.durationMin / planned) * 100}%`,
              }}
            />
          ))}
        </div>
        <ul className="list">
          {breaks.map((b, i) => (
            <li key={i}>
              <span className="title">
                {b} min, from {Math.round(slots[i]!.startMin)} to{' '}
                {Math.round(slots[i]!.startMin + b)} min
              </span>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setBreaks(breaks.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="row">
          {[10, 20, 30].map((m) => (
            <button
              key={m}
              type="button"
              className="btn"
              disabled={breaks.length >= EVENT_LIMITS.maxBreaks}
              onClick={() => setBreaks([...breaks, m])}
            >
              Add {m}-minute break
            </button>
          ))}
        </div>
        {breakIssue ? (
          <p className="error" role="alert">
            {breakIssue}
          </p>
        ) : null}
      </fieldset>

      <details id="playlist" open={loc.hash === '#playlist' || undefined}>
        <summary>Start from a playlist (optional)</summary>
        <p className="muted small">
          Paste a public Spotify, YouTube Music, YouTube or Apple Music playlist link. Its songs are
          queued in order, up to one minute less than the planned time. Public pages show only the
          first part of long playlists.
        </p>
        <label htmlFor="pl-url">Playlist link</label>
        <input
          id="pl-url"
          type="url"
          inputMode="url"
          value={playlistUrl}
          onChange={(e) => setPlaylistUrl(e.target.value)}
        />
        <label htmlFor="pl-style">Count these songs as</label>
        <select
          id="pl-style"
          value={pStyle}
          onChange={(e) => setPlaylistStyle(e.target.value as StyleId)}
        >
          {enabled.map((s) => (
            <option key={s} value={s}>
              {STYLE_PRESETS.find((p) => p.id === s)!.label} ({genreOf(s)})
            </option>
          ))}
        </select>
      </details>

      <ErrorLine error={error} />
      <button type="submit" className="btn primary" disabled={!ready}>
        {busy ? 'Creating…' : 'Create event'}
      </button>
    </form>
  );
}
