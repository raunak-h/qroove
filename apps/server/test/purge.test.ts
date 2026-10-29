import { describe, expect, it } from 'vitest';
import { testApp } from './api-helpers.js';

describe('POST /api/internal/purge', () => {
  it('is hidden without CRON_SECRET configured', async () => {
    const { api } = await testApp();
    expect((await api.call('POST', '/api/internal/purge')).status).toBe(404);
  });

  it('requires the secret header and returns the report', async () => {
    const { api } = await testApp({ env: { CRON_SECRET: 'cron-secret-value' } });
    expect((await api.call('POST', '/api/internal/purge')).status).toBe(401);
    expect(
      (await api.call('POST', '/api/internal/purge', { headers: { 'x-cron-secret': 'nope' } }))
        .status,
    ).toBe(401);
    const ok = await api.call('POST', '/api/internal/purge', {
      headers: { 'x-cron-secret': 'cron-secret-value' },
    });
    expect(ok.status).toBe(200);
    expect(ok.json).toEqual({
      draftsDeleted: 0,
      participantsDeleted: 0,
      auditDeleted: 0,
      idempotencyDeleted: 0,
    });
  });

  it('deletes a draft that is older than 7 days', async () => {
    const { api, clock } = await testApp({ env: { CRON_SECRET: 'cron-secret-value' } });
    const c = await api.call('POST', '/api/events', { body: { timezone: 'UTC' } });
    clock.advance(8 * 24 * 3600 * 1000);
    const r = await api.call('POST', '/api/internal/purge', {
      headers: { 'x-cron-secret': 'cron-secret-value' },
    });
    expect(r.json.draftsDeleted).toBe(1);
    expect((await api.call('GET', `/api/events/by-slug/${c.json.slug}`)).status).toBe(404);
  });
});
