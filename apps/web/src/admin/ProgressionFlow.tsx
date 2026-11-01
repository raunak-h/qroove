import { GENRE_COLOURS, genreOf, isNonLatin, STYLE_PRESETS } from '@qroove/config';
import { useMemo } from 'react';
import { GenreSwatch, shortGenreLabel, styleName } from '../shared/Genre';
import {
  previewRotation,
  runsOf,
  trackEstimate,
  type PartRules,
  type PlannedBreak,
} from './progression';
import { hm } from './TimelineBar';

const label = (genre: string) => shortGenreLabel(genre as Parameters<typeof shortGenreLabel>[0]);

/**
 * The planned rotation as one continuous bar, drawn from the same scheduler the live queue uses.
 * Everything that explains the colours is written out: a legend and the sequence as text, so
 * nothing depends on hovering or on telling colours apart.
 */
export function ProgressionFlow({
  plannedMin,
  breaks,
  parts,
  ratio,
}: {
  plannedMin: number;
  breaks: readonly PlannedBreak[];
  parts: readonly PartRules[];
  /** Ratio parts of the part being edited, in genre order; empty when it has no genre. */
  ratio: readonly number[];
}) {
  const songs = useMemo(
    () => previewRotation(plannedMin, breaks, parts),
    [plannedMin, breaks, parts],
  );
  const used = STYLE_PRESETS.filter((p) => parts.some((part) => part.styles.includes(p.id)));
  const musicMin = plannedMin - breaks.reduce((sum, b) => sum + b.durationMin, 0);
  const est = trackEstimate(musicMin);
  const runs = runsOf(songs);
  const pct = (m: number) => `${(m / plannedMin) * 100}%`;

  return (
    <div className="flow">
      <div className="flow-badges">
        <span className="pill mono-pill" data-testid="ratio-badge">
          Ratio: {ratio.length ? ratio.join(' : ') : 'none'}
        </span>
        <span className="pill gold-pill" data-testid="summary-badge">
          {hm(plannedMin)} total
          {used.length ? ` | about ${est.min}–${est.max} songs` : ''}
        </span>
      </div>
      <div className="flow-stamps" aria-hidden="true">
        <span>0:00</span>
        <span>{hm(Math.floor(plannedMin / 2))}</span>
        <span>{hm(plannedMin)}</span>
      </div>
      {used.length === 0 ? (
        <p className="flow-empty" role="status">
          Select at least one genre to see the rotation.
        </p>
      ) : (
        <div
          className="flow-bar"
          role="img"
          aria-label={`Rotation preview: ${songs.length} songs. ${runs
            .slice(0, 12)
            .map((r) => `${label(r.genre)} ${r.count}`)
            .join(', ')}${runs.length > 12 ? ', and so on' : ''}`}
        >
          {breaks.map((b, i) => (
            <span
              key={`b${i}`}
              className="flow-break"
              title={`Break · ${b.durationMin} min`}
              style={{ left: pct(b.startMin), width: pct(b.durationMin) }}
            />
          ))}
          {songs.map((s, i) => (
            <span
              key={i}
              className={`flow-song${isNonLatin(s.style) ? ' striped' : ''}`}
              title={`${styleName(s.style)} · ${hm(Math.floor(s.startMin))}`}
              style={{
                left: pct(s.startMin),
                width: pct(s.lengthMin),
                ['--c' as string]: GENRE_COLOURS[genreOf(s.style)],
              }}
            />
          ))}
        </div>
      )}
      {used.length > 0 ? (
        <>
          <ul className="flow-legend" aria-label="Legend">
            {used.map((p) => (
              <li key={p.id}>
                <GenreSwatch style={p.id} size={14} label={false} /> {styleName(p.id)}
              </li>
            ))}
            {breaks.length ? <li className="legend-break">Break</li> : null}
          </ul>
          <details className="flow-text">
            <summary>The rotation as text</summary>
            <p>
              {runs.length === 0
                ? 'Nothing fits in this time.'
                : `${runs.map((r) => `${label(r.genre)}${r.count > 1 ? ` ×${r.count}` : ''}`).join(', ')}.`}
            </p>
          </details>
        </>
      ) : null}
      <p className="muted small">
        A preview from the same rotation rules the queue uses, with plenty of songs in every style.
        The real number of songs depends on what people add.
      </p>
    </div>
  );
}
