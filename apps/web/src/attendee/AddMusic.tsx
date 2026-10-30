import { GENRES, STYLE_PRESETS, type GenreId } from '@qroove/config';
import { allowedStyles, type EventPublicView } from '@qroove/contracts';
import { useCallback, useState } from 'react';
import { api, ApiError, type Creds, type PlaylistSong } from '../shared/api';
import { styleBoxClass, styleBoxVars } from '../shared/Genre';
import { PlaylistInput } from '../shared/PlaylistInput';
import { SongList, type ListSong } from '../shared/SongList';

let counter = 0;
const toList = (tracks: readonly PlaylistSong[]): ListSong[] =>
  tracks.map((t) => ({ ...t, id: `p${++counter}` }));

/** "Other (Musicality Exercise)" -> "OTHER". */
const shout = (label: string) => label.split(' (')[0]!.toUpperCase();

/** "You selected SALSA. Remove all BACHATA, CHA-CHA, OTHER songs." */
export function genreAdvice(genre: GenreId): string {
  const label = (id: GenreId) => shout(GENRES.find((g) => g.id === id)!.label);
  const others = GENRES.filter((g) => g.id !== genre).map((g) => label(g.id));
  return `You selected ${label(genre)}. Remove all ${others.join(', ')} songs.`;
}

/**
 * The one place to add music: paste a playlist or song link, pick its genre, sort the songs (drag,
 * swipe left to remove, swipe right to send to the top), then add. Title, artist and length come from
 * the link. Only as many as the person has left can be added, so the rest are greyed out.
 */
export function AddMusic({
  view,
  eventId,
  creds,
  remaining,
  onAdded,
}: {
  view: EventPublicView;
  eventId: string;
  creds: Creds;
  /** How many more songs this person may still add. */
  remaining: number;
  onAdded: () => void;
}) {
  const allowed = view.rules ? allowedStyles(view.rules) : null;
  const styles = STYLE_PRESETS.filter((s) => !allowed || allowed.includes(s.id));
  const genres = GENRES.filter((g) => styles.some((s) => s.genre === g.id));
  const [url, setUrl] = useState('');
  const [songs, setSongs] = useState<ListSong[]>([]);
  const [picked, setPicked] = useState<GenreId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // Must stay stable: PlaylistInput reports tracks from an effect keyed on this function.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- only uses stable setters
  const onTracks = useCallback((_id: string, tracks: PlaylistSong[]) => {
    setSongs(toList(tracks));
    // Clearing the field after adding must not wipe the "added" message; loading a new list does.
    if (tracks.length > 0) {
      setDone(null);
      setError(null);
    }
  }, []);

  const genre = picked ?? (genres.length === 1 ? genres[0]!.id : null);
  // Songs are sent under the first style the event allows in that genre.
  const style = styles.find((s) => s.genre === genre)?.id ?? null;
  const take = Math.min(remaining, songs.length);

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text.trim());
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

  async function add() {
    if (!style || take === 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.submitBatch(
        eventId,
        creds,
        {
          style,
          songs: songs.slice(0, take).map(({ title, artist, durationMs, sourceUrl }) => ({
            title,
            artist,
            durationMs,
            sourceUrl,
          })),
        },
        crypto.randomUUID(),
      );
      const dup = r.results.filter((x) => x.status === 'DUPLICATE').length;
      setDone(`${r.accepted} added${dup ? `, ${dup} already queued` : ''}.`);
      setUrl('');
      setSongs([]);
      setPicked(null);
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack" aria-labelledby="am-h">
      <h2 id="am-h">Add music</h2>
      <p className="muted small">
        Paste a link to a playlist or a song from Spotify. Long-press the box to paste, or use the
        button.
      </p>
      <div className="row">
        <PlaylistInput
          id="music"
          value={url}
          onChange={setUrl}
          onTracks={onTracks}
          label="Playlist or song link"
          placeholder="Spotify link"
        />
        <button type="button" className="btn" onClick={() => void paste()}>
          Paste
        </button>
      </div>
      <fieldset className="chips">
        <legend>Which genre is this?</legend>
        {genres.map((g) => {
          const id = styles.find((s) => s.genre === g.id)!.id;
          return (
            <label
              key={g.id}
              className={`${styleBoxClass(id)}${genre === g.id ? ' on' : ''}`}
              style={styleBoxVars(id)}
            >
              <input
                type="radio"
                name="music-genre"
                value={g.id}
                checked={genre === g.id}
                onChange={() => setPicked(g.id)}
              />
              {g.label}
            </label>
          );
        })}
      </fieldset>
      {songs.length > 0 ? (
        <>
          {genre ? (
            <p className="warning" role="status">
              {genreAdvice(genre)}
            </p>
          ) : null}
          <SongList songs={songs} onChange={setSongs} activeCount={take} label="Songs to add" />
          {remaining === 0 ? (
            <p className="muted">
              You have used all your songs for this event. Withdraw one that has not started to add
              another.
            </p>
          ) : null}
          <button
            type="button"
            className="btn primary"
            disabled={busy || take === 0 || !style}
            onClick={() => void add()}
          >
            {busy ? '…' : genre ? `Add ${take}` : 'Choose a genre first'}
          </button>
        </>
      ) : null}
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
    </section>
  );
}
