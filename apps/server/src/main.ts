import { buildApp } from './app.js';
import { parseEnv } from './env.js';

const env = parseEnv();
const app = await buildApp(env);
await app.listen({ port: env.PORT, host: '0.0.0.0' });
