import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DomainError } from '@qroove/contracts';
import { parse } from './errors.js';
import { fetchJson, type FetchLike } from '../ingestion/fetch.js';
import { parseCookies, requireSameOrigin, type Security } from '../security/tokens.js';

const SCOPES = 'streaming user-read-email user-read-private user-modify-playback-state';
const STATE_COOKIE = 'qs_state';
const SESSION_COOKIE = 'qs_session';
const SESSION_MAX_AGE = 30 * 86400;
const RETURN_PATH = /^\/admin\/[A-Za-z0-9_-]{1,64}$/;

const TokenResponse = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
});

export interface SpotifyAuthOptions {
  base: string;
  creds: { id: string; secret: string } | undefined;
  /** Encrypts the session cookie; a missing secret only means sign-ins end at a restart. */
  cookieSecret: string | undefined;
  doFetch: FetchLike;
  sec: Security;
  limit: (key: string, max: number, windowMs: number) => void;
}

/**
 * Spotify sign-in for the organiser's device (ADR 0019). Nothing is stored on our side: the refresh
 * token lives in an encrypted HttpOnly cookie on that device, and the page only ever receives
 * short-lived access tokens, which Spotify's player requires.
 */
export function registerSpotifyAuth(app: FastifyInstance, o: SpotifyAuthOptions) {
  const key = createHash('sha256')
    .update(o.cookieSecret ?? randomBytes(32))
    .update('spotify-session')
    .digest();
  const seal = (text: string) => {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', key, iv);
    const body = Buffer.concat([c.update(text, 'utf8'), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url');
  };
  const open = (sealed: string | undefined): string | null => {
    if (!sealed) return null;
    try {
      const raw = Buffer.from(sealed, 'base64url');
      const d = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
      d.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
    } catch {
      return null;
    }
  };
  const cookie = (name: string, value: string, maxAge: number) =>
    // Lax: the state cookie must come back on the redirect from Spotify.
    `${name}=${encodeURIComponent(value)}; HttpOnly; Path=/api/spotify; SameSite=Lax${
      o.sec.secure ? '; Secure' : ''
    }; Max-Age=${maxAge}`;
  const redirectUri = `${o.base}/api/spotify/callback`;

  const tokenRequest = async (params: Record<string, string>) => {
    const basic = Buffer.from(`${o.creds!.id}:${o.creds!.secret}`).toString('base64');
    const t = TokenResponse.safeParse(
      await fetchJson(o.doFetch, 'https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          authorization: `Basic ${basic}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params).toString(),
      }),
    );
    if (!t.success) throw new DomainError('METADATA_UNAVAILABLE');
    return t.data;
  };
  const backTo = (reply: FastifyReply, path: string, cookies: string[]) => {
    reply.header('set-cookie', cookies);
    reply.header('cache-control', 'no-store');
    return reply.redirect(path);
  };

  app.get('/api/spotify/login', async (req, reply) => {
    o.limit(`spotify-login:${req.ip}`, 10, 60_000);
    const { return: back } = parse(z.object({ return: z.string().regex(RETURN_PATH) }), req.query);
    if (!o.creds) throw new DomainError('METADATA_UNAVAILABLE');
    const state = randomBytes(16).toString('hex');
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: o.creds.id,
      scope: SCOPES,
      redirect_uri: redirectUri,
      state,
    });
    return backTo(reply, `https://accounts.spotify.com/authorize?${q}`, [
      cookie(STATE_COOKIE, `${state}|${back}`, 600),
    ]);
  });

  app.get('/api/spotify/callback', async (req, reply) => {
    const q = z
      .object({
        state: z.string().optional(),
        code: z.string().optional(),
        error: z.string().optional(),
      })
      .parse(req.query);
    const [state, back] = (parseCookies(req.headers.cookie)[STATE_COOKIE] ?? '').split('|');
    const clear = cookie(STATE_COOKIE, '', 0);
    // A callback we did not start must not sign anyone in or choose where they land.
    if (!state || !back || !RETURN_PATH.test(back) || q.state !== state || !o.creds) {
      return backTo(reply, '/', [clear]);
    }
    if (!q.code) return backTo(reply, `${back}?spotify=denied`, [clear]);
    try {
      const t = await tokenRequest({
        grant_type: 'authorization_code',
        code: q.code,
        redirect_uri: redirectUri,
      });
      if (!t.refresh_token) throw new Error('no refresh token');
      return backTo(reply, back, [
        clear,
        cookie(SESSION_COOKIE, seal(t.refresh_token), SESSION_MAX_AGE),
      ]);
    } catch {
      return backTo(reply, `${back}?spotify=failed`, [clear]);
    }
  });

  // A signed-out device gets a plain null: that is a normal state, not an error.
  app.get('/api/spotify/token', async (req, reply) => {
    o.limit(`spotify-token:${req.ip}`, 30, 60_000);
    reply.header('cache-control', 'no-store');
    const refresh = open(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
    if (!refresh || !o.creds) return { accessToken: null };
    try {
      const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refresh });
      if (t.refresh_token) {
        reply.header('set-cookie', [
          cookie(SESSION_COOKIE, seal(t.refresh_token), SESSION_MAX_AGE),
        ]);
      }
      return { accessToken: t.access_token };
    } catch {
      return { accessToken: null };
    }
  });

  app.post('/api/spotify/logout', async (req, reply) => {
    requireSameOrigin(o.sec, req);
    reply.header('set-cookie', [cookie(SESSION_COOKIE, '', 0)]);
    return { ok: true };
  });
}
