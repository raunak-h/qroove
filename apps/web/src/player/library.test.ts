import { describe, expect, it } from 'vitest';
import { findMatch, isAudio, parseFilename, trackFromFile } from './library';

const file = (name: string, type = 'audio/mpeg') => new File(['x'], name, { type });

describe('parseFilename', () => {
  it('splits "Artist - Title" and drops extension and track numbers', () => {
    expect(parseFilename('03 - Marc Anthony - Vivir Mi Vida.mp3')).toEqual({
      artist: 'Marc Anthony',
      title: 'Vivir Mi Vida',
    });
    expect(parseFilename('Hot_Song.m4a')).toEqual({ artist: null, title: 'Hot Song' });
  });
});

describe('isAudio', () => {
  it('accepts by mime or extension', () => {
    expect(isAudio(file('a.bin', 'audio/flac'))).toBe(true);
    expect(isAudio(file('a.opus', ''))).toBe(true);
    expect(isAudio(file('a.jpg', 'image/jpeg'))).toBe(false);
  });
});

describe('findMatch', () => {
  const lib = [
    trackFromFile(file('Marc Anthony - Vivir Mi Vida.mp3')),
    trackFromFile(file('Vivir Mi Vida (Live).mp3')),
    trackFromFile(file('Hello.mp3')),
  ];
  it('matches exactly regardless of case, accents and feat. clauses', () => {
    const m = findMatch(lib, { title: 'vivir mí vida (feat. X)', artist: 'MARC ANTHONY' });
    expect(m?.kind).toBe('exact');
    expect(m?.track.file.name).toBe('Marc Anthony - Vivir Mi Vida.mp3');
  });
  it('falls back to title-only when the artist is unknown, respecting version tags', () => {
    expect(findMatch(lib, { title: 'Vivir Mi Vida', artist: null })?.track.file.name).toBe(
      'Marc Anthony - Vivir Mi Vida.mp3',
    );
    expect(findMatch(lib, { title: 'Vivir Mi Vida (Live)', artist: null })?.track.file.name).toBe(
      'Vivir Mi Vida (Live).mp3',
    );
    expect(findMatch(lib, { title: 'Hello', artist: 'Adele' })?.kind).toBe('title-only');
  });
  it('does not match a different artist or no file', () => {
    expect(findMatch(lib, { title: 'Vivir Mi Vida', artist: 'Someone Else' })).toBeNull();
    expect(findMatch(lib, { title: 'Unknown', artist: null })).toBeNull();
  });
});
