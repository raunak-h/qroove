import type { FastifyReply, FastifyRequest } from 'fastify';
import type { EventBus, Subscriber } from './bus.js';

export const HEARTBEAT_MS = 20_000;

/** Takes over the raw socket and streams bus messages until the client disconnects. */
export async function openStream(
  req: FastifyRequest,
  reply: FastifyReply,
  bus: EventBus,
  eventId: string,
  render: Subscriber['render'],
): Promise<void> {
  reply.hijack();
  const res = reply.raw;
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
    ...Object.fromEntries(
      Object.entries(reply.getHeaders()).filter(
        ([k]) => k.startsWith('content-security') || k === 'x-content-type-options',
      ),
    ),
  });
  res.write('retry: 3000\n\n');
  const ping = setInterval(() => res.write(': keep-alive\n\n'), HEARTBEAT_MS);
  const off = await bus.subscribe(eventId, {
    render,
    send: (name, data) => res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`),
  });
  const close = () => {
    clearInterval(ping);
    off();
  };
  req.raw.on('close', close);
}
