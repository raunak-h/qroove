import { useState } from 'react';
import { ApiError } from '../shared/api';

/** Runs an admin command, exposing busy/error state; refreshes afterwards so the UI never lags. */
export function useAction(refresh: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e : null);
      return undefined;
    } finally {
      setBusy(false);
      refresh();
    }
  }
  return { run, busy, error };
}

export function ErrorLine({ error }: { error: ApiError | null }) {
  return error ? (
    <p className="error" role="alert">
      {error.message} {error.action}
    </p>
  ) : null;
}
