import { STYLE_PRESETS } from '@qroove/config';
import { allowedStyles, type EventPublicView, type StyleId } from '@qroove/contracts';
import { useCallback, useState } from 'react';
import { api, ApiError, type Creds, type PlaylistSong } from '../shared/api';
import { styleBoxClass, styleBoxVars } from '../shared/Genre';
import { PlaylistInput } from '../shared/PlaylistInput';
import { SongList, type ListSong } from '../shared/SongList';

let counter = 0;
const toList = (tracks: readonly PlaylistSong[]): ListSong[] =>
  tracks.map((t) => ({ ...t, id: `p${++counter}` }));

/**
 * Add a whole playlist: paste a link, sort the songs (drag, swipe left to remove, swipe right to send
 * to the top), then add. Only as many as the person has left can be added, so the rest are greyed out.
 */
export function AddPlaylist({
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
  const [url, setUrl] = useState('');
  const [songs, setSongs] = useState<ListSong[]>([]);
  const [style, setStyle] = useState<StyleId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const chosen = style ?? styles[0]?.id ?? null;
  const take = Math.min(remaining, songs.length);

  const onTracks = useCallback((_id: string, tracks: PlaylistSong[]) => {
    setSongs(toList(tracks));
    // Clearing the field after adding must not wipe the "added" message; loading a new list does.
    if (tracks.length > 0) {
      setDone(null);
      setError(null);
    }
  }, []);

  async function add() {
    if (!chosen || take === 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.submitBatch(
        eventId,
        creds,
        {
          style: chosen,
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
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="card stack">
      <summary aria-label="Add a playlist">
        <span aria-hidden="true">♫ +</span>
      </summary>
      <PlaylistInput
        id="playlist"
        value={url}
        onChange={setUrl}
        onTracks={onTracks}
        label="Playlist link (Spotify, YouTube Music, Apple Music)"
      />
      {songs.length > 0 ? (
        <>
          <SongList songs={songs} onChange={setSongs} activeCount={take} label="Playlist songs" />
          <fieldset className="chips">
            <legend className="sr-only">Dance style for these songs</legend>
            {styles.map((s) => (
              <label
                key={s.id}
                className={`${styleBoxClass(s.id)}${chosen === s.id ? ' on' : ''}`}
                style={styleBoxVars(s.id)}
              >
                <input
                  type="radio"
                  name="playlist-style"
                  value={s.id}
                  checked={chosen === s.id}
                  onChange={() => setStyle(s.id)}
                />
                {s.label}
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            className="btn primary"
            disabled={busy || take === 0}
            onClick={() => void add()}
          >
            {busy ? '…' : `Add ${take}`}
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
    </details>
  );
}
