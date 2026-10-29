import { sha256 } from './ids.js';

const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

/** Identity for a manually entered or imported recording (no provider id to anchor on). */
export const manualKey = (title: string, artist: string | null) =>
  `manual:${sha256(`${norm(title)}|${norm(artist ?? '')}`).slice(0, 32)}`;
