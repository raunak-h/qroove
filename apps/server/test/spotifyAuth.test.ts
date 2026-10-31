import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { parseEnv } from '../src/env.js';

const apps: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

async function setup() {
  const bodies: string[] = [];
  const app = await buildApp(
    parseEnv({
      NODE_ENV: 'test',
      SPOTIFY_CLIENT_ID: 'id',
      SPOTIFY_CLIENT_SECRET: 'secret',
      COOKIE_SECRET: 'x'.repeat(32),
    }),
    {
      fetch: async (_url, init) => {
        bodies.push(String(init?.body));
        return new Response(
          JSON.stringify({ access_token: 'access', expires_in: 3600, refresh_token: 'refresh-me' }),
        );
      },
    },
  );
  apps.push(app);
  return { app, bodies };
}
const cookiesOf = (res: { headers: Record<string, unknown> }) =>
  ([res.headers['set-cookie']].flat() as string[]).map((c) => c.split(';')[0]!).join('; ');

describe('Spotify sign-in', () => {
  it('logs in, keeps the refresh token out of the page, and returns access tokens', async () => {
    const { app, bodies } = await setup();
    const login = await app.inject('/api/spotify/login?return=/admin/ev1');
    const to = new URL(login.headers.location as string);
    expect(to.hostname).toBe('accounts.spotify.com');
    expect(to.searchParams.get('scope')).toContain('streaming');
    const state = to.searchParams.get('state')!;

    const cb = await app.inject({
      url: `/api/spotify/callback?code=c&state=${state}`,
      headers: { cookie: cookiesOf(login) },
    });
    expect(cb.headers.location).toBe('/admin/ev1');
    const set = [cb.headers['set-cookie']].flat() as string[];
    expect(set.find((c) => c.startsWith('qs_session='))).toContain('HttpOnly');
    expect(set.join()).not.toContain('refresh-me');

    const session = set.find((c) => c.startsWith('qs_session='))!.split(';')[0]!;
    const token = await app.inject({ url: '/api/spotify/token', headers: { cookie: session } });
    expect(token.json()).toEqual({ accessToken: 'access' });
    expect(bodies.at(-1)).toContain('refresh_token=refresh-me');
  });

  it('refuses a callback whose state does not match', async () => {
    const { app, bodies } = await setup();
    const login = await app.inject('/api/spotify/login?return=/admin/ev1');
    const cb = await app.inject({
      url: '/api/spotify/callback?code=c&state=forged',
      headers: { cookie: cookiesOf(login) },
    });
    expect(cb.headers.location).toBe('/');
    expect(bodies).toEqual([]);
  });

  it('only returns to organiser pages', async () => {
    const { app } = await setup();
    const res = await app.inject('/api/spotify/login?return=https://evil.example');
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('reports a signed-out or tampered session as no token', async () => {
    const { app } = await setup();
    for (const headers of [{}, { cookie: 'qs_session=tampered' }]) {
      const r = await app.inject({ url: '/api/spotify/token', headers });
      expect(r.json()).toEqual({ accessToken: null });
    }
  });
});

describe('Spotify search and playlists', () => {
  const track = {
    id: 't'.repeat(22),
    name: 'Song',
    duration_ms: 200000,
    artists: [{ name: 'Band' }],
  };
  const serve = async (routes: (url: string) => Response) => {
    const app = await buildApp(
      parseEnv({
        NODE_ENV: 'test',
        SPOTIFY_CLIENT_ID: 'id',
        SPOTIFY_CLIENT_SECRET: 'secret',
        COOKIE_SECRET: 'x'.repeat(32),
      }),
      {
        fetch: async (url) =>
          String(url).includes('accounts.spotify.com')
            ? new Response(
                JSON.stringify({ access_token: 'a', expires_in: 3600, refresh_token: 'r' }),
              )
            : routes(String(url)),
      },
    );
    apps.push(app);
    const login = await app.inject('/api/spotify/login?for=guest&return=/e/ABC123');
    const to = new URL(login.headers.location as string);
    expect(to.searchParams.get('scope')).not.toContain('streaming');
    const cb = await app.inject({
      url: `/api/spotify/callback?code=c&state=${to.searchParams.get('state')}`,
      headers: { cookie: cookiesOf(login) },
    });
    expect(cb.headers.location).toBe('/e/ABC123');
    const cookie = ([cb.headers['set-cookie']].flat() as string[])
      .find((c) => c.startsWith('qs_session='))!
      .split(';')[0]!;
    return { app, cookie };
  };

  it('searches with the app credentials, with no login', async () => {
    const { app } = await serve(() => new Response(JSON.stringify({ tracks: { items: [track] } })));
    const r = await app.inject('/api/spotify/search?q=vivir');
    expect(r.json().tracks).toEqual([
      {
        title: 'Song',
        artist: 'Band',
        durationMs: 200000,
        sourceUrl: `https://open.spotify.com/track/${track.id}`,
      },
    ]);
  });

  it('lists and opens a guest playlist, without giving the page a token', async () => {
    const { app, cookie } = await serve((url) =>
      url.includes('/me/playlists')
        ? new Response(JSON.stringify({ items: [{ id: 'p'.repeat(22), name: 'Mine' }, null] }))
        : new Response(JSON.stringify({ items: [{ item: track }, { item: null }] })),
    );
    const list = await app.inject({ url: '/api/spotify/me/playlists', headers: { cookie } });
    expect(list.json()).toEqual({
      signedIn: true,
      playlists: [{ id: 'p'.repeat(22), name: 'Mine' }],
    });
    const songs = await app.inject({
      url: `/api/spotify/me/playlists/${'p'.repeat(22)}`,
      headers: { cookie },
    });
    expect(songs.json().tracks).toHaveLength(1);
    expect(songs.body).not.toContain('access');
  });

  it('explains a refused account and a playlist Spotify will not share', async () => {
    const { app, cookie } = await serve(() => new Response('{}', { status: 403 }));
    const list = await app.inject({ url: '/api/spotify/me/playlists', headers: { cookie } });
    expect(list.json().error.message).toMatch(/pilot list/);
    const songs = await app.inject({
      url: `/api/spotify/me/playlists/${'p'.repeat(22)}`,
      headers: { cookie },
    });
    expect(songs.json().error.message).toMatch(/own or collaborate/);
  });

  it('reports no session as signed out', async () => {
    const { app } = await serve(() => new Response('{}'));
    const r = await app.inject('/api/spotify/me/playlists');
    expect(r.json()).toEqual({ signedIn: false, playlists: [] });
  });
});

describe('event limits', () => {
  it('scales the song limit with planned time and caps songs in a row at 3', async () => {
    const { app } = await setup();
    const make = (body: object) =>
      app.inject({
        method: 'POST',
        url: '/api/events',
        payload: { timezone: 'UTC', ...body },
      });
    expect((await make({ plannedDurationMin: 75, submissionLimit: 25 })).statusCode).toBe(201);
    expect((await make({ plannedDurationMin: 60, submissionLimit: 25 })).statusCode).toBe(400);
    expect((await make({ masterRunCap: 4 })).statusCode).toBe(400);
    const short = await make({ plannedDurationMin: 30 });
    expect(short.json().rules.submissionLimit).toBe(10);
    const dflt = await make({ plannedDurationMin: 120 });
    expect(dflt.json().rules.submissionLimit).toBe(20);
    expect(dflt.json().rules.segments[0].masterRunCap).toBe(1);
  });
});
