/* eslint-disable @typescript-eslint/no-explicit-any -- HTTP response bodies are untyped JSON in tests */
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  capPlaytime,
  parseApple,
  parsePlaylistUrl,
  parseSpotify,
  parseYouTube,
} from '../src/ingestion/playlist.js';
import { testApp } from './api-helpers.js';

const spotifyHtml = (tracks: object[]) =>
  `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { state: { data: { entity: { trackList: tracks } } } } },
  })}</script></html>`;

const appleHtml = (tracks: object[]) =>
  `<html><script type="application/json" id="serialized-server-data">${JSON.stringify({
    data: [{ items: tracks }],
  })}</script></html>`;

const ytHtml = (inner: object) =>
  `<html><script>var ytInitialData = ${JSON.stringify(inner)};</script></html>`;

describe('parsePlaylistUrl', () => {
  it('accepts the three services and rebuilds a clean URL', () => {
    expect(
      parsePlaylistUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc'),
    ).toEqual({
      platform: 'spotify',
      url: 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M',
    });
    expect(
      parsePlaylistUrl(
        'https://music.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI&si=x',
      ),
    ).toEqual({
      platform: 'youtube',
      url: 'https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',
    });
    expect(
      parsePlaylistUrl(
        'https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb',
      ).platform,
    ).toBe('apple');
  });
  it('refuses other hosts, single tracks and credentials', () => {
    for (const u of [
      'https://evil.example/playlist/abc',
      'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
      'https://user:pw@open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
      'ftp://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
      'https://www.youtube.com/watch?v=abc',
      'not a url',
    ]) {
      expect(() => parsePlaylistUrl(u), u).toThrow();
    }
  });
});

describe('page parsers', () => {
  it('reads Spotify embed tracks', () => {
    const t = parseSpotify(
      spotifyHtml([
        {
          uri: 'spotify:track:abc123',
          title: 'One',
          subtitle: 'A, B',
          duration: 200000,
          entityType: 'track',
        },
        { uri: 'spotify:episode:zzz', title: 'Pod', entityType: 'episode' },
      ]),
    );
    expect(t).toEqual([
      {
        title: 'One',
        artist: 'A, B',
        durationMs: 200000,
        sourceUrl: 'https://open.spotify.com/track/abc123',
      },
    ]);
  });
  it('reads Apple Music tracks', () => {
    const t = parseApple(
      appleHtml([
        { id: 'track-lockup - pl.x - 1', title: 'Uno', artistName: 'Banda', duration: 180000 },
        { id: 'track-lockup - pl.x - 1', title: 'Dup', artistName: 'Banda', duration: 1 },
        { id: 'other', title: 'Nope' },
      ]),
    );
    expect(t).toEqual([{ title: 'Uno', artist: 'Banda', durationMs: 180000, sourceUrl: null }]);
  });
  it('reads both YouTube layouts and tidies video titles', () => {
    const t = parseYouTube(
      ytHtml({
        a: {
          playlistVideoRenderer: {
            videoId: 'v1',
            title: { runs: [{ text: 'Marc Anthony - Vivir Mi Vida (Official Video)' }] },
            shortBylineText: { runs: [{ text: 'MarcAnthonyVEVO' }] },
            lengthSeconds: '255',
          },
        },
        b: {
          lockupViewModel: {
            contentId: 'v2',
            contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
            metadata: {
              lockupMetadataViewModel: {
                title: { content: 'Bella' },
                metadata: {
                  contentMetadataViewModel: {
                    metadataRows: [{ metadataParts: [{ text: { content: 'Wolfine - Topic' } }] }],
                  },
                },
              },
            },
            contentImage: { overlays: [{ thumbnailBadgeViewModel: { text: '3:55' } }] },
          },
        },
      }),
    );
    expect(t).toEqual([
      {
        title: 'Vivir Mi Vida',
        artist: 'Marc Anthony',
        durationMs: 255000,
        sourceUrl: 'https://www.youtube.com/watch?v=v1',
      },
      {
        title: 'Bella',
        artist: 'Wolfine',
        durationMs: 235000,
        sourceUrl: 'https://www.youtube.com/watch?v=v2',
      },
    ]);
  });
});

describe('capPlaytime', () => {
  const s = (title: string, min: number | null) => ({
    title,
    artist: null,
    durationMs: min === null ? null : min * 60_000,
  });
  it('keeps order, skips what does not fit, and never exceeds the limit', () => {
    const out = capPlaytime([s('a', 4), s('b', 5), s('c', 2), s('d', 3)], 9 * 60_000);
    expect(out.map((x) => x.title)).toEqual(['a', 'b']); // 9 min exactly; c and d no longer fit
    expect(capPlaytime([s('a', 4), s('b', 8), s('c', 2)], 7 * 60_000).map((x) => x.title)).toEqual([
      'a',
      'c',
    ]);
  });
  it('counts unknown lengths as four minutes and drops duplicates', () => {
    expect(
      capPlaytime([s('a', null), s('A', 3), s('b', null)], 8 * 60_000).map((x) => x.title),
    ).toEqual(['a', 'b']);
  });
});

describe('POST /api/events with a playlist', () => {
  const apps: FastifyInstance[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((a) => a.close()));
  });
  const page = spotifyHtml(
    Array.from({ length: 40 }, (_, i) => ({
      uri: `spotify:track:t${i}`,
      title: `Song ${i}`,
      subtitle: 'Band',
      duration: 240_000,
      entityType: 'track',
    })),
  );
  it('queues songs up to one minute less than the planned time', async () => {
    const t = await testApp({
      fetch: (async (url: string) => {
        expect(url).toBe('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M');
        return new Response(page);
      }) as any,
    });
    apps.push(t.app);
    const r = await t.api.call('POST', '/api/events', {
      body: {
        timezone: 'UTC',
        enabledStyles: ['salsa'],
        plannedDurationMin: 60,
        playlists: [
          {
            url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
            style: 'salsa',
          },
        ],
      },
    });
    expect(r.status).toBe(201);
    expect(r.json.seeded).toBe(14); // 14 x 4 min = 56 min <= 59 min; a 15th would be 60 min
  });
  it('sends the consent marker YouTube needs, and only to YouTube', async () => {
    const seen: Array<{ url: string; cookie: string | undefined }> = [];
    const t = await testApp({
      fetch: (async (url: string, init: RequestInit) => {
        seen.push({ url, cookie: (init.headers as Record<string, string>).cookie });
        return new Response(
          ytHtml({
            a: {
              playlistVideoRenderer: {
                videoId: 'v1',
                title: { runs: [{ text: 'A - B' }] },
                lengthSeconds: '200',
              },
            },
          }),
        );
      }) as any,
    });
    apps.push(t.app);
    const r = await t.api.call('POST', '/api/events', {
      body: {
        timezone: 'UTC',
        enabledStyles: ['salsa'],
        plannedDurationMin: 60,
        playlists: [
          {
            url: 'https://music.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',
            style: 'salsa',
          },
        ],
      },
    });
    expect(r.status).toBe(201);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toBe(
      'https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',
    );
    expect(seen[0]!.cookie).toContain('SOCS=CAI');
  });

  it('needs a planned time, and a supported link', async () => {
    const t = await testApp();
    apps.push(t.app);
    const noTime = await t.api.call('POST', '/api/events', {
      body: {
        timezone: 'UTC',
        playlists: [
          {
            url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
            style: 'salsa',
          },
        ],
      },
    });
    expect(noTime.status).toBe(400);
    const bad = await t.api.call('POST', '/api/events', {
      body: {
        timezone: 'UTC',
        enabledStyles: ['salsa'],
        plannedDurationMin: 60,
        playlists: [{ url: 'https://evil.example/x', style: 'salsa' }],
      },
    });
    expect(bad.status).toBe(422);
  });

  describe('one playlist per style, every genre covered', () => {
    const SPOT = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
    const APPLE =
      'https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb';
    const create = async (body: object, fetched: string[] = []) => {
      const t = await testApp({
        fetch: (async (url: string) => {
          fetched.push(url);
          return new Response(
            url.includes('apple.com')
              ? appleHtml(
                  Array.from({ length: 10 }, (_, i) => ({
                    id: `track-lockup - pl.x - ${i}`,
                    title: `Apple ${i}`,
                    artistName: 'Banda',
                    duration: 240_000,
                  })),
                )
              : page,
          );
        }) as any,
      });
      apps.push(t.app);
      return t.api.call('POST', '/api/events', {
        body: { timezone: 'UTC', plannedDurationMin: 120, ...body },
      });
    };

    it('refuses a missing genre: salsa and bachata are active but only salsa has a playlist', async () => {
      const r = await create({
        enabledStyles: ['salsa', 'bachata'],
        playlists: [{ url: SPOT, style: 'salsa' }],
      });
      expect(r.status).toBe(400);
      expect(r.json.error.message).toMatch(/every genre/);
    });

    it('a Latin style’s playlist covers its non-Latin counterpart, and the other way round', async () => {
      const both = await create({
        enabledStyles: ['salsa', 'salsa_nl', 'bachata', 'bachata_nl'],
        playlists: [
          { url: SPOT, style: 'salsa' },
          { url: APPLE, style: 'bachata_nl' },
        ],
      });
      expect(both.status).toBe(201);
    });

    it('the genre rule counts every part of the evening, not just the first', async () => {
      const r = await create({
        plannedDurationMin: 120,
        breaks: [{ startMin: 60, durationSec: 600 }],
        segments: [{ enabledStyles: ['salsa'] }, { enabledStyles: ['chacha'] }],
        playlists: [{ url: SPOT, style: 'salsa' }],
      });
      expect(r.status).toBe(400);
    });

    it('refuses two playlists for one style, and a playlist for a style that is not in the event', async () => {
      expect(
        (
          await create({
            enabledStyles: ['salsa'],
            playlists: [
              { url: SPOT, style: 'salsa' },
              { url: APPLE, style: 'salsa' },
            ],
          })
        ).status,
      ).toBe(400);
      expect(
        (await create({ enabledStyles: ['salsa'], playlists: [{ url: SPOT, style: 'chacha' }] }))
          .status,
      ).toBe(400);
    });

    it('fetches each playlist and shares the time between them, so no genre is crowded out', async () => {
      const fetched: string[] = [];
      const r = await create(
        {
          enabledStyles: ['salsa', 'bachata'],
          plannedDurationMin: 15, // 14 minutes: room for three four-minute songs
          playlists: [
            { url: SPOT, style: 'salsa' },
            { url: APPLE, style: 'bachata' },
          ],
        },
        fetched,
      );
      expect(r.status).toBe(201);
      expect(fetched).toHaveLength(2);
      expect(r.json.seeded).toBe(3);
    });
  });
});
