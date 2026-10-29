import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { StyleId } from '@qroove/config';
import type { BreakSlot } from '@qroove/contracts/breaks';
import { TimelineBar } from './TimelineBar';

afterEach(cleanup);

// jsdom has no layout: give the bar a 360 px width starting at x = 0.
beforeEach(() => {
  Element.prototype.getBoundingClientRect = function () {
    return {
      left: 0,
      top: 0,
      right: 360,
      bottom: 52,
      width: 360,
      height: 52,
      x: 0,
      y: 0,
      toJSON() {},
    };
  };
});

function Harness({ planned = 120, start = [] as BreakSlot[] }) {
  const [breaks, setBreaks] = useState(start);
  const segs: StyleId[][] = Array.from({ length: breaks.length + 1 }, () => ['salsa', 'bachata']);
  return (
    <>
      <TimelineBar
        plannedMin={planned}
        breaks={breaks}
        segments={segs}
        selected={0}
        onSelect={() => {}}
        onAdd={(s) => setBreaks((b) => [...b, s].sort((x, y) => x.startMin - y.startMin))}
        onChange={(i, s) => setBreaks((b) => b.map((x, j) => (j === i ? s : x)))}
        onRemove={(i) => setBreaks((b) => b.filter((_, j) => j !== i))}
      />
      <output data-testid="breaks">{JSON.stringify(breaks)}</output>
    </>
  );
}
const bar = () => screen.getByRole('group', { name: /Evening timeline/ });
const tap = (x: number) => {
  fireEvent.pointerDown(bar(), { clientX: x });
  fireEvent.pointerUp(bar(), { clientX: x });
};
const breaks = () => JSON.parse(screen.getByTestId('breaks').textContent!) as BreakSlot[];

describe('TimelineBar', () => {
  it('adds a 10-minute break where you tap, snapped to the 10-minute grid', () => {
    render(<Harness />);
    tap(183); // 183 / 360 * 120 = 61 min -> 60
    expect(breaks()).toEqual([{ startMin: 60, durationMin: 10 }]);
    expect(screen.getAllByRole('tab')).toHaveLength(2); // two parts of the evening now
  });

  it('is always the width of its container: the same tap position means the same share of the evening', () => {
    const { unmount } = render(<Harness planned={480} />);
    tap(180); // the middle of the bar is the middle of 8 hours, whatever the length
    expect(breaks()[0]).toEqual({ startMin: 240, durationMin: 10 });
    unmount();
  });

  it('moves a nearby tap to the nearest legal spot rather than refusing outright', () => {
    render(<Harness />);
    tap(5); // 1.7 min: too early for 20 minutes of music before the break
    expect(breaks()[0]!.startMin).toBeGreaterThanOrEqual(20);
  });

  it('drags the end handle to lengthen a break, in 10-minute steps and up to 30', () => {
    render(<Harness start={[{ startMin: 60, durationMin: 10 }]} />);
    const end = screen.getByRole('slider', { name: 'Break 1 end' });
    fireEvent.pointerDown(end, { clientX: 210, pointerId: 1 });
    fireEvent.pointerMove(end, { clientX: 240, buttons: 1 }); // 80 min
    expect(breaks()[0]).toEqual({ startMin: 60, durationMin: 20 });
    fireEvent.pointerMove(end, { clientX: 340, buttons: 1 }); // would be 113 min: refused
    expect(breaks()[0]).toEqual({ startMin: 60, durationMin: 20 });
  });

  it('drags the start handle to move the start while the end stays', () => {
    render(<Harness start={[{ startMin: 60, durationMin: 10 }]} />);
    const start = screen.getByRole('slider', { name: 'Break 1 start' });
    fireEvent.pointerDown(start, { clientX: 180, pointerId: 1 });
    fireEvent.pointerMove(start, { clientX: 150, buttons: 1 }); // 50 min
    expect(breaks()[0]).toEqual({ startMin: 50, durationMin: 20 });
  });

  it('never lets a drag break the limits (back to back, more than half)', () => {
    render(
      <Harness
        start={[
          { startMin: 30, durationMin: 10 },
          { startMin: 80, durationMin: 10 },
        ]}
      />,
    );
    const first = screen.getByRole('slider', { name: 'Break 1 end' });
    fireEvent.pointerDown(first, { clientX: 120, pointerId: 1 });
    fireEvent.pointerMove(first, { clientX: 240, buttons: 1 }); // would touch the second break
    expect(breaks()[0]).toEqual({ startMin: 30, durationMin: 10 });
  });

  it('can be adjusted and removed without a pointer', () => {
    render(<Harness start={[{ startMin: 60, durationMin: 10 }]} />);
    const end = screen.getByRole('slider', { name: 'Break 1 end' });
    end.focus();
    fireEvent.keyDown(end, { key: 'ArrowRight' });
    expect(breaks()[0]).toEqual({ startMin: 60, durationMin: 20 });
    fireEvent.pointerDown(end, { pointerId: 1 }); // selects the break
    fireEvent.click(screen.getByRole('button', { name: 'Remove break 1' }));
    expect(breaks()).toEqual([]);
  });

  it('only allows three breaks', () => {
    render(<Harness planned={480} />);
    for (const x of [60, 180, 300, 330]) tap(x);
    expect(breaks()).toHaveLength(3);
  });
});
