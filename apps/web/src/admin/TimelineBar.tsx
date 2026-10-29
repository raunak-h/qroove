import {
  EVENT_LIMITS,
  GENRE_COLOURS,
  STYLE_PRESETS,
  genreOf,
  isNonLatin,
  type StyleId,
} from '@qroove/config';
import { segmentSpans, snapStart, validateBreaks, type BreakSlot } from '@qroove/contracts/breaks';
import { useRef, useState } from 'react';
import { GenreSwatch } from '../shared/Genre';

export const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

const STEP = EVENT_LIMITS.breakStartStepMin;

/**
 * The whole evening as one bar, always the width of its container. Tap it to add a break there
 * (snapped to 10 minutes), drag a break's handles to move or resize it, and tap a part of the
 * evening below the bar to choose which styles play then. Hard limits are enforced as you drag:
 * a move that would break them simply does not happen.
 */
export function TimelineBar({
  plannedMin,
  breaks,
  segments,
  selected,
  onSelect,
  onAdd,
  onChange,
  onRemove,
}: {
  plannedMin: number;
  breaks: readonly BreakSlot[];
  /** Styles allowed in each part of the evening (breaks.length + 1 entries). */
  segments: ReadonlyArray<readonly StyleId[]>;
  selected: number;
  onSelect: (i: number) => void;
  onAdd: (slot: BreakSlot) => void;
  onChange: (i: number, slot: BreakSlot) => void;
  onRemove: (i: number) => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const down = useRef<{ x: number; moved: boolean } | null>(null);
  const [selBreak, setSelBreak] = useState<number | null>(null);
  const [rejected, setRejected] = useState(false);
  const spans = segmentSpans(plannedMin, breaks);
  const pct = (m: number) => `${(m / plannedMin) * 100}%`;

  const minuteAt = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    const w = r.width || 1;
    return Math.min(plannedMin, Math.max(0, ((clientX - r.left) / w) * plannedMin));
  };
  const fits = (list: BreakSlot[]) => validateBreaks(plannedMin, list) === null;
  const flash = () => {
    setRejected(true);
    setTimeout(() => setRejected(false), 400);
  };

  function addAt(minute: number) {
    const start = snapStart(minute);
    // Nearest legal spot within an hour, so a tap near a limit still does something useful.
    for (let d = 0; d <= 60; d += STEP) {
      for (const s of d === 0 ? [start] : [start - d, start + d]) {
        const slot = { startMin: s, durationMin: 10 };
        if (fits([...breaks, slot])) {
          onAdd(slot);
          return;
        }
      }
    }
    flash();
  }

  function drag(i: number, edge: 'start' | 'end', clientX: number) {
    const b = breaks[i]!;
    const m = snapStart(minuteAt(clientX));
    const next: BreakSlot =
      edge === 'start'
        ? { startMin: m, durationMin: b.startMin + b.durationMin - m }
        : { startMin: b.startMin, durationMin: m - b.startMin };
    if (next.durationMin === b.durationMin && next.startMin === b.startMin) return;
    const list = breaks.map((x, j) => (j === i ? next : x));
    if (fits(list)) onChange(i, next);
  }

  function nudge(i: number, edge: 'start' | 'end', dir: -1 | 1) {
    const b = breaks[i]!;
    const next: BreakSlot =
      edge === 'start'
        ? { startMin: b.startMin + dir * STEP, durationMin: b.durationMin - dir * STEP }
        : { startMin: b.startMin, durationMin: b.durationMin + dir * STEP };
    if (fits(breaks.map((x, j) => (j === i ? next : x)))) onChange(i, next);
  }

  const handle = (i: number, edge: 'start' | 'end') => {
    const b = breaks[i]!;
    const at = edge === 'start' ? b.startMin : b.startMin + b.durationMin;
    return (
      <div
        key={`${i}-${edge}`}
        role="slider"
        tabIndex={0}
        aria-label={`Break ${i + 1} ${edge}`}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={plannedMin}
        aria-valuenow={at}
        aria-valuetext={hm(at)}
        className={`tl-handle ${edge}`}
        style={{ left: pct(at) }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setSelBreak(i);
        }}
        onPointerMove={(e) => {
          if (e.buttons || e.pressure > 0) drag(i, edge, e.clientX);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            nudge(i, edge, -1);
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            nudge(i, edge, 1);
          }
        }}
      >
        <span aria-hidden="true" className="tl-grip" />
      </div>
    );
  };

  return (
    <div className="tl">
      <div
        ref={bar}
        className={`tl-bar${rejected ? ' rejected' : ''}`}
        role="group"
        aria-label="Evening timeline. Tap to add a break."
        onPointerDown={(e) => {
          down.current = { x: e.clientX, moved: false };
        }}
        onPointerMove={(e) => {
          if (down.current && Math.abs(e.clientX - down.current.x) > 6) down.current.moved = true;
        }}
        onPointerUp={(e) => {
          const d = down.current;
          down.current = null;
          if (d && !d.moved) addAt(minuteAt(e.clientX));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target === e.currentTarget) addAt(plannedMin / 2);
        }}
        tabIndex={0}
      >
        {spans.map(([from, to], i) => (
          <div
            key={i}
            className={`tl-seg${i === selected ? ' sel' : ''}`}
            style={{ left: pct(from), width: pct(Math.max(0, to - from)) }}
          >
            {STYLE_PRESETS.filter((s) => segments[i]?.includes(s.id)).map((s) => (
              <GenreBand key={s.id} style={s.id} />
            ))}
          </div>
        ))}
        {breaks.map((b, i) => (
          <div
            key={i}
            className={`tl-break${selBreak === i ? ' sel' : ''}`}
            style={{ left: pct(b.startMin), width: pct(b.durationMin) }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setSelBreak(selBreak === i ? null : i)}
          />
        ))}
        {breaks.map((_, i) => [handle(i, 'start'), handle(i, 'end')])}
      </div>
      <div className="tl-ends" aria-hidden="true">
        <span>0:00</span>
        <span>{hm(plannedMin)}</span>
      </div>
      <div className="tl-parts" role="tablist" aria-label="Parts of the evening">
        {spans.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === selected}
            aria-label={`Part ${i + 1} of ${spans.length}`}
            className={`btn tl-part${i === selected ? ' primary' : ''}`}
            onClick={() => onSelect(i)}
          >
            {(segments[i] ?? []).slice(0, 6).map((s) => (
              <GenreSwatch key={s} style={s} size={14} label={false} />
            ))}
          </button>
        ))}
      </div>
      {selBreak !== null && breaks[selBreak] ? (
        <div className="row tl-sel" role="status">
          <span className="mono">
            {hm(breaks[selBreak]!.startMin)} –{' '}
            {hm(breaks[selBreak]!.startMin + breaks[selBreak]!.durationMin)}
          </span>
          <button
            type="button"
            className="btn"
            aria-label={`Remove break ${selBreak + 1}`}
            onClick={() => {
              onRemove(selBreak);
              setSelBreak(null);
            }}
          >
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}

function GenreBand({ style }: { style: StyleId }) {
  return (
    <div
      className={`tl-band${isNonLatin(style) ? ' striped' : ''}`}
      style={{ ['--c' as string]: GENRE_COLOURS[genreOf(style)] }}
    />
  );
}
