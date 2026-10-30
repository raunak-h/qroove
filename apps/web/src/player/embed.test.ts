import { describe, expect, it, vi } from 'vitest';
import { sourceOf, spotifyTracker } from './embed';

const events = () => ({ onPlaying: vi.fn(), onEnded: vi.fn(), onFailed: vi.fn() });
const update = (over: Partial<Parameters<ReturnType<typeof spotifyTracker>>[0]>) => ({
  isPaused: false,
  isBuffering: false,
  duration: 200_000,
  position: 0,
  ...over,
});

describe('sourceOf', () => {
  it('recognises stored Spotify and YouTube links only', () => {
    const spotify = 'a'.repeat(22);
    expect(sourceOf(`https://open.spotify.com/track/${spotify}`)).toEqual({
      kind: 'spotify',
      id: spotify,
    });
    expect(sourceOf('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      kind: 'youtube',
      id: 'dQw4w9WgXcQ',
    });
    expect(sourceOf('https://music.apple.com/song/123456')).toBeNull();
    expect(sourceOf(null)).toBeNull();
  });
});

describe('spotifyTracker', () => {
  it('reports a real start once and the end once', () => {
    const ev = events();
    const track = spotifyTracker(ev);
    track(update({ isPaused: true }));
    expect(ev.onPlaying).not.toHaveBeenCalled();
    track(update({ position: 500 }));
    track(update({ position: 1500 }));
    expect(ev.onPlaying).toHaveBeenCalledTimes(1);
    expect(ev.onPlaying).toHaveBeenCalledWith(200_000);
    track(update({ position: 199_500 }));
    track(update({ position: 0, isPaused: true }));
    expect(ev.onEnded).toHaveBeenCalledTimes(1);
  });

  it('does not treat a pause part-way through as the end', () => {
    const ev = events();
    const track = spotifyTracker(ev);
    track(update({ position: 5000 }));
    track(update({ position: 5000, isPaused: true }));
    expect(ev.onEnded).not.toHaveBeenCalled();
  });

  it('refuses a 30-second preview before it counts as started', () => {
    const ev = events();
    spotifyTracker(ev)(update({ duration: 30_000 }));
    expect(ev.onFailed).toHaveBeenCalledWith('preview');
    expect(ev.onPlaying).not.toHaveBeenCalled();
  });
});
