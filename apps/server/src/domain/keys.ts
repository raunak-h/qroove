const VERSION_TAGS: Array<[RegExp, string]> = [
  [/\bremix\b/, 'remix'],
  [/\blive\b|\ben vivo\b/, 'live'],
  [/\bacoustic\b/, 'acoustic'],
  [/\bradio edit\b/, 'radio'],
  [/\bextended\b/, 'extended'],
  [/\bversion\b/, 'version'],
];

/** NFKD, lowercase, strip diacritics, "feat." clauses, brackets and punctuation. */
export function norm(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[([](?:feat\.?|ft\.?|featuring)[^)\]]*[)\]]/g, ' ')
    .replace(/\s(?:feat\.?|ft\.?|featuring)\s.*$/, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function versionTag(title: string): string {
  const t = title.toLowerCase();
  const tags = VERSION_TAGS.filter(([re]) => re.test(t)).map(([, tag]) => tag);
  return tags.length ? tags.sort().join('+') : 'studio';
}

/** Title with version words removed, so "Song (Live)" and "Song" share a loose key. */
function baseTitle(title: string): string {
  return norm(title)
    .replace(
      /\b(remix|live|en vivo|acoustic|radio edit|extended|version|remastered|remaster)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/** Exact fingerprint: same artist, title and version tag. */
export const fingerprint = (title: string, artist: string | null) =>
  `fp:${norm(artist ?? '')}|${norm(title)}|${versionTag(title)}`;

/** Looser identity that ignores the version tag; a hit alone means "needs review". */
export const looseKey = (title: string, artist: string | null) =>
  `loose:${norm(artist ?? '')}|${baseTitle(title)}`;

/** Identity for a manually entered or imported recording (no provider id to anchor on). */
export const manualKey = fingerprint;
