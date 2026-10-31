import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { parseEnv } from '../src/env.js';

describe('GET /api/health', () => {
  it('reports ok with version and commit', async () => {
    const app = await buildApp(parseEnv({ NODE_ENV: 'test', RAILWAY_GIT_COMMIT_SHA: 'abc123' }));
    const res = await app.inject('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, version: expect.any(String), commit: 'abc123' });
    await app.close();
  });

  it('404s unknown api routes as JSON', async () => {
    const app = await buildApp(parseEnv({ NODE_ENV: 'test' }));
    const res = await app.inject('/api/nope');
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('env', () => {
  it('defaults to memory driver without credentials', () => {
    expect(parseEnv({}).REPO_DRIVER).toBe('memory');
  });
  it('picks firestore when credentials are present', () => {
    expect(parseEnv({ FIREBASE_SERVICE_ACCOUNT_B64: 'x' }).REPO_DRIVER).toBe('firestore');
  });
});

describe('CSP', () => {
  it('allows inline scripts only under /docs', async () => {
    const app = await buildApp(parseEnv({ NODE_ENV: 'test' }));
    const api = await app.inject('/api/health');
    const docs = await app.inject('/docs/');
    expect(api.headers['content-security-policy']).toContain(
      "script-src 'self' https://www.youtube.com https://sdk.scdn.co;",
    );
    expect(api.headers['content-security-policy']).not.toContain("'unsafe-inline' https");
    expect(docs.headers['content-security-policy']).toContain("script-src 'self' 'unsafe-inline'");
    await app.close();
  });
});
