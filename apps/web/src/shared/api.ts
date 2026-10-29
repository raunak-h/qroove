import type {
  EventPublicView,
  JoinResponse,
  MyRequests,
  RequestView,
  StyleId,
} from '@qroove/contracts';

export interface ResolvedLink {
  title: string;
  artist: string | null;
  durationMs: number | null;
  artworkUrl: string | null;
  provider: string;
  confidence: 'high' | 'medium' | 'low' | 'manual';
  suggestedStyle: StyleId | null;
}

export interface Creds {
  participantId: string;
  token: string;
}

/** Server errors already carry plain-language copy and a next action (ERROR_COPY). */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly action: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const OFFLINE = new ApiError(
  'OFFLINE',
  'You appear to be offline.',
  'Check your connection; we will keep trying.',
  0,
);

export async function request<T>(
  method: string,
  url: string,
  o: {
    body?: unknown;
    creds?: Creds | null;
    idempotencyKey?: string;
    signal?: AbortSignal;
    csrf?: string;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (o.body !== undefined) headers['content-type'] = 'application/json';
  if (o.creds) headers.authorization = `Bearer ${o.creds.participantId}:${o.creds.token}`;
  if (o.csrf) headers['x-qroove-csrf'] = o.csrf;
  if (o.idempotencyKey) headers['idempotency-key'] = o.idempotencyKey;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      ...(o.body !== undefined ? { body: JSON.stringify(o.body) } : {}),
      ...(o.signal ? { signal: o.signal } : {}),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw OFFLINE;
  }
  const json = (await res.json().catch(() => null)) as
    (T & { error?: { code: string; message: string; action: string } }) | null;
  if (!res.ok) {
    const err = json?.error;
    throw new ApiError(
      err?.code ?? 'UNKNOWN',
      err?.message ?? 'Something went wrong.',
      err?.action ?? 'Try again in a moment.',
      res.status,
    );
  }
  return json as T;
}

export const api = {
  bySlug: (slug: string) =>
    request<{ eventId: string; slug: string }>(
      'GET',
      `/api/events/by-slug/${encodeURIComponent(slug)}`,
    ),
  publicView: (slug: string, signal?: AbortSignal) =>
    request<EventPublicView>(
      'GET',
      `/api/events/${encodeURIComponent(slug)}/public`,
      signal ? { signal } : {},
    ),
  join: (eventId: string, nickname?: string) =>
    request<JoinResponse>('POST', `/api/events/${eventId}/join`, {
      body: nickname ? { nickname } : {},
    }),
  myRequests: (eventId: string, creds: Creds) =>
    request<MyRequests>('GET', `/api/events/${eventId}/my-requests`, { creds }),
  resolveLink: (url: string, signal?: AbortSignal) =>
    request<ResolvedLink>('POST', '/api/resolve-link', {
      body: { url },
      ...(signal ? { signal } : {}),
    }),
  submit: (
    eventId: string,
    creds: Creds,
    body: {
      style: StyleId;
      url?: string;
      manual?: { title: string; artist?: string; durationMs?: number };
    },
    idempotencyKey: string,
  ) =>
    request<{ request: RequestView }>('POST', `/api/events/${eventId}/requests`, {
      body,
      creds,
      idempotencyKey,
    }),
  withdraw: (eventId: string, creds: Creds, requestId: string) =>
    request<{ ok: true }>('DELETE', `/api/events/${eventId}/requests/${requestId}`, { creds }),
};
