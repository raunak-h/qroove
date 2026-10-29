import { DomainError, ERROR_COPY, type ErrorCode } from '@qroove/contracts';
import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError, type ZodType } from 'zod';

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new DomainError('VALIDATION', r.error.issues[0]?.message);
  return r.data;
}

const send = (code: ErrorCode, message?: string) => {
  const c = ERROR_COPY[code];
  return {
    status: c.http,
    body: { error: { code, message: message ?? c.message, action: c.action } },
  };
};

export function registerErrors(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError | Error, req, reply) => {
    let out;
    if (err instanceof DomainError) out = send(err.code, err.message);
    else if (err instanceof ZodError) out = send('VALIDATION', err.issues[0]?.message);
    else if ('statusCode' in err && err.statusCode === 413)
      out = send('VALIDATION', 'The request is too large.');
    else if ('statusCode' in err && err.statusCode && err.statusCode < 500)
      out = send('VALIDATION');
    else {
      req.log.error({ err }, 'unhandled error');
      return reply.code(500).send({
        error: {
          code: 'INTERNAL',
          message: 'Something went wrong.',
          action: 'Try again in a moment.',
        },
      });
    }
    return reply.code(out.status).send(out.body);
  });
}
