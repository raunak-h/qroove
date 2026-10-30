import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SongList, type ListSong } from './SongList';

const mk = (n: number): ListSong[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    title: `Song ${i}`,
    artist: `Artist ${i}`,
    durationMs: 200000,
    sourceUrl: null,
  }));

function Harness({ initial = mk(5), active = 3 }: { initial?: ListSong[]; active?: number }) {
  const [songs, setSongs] = useState(initial);
  return (
    <>
      <SongList songs={songs} onChange={setSongs} activeCount={active} label="Playlist songs" />
      <output data-testid="order">{songs.map((s) => s.title).join('|')}</output>
    </>
  );
}
const order = () => screen.getByTestId('order').textContent!.split('|');
const row = (n: number) => screen.getByRole('listitem', { name: new RegExp(`^Song ${n}`) });
const fg = (n: number) => row(n).querySelector('.song-fg') as HTMLElement;
const bg = (n: number, kind: 'add' | 'del') =>
  row(n).querySelector(`.song-bg.${kind}`) as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  Element.prototype.getBoundingClientRect = function () {
    return {
      left: 0,
      top: 0,
      right: 300,
      bottom: 60,
      width: 300,
      height: 60,
      x: 0,
      y: 0,
      toJSON() {},
    };
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const swipe = (n: number, from: number, to: number) => {
  fireEvent.pointerDown(fg(n), { clientX: from, clientY: 10, pointerId: 1 });
  fireEvent.pointerMove(fg(n), { clientX: to, clientY: 12, pointerId: 1 });
};

describe('SongList', () => {
  it('greys out everything past the limit, with a marked boundary', () => {
    render(<Harness />);
    expect(row(2).className).not.toContain('over');
    expect(row(3).className).toContain('over');
    expect(row(3).className).toContain('edge'); // the first song that will not be added
    expect(row(4).className).toContain('over');
    expect(row(3)).toHaveAccessibleName(/over the limit/);
  });

  it('shows a red bin as you swipe left, and removes the song once you pass the threshold', () => {
    render(<Harness />);
    swipe(1, 250, 200); // 50px of a 300px row: part way
    const opacity = Number(bg(1, 'del').style.opacity);
    expect(opacity).toBeGreaterThan(0.3);
    expect(opacity).toBeLessThan(1); // gradual
    expect(bg(1, 'add').style.opacity).toBe('0');
    fireEvent.pointerMove(fg(1), { clientX: 100, clientY: 12, pointerId: 1 }); // 150px: past 35%
    expect(bg(1, 'del').style.opacity).toBe('1');
    fireEvent.pointerUp(fg(1), { pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(order()).toEqual(['Song 0', 'Song 2', 'Song 3', 'Song 4']);
  });

  it('springs back when a swipe is too short', () => {
    render(<Harness />);
    swipe(1, 250, 200);
    fireEvent.pointerUp(fg(1), { pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(order()).toEqual(['Song 0', 'Song 1', 'Song 2', 'Song 3', 'Song 4']);
    expect(fg(1).style.transform).toContain('translate(0px');
  });

  it('shows a green arrow as you swipe right and sends the song to the top', () => {
    render(<Harness />);
    swipe(3, 20, 70);
    const opacity = Number(bg(3, 'add').style.opacity);
    expect(opacity).toBeGreaterThan(0.3);
    expect(opacity).toBeLessThan(1);
    fireEvent.pointerMove(fg(3), { clientX: 200, clientY: 12, pointerId: 1 });
    fireEvent.pointerUp(fg(3), { pointerId: 1 });
    expect(order()).toEqual(['Song 3', 'Song 0', 'Song 1', 'Song 2', 'Song 4']);
  });

  it('does not offer "to the top" on the first song', () => {
    render(<Harness />);
    swipe(0, 20, 250); // the first song is already at the top
    expect(bg(0, 'add').style.opacity).toBe('0');
    fireEvent.pointerUp(fg(0), { pointerId: 1 });
    expect(order()[0]).toBe('Song 0');
    expect(screen.getByRole('button', { name: 'Move Song 0 to the top' })).toBeDisabled();
  });

  it('ignores a mostly vertical touch, so the page can scroll', () => {
    render(<Harness />);
    fireEvent.pointerDown(fg(1), { clientX: 100, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(fg(1), { clientX: 112, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(fg(1), { pointerId: 1 });
    expect(order()).toEqual(['Song 0', 'Song 1', 'Song 2', 'Song 3', 'Song 4']);
  });

  it('reorders by dragging the grip, and a promoted song becomes active', () => {
    render(<Harness />);
    const grip = row(4).querySelector('.grip') as HTMLElement;
    fireEvent.pointerDown(grip, { clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientY: 300 - 130, pointerId: 1 }); // ~2 rows up
    fireEvent.pointerUp(grip, { pointerId: 1 });
    expect(order()).toEqual(['Song 0', 'Song 1', 'Song 4', 'Song 2', 'Song 3']);
    expect(row(4).className).not.toContain('over'); // now inside the first three
    expect(row(2).className).toContain('over');
  });

  it('has keyboard buttons for every gesture', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Move Song 2 up' }));
    expect(order().slice(0, 3)).toEqual(['Song 0', 'Song 2', 'Song 1']);
    fireEvent.click(screen.getByRole('button', { name: 'Move Song 0 down' }));
    expect(order().slice(0, 3)).toEqual(['Song 2', 'Song 0', 'Song 1']);
    fireEvent.click(screen.getByRole('button', { name: 'Move Song 4 to the top' }));
    expect(order()[0]).toBe('Song 4');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Song 4' }));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(order()).not.toContain('Song 4');
  });
});
