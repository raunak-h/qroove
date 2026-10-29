/* eslint-disable @typescript-eslint/no-explicit-any -- HTTP response bodies are untyped JSON in tests */
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { MemoryRepository } from '../src/db/memory/index.js';
import { FakeClock } from '../src/domain/clock.js';
import { parseEnv } from '../src/env.js';
import type { FetchLike } from '../src/ingestion/fetch.js';

export const ORIGIN = 'http://localhost:3000';

export type Routes = Record<string, (url: URL, init?: RequestInit) => unknown>;

/** Fake network: each key is a URL prefix; anything unmatched fails the test loudly. */
export function mockFetch(routes: Routes): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.startsWith(k));
    if (!key) throw new Error(`unexpected fetch: ${url}`);
    const out = routes[key]!(new URL(url), init);
    if (out instanceof Response) return out;
    return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json' } });
  }) as FetchLike & { calls: string[] };
  f.calls = calls;
  return f;
}

export async function testApp(opts: { fetch?: FetchLike; env?: Record<string, string> } = {}) {
  const clock = new FakeClock();
  const repo = new MemoryRepository();
  const app = await buildApp(parseEnv({ NODE_ENV: 'test', ...opts.env }), {
    repo,
    clock,
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  });
  return { app, clock, repo, api: new Client(app) };
}

export class Client {
  cookies = new Map<string, string>();
  constructor(private readonly app: FastifyInstance) {}

  async call(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    o: {
      body?: unknown;
      auth?: { participantId: string; token: string };
      headers?: Record<string, string>;
      ip?: string;
    } = {},
  ) {
    const headers: Record<string, string> = { origin: ORIGIN, ...o.headers };
    if (o.auth) headers.authorization = `Bearer ${o.auth.participantId}:${o.auth.token}`;
    const jar = [...this.cookies].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
    if (jar) headers.cookie = jar;
    const res = await this.app.inject({
      method,
      url,
      headers,
      ...(o.body !== undefined ? { payload: o.body as object } : {}),
      ...(o.ip ? { remoteAddress: o.ip } : {}),
    });
    const set = res.headers['set-cookie'];
    for (const c of Array.isArray(set) ? set : set ? [set] : []) {
      const [pair] = c.split(';');
      const i = pair!.indexOf('=');
      this.cookies.set(pair!.slice(0, i), decodeURIComponent(pair!.slice(i + 1)));
    }
    let json: any = null;
    try {
      json = res.json();
    } catch {
      /* not JSON */
    }
    return { status: res.statusCode, json, headers: res.headers, text: res.body };
  }

  /** Admin call: attaches the CSRF header from the cookie the server issued. */
  admin(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    eventId: string,
    path: string,
    body?: unknown,
  ) {
    const csrf = this.cookies.get(`qc_${eventId}`);
    return this.call(method, `/api/events/${eventId}${path}`, {
      ...(body !== undefined ? { body } : {}),
      headers: csrf ? { 'x-qroove-csrf': csrf } : {},
    });
  }
}

export async function createAndStart(api: Client, body: Record<string, unknown> = {}) {
  const c = await api.call('POST', '/api/events', {
    body: { name: 'Friday', timezone: 'Europe/London', ...body },
  });
  const secret = new URL(c.json.adminUrl).hash.replace('#k=', '');
  const s = await api.call('POST', `/api/events/${c.json.eventId}/admin/session`, {
    body: { secret },
  });
  if (s.status !== 200) throw new Error(`session failed ${JSON.stringify(s.json)}`);
  const start = await api.admin('POST', c.json.eventId, '/start');
  return { created: c.json, secret, start };
}
