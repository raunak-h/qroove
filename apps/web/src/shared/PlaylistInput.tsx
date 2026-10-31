import { useEffect } from 'react';
import type { StyleId } from '@qroove/config';
import { GenreSwatch } from './Genre';
import type { PlaylistSong } from './api';
import { usePlaylist } from './usePlaylist';

/**
 * One playlist link. Pasting it loads the songs (reported through `onTracks`); the same field is
 * used when an organiser starts an event and when a guest adds a playlist.
 */
export function PlaylistInput({
  id,
  value,
  onChange,
  onTracks,
  label,
  style,
  missing = false,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Tells the parent which input these songs came from (so one input can be replaced alone). */
  id: string;
  onTracks: (id: string, tracks: PlaylistSong[]) => void;
  label: string;
  style?: StyleId;
  missing?: boolean;
  placeholder?: string;
}) {
  const pl = usePlaylist(value);
  useEffect(() => {
    onTracks(id, pl.tracks);
    // `pl.tracks` is stable between loads, so this fires once per loaded (or cleared) playlist.
  }, [id, pl.tracks, onTracks]);
  return (
    <div className={`playlist-cell${missing ? ' missing' : ''}`}>
      {style ? <GenreSwatch style={style} size={22} /> : null}
      <input
        type="text"
        autoComplete="off"
        inputMode="text"
        enterKeyHint="search"
        aria-label={label}
        placeholder={placeholder}
        aria-invalid={missing || pl.status === 'error' || undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="playlist-status" role="status" aria-live="polite">
        {pl.status === 'loading' ? '…' : null}
        {pl.status === 'ready' ? pl.tracks.length : null}
        {pl.status === 'error' ? <span aria-hidden="true">!</span> : null}
      </span>
      {pl.status === 'error' ? (
        <p className="error small playlist-error" role="alert">
          {pl.error ? `${pl.error.message} ${pl.error.action}` : 'We could not read that link.'}
        </p>
      ) : null}
    </div>
  );
}
