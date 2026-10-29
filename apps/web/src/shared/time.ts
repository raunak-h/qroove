export const pluralise = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

/** 83_000 → "01:23"; negative values clamp to zero. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** "3:45" or "225" (seconds) → ms; blank → undefined; anything else → null (invalid). */
export function parseDuration(text: string): number | undefined | null {
  const t = text.trim();
  if (!t) return undefined;
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(t);
  const secs = m ? Number(m[1]) * 60 + Number(m[2]) : /^\d{1,4}$/.test(t) ? Number(t) : NaN;
  return Number.isFinite(secs) && secs >= 1 && secs <= 3600 ? secs * 1000 : null;
}

export function formatClock(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(ms);
}
