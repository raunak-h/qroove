import { allowedStyles, type EventPublicView, type StyleId } from '@qroove/contracts';
import { STYLE_PRESETS } from '@qroove/config';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, type Creds, type ResolvedLink } from '../shared/api';
import { styleBoxClass, styleBoxVars } from '../shared/Genre';
import { parseDuration } from '../shared/time';

const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());

export function AddSong({
  view,
  eventId,
  creds,
  full,
  onAdded,
}: {
  view: EventPublicView;
  eventId: string;
  creds: Creds;
  full: boolean;
  onAdded: () => void;
}) {
  const allowed = view.rules ? allowedStyles(view.rules) : null;
  const styles = STYLE_PRESETS.filter((s) => !allowed || allowed.includes(s.id));
  const [input, setInput] = useState('');
  const [style, setStyle] = useState<StyleId | null>(null);
  // Lookup results are keyed by the input they answer, so stale ones are ignored without resets.
  const [lookup, setLookup] = useState<{
    input: string;
    preview: ResolvedLink | null;
    error: ApiError | null;
  } | null>(null);
  const current = lookup?.input === input ? lookup : null;
  const preview = current?.preview ?? null;
  const lookupError = current?.error ?? null;
  const [artist, setArtist] = useState('');
  const [duration, setDuration] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const attempt = useRef<string | null>(null);

  const url = isUrl(input);
  const manual = !url || lookupError !== null;

  // Debounced, side-effect-free link preview.
  useEffect(() => {
    if (!isUrl(input)) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      api
        .resolveLink(input.trim(), ctl.signal)
        .then((r) => {
          setLookup({ input, preview: r, error: null });
          setStyle((cur) => cur ?? r.suggestedStyle);
        })
        .catch((e: unknown) => {
          if (e instanceof ApiError) setLookup({ input, preview: null, error: e });
        });
    }, 500);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [input]);

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setInput(text.trim());
    } catch {
      setError(
        new ApiError(
          'PASTE',
          'We could not read your clipboard.',
          'Long-press the box and choose Paste.',
          0,
        ),
      );
    }
  }

  const durationMs = parseDuration(duration);
  const ready =
    !busy &&
    !full &&
    style !== null &&
    input.trim() !== '' &&
    durationMs !== null &&
    (manual || preview !== null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || !style) return;
    setBusy(true);
    setError(null);
    setDone(null);
    attempt.current ??= crypto.randomUUID();
    try {
      const body =
        url && !lookupError
          ? { style, url: input.trim() }
          : {
              style,
              manual: {
                title: url ? (preview?.title ?? input.trim()) : input.trim(),
                ...(artist.trim() ? { artist: artist.trim() } : {}),
                ...(durationMs ? { durationMs } : {}),
              },
            };
      const r = await api.submit(eventId, creds, body, attempt.current);
      setDone(
        `Added “${r.request.title}”.${r.request.statusText ? ` ${r.request.statusText}.` : ''}`,
      );
      setInput('');
      setArtist('');
      setDuration('');
      setStyle(null);
      attempt.current = null;
      onAdded();
    } catch (err) {
      // A definitive server answer ends this attempt; a network failure keeps the key for a safe retry.
      if (err instanceof ApiError && err.status !== 0) attempt.current = null;
      setError(err instanceof ApiError ? err : null);
    } finally {
      setBusy(false);
    }
  }

  if (view.state === 'ENDED' || view.state === 'ARCHIVED') return null;

  return (
    <section className="card" aria-labelledby="as-h">
      <h2 id="as-h">Add a song</h2>
      {full ? (
        <p className="muted">
          You have used all your songs for this event. Withdraw one that has not started to add
          another.
        </p>
      ) : null}
      <form onSubmit={(e) => void submit(e)} noValidate>
        <label htmlFor="song-input">
          Paste a Spotify, YouTube or Apple Music link, or type the title
        </label>
        <div className="row">
          <input
            id="song-input"
            value={input}
            onChange={(e) => {
              attempt.current = null;
              setInput(e.target.value);
            }}
            autoComplete="off"
            inputMode="url"
            maxLength={500}
            disabled={full}
          />
          <button type="button" className="btn" onClick={() => void paste()} disabled={full}>
            Paste
          </button>
        </div>

        {preview ? (
          <p className="preview" aria-live="polite">
            <strong>{preview.title}</strong>
            {preview.artist ? ` — ${preview.artist}` : ''}
            {preview.confidence === 'low' ? (
              <span className="muted small">
                {' '}
                We could only read the title; check it is the right song.
              </span>
            ) : null}
          </p>
        ) : null}
        {lookupError ? (
          <p className="error" role="alert">
            {lookupError.message} {lookupError.action}
          </p>
        ) : null}

        {manual && input.trim() !== '' ? (
          <div className="grid2">
            <div>
              <label htmlFor="song-artist">Artist (optional)</label>
              <input
                id="song-artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                maxLength={120}
              />
            </div>
            <div>
              <label htmlFor="song-dur">Length (optional, m:ss)</label>
              <input
                id="song-dur"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                inputMode="numeric"
                aria-invalid={durationMs === null}
                placeholder="3:45"
              />
            </div>
          </div>
        ) : null}

        <fieldset className="chips">
          <legend className="sr-only">Dance style</legend>
          {styles.map((s) => (
            <label
              key={s.id}
              className={`${styleBoxClass(s.id)}${style === s.id ? ' on' : ''}`}
              style={styleBoxVars(s.id)}
            >
              <input
                type="radio"
                name="style"
                value={s.id}
                checked={style === s.id}
                onChange={() => setStyle(s.id)}
              />
              {s.label}
            </label>
          ))}
        </fieldset>

        {error ? (
          <p className="error" role="alert">
            {error.message} {error.action}
          </p>
        ) : null}
        {done ? (
          <p className="ok" role="status">
            {done}
          </p>
        ) : null}
        <button type="submit" className="btn primary" disabled={!ready}>
          {busy ? 'Adding…' : 'Add to queue'}
        </button>
      </form>
    </section>
  );
}
