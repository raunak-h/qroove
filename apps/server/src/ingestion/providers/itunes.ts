import { z } from 'zod';
import { DomainError } from '@qroove/contracts';
import { fetchJson, type FetchLike } from '../fetch.js';
import type { ParsedLink } from '../parseLink.js';
import type { MetadataProvider, TrackMetadata } from '../types.js';

const Lookup = z.object({
  results: z.array(
    z.object({
      trackId: z.number(),
      trackName: z.string(),
      artistName: z.string(),
      collectionName: z.string().optional(),
      trackTimeMillis: z.number().int().optional(),
      artworkUrl100: z.string().optional(),
    }),
  ),
});

/** Apple Music song ids resolve through the keyless iTunes Lookup API (no ISRC available). */
export class ItunesProvider implements MetadataProvider {
  readonly name = 'itunes';
  constructor(private readonly doFetch: FetchLike) {}

  async lookup(link: ParsedLink): Promise<TrackMetadata> {
    const q = new URLSearchParams({ id: link.id, entity: 'song' });
    const parsed = Lookup.safeParse(
      await fetchJson(this.doFetch, `https://itunes.apple.com/lookup?${q}`),
    );
    const t = parsed.success ? parsed.data.results[0] : undefined;
    if (!t) throw new DomainError('METADATA_UNAVAILABLE');
    return {
      source: 'apple',
      externalId: String(t.trackId),
      title: t.trackName,
      artists: [t.artistName],
      album: t.collectionName ?? null,
      durationMs: t.trackTimeMillis ?? null,
      isrc: null,
      artworkUrl: t.artworkUrl100 ?? null,
      confidence: 'high',
    };
  }
}
