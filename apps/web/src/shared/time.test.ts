import { describe, expect, it } from 'vitest';
import { formatCountdown, parseDuration, pluralise } from './time';

describe('time helpers', () => {
  it('formats countdowns as MM:SS and clamps below zero', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(83_000)).toBe('01:23');
    expect(formatCountdown(8 * 60_000 + 30_000)).toBe('08:30');
    expect(formatCountdown(125 * 60_000)).toBe('125:00');
    expect(formatCountdown(-5000)).toBe('00:00');
    expect(formatCountdown(59_600)).toBe('01:00');
  });
  it('pluralises', () => {
    expect(pluralise(0, 'song')).toBe('songs');
    expect(pluralise(1, 'song')).toBe('song');
    expect(pluralise(2, 'song')).toBe('songs');
  });
  it('parses durations', () => {
    expect(parseDuration('')).toBeUndefined();
    expect(parseDuration('3:45')).toBe(225_000);
    expect(parseDuration('225')).toBe(225_000);
    expect(parseDuration('3:75')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('0')).toBeNull();
    expect(parseDuration('9999')).toBeNull();
  });
});
