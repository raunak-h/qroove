import type { Provider } from '@qroove/contracts';
import type { ParsedLink } from './parseLink.js';

/** SPEC §5 adapter output. */
export interface TrackMetadata {
  source: Provider;
  externalId: string;
  title: string;
  artists: string[];
  album: string | null;
  durationMs: number | null;
  isrc: string | null;
  artworkUrl: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface MetadataProvider {
  readonly name: string;
  lookup(link: ParsedLink): Promise<TrackMetadata>;
}
