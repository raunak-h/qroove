import { fingerprint, norm, versionTag } from '@qroove/contracts/normalise';

export interface LocalTrack {
  /** Stable id for this device's library (name + size + mtime). */
  id: string;
  file: File;
  title: string;
  artist: string | null;
}

export interface Wanted {
  title: string;
  artist: string | null;
}

/** "Artist - Title.mp3" → parts; anything else is a bare title. */
export function parseFilename(name: string): { title: string; artist: string | null } {
  const base = name
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/^\d{1,3}[\s._-]+(?=\D)/, '')
    .replace(/_/g, ' ')
    .trim();
  const i = base.indexOf(' - ');
  if (i > 0) return { artist: base.slice(0, i).trim(), title: base.slice(i + 3).trim() };
  return { artist: null, title: base };
}

export const fileId = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

export function isAudio(f: File): boolean {
  return (
    f.type.startsWith('audio/') || /\.(mp3|m4a|aac|flac|wav|ogg|opus|oga|aiff?)$/i.test(f.name)
  );
}

/** Cheap first pass (filename only); tags refine it lazily. */
export function trackFromFile(f: File): LocalTrack {
  return { id: fileId(f), file: f, ...parseFilename(f.name) };
}

export type MatchKind = 'exact' | 'title-only';
export interface Match {
  track: LocalTrack;
  kind: MatchKind;
}

/**
 * Exact = same artist, title and version tag as the server's duplicate fingerprint. A file or request
 * with no artist can still match on title + version tag; the organiser sees "probable" and decides.
 */
export function findMatch(library: LocalTrack[], want: Wanted): Match | null {
  const fp = fingerprint(want.title, want.artist);
  for (const t of library)
    if (fingerprint(t.title, t.artist) === fp) return { track: t, kind: 'exact' };
  const nt = norm(want.title);
  const vt = versionTag(want.title);
  for (const t of library) {
    if (norm(t.title) !== nt || versionTag(t.title) !== vt) continue;
    if (!want.artist || !t.artist) return { track: t, kind: 'title-only' };
  }
  return null;
}

/** Reads embedded tags; `music-metadata` is loaded on demand so it never reaches the attendee bundle. */
export async function withTags(t: LocalTrack): Promise<LocalTrack> {
  try {
    const { parseBlob } = await import('music-metadata');
    const m = await parseBlob(t.file, { skipCovers: true, duration: false });
    const title = m.common.title?.trim();
    if (!title) return t;
    return { ...t, title, artist: m.common.artist?.trim() || t.artist };
  } catch {
    return t;
  }
}
