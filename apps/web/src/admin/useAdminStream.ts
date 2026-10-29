import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../shared/api';
import type { Connection } from '../shared/useEventStream';
import { adminApi, type AdminStateResponse } from './adminApi';

export interface AdminStream {
  state: AdminStateResponse | null;
  csrf: string | null;
  connection: Connection;
  error: ApiError | null;
  refresh: () => void;
}

const POLL_MS = 10_000;

/**
 * Admin state: one authenticated fetch (which also yields the CSRF token), then the admin SSE
 * stream, with 10 s polling whenever the stream is down.
 */
export function useAdminStream(eventId: string): AdminStream {
  const [state, setState] = useState<AdminStateResponse | null>(null);
  const [csrf, setCsrf] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection>('reconnecting');
  const [error, setError] = useState<ApiError | null>(null);
  const live = useRef(false);

  const poll = useCallback(() => {
    adminApi
      .state(eventId)
      .then((s) => {
        setCsrf(s.csrf);
        setState((old) => (old && old.view.version > s.view.version ? old : s));
        setError(null);
        if (!live.current) setConnection('reconnecting');
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError) setError(e);
        if (!live.current) setConnection('offline');
      });
  }, [eventId]);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const es = new EventSource(`/api/events/${eventId}/admin/stream`);
    es.addEventListener('state', (m) => {
      live.current = true;
      setConnection('live');
      const s = JSON.parse((m as MessageEvent<string>).data) as AdminStateResponse;
      setState((old) =>
        old && old.view.version > s.view.version ? old : { ...s, csrf: old?.csrf ?? '' },
      );
    });
    es.onerror = () => {
      live.current = false;
      setConnection('reconnecting');
    };
    return () => es.close();
  }, [eventId]);

  useEffect(() => {
    poll();
    const id = setInterval(() => {
      if (!live.current) poll();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  return { state, csrf, connection, error, refresh: poll };
}
