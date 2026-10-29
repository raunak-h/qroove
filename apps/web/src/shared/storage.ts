import type { Creds } from './api';

const key = (eventId: string) => `qroove:p:${eventId}`;

export function loadCreds(eventId: string): Creds | null {
  try {
    const raw = localStorage.getItem(key(eventId));
    const v = raw ? (JSON.parse(raw) as Partial<Creds>) : null;
    return v?.participantId && v.token ? { participantId: v.participantId, token: v.token } : null;
  } catch {
    return null;
  }
}

export function saveCreds(eventId: string, c: Creds) {
  try {
    localStorage.setItem(key(eventId), JSON.stringify(c));
  } catch {
    /* private mode: the session still works until reload */
  }
}

export function clearCreds(eventId: string) {
  try {
    localStorage.removeItem(key(eventId));
  } catch {
    /* ignore */
  }
}

export type Theme = 'dark' | 'light';

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem('qroove:theme', t);
  } catch {
    /* ignore */
  }
}

const joinKeyName = (slug: string) => `qroove:jk:${slug}`;

/**
 * The join secret arrives in the QR code's URL fragment. Keep it for this tab only and take it out
 * of the address bar, so it is not shared by copying the page link.
 */
export function takeJoinKey(slug: string): string | null {
  const m = /(?:^|[#&])j=([\w-]{16,128})/.exec(location.hash);
  try {
    if (m) {
      sessionStorage.setItem(joinKeyName(slug), m[1]!);
      history.replaceState(null, '', location.pathname + location.search);
      return m[1]!;
    }
    return sessionStorage.getItem(joinKeyName(slug));
  } catch {
    return m?.[1] ?? null;
  }
}
