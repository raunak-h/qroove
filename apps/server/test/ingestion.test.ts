import { describe, expect, it } from 'vitest';
import { fetchJson, MAX_BYTES } from '../src/ingestion/fetch.js';
import { parseLink } from '../src/ingestion/parseLink.js';
import { splitYoutubeTitle } from '../src/ingestion/providers/oembed.js';
import { createIngestion, toTrack } from '../src/ingestion/index.js';
import { suggestStyle } from '../src/ingestion/style.js';
import { fingerprint, looseKey, norm, versionTag } from '../src/domain/keys.js';
import { mockFetch } from './api-helpers.js';

const SP = '4uLU6hMCjMI75M1A2tKUQC';

describe('parseLink', () => {
  it.each([
    [`https://open.spotify.com/track/${SP}?si=abc&utm_source=x`, 'spotify', SP],
    [`https://open.spotify.com/intl-es/track/${SP}`, 'spotify', SP],
    ['https://music.apple.com/gb/album/x/123456?i=987654321&uo=4', 'apple', '987654321'],
    ['https://music.apple.com/us/song/despacito/1234567890', 'apple', '1234567890'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&pp=x', 'youtube', 'dQw4w9WgXcQ'],
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=z', 'youtube', 'dQw4w9WgXcQ'],
  ])('accepts %s', (url, platform, id) => {
    const p = parseLink(url);
    expect(p.platform).toBe(platform);
    expect(p.id).toBe(id);
    expect(p.canonicalUrl).not.toMatch(/si=|utm_|feature|pp=/);
  });

  it.each([
    'not a url',
    'ftp://open.spotify.com/track/' + SP,
    'https://evil.example/track/' + SP,
    'https://open.spotify.com.evil.example/track/' + SP,
    'https://user:pw@open.spotify.com/track/' + SP,
    'https://open.spotify.com/album/' + SP,
    'https://open.spotify.com/track/short',
    'https://www.youtube.com/playlist?list=abc',
    'https://www.youtube.com/watch?v=tooshort',
    'http://127.0.0.1/track/' + SP,
    'https://music.apple.com/gb/album/x/123456',
  ])('rejects %s', (url) => {
    expect(() => parseLink(url)).toThrowError(
      expect.objectContaining({ code: 'UNSUPPORTED_LINK' }),
    );
  });

  it('explains short Spotify links instead of following them', () => {
    expect(() => parseLink('https://spotify.link/abc123')).toThrow(/full link/);
  });
});

describe('keys', () => {
  it('normalises diacritics, feat clauses and punctuation', () => {
    expect(norm('Déjà Vu (feat. Someone)')).toBe('deja vu');
    expect(norm('Hello,   World!')).toBe('hello world');
  });
  it('tags versions conservatively', () => {
    expect(versionTag('Song')).toBe('studio');
    expect(versionTag('Song (Live)')).toBe('live');
    expect(versionTag('Cancion en vivo')).toBe('live');
    expect(versionTag('Song - Radio Edit')).toBe('radio');
  });
  it('separates versions in the fingerprint but not in the loose key', () => {
    expect(fingerprint('Song', 'A')).not.toBe(fingerprint('Song (Remix)', 'A'));
    expect(looseKey('Song', 'A')).toBe(looseKey('Song (Remix)', 'A'));
    expect(fingerprint('SONG', ' a ')).toBe(fingerprint('Song', 'A'));
  });
});

describe('suggestStyle', () => {
  it('suggests only from one unambiguous cue', () => {
    expect(suggestStyle('Mi Bachata')).toBe('bachata');
    expect(suggestStyle('Cha Cha Chá del Barrio')).toBe('chacha');
    expect(suggestStyle('Salsa y Bachata mix')).toBeNull();
    expect(suggestStyle('Despacito')).toBeNull();
  });
});

describe('splitYoutubeTitle', () => {
  it('splits Artist - Title and falls back to the channel', () => {
    expect(splitYoutubeTitle('Aventura - Obsesion', 'Ch')).toEqual({
      artist: 'Aventura',
      title: 'Obsesion',
    });
    expect(splitYoutubeTitle('Obsesion', 'Aventura - Topic')).toEqual({
      artist: 'Aventura',
      title: 'Obsesion',
    });
  });
});

describe('toTrack key priority', () => {
  const meta = {
    source: 'spotify' as const,
    externalId: SP,
    title: 'Song',
    artists: ['A'],
    album: null,
    durationMs: 1,
    isrc: 'USX1',
    artworkUrl: null,
    confidence: 'high' as const,
  };
  it('prefers ISRC and keeps platform id and fingerprint as aliases', () => {
    const t = toTrack(meta, 'u');
    expect(t.canonicalKey).toBe('isrc:USX1');
    expect(t.aliasKeys).toEqual([`spotify:${SP}`, fingerprint('Song', 'A')]);
  });
  it('falls back to the platform id', () => {
    expect(toTrack({ ...meta, isrc: null }, 'u').canonicalKey).toBe(`spotify:${SP}`);
  });
});

describe('fetchJson (SSRF guard)', () => {
  it('refuses hosts outside the allowlist without calling fetch', async () => {
    const f = mockFetch({});
    await expect(fetchJson(f, 'https://evil.example/x')).rejects.toMatchObject({
      code: 'METADATA_UNAVAILABLE',
    });
    await expect(fetchJson(f, 'http://api.spotify.com/x')).rejects.toMatchObject({
      code: 'METADATA_UNAVAILABLE',
    });
    await expect(fetchJson(f, 'https://127.0.0.1/x')).rejects.toMatchObject({
      code: 'METADATA_UNAVAILABLE',
    });
    expect(f.calls).toEqual([]);
  });
  it('passes redirect:error and a timeout signal', async () => {
    let init: RequestInit | undefined;
    const f = mockFetch({ 'https://itunes.apple.com/': (_u, i) => ((init = i), { ok: 1 }) });
    await fetchJson(f, 'https://itunes.apple.com/lookup?id=1');
    expect(init?.redirect).toBe('error');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
  it('rejects oversized and non-OK responses', async () => {
    const big = mockFetch({
      'https://itunes.apple.com/': () => new Response('x'.repeat(MAX_BYTES + 10)),
    });
    await expect(fetchJson(big, 'https://itunes.apple.com/a')).rejects.toMatchObject({
      code: 'METADATA_UNAVAILABLE',
    });
    const bad = mockFetch({
      'https://itunes.apple.com/': () => new Response('{}', { status: 500 }),
    });
    await expect(fetchJson(bad, 'https://itunes.apple.com/a')).rejects.toMatchObject({
      code: 'METADATA_UNAVAILABLE',
    });
  });
});

describe('providers', () => {
  const spotifyApi = {
    'https://accounts.spotify.com/': () => ({ access_token: 'tok', expires_in: 3600 }),
    'https://api.spotify.com/v1/tracks/': () => ({
      id: SP,
      name: 'Obsesión',
      duration_ms: 247000,
      artists: [{ name: 'Aventura' }],
      album: { name: 'God’s Project', images: [{ url: 'https://i.scdn.co/a.jpg' }] },
      external_ids: { isrc: 'usabc1' },
    }),
  };
  it('uses the Spotify API when keys exist, caching the token', async () => {
    const f = mockFetch(spotifyApi);
    let now = 0;
    const ing = createIngestion({ fetch: f, now: () => now, spotify: { id: 'i', secret: 's' } });
    const r = await ing.resolveUrl(`https://open.spotify.com/track/${SP}`);
    expect(r.track).toMatchObject({
      canonicalKey: 'isrc:USABC1',
      durationMs: 247000,
      artist: 'Aventura',
    });
    await ing.resolveUrl(`https://open.spotify.com/track/${SP}`);
    expect(f.calls.filter((c) => c.includes('accounts.spotify.com'))).toHaveLength(1);
    now = 4_000_000;
    await ing.resolveUrl(`https://open.spotify.com/track/${SP}`);
    expect(f.calls.filter((c) => c.includes('accounts.spotify.com'))).toHaveLength(2);
  });
  it('falls back to oEmbed when the API fails', async () => {
    const f = mockFetch({
      'https://accounts.spotify.com/': () => new Response('{}', { status: 500 }),
      'https://open.spotify.com/oembed': () => ({ title: 'Obsesión' }),
    });
    const ing = createIngestion({ fetch: f, now: () => 0, spotify: { id: 'i', secret: 's' } });
    const r = await ing.resolveUrl(`https://open.spotify.com/track/${SP}`);
    expect(r.track.title).toBe('Obsesión');
    expect(r.confidence).toBe('low');
    expect(r.track.durationMs).toBeNull();
  });
  it('reads Apple Music via iTunes lookup and surfaces failure', async () => {
    const ok = mockFetch({
      'https://itunes.apple.com/lookup': () => ({
        results: [{ trackId: 9, trackName: 'T', artistName: 'A', trackTimeMillis: 1000 }],
      }),
    });
    const r = await createIngestion({ fetch: ok, now: () => 0 }).resolveUrl(
      'https://music.apple.com/gb/album/x/1234567?i=9999999',
    );
    expect(r.track).toMatchObject({ canonicalKey: 'apple:9', provider: 'apple', durationMs: 1000 });
    const none = mockFetch({ 'https://itunes.apple.com/lookup': () => ({ results: [] }) });
    await expect(
      createIngestion({ fetch: none, now: () => 0 }).resolveUrl(
        'https://music.apple.com/gb/album/x/1234567?i=9999999',
      ),
    ).rejects.toMatchObject({ code: 'METADATA_UNAVAILABLE' });
  });
});
