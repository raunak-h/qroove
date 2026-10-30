import { useEffect, useRef, type ReactNode } from 'react';

const ITEM = 44; // px; also the touch-target size
const ROWS = 5;
const SETTLE_MS = 40; // was 90: the wheel now follows the scroll live, this only confirms the rest position

/**
 * A vertical drum: scroll-snap rows that fade away above and below the highlighted one. The only
 * way to change the value is to spin it (or use arrow keys), so there is nothing to type.
 */
export function WheelPicker<T extends string | number>({
  values,
  value,
  onChange,
  format = String,
  render,
  label,
  className = '',
}: {
  values: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
  render?: (v: T) => ReactNode;
  label: string;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);
  /** True while a finger or momentum is moving the wheel: external-value syncing must not fight it. */
  const spinning = useRef(false);
  /** The last value we reported, so a stale closure never reports the same row twice. */
  const reported = useRef<T>(value);
  const index = Math.max(0, values.indexOf(value));
  // Follow the parent when it changes the value itself (defaults, keyboard, clamping).
  useEffect(() => {
    reported.current = value;
  }, [value]);

  // Follow external changes (defaults, keyboard) without fighting a spin in progress.
  useEffect(() => {
    const el = scroller.current;
    if (el && !spinning.current && Math.abs(el.scrollTop - index * ITEM) > 1) {
      el.scrollTo?.({ top: index * ITEM, behavior: 'smooth' });
      el.scrollTop = index * ITEM;
    }
  }, [index]);

  useEffect(
    () => () => {
      clearTimeout(settle.current);
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    },
    [],
  );

  // `scrollend` fires the moment the snap finishes, so the wheel settles without waiting on a timer.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !('onscrollend' in window)) return;
    const done = () => {
      clearTimeout(settle.current);
      spinning.current = false;
      commitFromScroll();
    };
    el.addEventListener('scrollend', done);
    return () => el.removeEventListener('scrollend', done);
  });

  function commitFromScroll() {
    const el = scroller.current;
    if (!el) return;
    const i = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM)));
    const v = values[i]!;
    if (v !== reported.current) {
      reported.current = v;
      onChange(v);
    }
  }

  const move = (to: number) => {
    const i = Math.min(values.length - 1, Math.max(0, to));
    if (values[i] !== value) {
      reported.current = values[i]!;
      onChange(values[i]!);
    }
  };

  return (
    <div className={`wheel ${className}`} style={{ height: ITEM * ROWS }}>
      <div className="wheel-band" aria-hidden="true" style={{ height: ITEM }} />
      {/* The scrolling element is itself the focusable control, so keyboard users can reach it. */}
      <div
        ref={scroller}
        className="wheel-scroll"
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={typeof value === 'number' ? value : index}
        aria-valuemin={typeof values[0] === 'number' ? (values[0] as number) : 0}
        aria-valuemax={
          typeof values[0] === 'number' ? (values[values.length - 1] as number) : values.length - 1
        }
        aria-valuetext={format(value)}
        onKeyDown={(e) => {
          const step = { ArrowUp: -1, ArrowDown: 1, PageUp: -4, PageDown: 4 }[e.key];
          if (step !== undefined) {
            e.preventDefault();
            move(index + step);
          } else if (e.key === 'Home') {
            e.preventDefault();
            move(0);
          } else if (e.key === 'End') {
            e.preventDefault();
            move(values.length - 1);
          }
        }}
        onScroll={() => {
          spinning.current = true;
          // Follow the wheel live, so the number under the highlight changes as it passes.
          if (frame.current === undefined) {
            frame.current = requestAnimationFrame(() => {
              frame.current = undefined;
              commitFromScroll();
            });
          }
          // Fallback for browsers without `scrollend`: short, since the snap itself is the slow part.
          clearTimeout(settle.current);
          settle.current = setTimeout(() => {
            spinning.current = false;
            commitFromScroll();
          }, SETTLE_MS);
        }}
      >
        <div style={{ height: ITEM * 2 }} aria-hidden="true" />
        {values.map((v, i) => (
          <div
            key={String(v)}
            className={`wheel-item${i === index ? ' on' : ''}`}
            style={{ height: ITEM }}
            aria-hidden="true"
            onClick={() => move(i)}
          >
            {render ? render(v) : format(v)}
          </div>
        ))}
        <div style={{ height: ITEM * 2 }} aria-hidden="true" />
      </div>
    </div>
  );
}
