import { RULE_DEFAULTS, STYLE_PRESETS, DEFAULT_ENABLED_STYLES } from '@qroove/config';
import type { StyleId } from '@qroove/contracts';
import { useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../shared/api';
import { CopyButton } from '../shared/widgets';
import { fromLocalInput, toLocalInput } from '../shared/time';
import { adminApi, type Created } from './adminApi';
import { ErrorLine } from './useAction';

const clamp = (v: string, lo: number, hi: number, dflt: number) => {
  const n = Math.round(Number(v));
  return v.trim() === '' || !Number.isFinite(n) ? dflt : Math.min(hi, Math.max(lo, n));
};
const defaultCap = (s: StyleId) => RULE_DEFAULTS.runCaps[s] ?? RULE_DEFAULTS.otherStyleRunCap;

/** The admin link is shown exactly once; losing it means falling back to the recovery secret. */
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
        <CopyButton text={created.adminUrl} label="Copy organiser link" />
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
        <CopyButton text={created.recoverySecret} label="Copy recovery secret" />
      </details>
      <p>
        Attendees join with code <strong className="code">{created.slug}</strong> or{' '}
        <span className="mono">{created.joinUrl}</span>.
      </p>
    </section>
  );
}

const TEMPLATES = [
  {
    label: 'Friday Social',
    make: () => {
      const d = new Date();
      d.setHours(21, 0, 0, 0);
      return {
        name: 'Friday Social',
        end: d.getTime() > Date.now() ? d.getTime() : null,
        breaks: [] as Brk[],
      };
    },
  },
  ...[10, 20].map((m) => ({
    label: `Dance break (${m} min)`,
    make: () => ({
      name: `Dance break (${m} min)`,
      end: Date.now() + m * 60_000,
      breaks: [] as Brk[],
    }),
  })),
];
type Brk = { label: string; durationSec: number };

export default function CreateEvent() {
  const [mountedAt] = useState(() => Date.now());
  const [name, setName] = useState('');
  const [end, setEnd] = useState('');
  const [breaks, setBreaks] = useState<Brk[]>([]);
  const [styles, setStyles] = useState<Set<StyleId>>(new Set(DEFAULT_ENABLED_STYLES));
  const [caps, setCaps] = useState<Partial<Record<StyleId, string>>>({});
  const [limit, setLimit] = useState(String(RULE_DEFAULTS.submissionLimit));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  if (created) return <CreatedPanel created={created} />;

  const endMs = fromLocalInput(end);
  const endBad = end !== '' && (endMs === null || endMs <= mountedAt);
  const ready = name.trim() !== '' && styles.size >= 2 && !endBad && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const enabled = STYLE_PRESETS.filter((s) => styles.has(s.id)).map((s) => s.id);
      setCreated(
        await adminApi.create({
          name: name.trim(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          enabledStyles: enabled,
          runCaps: Object.fromEntries(
            enabled.map((s) => [s, clamp(caps[s] ?? '', 1, 10, defaultCap(s))]),
          ),
          submissionLimit: clamp(limit, 1, 20, RULE_DEFAULTS.submissionLimit),
          ...(endMs ? { endAt: endMs } : {}),
          ...(breaks.length ? { breaks } : {}),
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={(e) => void submit(e)} noValidate>
      <h1>Create an event</h1>
      <fieldset className="chips">
        <legend>Start from a template</legend>
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            className="btn"
            onClick={() => {
              const v = t.make();
              setName(v.name);
              setEnd(v.end ? toLocalInput(v.end) : '');
              setBreaks(v.breaks);
            }}
          >
            {t.label}
          </button>
        ))}
      </fieldset>

      <div>
        <label htmlFor="ev-name">Event name</label>
        <input id="ev-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>
      <div>
        <label htmlFor="ev-end">Planned end time (optional, your device’s time zone)</label>
        <input
          id="ev-end"
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          aria-invalid={endBad}
        />
        {endBad ? (
          <p className="error">Pick a time in the future, or leave it blank for no fixed end.</p>
        ) : null}
      </div>

      <fieldset className="chips">
        <legend>Dance styles (at least two)</legend>
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
      </fieldset>

      <fieldset className="caps">
        <legend>Most songs in a row, per style</legend>
        {STYLE_PRESETS.filter((s) => styles.has(s.id)).map((s) => (
          <div key={s.id}>
            <label htmlFor={`cap-${s.id}`}>{s.label}</label>
            <input
              id={`cap-${s.id}`}
              type="number"
              min={1}
              max={10}
              value={caps[s.id] ?? String(defaultCap(s.id))}
              onChange={(e) => setCaps({ ...caps, [s.id]: e.target.value })}
            />
          </div>
        ))}
      </fieldset>

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
      <p className="muted">
        Spacing rule (fixed): someone cannot play twice in a row, and not again until the style has
        changed at least once. These rules are locked when you start the event.
      </p>

      <fieldset>
        <legend>Breaks (optional)</legend>
        <ul className="list">
          {breaks.map((b, i) => (
            <li key={i}>
              <span className="title">
                {b.label}, {b.durationSec / 60} min
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
          {[10, 20].map((m) => (
            <button
              key={m}
              type="button"
              className="btn"
              onClick={() =>
                setBreaks([...breaks, { label: `${m}-minute break`, durationSec: m * 60 }])
              }
            >
              Add {m}-minute break
            </button>
          ))}
        </div>
      </fieldset>

      <ErrorLine error={error} />
      <button type="submit" className="btn primary" disabled={!ready}>
        {busy ? 'Creating…' : 'Create event'}
      </button>
    </form>
  );
}
