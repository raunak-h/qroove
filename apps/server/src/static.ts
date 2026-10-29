import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { BRAND } from '@qroove/config';

const IMMUTABLE = 'public, max-age=31536000, immutable';

function setHeaders(res: FastifyReply, path: string) {
  if (/[\\/](assets)[\\/]/.test(path) && !path.endsWith('.html')) {
    res.header('Cache-Control', IMMUTABLE);
  } else {
    res.header('Cache-Control', 'no-cache');
  }
}

export async function registerStatic(
  app: FastifyInstance,
  dirs: { web: string; docs: string },
): Promise<void> {
  const docsPrefix = `${BRAND.docsPath}/`;

  if (existsSync(dirs.docs)) {
    await app.register(fastifyStatic, {
      root: dirs.docs,
      prefix: docsPrefix,
      decorateReply: false,
      index: ['index.html'],
      setHeaders,
    });
  }
  if (existsSync(dirs.web)) {
    await app.register(fastifyStatic, {
      root: dirs.web,
      prefix: '/',
      index: ['index.html'],
      setHeaders,
    });
  }

  app.setNotFoundHandler(async (req, reply: FastifyReply) => {
    const path = req.url.split('?')[0] ?? '/';
    if (req.method !== 'GET' && req.method !== 'HEAD')
      return reply.code(404).send({ error: 'not_found' });
    if (path === '/api' || path.startsWith('/api/'))
      return reply.code(404).send({ error: 'not_found' });

    if (path === BRAND.docsPath || path.startsWith(docsPrefix)) {
      // VitePress clean URLs: /docs/foo -> foo.html
      const rel = path.slice(docsPrefix.length).replace(/\/$/, '');
      const candidate = rel === '' ? 'index.html' : `${rel}.html`;
      if (existsSync(join(dirs.docs, candidate))) {
        return reply
          .header('Cache-Control', 'no-cache')
          .type('text/html')
          .send(await readFile(join(dirs.docs, candidate)));
      }
      const notFound = join(dirs.docs, '404.html');
      return reply
        .code(404)
        .type('text/html')
        .send(existsSync(notFound) ? await readFile(notFound) : 'Not found');
    }

    const index = join(dirs.web, 'index.html');
    if (existsSync(index)) {
      return reply
        .header('Cache-Control', 'no-cache')
        .type('text/html')
        .send(await readFile(index));
    }
    return reply.code(404).send({ error: 'not_found' });
  });
}
