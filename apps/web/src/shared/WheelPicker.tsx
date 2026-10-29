import { useEffect, useRef, type ReactNode } from 'react';

const ITEM = 44; // px; also the touch-target size
const ROWS = 5;

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
  const index = Math.max(0, values.indexOf(value));

  // Follow external changes (defaults, keyboard) without fighting a spin in progress.
  useEffect(() => {
    const el = scroller.current;
    if (el && Math.abs(el.scrollTop - index * ITEM) > 1) {
      el.scrollTo?.({ top: index * ITEM, behavior: 'smooth' });
      el.scrollTop = index * ITEM;
    }
  }, [index]);

  useEffect(() => () => clearTimeout(settle.current), []);

  function commitFromScroll() {
    const el = scroller.current;
    if (!el) return;
    const i = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM)));
    const v = values[i]!;
    if (v !== value) onChange(v);
  }

  const move = (to: number) => {
    const i = Math.min(values.length - 1, Math.max(0, to));
    if (values[i] !== value) onChange(values[i]!);
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
          clearTimeout(settle.current);
          settle.current = setTimeout(commitFromScroll, 90);
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
