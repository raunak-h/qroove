import type { AdminState, CreateEventBody, ExportSnapshot } from '@qroove/contracts';
import { request } from '../shared/api';

export interface Created {
  eventId: string;
  slug: string;
  joinUrl: string;
  adminUrl: string;
  recoverySecret: string;
}

export interface AdminStateResponse extends AdminState {
  csrf: string;
}

const base = (id: string) => `/api/events/${id}`;

export const adminApi = {
  create: (body: CreateEventBody) => request<Created>('POST', '/api/events', { body }),
  /** Exchanges the fragment secret for the HttpOnly cookie. */
  session: (id: string, secret: string) =>
    request<{ ok: true; csrf: string }>('POST', `${base(id)}/admin/session`, { body: { secret } }),
  claim: (id: string, code: string) =>
    request<{ ok: true; csrf: string }>('POST', `${base(id)}/admin/handover/claim`, {
      body: { code },
    }),
  recover: (id: string, recoverySecret: string) =>
    request<{ ok: true; csrf: string }>('POST', `${base(id)}/admin/recover`, {
      body: { recoverySecret },
    }),
  state: (id: string, signal?: AbortSignal) =>
    request<AdminStateResponse>('GET', `${base(id)}/admin/state`, signal ? { signal } : {}),
  carryOver: (id: string) => request<ExportSnapshot>('GET', `${base(id)}/admin/carry-over`),
  exportSnapshot: (id: string) => request<ExportSnapshot>('GET', `${base(id)}/export`),
  importSnapshot: (body: {
    snapshot: ExportSnapshot;
    timezone: string;
    shuffle: boolean;
    selectedIndexes: number[];
    name: string;
  }) => request<Created & { seeded: number }>('POST', '/api/events/import', { body }),
};

/** A command bound to one event and CSRF token. */
export function commands(id: string, csrf: string) {
  const post = <T = { ok: true; version: number }>(path: string, body: unknown = {}) =>
    request<T>('POST', `${base(id)}${path}`, { body, csrf });
  return {
    start: () => post('/start'),
    pause: () => post('/admin/pause'),
    resume: () => post('/admin/resume'),
    skip: () => post('/admin/skip'),
    end: () => post('/admin/end'),
    extend: (endAt: number) => post('/admin/end-time', { endAt }),
    remove: (rid: string) => post(`/admin/remove/${rid}`),
    duplicate: (rid: string, decision: 'approve' | 'reject') =>
      post(`/admin/duplicate/${rid}`, { decision }),
    startBreak: (bid: string) => post(`/admin/breaks/${bid}/start`),
    endBreak: (bid: string) => post(`/admin/breaks/${bid}/end`),
    handover: () => post<{ code: string; expiresAt: number }>('/admin/handover'),
  };
}
export type Commands = ReturnType<typeof commands>;
