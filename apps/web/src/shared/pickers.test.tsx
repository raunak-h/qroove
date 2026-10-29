import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ENABLED_STYLES, type StyleId } from '@qroove/config';
import { GenreSwatch, StyleGrid } from './Genre';
import { WheelPicker } from './WheelPicker';

afterEach(cleanup);

function Wheel({
  start = 120,
  onChange = () => {},
}: {
  start?: number;
  onChange?: (v: number) => void;
}) {
  const [v, set] = useState(start);
  const values = Array.from({ length: 32 }, (_, i) => 15 + i * 15);
  return (
    <WheelPicker
      label="Planned time"
      values={values}
      value={v}
      format={(m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`}
      onChange={(n) => {
        set(n);
        onChange(n);
      }}
    />
  );
}

describe('WheelPicker', () => {
  it('shows the current value, and steps with the arrow keys, one row at a time', async () => {
    const seen: number[] = [];
    render(<Wheel onChange={(n) => seen.push(n)} />);
    const wheel = screen.getByRole('spinbutton', { name: 'Planned time' });
    expect(wheel).toHaveAttribute('aria-valuetext', '2:00');
    wheel.focus();
    const user = userEvent.setup();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}');
    expect(seen).toEqual([135, 150, 135]);
    expect(wheel).toHaveAttribute('aria-valuetext', '2:15');
    await user.keyboard('{End}');
    expect(wheel).toHaveAttribute('aria-valuetext', '8:00');
    await user.keyboard('{ArrowDown}'); // never past the ends
    expect(wheel).toHaveAttribute('aria-valuetext', '8:00');
    await user.keyboard('{Home}');
    expect(wheel).toHaveAttribute('aria-valuetext', '0:15');
  });

  describe('spinning', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());
    it('settles on the row that scrolled to the centre', () => {
      const seen: number[] = [];
      const { container } = render(<Wheel onChange={(n) => seen.push(n)} />);
      const scroller = container.querySelector('.wheel-scroll') as HTMLElement;
      scroller.scrollTop = 44 * 3; // three rows down: 2:00 -> 2:45 is index 7 + ... start index is 7, so 3 rows = index 3
      fireEvent.scroll(scroller);
      act(() => {
        vi.advanceTimersByTime(120);
      });
      expect(seen).toEqual([60]); // index 3 of 15-minute steps starting at 0:15 = 1:00
    });
  });
});

describe('GenreSwatch', () => {
  it('names the style for screen readers, with a white outline hook and stripes for non-Latin', () => {
    render(
      <>
        <GenreSwatch style="salsa" />
        <GenreSwatch style="bachata_nl" />
      </>,
    );
    const salsa = screen.getByRole('img', { name: 'Salsa' });
    expect(salsa.className).toBe('swatch');
    expect(salsa.style.getPropertyValue('--c')).toBe('#d32f2f');
    const nl = screen.getByRole('img', { name: 'Non-Latin bachata-compatible' });
    expect(nl.className).toContain('striped');
    expect(nl.style.getPropertyValue('--c')).toBe('#000000'); // bachata is black
  });
});

describe('StyleGrid', () => {
  function Grid() {
    const [v, set] = useState<Set<StyleId>>(new Set(DEFAULT_ENABLED_STYLES));
    return <StyleGrid value={v} onChange={set} />;
  }
  it('starts with salsa and bachata and their non-Latin styles; cha-cha is the extra', () => {
    render(<Grid />);
    const on = screen
      .getAllByRole('checkbox')
      .filter((c) => c.getAttribute('aria-checked') === 'true')
      .map((c) => c.getAttribute('aria-label'));
    expect(on).toEqual([
      'Salsa',
      'Non-Latin salsa-compatible',
      'Bachata',
      'Non-Latin bachata-compatible',
    ]);
    expect(screen.getByRole('checkbox', { name: 'Cha-cha' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
  it('lays out Latin styles on the left and each non-Latin counterpart directly across', () => {
    render(<Grid />);
    const order = screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'));
    // Two columns: row-major order alternates left / right, then Other alone.
    expect(order).toEqual([
      'Salsa',
      'Non-Latin salsa-compatible',
      'Bachata',
      'Non-Latin bachata-compatible',
      'Cha-cha',
      'Non-Latin cha-cha-compatible',
      'Other (Musicality Exercise)',
    ]);
  });
  it('toggles a style on tap', async () => {
    render(<Grid />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Cha-cha' }));
    expect(screen.getByRole('checkbox', { name: 'Cha-cha' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(screen.getByRole('checkbox', { name: 'Other (Musicality Exercise)' }));
    expect(screen.getByRole('checkbox', { name: 'Other (Musicality Exercise)' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
