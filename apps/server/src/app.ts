import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';
import { createRepository } from './db/index.js';
import type { Repository } from './db/ports.js';
import { systemClock, type Clock } from './domain/clock.js';
import { randomIds } from './domain/ids.js';
import { registerErrors } from './api/errors.js';
import { registerRoutes } from './api/routes.js';
import { parseEnv, type Env } from './env.js';
import { createIngestion } from './ingestion/index.js';
import type { FetchLike } from './ingestion/fetch.js';
import { EventBus } from './realtime/bus.js';
import { RateLimiter } from './security/rateLimit.js';
import { createSecurity } from './security/tokens.js';
import { registerStatic } from './static.js';

export const VERSION = '0.0.0';

const here = dirname(fileURLToPath(import.meta.url));

export interface AppOverrides {
  repo?: Repository;
  clock?: Clock;
  fetch?: FetchLike;
}

export async function buildApp(
  env: Env = parseEnv(),
  overrides: AppOverrides = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: 16 * 1024,
    // Railway terminates TLS in front of us; trust it for the client IP used by rate limits.
    trustProxy: true,
    logger:
      env.NODE_ENV === 'test'
        ? false
        : {
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
                '*.token',
                '*.secret',
              ],
              censor: '[redacted]',
            },
          },
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: [
          "'self'",
          'data:',
          'https://i.scdn.co',
          'https://*.mzstatic.com',
          'https://i.ytimg.com',
        ],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
  });
  // VitePress emits small inline bootstrap scripts, so /docs needs 'unsafe-inline' for scripts.
  app.addHook('onSend', async (req, reply) => {
    const csp = reply.getHeader('content-security-policy');
    if (typeof csp === 'string' && (req.url === '/docs' || req.url.startsWith('/docs/'))) {
      reply.header(
        'content-security-policy',
        csp.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"),
      );
    }
  });
  await app.register(compress);

  const clock = overrides.clock ?? systemClock;
  const repo = overrides.repo ?? (await createRepository(env));
  const limiter = new RateLimiter(() => clock.now());
  const spotify =
    (env.SPOTIFY_CLIENT_ID ?? env.SPOTIFY_DEV_CLIENT_ID) && env.SPOTIFY_CLIENT_SECRET
      ? {
          id: (env.SPOTIFY_CLIENT_ID ?? env.SPOTIFY_DEV_CLIENT_ID)!,
          secret: env.SPOTIFY_CLIENT_SECRET,
        }
      : undefined;
  registerErrors(app);
  registerRoutes(app, {
    deps: { repo, clock, ids: randomIds },
    env,
    ingestion: createIngestion({
      fetch: overrides.fetch ?? ((url, init) => fetch(url, init)),
      now: () => clock.now(),
      spotify,
    }),
    bus: new EventBus(repo),
    sec: createSecurity({
      publicBaseUrl: env.PUBLIC_BASE_URL,
      production: env.NODE_ENV === 'production',
      cookieSecret: env.COOKIE_SECRET,
    }),
    limiter,
  });
  app.addHook('onClose', async () => {
    limiter.close();
    await repo.close();
  });

  app.get('/api/health', async () => ({
    ok: true,
    version: VERSION,
    commit: env.RAILWAY_GIT_COMMIT_SHA ?? null,
  }));

  await registerStatic(app, {
    web: env.WEB_DIST ?? resolve(here, '../../web/dist'),
    docs: env.DOCS_DIST ?? resolve(here, '../../../docs/.vitepress/dist'),
  });

  return app;
}
