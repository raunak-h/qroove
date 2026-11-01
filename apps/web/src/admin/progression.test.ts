import { describe, expect, it } from 'vitest';
import { previewRotation, runsOf, syncedLimit, trackEstimate, type PartRules } from './progression';

const part = (
  styles: PartRules['styles'],
  master = 1,
  ratio: PartRules['ratio'] = {},
): PartRules => ({
  styles,
  master,
  ratio,
});

describe('previewRotation', () => {
  it('follows the run cap of each genre and alternates the genres', () => {
    const songs = previewRotation(60, [], [part(['salsa', 'bachata'], 2)]);
    const runs = runsOf(songs).map((r) => `${r.genre}${r.count}`);
    expect(runs.slice(0, 4)).toEqual(['salsa2', 'bachata2', 'salsa2', 'bachata2']);
  });

  it('uses a ratio for the run caps, as the real queue does', () => {
    const songs = previewRotation(
      120,
      [],
      [part(['salsa', 'bachata'], 1, { salsa: 2, bachata: 1 })],
    );
    const runs = runsOf(songs).map((r) => `${r.genre}${r.count}`);
    expect(runs.slice(0, 4)).toEqual(['salsa2', 'bachata1', 'salsa2', 'bachata1']);
  });

  it('plays a genre’s non-Latin variant inside the same run, not as a change of genre', () => {
    const songs = previewRotation(60, [], [part(['salsa', 'salsa_nl', 'bachata'], 2)]);
    expect(songs.slice(0, 2).map((s) => s.style)).toEqual(['salsa', 'salsa_nl']);
    expect(runsOf(songs)[0]).toEqual({ genre: 'salsa', count: 2 });
  });

  it('plays nothing during a break, and fits every song before the end', () => {
    const songs = previewRotation(
      60,
      [{ startMin: 20, durationMin: 20 }],
      [part(['salsa']), part(['bachata'])],
    );
    expect(songs.length).toBeGreaterThan(0);
    for (const s of songs) {
      expect(s.startMin + s.lengthMin <= 60).toBe(true);
      expect(s.startMin + s.lengthMin <= 20 || s.startMin >= 40).toBe(true);
    }
    // Each part of the evening has its own styles.
    expect(songs.filter((s) => s.startMin < 20).every((s) => s.style === 'salsa')).toBe(true);
    expect(songs.filter((s) => s.startMin >= 40).every((s) => s.style === 'bachata')).toBe(true);
  });

  it('has nothing to show without a style', () => {
    expect(previewRotation(60, [], [part([])])).toEqual([]);
  });

  it('only a non-Latin variant is enough to play that genre', () => {
    const songs = previewRotation(30, [], [part(['bachata_nl'])]);
    expect(new Set(songs.map((s) => s.style))).toEqual(new Set(['bachata_nl']));
  });
});

describe('syncedLimit', () => {
  it('gives 5 songs for every 15 minutes, between 5 and 50', () => {
    expect(syncedLimit(15, 160)).toBe(5);
    expect(syncedLimit(30, 160)).toBe(10);
    expect(syncedLimit(60, 160)).toBe(20);
    expect(syncedLimit(90, 160)).toBe(30);
    expect(syncedLimit(240, 160)).toBe(50);
    expect(syncedLimit(480, 160)).toBe(50);
  });
  it('never goes above what the event may hold', () => {
    expect(syncedLimit(60, 15)).toBe(15);
  });
});

describe('trackEstimate', () => {
  it('is one song every 3.5 to 5 minutes, at least 2 and 3', () => {
    expect(trackEstimate(60)).toEqual({ min: 12, max: 18 });
    expect(trackEstimate(15)).toEqual({ min: 3, max: 5 });
    expect(trackEstimate(5)).toEqual({ min: 2, max: 3 });
  });
});
