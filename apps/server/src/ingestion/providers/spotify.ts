import { z } from 'zod';
import { DomainError } from '@qroove/contracts';
import { fetchJson, type FetchLike } from '../fetch.js';
import type { ParsedLink } from '../parseLink.js';
import type { PlaylistTrack } from '../playlist.js';
import type { MetadataProvider, TrackMetadata } from '../types.js';

const Token = z.object({ access_token: z.string(), expires_in: z.number() });
const Track = z.object({
  id: z.string(),
  name: z.string(),
  duration_ms: z.number().int().nullable().optional(),
  artists: z.array(z.object({ name: z.string() })),
  album: z
    .object({ name: z.string(), images: z.array(z.object({ url: z.string() })).optional() })
    .optional(),
  external_ids: z.object({ isrc: z.string().optional() }).optional(),
});

/** Client-credentials Web API lookup. The token is cached until shortly before it expires. */
export class SpotifyApiProvider implements MetadataProvider {
  readonly name = 'spotify-api';
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly doFetch: FetchLike,
    private readonly creds: { id: string; secret: string },
    private readonly now: () => number,
  ) {}

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now()) return this.token.value;
    const basic = Buffer.from(`${this.creds.id}:${this.creds.secret}`).toString('base64');
    const raw = await fetchJson(this.doFetch, 'https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        authorization: `Basic ${basic}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const t = Token.safeParse(raw);
    if (!t.success) throw new DomainError('METADATA_UNAVAILABLE');
    this.token = {
      value: t.data.access_token,
      expiresAt: this.now() + (t.data.expires_in - 60) * 1000,
    };
    return this.token.value;
  }

  async lookup(link: ParsedLink): Promise<TrackMetadata> {
    const token = await this.accessToken();
    const raw = await fetchJson(this.doFetch, `https://api.spotify.com/v1/tracks/${link.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const t = Track.safeParse(raw);
    if (!t.success) throw new DomainError('METADATA_UNAVAILABLE');
    return {
      source: 'spotify',
      externalId: t.data.id,
      title: t.data.name,
      artists: t.data.artists.map((a) => a.name),
      album: t.data.album?.name ?? null,
      durationMs: t.data.duration_ms ?? null,
      isrc: t.data.external_ids?.isrc?.toUpperCase() ?? null,
      artworkUrl: t.data.album?.images?.[0]?.url ?? null,
      confidence: 'high',
    };
  }

  /** Song search with the app's own credentials, so guests need no Spotify login. */
  async search(q: string): Promise<PlaylistTrack[]> {
    const token = await this.accessToken();
    const query = new URLSearchParams({ q, type: 'track', limit: '10' });
    const raw = await fetchJson(this.doFetch, `https://api.spotify.com/v1/search?${query}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const r = SearchResult.safeParse(raw);
    if (!r.success) throw new DomainError('METADATA_UNAVAILABLE');
    return r.data.tracks.items.map(songFromTrack);
  }
}

const SearchResult = z.object({ tracks: z.object({ items: z.array(Track) }) });

export const songFromTrack = (t: {
  id: string;
  name: string;
  duration_ms?: number | null | undefined;
  artists: Array<{ name: string }>;
}): PlaylistTrack => ({
  title: t.name.slice(0, 200),
  artist:
    t.artists
      .map((a) => a.name)
      .join(', ')
      .slice(0, 200) || null,
  durationMs: t.duration_ms ?? null,
  sourceUrl: `https://open.spotify.com/track/${t.id}`,
});
