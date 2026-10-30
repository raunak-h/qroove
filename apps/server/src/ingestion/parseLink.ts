import { DomainError } from '@qroove/contracts';

export type Platform = 'spotify' | 'apple' | 'youtube';

export interface ParsedLink {
  platform: Platform;
  id: string;
  /** Rebuilt from the id alone: no tracking parameters, safe to hand to oEmbed. */
  canonicalUrl: string;
}

const SPOTIFY_HOSTS = new Set(['open.spotify.com']);
const APPLE_HOSTS = new Set(['music.apple.com', 'geo.music.apple.com']);
const YOUTUBE_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'music.youtube.com',
  'm.youtube.com',
]);

const unsupported = (msg?: string) => new DomainError('UNSUPPORTED_LINK', msg);

/**
 * Pure: never fetches. Accepts only allowlisted hosts over http(s) and extracts a platform id;
 * everything else (including `spotify.link` short links, which need a redirect) is refused.
 */
export function parseLink(raw: string): ParsedLink {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw unsupported();
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw unsupported();
  if (u.username || u.password) throw unsupported();
  const host = u.hostname.toLowerCase();

  if (host === 'spotify.link' || host === 'spotify.app.link') {
    throw unsupported(
      'Short Spotify links cannot be followed. Open the song in Spotify and copy its full link.',
    );
  }
  if (SPOTIFY_HOSTS.has(host)) {
    const m = /^\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})\/?$/.exec(u.pathname);
    if (!m) throw unsupported('Paste a link to a single Spotify song.');
    return {
      platform: 'spotify',
      id: m[1]!,
      canonicalUrl: `https://open.spotify.com/track/${m[1]}`,
    };
  }
  if (APPLE_HOSTS.has(host)) {
    const song = u.searchParams.get('i');
    const m = /^\/[a-z]{2}\/song\/(?:[^/]+\/)?(\d{5,})\/?$/.exec(u.pathname);
    const id = song && /^\d{5,}$/.test(song) ? song : m?.[1];
    if (!id) throw unsupported('Paste a Spotify link to a playlist or a song.');
    return { platform: 'apple', id, canonicalUrl: `https://music.apple.com/song/${id}` };
  }
  if (host === 'youtu.be') {
    const m = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(u.pathname);
    if (!m) throw unsupported();
    return youtube(m[1]!);
  }
  if (YOUTUBE_HOSTS.has(host)) {
    const v = u.pathname === '/watch' ? u.searchParams.get('v') : null;
    if (!v || !/^[A-Za-z0-9_-]{11}$/.test(v))
      throw unsupported('Paste a Spotify link to a playlist or a song.');
    return youtube(v);
  }
  throw unsupported();
}

const youtube = (id: string): ParsedLink => ({
  platform: 'youtube',
  id,
  canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
});

/** A client-supplied source link, kept only if it is a supported song link (never an arbitrary URL). */
export function safeSourceUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return parseLink(raw).canonicalUrl;
  } catch {
    return null;
  }
}
