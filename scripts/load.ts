/**
 * Load sanity (Phase 8): 40 SSE viewers + 25 contributors × 6 songs against one event.
 * Memory repository by default; set FIRESTORE_EMULATOR_HOST + FIREBASE_PROJECT_ID for the emulator.
 *
 *   pnpm load            # memory
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-qroove pnpm load
 *
 * Contributors start within 3 s and think 0.3–1.5 s between songs. Mutations on one event are
 * serialised, so a simultaneous burst of N submitters queues for about N × transaction time.
 *
 * Exits non-zero if any request fails with a 5xx or the mutation p95 is 2 s or more.
 */
import { buildApp } from '../apps/server/src/app.js';
import { parseEnv } from '../apps/server/src/env.js';

const VIEWERS = 40;
const SUBMITTERS = 25;
const SONGS_EACH = 6;
const P95_LIMIT_MS = 2000;

const env = parseEnv({
  ...process.env,
  NODE_ENV: 'test', // quiet logs, non-Secure cookies
  RATE_LIMIT_OFF: '1',
  PUBLIC_BASE_URL: 'http://127.0.0.1:3199',
});
const app = await buildApp(env);
await app.listen({ port: 3199, host: '127.0.0.1' });
const base = 'http://127.0.0.1:3199';

const durations: number[] = [];
const statuses = new Map<number, number>();
async function timed(url: string, init: RequestInit): Promise<unknown> {
  const t0 = performance.now();
  const res = await fetch(url, init);
  const body: unknown = await res.json().catch(() => null);
  durations.push(performance.now() - t0);
  statuses.set(res.status, (statuses.get(res.status) ?? 0) + 1);
  return body;
}
const json = (body: unknown, extra: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: base, ...extra },
  body: JSON.stringify(body),
});

// Event: create, exchange the secret for a session, start.
const created = (await (
  await fetch(`${base}/api/events`, json({ name: 'Load', timezone: 'UTC' }))
).json()) as { eventId: string; slug: string; adminUrl: string };
const secret = new URL(created.adminUrl).hash.replace('#k=', '');
const session = await fetch(
  `${base}/api/events/${created.eventId}/admin/session`,
  json({ secret }),
);
const cookies = session.headers.getSetCookie().map((c) => c.split(';')[0]!);
const csrf = decodeURIComponent(
  cookies.find((c) => c.startsWith(`qc_${created.eventId}=`))!.split('=')[1]!,
);
const start = await fetch(
  `${base}/api/events/${created.eventId}/start`,
  json({}, { cookie: cookies.join('; '), 'x-qroove-csrf': csrf }),
);
if (!start.ok) throw new Error(`start failed: ${start.status}`);

// SSE viewers.
const viewerAbort = new AbortController();
let messages = 0;
async function view() {
  const res = await fetch(`${base}/api/events/${created.eventId}/stream`, {
    signal: viewerAbort.signal,
  });
  const reader = res.body!.getReader();
  for (;;) {
    const { done } = await reader.read();
    if (done) return;
    messages++;
  }
}
for (let i = 0; i < VIEWERS; i++) view().catch(() => undefined);

// Contributors run concurrently; each submits its songs one after another, like a person would.
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function contribute(n: number) {
  await pause(Math.random() * 3000); // people do not all tap in the same millisecond
  const j = (await timed(
    `${base}/api/events/${created.eventId}/join`,
    json({ nickname: `P${n}` }),
  )) as { participantId: string; token: string };
  for (let s = 0; s < SONGS_EACH; s++) {
    await pause(300 + Math.random() * 1200);
    await timed(
      `${base}/api/events/${created.eventId}/requests`,
      json(
        {
          style: s % 2 ? 'bachata' : 'salsa',
          manual: { title: `Song ${n}-${s}`, artist: `Artist ${n}`, durationMs: 200_000 },
        },
        {
          authorization: `Bearer ${j.participantId}:${j.token}`,
          'idempotency-key': `${n}-${s}-${Math.random()}`,
        },
      ),
    );
  }
}
await Promise.all(Array.from({ length: SUBMITTERS }, (_, i) => contribute(i)));
await new Promise((r) => setTimeout(r, 500));

viewerAbort.abort();
await app.close();

durations.sort((a, b) => a - b);
const pct = (p: number) =>
  durations[Math.min(durations.length - 1, Math.floor(durations.length * p))]!;
const fivexx = [...statuses].filter(([s]) => s >= 500).reduce((n, [, c]) => n + c, 0);
console.log(
  JSON.stringify(
    {
      repo: env.REPO_DRIVER,
      requests: durations.length,
      statuses: Object.fromEntries(statuses),
      p50Ms: Math.round(pct(0.5)),
      p95Ms: Math.round(pct(0.95)),
      maxMs: Math.round(durations.at(-1)!),
      sseMessagesDelivered: messages,
    },
    null,
    2,
  ),
);
if (fivexx > 0 || pct(0.95) >= P95_LIMIT_MS) {
  console.error('FAILED: server errors or p95 over budget');
  process.exit(1);
}
