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
