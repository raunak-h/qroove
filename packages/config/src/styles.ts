/**
 * Dance styles. A style belongs to a genre; the scheduler counts style changes and run caps per
 * genre, so "Salsa" followed by "Non-Latin salsa-compatible" is not a change.
 */
export const STYLE_PRESETS = [
  { id: 'salsa', label: 'Salsa', genre: 'salsa' },
  { id: 'salsa_nl', label: 'Non-Latin salsa-compatible', genre: 'salsa' },
  { id: 'bachata', label: 'Bachata', genre: 'bachata' },
  { id: 'bachata_nl', label: 'Non-Latin bachata-compatible', genre: 'bachata' },
  { id: 'chacha', label: 'Cha-cha', genre: 'chacha' },
  { id: 'chacha_nl', label: 'Non-Latin cha-cha-compatible', genre: 'chacha' },
  { id: 'other', label: 'Other (Musicality Exercise)', genre: 'other' },
] as const;

export type StyleId = (typeof STYLE_PRESETS)[number]['id'];
export type GenreId = (typeof STYLE_PRESETS)[number]['genre'];

export const GENRES: ReadonlyArray<{ id: GenreId; label: string }> = [
  { id: 'salsa', label: 'Salsa' },
  { id: 'bachata', label: 'Bachata' },
  { id: 'chacha', label: 'Cha-cha' },
  { id: 'other', label: 'Other (Musicality Exercise)' },
];

export const genreOf = (style: StyleId): GenreId =>
  STYLE_PRESETS.find((s) => s.id === style)!.genre;

/** Distinct genres of a set of styles, in preset order. */
export const genresOf = (styles: readonly StyleId[]): GenreId[] =>
  GENRES.map((g) => g.id).filter((g) => styles.some((s) => genreOf(s) === g));

export const DEFAULT_ENABLED_STYLES: readonly StyleId[] = [
  'salsa',
  'salsa_nl',
  'bachata',
  'bachata_nl',
];

/**
 * Colour code (each is drawn with a thin white outline so it never disappears into the
 * background). Non-Latin styles use their genre's colour with white diagonal stripes.
 */
export const GENRE_COLOURS: Record<GenreId, string> = {
  salsa: '#d32f2f',
  bachata: '#000000',
  chacha: '#fb8c00',
  other: '#757575',
};

export const isNonLatin = (style: StyleId): boolean => style.endsWith('_nl');
