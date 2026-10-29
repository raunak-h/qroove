import type { StyleId } from '@qroove/contracts';

const CUES: Array<[RegExp, StyleId]> = [
  [/\bbachata\b/i, 'bachata'],
  [/\bsalsa\b/i, 'salsa'],
  [/\bcha[\s-]?cha(?:[\s-]?ch[aá])?\b/i, 'chacha'],
  [/\bkizomba\b/i, 'kizomba'],
  [/\bmerengue\b/i, 'merengue'],
];

/**
 * A suggestion only, from explicit words in the title. Exactly one distinct cue is required, and
 * genres from catalogues or audio are never used: the attendee's choice is authoritative.
 */
export function suggestStyle(title: string): StyleId | null {
  const hits = CUES.filter(([re]) => re.test(title)).map(([, s]) => s);
  return hits.length === 1 ? hits[0]! : null;
}
