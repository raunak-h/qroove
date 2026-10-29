import { buildApp } from './app.js';
import { parseEnv } from './env.js';

const env = parseEnv();
const app = await buildApp(env, { schedulePurge: true });
await app.listen({ port: env.PORT, host: '0.0.0.0' });

// Railway sends SIGTERM on deploy. Open SSE streams would keep a graceful close waiting, so give it a
// few seconds, then exit; clients reconnect on their own.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    setTimeout(() => process.exit(0), 5000).unref();
    void app.close().then(() => process.exit(0));
  });
}
