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

export const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

const STEP = EVENT_LIMITS.breakStartStepMin;
/** How long a press must last to add a break, so it cannot be confused with tapping to select. */
export const LONG_PRESS_MS = 450;
const MOVE_SLOP = 8; // px

/**
 * The whole evening as one bar, always the width of its container.
 *  - Tap a part of the evening to choose which styles play then.
 *  - Press and hold a part to add a break in the middle of it.
 *  - Drag a break to move it; drag its end handle to make it longer or shorter (one direction only).
 * Minutes are written above each part and each break. Hard limits are enforced as you drag: a move
 * that would break them (back to back, too much break time, too little music) does not happen.
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
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; fired: boolean } | null>(
    null,
  );
  const grab = useRef(0);
  const [selBreak, setSelBreak] = useState<number | null>(null);
  const [rejected, setRejected] = useState(false);
  const spans = segmentSpans(plannedMin, breaks);
  const pct = (m: number) => `${(m / plannedMin) * 100}%`;
  const mid = (a: number, b: number) => `${((a + b) / 2 / plannedMin) * 100}%`;

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

  /** A new break goes to the middle of the part. If that is not legal, the nearest legal spot in it. */
  function addIn(i: number) {
    const [from, to] = spans[i]!;
    const centre = snapStart((from + to) / 2 - 5);
    for (let d = 0; d <= to - from; d += STEP) {
      for (const s of d === 0 ? [centre] : [centre - d, centre + d]) {
        if (s < from || s + 10 > to) continue;
        const slot = { startMin: s, durationMin: 10 };
        if (fits([...breaks, slot])) {
          onAdd(slot);
          return;
        }
      }
    }
    flash();
  }

  function startPress(i: number, x: number) {
    cancelPress();
    const p = {
      x,
      fired: false,
      timer: setTimeout(() => {
        p.fired = true;
        addIn(i);
      }, LONG_PRESS_MS),
    };
    press.current = p;
  }
  function cancelPress() {
    if (press.current) clearTimeout(press.current.timer);
  }

  /** Moves the whole break, keeping its length. */
  function moveTo(i: number, clientX: number) {
    const b = breaks[i]!;
    const start = snapStart(minuteAt(clientX) - grab.current);
    if (start === b.startMin) return;
    const next = { ...b, startMin: start };
    if (fits(breaks.map((x, j) => (j === i ? next : x)))) onChange(i, next);
  }

  /** The end handle changes the length only: the start stays where it is. */
  function resizeTo(i: number, clientX: number) {
    const b = breaks[i]!;
    const end = snapStart(minuteAt(clientX));
    const next = { ...b, durationMin: end - b.startMin };
    if (next.durationMin === b.durationMin) return;
    if (fits(breaks.map((x, j) => (j === i ? next : x)))) onChange(i, next);
  }

  const nudge = (i: number, field: 'move' | 'length', dir: -1 | 1) => {
    const b = breaks[i]!;
    const next =
      field === 'move'
        ? { ...b, startMin: b.startMin + dir * STEP }
        : { ...b, durationMin: b.durationMin + dir * STEP };
    if (fits(breaks.map((x, j) => (j === i ? next : x)))) onChange(i, next);
  };

  const arrows = (e: React.KeyboardEvent, act: (dir: -1 | 1) => void) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      act(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      act(1);
    }
  };

  return (
    <div className="tl">
      {/* Every time stamp sits above the bar, out from under the thumb. The rows have fixed
          heights, so selecting a break or adding one never moves the bar. */}
      <div className="tl-stamps">
        <span aria-hidden="true">0:00</span>
        <span className="tl-sel" role="status">
          {selBreak !== null && breaks[selBreak] ? (
            <>
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
            </>
          ) : null}
        </span>
        <span aria-hidden="true">{hm(plannedMin)}</span>
      </div>
      <div className="tl-labels" aria-hidden="true">
        <div className="tl-labels-breaks">
          {breaks.map((b, i) => (
            <span
              key={i}
              className="tl-label brk"
              style={{ left: mid(b.startMin, b.startMin + b.durationMin) }}
            >
              {b.durationMin}
            </span>
          ))}
        </div>
        <div className="tl-labels-parts">
          {spans.map(([from, to], i) => (
            <span
              key={i}
              className={`tl-label${(to - from) / plannedMin >= 0.2 ? ' wide' : ''}`}
              style={{ left: mid(from, to) }}
            >
              {Math.round(to - from)}
            </span>
          ))}
        </div>
      </div>
      <div
        ref={bar}
        className={`tl-bar${rejected ? ' rejected' : ''}`}
        role="group"
        aria-label="Evening timeline. Tap a part to choose its styles, press and hold to add a break."
      >
        {spans.map(([from, to], i) => (
          <div
            key={i}
            role="button"
            tabIndex={0}
            aria-pressed={i === selected}
            aria-label={`Part ${i + 1} of ${spans.length}, ${Math.round(to - from)} minutes`}
            className={`tl-seg${i === selected ? ' sel' : ''}`}
            style={{ left: pct(from), width: pct(Math.max(0, to - from)) }}
            onPointerDown={(e) => startPress(i, e.clientX)}
            onPointerMove={(e) => {
              if (press.current && Math.abs(e.clientX - press.current.x) > MOVE_SLOP) cancelPress();
            }}
            onPointerUp={cancelPress}
            onPointerCancel={cancelPress}
            onPointerLeave={cancelPress}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => {
              // A long press already added a break; the click that follows it is not a selection.
              if (press.current?.fired) {
                press.current = null;
                return;
              }
              onSelect(i);
            }}
            onKeyDown={(e) => {
              if (e.key === 'b' || e.key === 'B') {
                e.preventDefault();
                addIn(i);
              } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(i);
              }
            }}
          >
            {STYLE_PRESETS.filter((s) => segments[i]?.includes(s.id)).map((s) => (
              <GenreBand key={s.id} style={s.id} />
            ))}
          </div>
        ))}
        {breaks.map((b, i) => (
          <div
            key={i}
            role="slider"
            tabIndex={0}
            aria-label={`Break ${i + 1}`}
            aria-valuemin={0}
            aria-valuemax={plannedMin}
            aria-valuenow={b.startMin}
            aria-valuetext={`${hm(b.startMin)}, ${b.durationMin} minutes`}
            className={`tl-break${selBreak === i ? ' sel' : ''}`}
            style={{ left: pct(b.startMin), width: pct(b.durationMin) }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture?.(e.pointerId);
              grab.current = minuteAt(e.clientX) - b.startMin;
            }}
            onPointerMove={(e) => {
              if (e.buttons || e.pressure > 0) moveTo(i, e.clientX);
            }}
            onClick={() => setSelBreak(selBreak === i ? null : i)}
            onKeyDown={(e) => arrows(e, (dir) => nudge(i, 'move', dir))}
          />
        ))}
        {breaks.map((b, i) => (
          <div
            key={`end-${i}`}
            role="slider"
            tabIndex={0}
            aria-label={`Break ${i + 1} end`}
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={plannedMin}
            aria-valuenow={b.startMin + b.durationMin}
            aria-valuetext={hm(b.startMin + b.durationMin)}
            className="tl-handle end"
            style={{ left: pct(b.startMin + b.durationMin) }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture?.(e.pointerId);
              setSelBreak(i);
            }}
            onPointerMove={(e) => {
              if (e.buttons || e.pressure > 0) resizeTo(i, e.clientX);
            }}
            onKeyDown={(e) => arrows(e, (dir) => nudge(i, 'length', dir))}
          >
            <span aria-hidden="true" className="tl-grip" />
          </div>
        ))}
      </div>
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
