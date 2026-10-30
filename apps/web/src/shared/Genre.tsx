import {
  GENRE_COLOURS,
  GENRES,
  STYLE_PRESETS,
  genreOf,
  isNonLatin,
  type GenreId,
  type StyleId,
} from '@qroove/config';

export const styleName = (id: string) => STYLE_PRESETS.find((s) => s.id === id)?.label ?? id;
const ROWS: Array<[StyleId, StyleId]> = [
  ['salsa', 'salsa_nl'],
  ['bachata', 'bachata_nl'],
  ['chacha', 'chacha_nl'],
];
/** A selector box: the style's name inside, its colour scheme as a thick border (striped for non-Latin). */
export const styleBoxClass = (id: StyleId) => `style-box${isNonLatin(id) ? ' striped' : ''}`;
export const styleBoxVars = (id: StyleId) => ({ ['--c' as string]: GENRE_COLOURS[genreOf(id)] });

const known = (id: string): id is StyleId => STYLE_PRESETS.some((s) => s.id === id);

/**
 * The colour code for a style: red salsa, black bachata, orange cha-cha, grey other. Non-Latin
 * styles share their genre's colour with white diagonal stripes. Always drawn with a thin white
 * outline so no colour can vanish into the background.
 */
export function GenreSwatch({
  style,
  size = 20,
  label = true,
}: {
  style: string;
  size?: number;
  /** Expose the style name to screen readers and as a tooltip. */
  label?: boolean;
}) {
  if (!known(style)) return <span>{style}</span>;
  const name = styleName(style);
  return (
    <span
      className={`swatch${isNonLatin(style) ? ' striped' : ''}`}
      style={{ ['--c' as string]: GENRE_COLOURS[genreOf(style)], width: size, height: size }}
      {...(label ? { role: 'img', 'aria-label': name, title: name } : { 'aria-hidden': true })}
    />
  );
}

/** A genre (not a style): used for ratio drums and run indicators. */
export function GenreDot({ genre, size = 20 }: { genre: GenreId; size?: number }) {
  const name = GENRES.find((g) => g.id === genre)?.label ?? genre;
  return (
    <span
      className="swatch"
      role="img"
      aria-label={name}
      title={name}
      style={{ ['--c' as string]: GENRE_COLOURS[genre], width: size, height: size }}
    />
  );
}

/** Swatches for a set of styles, e.g. a segment of the evening. */
export function StyleSwatches({
  styles,
  size = 16,
}: {
  styles: readonly StyleId[];
  size?: number;
}) {
  return (
    <span className="swatches">
      {STYLE_PRESETS.filter((s) => styles.includes(s.id)).map((s) => (
        <GenreSwatch key={s.id} style={s.id} size={size} />
      ))}
    </span>
  );
}

/**
 * Pick styles by tapping swatches. Latin styles are one column on the left, their non-Latin
 * counterparts directly across on the right; "Other" sits underneath.
 */
export function StyleGrid({
  value,
  onChange,
  label = 'Dance styles',
}: {
  value: ReadonlySet<StyleId>;
  onChange: (next: Set<StyleId>) => void;
  label?: string;
}) {
  const toggle = (id: StyleId) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const cell = (id: StyleId) => (
    <button
      key={id}
      type="button"
      role="checkbox"
      aria-checked={value.has(id)}
      className={`${styleBoxClass(id)}${value.has(id) ? ' on' : ''}`}
      style={styleBoxVars(id)}
      onClick={() => toggle(id)}
    >
      {styleName(id)}
    </button>
  );
  return (
    <div role="group" aria-label={label} className="style-grid">
      {ROWS.map(([a, b]) => [cell(a), cell(b)])}
      <div className="style-other">{cell('other')}</div>
    </div>
  );
}
