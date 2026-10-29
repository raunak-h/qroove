import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';
import { parseEnv, type Env } from './env.js';
import { registerStatic } from './static.js';

export const VERSION = '0.0.0';

const here = dirname(fileURLToPath(import.meta.url));

export async function buildApp(env: Env = parseEnv()): Promise<FastifyInstance> {
  const app = Fastify({
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
