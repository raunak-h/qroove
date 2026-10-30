import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StyleId } from '@qroove/config';
import type { BreakSlot } from '@qroove/contracts/breaks';
import { LONG_PRESS_MS, TimelineBar } from './TimelineBar';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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

function Harness({ planned = 120, start = [] as BreakSlot[], onSelect = (_: number) => {} }) {
  const [breaks, setBreaks] = useState(start);
  const segs: StyleId[][] = Array.from({ length: breaks.length + 1 }, () => ['salsa', 'bachata']);
  return (
    <>
      <TimelineBar
        plannedMin={planned}
        breaks={breaks}
        segments={segs}
        selected={0}
        onSelect={onSelect}
        onAdd={(s) => setBreaks((b) => [...b, s].sort((x, y) => x.startMin - y.startMin))}
        onChange={(i, s) => setBreaks((b) => b.map((x, j) => (j === i ? s : x)))}
        onRemove={(i) => setBreaks((b) => b.filter((_, j) => j !== i))}
      />
      <output data-testid="breaks">{JSON.stringify(breaks)}</output>
    </>
  );
}
const breaks = () => JSON.parse(screen.getByTestId('breaks').textContent!) as BreakSlot[];
const part = (n: number, of: number) =>
  screen.getByRole('button', { name: new RegExp(`^Part ${n} of ${of}`) });
const hold = (el: HTMLElement, ms = LONG_PRESS_MS + 50) => {
  fireEvent.pointerDown(el, { clientX: 100 });
  act(() => {
    vi.advanceTimersByTime(ms);
  });
  fireEvent.pointerUp(el, { clientX: 100 });
  fireEvent.click(el); // the click a browser fires after a long press
};

describe('TimelineBar', () => {
  it('selects a part with a plain tap', () => {
    const picked: number[] = [];
    render(
      <Harness start={[{ startMin: 60, durationMin: 10 }]} onSelect={(i) => picked.push(i)} />,
    );
    fireEvent.pointerDown(part(2, 2), { clientX: 300 });
    fireEvent.pointerUp(part(2, 2), { clientX: 300 });
    fireEvent.click(part(2, 2));
    expect(picked).toEqual([1]);
    expect(breaks()).toHaveLength(1); // a tap never adds a break
  });

  it('adds a break only on a long press, in the middle of that part, whatever spot was pressed', () => {
    vi.useFakeTimers();
    const picked: number[] = [];
    render(<Harness onSelect={(i) => picked.push(i)} />);
    hold(part(1, 1)); // pressed at x = 100 (a third of the way), but the break goes to the middle
    expect(breaks()).toEqual([{ startMin: 60, durationMin: 10 }]); // 2 h: the middle, snapped to the 10-minute grid
    expect(picked).toEqual([]); // the click after the hold did not select
    expect(screen.getAllByRole('button', { name: /^Part/ })).toHaveLength(2);
  });

  it('a press that is released early does not add a break', () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.pointerDown(part(1, 1), { clientX: 100 });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS - 100);
    });
    fireEvent.pointerUp(part(1, 1), { clientX: 100 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(breaks()).toEqual([]);
  });

  it('a press that turns into a drag does not add a break', () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.pointerDown(part(1, 1), { clientX: 100 });
    fireEvent.pointerMove(part(1, 1), { clientX: 140 });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS + 100);
    });
    expect(breaks()).toEqual([]);
  });

  it('the second break goes to the middle of the part that was pressed, clear of the first', () => {
    vi.useFakeTimers();
    render(<Harness planned={240} start={[{ startMin: 110, durationMin: 20 }]} />);
    hold(part(2, 2)); // the part from 2:10 to 4:00 (110 min): middle at 185
    const [, second] = breaks();
    expect(second!.startMin).toBe(180); // snapped: 185 - 5
    expect(second!.startMin).toBeGreaterThanOrEqual(130 + 20); // never joined to the first
  });

  it('refuses (and does nothing) where a break cannot legally go', () => {
    vi.useFakeTimers();
    render(<Harness planned={30} />); // far too short for 20 minutes of music either side
    hold(part(1, 1));
    expect(breaks()).toEqual([]);
  });

  it('writes the minutes above each part and each break', () => {
    render(<Harness start={[{ startMin: 60, durationMin: 10 }]} />);
    expect(part(1, 2)).toHaveAccessibleName('Part 1 of 2, 60 minutes');
    expect(part(2, 2)).toHaveAccessibleName('Part 2 of 2, 50 minutes');
    const labels = document.querySelectorAll('.tl-label');
    expect([...labels].map((l) => l.textContent)).toEqual(['10', '60', '50']);
  });

  it('moves a whole break by dragging it, keeping its length and the 10-minute grid', () => {
    render(<Harness start={[{ startMin: 60, durationMin: 10 }]} />);
    const brk = screen.getByRole('slider', { name: 'Break 1' });
    fireEvent.pointerDown(brk, { clientX: 183, pointerId: 1 }); // grab at 61 min: 1 min into the break
    fireEvent.pointerMove(brk, { clientX: 243, buttons: 1 }); // 81 min - 1 = 80
    expect(breaks()[0]).toEqual({ startMin: 80, durationMin: 10 });
    fireEvent.pointerMove(brk, { clientX: 20, buttons: 1 }); // too close to the start: refused
    expect(breaks()[0]).toEqual({ startMin: 80, durationMin: 10 });
  });

  it('lengthens or shortens a break from its end only, up to 30 minutes', () => {
    render(<Harness start={[{ startMin: 60, durationMin: 10 }]} />);
    expect(screen.queryByRole('slider', { name: 'Break 1 start' })).toBeNull(); // no start handle
    const end = screen.getByRole('slider', { name: 'Break 1 end' });
    fireEvent.pointerDown(end, { clientX: 210, pointerId: 1 });
    fireEvent.pointerMove(end, { clientX: 240, buttons: 1 }); // end at 80 min
    expect(breaks()[0]).toEqual({ startMin: 60, durationMin: 20 }); // the start did not move
    fireEvent.pointerMove(end, { clientX: 340, buttons: 1 }); // would be 113 min: refused
    expect(breaks()[0]).toEqual({ startMin: 60, durationMin: 20 });
    fireEvent.pointerMove(end, { clientX: 200, buttons: 1 }); // shorten back to 10
    expect(breaks()[0]).toEqual({ startMin: 60, durationMin: 10 });
  });

  it('never lets a break touch another one', () => {
    render(
      <Harness
        start={[
          { startMin: 30, durationMin: 10 },
          { startMin: 80, durationMin: 10 },
        ]}
      />,
    );
    const first = screen.getByRole('slider', { name: 'Break 1' });
    fireEvent.pointerDown(first, { clientX: 90, pointerId: 1 });
    fireEvent.pointerMove(first, { clientX: 240, buttons: 1 }); // dragged onto the second break
    expect(breaks()[0]).toEqual({ startMin: 30, durationMin: 10 });
    const end = screen.getByRole('slider', { name: 'Break 1 end' });
    fireEvent.pointerDown(end, { clientX: 120, pointerId: 1 });
    fireEvent.pointerMove(end, { clientX: 230, buttons: 1 }); // lengthened into the second
    expect(breaks()[0]).toEqual({ startMin: 30, durationMin: 10 });
  });

  it('can be used without a pointer: keys move, resize and add; the button removes', () => {
    render(<Harness start={[{ startMin: 60, durationMin: 10 }]} />);
    const brk = screen.getByRole('slider', { name: 'Break 1' });
    brk.focus();
    fireEvent.keyDown(brk, { key: 'ArrowRight' });
    expect(breaks()[0]).toEqual({ startMin: 70, durationMin: 10 });
    const end = screen.getByRole('slider', { name: 'Break 1 end' });
    fireEvent.keyDown(end, { key: 'ArrowRight' });
    expect(breaks()[0]).toEqual({ startMin: 70, durationMin: 20 });
    fireEvent.click(brk); // selects the break
    fireEvent.click(screen.getByRole('button', { name: 'Remove break 1' }));
    expect(breaks()).toEqual([]);
    fireEvent.keyDown(part(1, 1), { key: 'b' }); // keyboard equivalent of a long press
    expect(breaks()).toEqual([{ startMin: 60, durationMin: 10 }]);
  });

  it('only allows three breaks', () => {
    render(<Harness planned={480} />);
    for (let n = 0; n < 4; n++)
      fireEvent.keyDown(screen.getAllByRole('button', { name: /^Part/ }).at(-1)!, { key: 'b' });
    expect(breaks()).toHaveLength(3);
  });

  it('is always the width of its container: positions are shares of the evening', () => {
    render(<Harness planned={480} start={[{ startMin: 240, durationMin: 10 }]} />);
    const brk = screen.getByRole('slider', { name: 'Break 1' });
    expect(brk.style.left).toBe('50%');
  });
});
