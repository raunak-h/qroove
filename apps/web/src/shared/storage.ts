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
