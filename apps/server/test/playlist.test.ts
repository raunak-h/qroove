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

const spot = (n: number, mins = 4) =>
  Array.from({ length: n }, (_, i) => ({
    title: `Song ${i}`,
    artist: 'Band',
    durationMs: mins * 60_000,
    sourceUrl: `https://open.spotify.com/track/${String(i).padStart(22, 'x')}`,
  }));

describe('POST /api/resolve-playlist', () => {
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

  it('turns a public playlist link into its songs, in order', async () => {
    const seen: string[] = [];
    const t = await testApp({
      fetch: (async (url: string) => {
        seen.push(url);
        return new Response(page);
      }) as any,
    });
    apps.push(t.app);
    const r = await t.api.call('POST', '/api/resolve-playlist', {
      body: { url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' },
    });
    expect(r.status).toBe(200);
    expect(seen).toEqual(['https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M']);
    expect(r.json.tracks).toHaveLength(40);
    expect(r.json.tracks[0]).toEqual({
      title: 'Song 0',
      artist: 'Band',
      durationMs: 240000,
      sourceUrl: 'https://open.spotify.com/track/t0',
    });
  });

  it('refuses unsupported links with the plain-language 422, and is rate limited', async () => {
    const t = await testApp();
    apps.push(t.app);
    const bad = await t.api.call('POST', '/api/resolve-playlist', {
      body: { url: 'https://evil.example/x' },
    });
    expect(bad.status).toBe(422);
  });
});

describe('POST /api/events with songs from playlists', () => {
  const apps: FastifyInstance[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((a) => a.close()));
  });
  const create = async (body: object) => {
    const t = await testApp();
    apps.push(t.app);
    return t.api.call('POST', '/api/events', {
      body: { timezone: 'UTC', plannedDurationMin: 120, ...body },
    });
  };
  const songs = (style: string, n: number, mins = 4) =>
    spot(n, mins).map((s) => ({ ...s, title: `${style} ${s.title}`, style }));

  it('queues the organiser’s songs in their order, up to one minute less than the planned time', async () => {
    const r = await create({
      enabledStyles: ['salsa'],
      plannedDurationMin: 60,
      songs: songs('salsa', 20),
    });
    expect(r.status).toBe(201);
    expect(r.json.seeded).toBe(14); // 14 x 4 min = 56 min <= 59 min; a 15th would be 60 min
  });

  it('needs a planned time', async () => {
    const r = await create({
      enabledStyles: ['salsa'],
      plannedDurationMin: undefined,
      songs: songs('salsa', 3),
    });
    expect(r.status).toBe(400);
  });

  it('needs at least one song for every active genre, counting non-Latin styles with their genre', async () => {
    expect(
      (await create({ enabledStyles: ['salsa', 'bachata'], songs: songs('salsa', 3) })).status,
    ).toBe(400);
    const ok = await create({
      enabledStyles: ['salsa', 'salsa_nl', 'bachata', 'bachata_nl'],
      songs: [...songs('salsa', 3), ...songs('bachata_nl', 3)],
    });
    expect(ok.status).toBe(201);
  });

  it('counts every part of the evening, and refuses a style that is not in the event', async () => {
    const parts = await create({
      breaks: [{ startMin: 60, durationSec: 600 }],
      segments: [{ enabledStyles: ['salsa'] }, { enabledStyles: ['chacha'] }],
      songs: songs('salsa', 3),
    });
    expect(parts.status).toBe(400);
    expect((await create({ enabledStyles: ['salsa'], songs: songs('chacha', 2) })).status).toBe(
      400,
    );
  });

  it('keeps only supported source links on the songs', async () => {
    const t = await testApp();
    apps.push(t.app);
    const r = await t.api.call('POST', '/api/events', {
      body: {
        timezone: 'UTC',
        plannedDurationMin: 120,
        enabledStyles: ['salsa'],
        songs: [
          {
            title: 'A',
            artist: null,
            durationMs: 200000,
            sourceUrl: 'https://evil.example/x',
            style: 'salsa',
          },
          {
            title: 'B',
            artist: null,
            durationMs: 200000,
            sourceUrl: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=1',
            style: 'salsa',
          },
        ],
      },
    });
    expect(r.status).toBe(201);
    const secret = new URL(r.json.adminUrl).hash.slice(3);
    await t.api.call('POST', `/api/events/${r.json.eventId}/admin/session`, { body: { secret } });
    const st = await t.api.admin('GET', r.json.eventId, '/admin/state');
    const urls = st.json.requests.map((q: any) => q.sourceUrl);
    expect(urls).toEqual([null, 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC']);
  });
});

describe('POST /api/events/:id/requests/batch', () => {
  const apps: FastifyInstance[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((a) => a.close()));
  });
  async function started() {
    const t = await testApp();
    apps.push(t.app);
    const { createAndStart } = await import('./api-helpers.js');
    const { created } = await createAndStart(t.api, {
      submissionLimit: 3,
      enabledStyles: ['salsa', 'bachata'],
    });
    const j = await t.api.call('POST', `/api/events/${created.eventId}/join`, { body: {} });
    return {
      t,
      id: created.eventId as string,
      me: j.json as { participantId: string; token: string },
    };
  }

  it('adds songs in the order given and stops when the quota is full', async () => {
    const { t, id, me } = await started();
    const r = await t.api.call('POST', `/api/events/${id}/requests/batch`, {
      auth: me,
      body: { style: 'salsa', songs: spot(5) },
    });
    expect(r.status).toBe(200);
    expect(r.json.accepted).toBe(3);
    expect(r.json.results.map((x: any) => x.status)).toEqual([
      'ADDED',
      'ADDED',
      'ADDED',
      'QUOTA_FULL',
      'QUOTA_FULL',
    ]);
    const mine = await t.api.call('GET', `/api/events/${id}/my-requests`, { auth: me });
    expect(mine.json.requests.map((q: any) => q.title)).toEqual(['Song 0', 'Song 1', 'Song 2']);
  });

  it('skips duplicates without using quota, and needs a signed-in participant', async () => {
    const { t, id, me } = await started();
    const dup = [spot(1)[0]!, spot(1)[0]!, spot(2)[1]!];
    const r = await t.api.call('POST', `/api/events/${id}/requests/batch`, {
      auth: me,
      body: { style: 'salsa', songs: dup },
    });
    expect(r.json.results.map((x: any) => x.status)).toEqual(['ADDED', 'DUPLICATE', 'ADDED']);
    const anon = await t.api.call('POST', `/api/events/${id}/requests/batch`, {
      body: { style: 'salsa', songs: spot(1) },
    });
    expect(anon.status).toBe(401);
  });

  it('refuses a style the event does not allow, for the whole batch', async () => {
    const { t, id, me } = await started();
    const r = await t.api.call('POST', `/api/events/${id}/requests/batch`, {
      auth: me,
      body: { style: 'chacha', songs: spot(2) },
    });
    expect(r.status).toBe(400);
  });
});
