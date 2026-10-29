import type { EventPublicView } from '@qroove/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';

export type Connection = 'live' | 'reconnecting' | 'offline';

export interface StreamState {
  view: EventPublicView | null;
  connection: Connection;
  error: ApiError | null;
  /** Server clock estimate: add to `Date.now()` to get server time. */
  clockOffset: number;
  refresh: () => void;
}

const POLL_MS = 10_000;

/**
 * Live public view over SSE. If the stream is not delivering, falls back to polling
 * `GET /public` every 10 s and reports Reconnecting (polling works) or Offline (nothing works).
 */
export function useEventStream(eventId: string | null, slug: string | null): StreamState {
  const [view, setView] = useState<EventPublicView | null>(null);
  const [connection, setConnection] = useState<Connection>('reconnecting');
  const [error, setError] = useState<ApiError | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const live = useRef(false);

  const accept = useCallback((v: EventPublicView) => {
    setView((old) => (old && old.version > v.version ? old : v));
    setClockOffset(v.serverNow - Date.now());
    setError(null);
  }, []);

  const poll = useCallback(() => {
    if (!slug) return;
    api
      .publicView(slug)
      .then((v) => {
        accept(v);
        if (!live.current) setConnection('reconnecting');
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status !== 0) setError(e);
        if (!live.current) setConnection('offline');
      });
  }, [slug, accept]);

  useEffect(() => {
    if (!eventId || typeof EventSource === 'undefined') return;
    const es = new EventSource(`/api/events/${eventId}/stream`);
    es.addEventListener('state', (m) => {
      live.current = true;
      setConnection('live');
      accept(JSON.parse((m as MessageEvent<string>).data) as EventPublicView);
    });
    es.onerror = () => {
      live.current = false;
      setConnection('reconnecting');
    };
    return () => es.close();
  }, [eventId, accept]);

  useEffect(() => {
    poll();
    const id = setInterval(() => {
      if (!live.current) poll();
    }, POLL_MS);
    const online = () => poll();
    const offline = () => {
      live.current = false;
      setConnection('offline');
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [poll]);

  return { view, connection, error, clockOffset, refresh: poll };
}

/** Re-renders every `ms` so countdowns tick without any network traffic. */
export function useTick(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
