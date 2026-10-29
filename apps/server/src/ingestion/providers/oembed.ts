import { z } from 'zod';
import { DomainError } from '@qroove/contracts';
import { fetchJson, type FetchLike } from '../fetch.js';
import type { ParsedLink } from '../parseLink.js';
import type { MetadataProvider, TrackMetadata } from '../types.js';

const OEmbed = z.object({
  title: z.string(),
  author_name: z.string().optional(),
  thumbnail_url: z.string().optional(),
});

/** "Artist - Title" is a convention, not a guarantee, so a split is only low confidence. */
export function splitYoutubeTitle(title: string, channel: string | undefined) {
  const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(title);
  if (m) return { artist: m[1]!.trim(), title: m[2]!.trim() };
  return { artist: channel?.replace(/\s*-\s*Topic$/i, '').trim() || null, title };
}

/** Keyless fallbacks: Spotify oEmbed (title only) and YouTube oEmbed. */
export class OEmbedProvider implements MetadataProvider {
  readonly name = 'oembed';
  constructor(private readonly doFetch: FetchLike) {}

  async lookup(link: ParsedLink): Promise<TrackMetadata> {
    const base =
      link.platform === 'spotify'
        ? 'https://open.spotify.com/oembed'
        : link.platform === 'youtube'
          ? 'https://www.youtube.com/oembed'
          : null;
    if (!base) throw new DomainError('METADATA_UNAVAILABLE');
    const q = new URLSearchParams({ url: link.canonicalUrl, format: 'json' });
    const parsed = OEmbed.safeParse(await fetchJson(this.doFetch, `${base}?${q}`));
    if (!parsed.success) throw new DomainError('METADATA_UNAVAILABLE');
    const o = parsed.data;
    if (link.platform === 'spotify') {
      return {
        source: 'spotify',
        externalId: link.id,
        title: o.title,
        artists: [],
        album: null,
        durationMs: null,
        isrc: null,
        artworkUrl: o.thumbnail_url ?? null,
        confidence: 'low',
      };
    }
    const s = splitYoutubeTitle(o.title, o.author_name);
    return {
      source: 'youtube',
      externalId: link.id,
      title: s.title,
      artists: s.artist ? [s.artist] : [],
      album: null,
      durationMs: null,
      isrc: null,
      artworkUrl: o.thumbnail_url ?? null,
      confidence: 'low',
    };
  }
}
