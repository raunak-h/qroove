import { useEffect, useState } from 'react';
import { api, ApiError, type PlaylistSong } from './api';

export type PlaylistState =
  | { status: 'idle' | 'loading'; tracks: PlaylistSong[]; error: null }
  | { status: 'ready'; tracks: PlaylistSong[]; error: null }
  | { status: 'error'; tracks: PlaylistSong[]; error: ApiError | null };

const EMPTY: PlaylistSong[] = [];
const IDLE: PlaylistState = { status: 'idle', tracks: EMPTY, error: null };
const LOADING: PlaylistState = { status: 'loading', tracks: EMPTY, error: null };
const looksLikeLink = (u: string) => /^https?:\/\/\S+$/i.test(u.trim());

/** Loads a public playlist link once it has stopped changing (so pasting loads it straight away). */
export function usePlaylist(url: string): PlaylistState {
  const link = url.trim();
  const [done, setDone] = useState<{ link: string; state: PlaylistState } | null>(null);
  useEffect(() => {
    if (!looksLikeLink(link)) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      api
        .resolvePlaylist(link, ctl.signal)
        .then((r) => setDone({ link, state: { status: 'ready', tracks: r.tracks, error: null } }))
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          setDone({
            link,
            state: { status: 'error', tracks: EMPTY, error: e instanceof ApiError ? e : null },
          });
        });
    }, 400);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [link]);
  if (!looksLikeLink(link)) return IDLE;
  if (done?.link === link) return done.state;
  return LOADING;
}
