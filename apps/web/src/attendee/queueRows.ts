import type { BreakSpec, EventPublicView } from '@qroove/contracts';

export type QueueRow =
  { kind: 'song'; q: EventPublicView['queue'][number] } | { kind: 'break'; b: BreakSpec };

/**
 * Songs in play order with the breaks that are still to come placed where they fall: before the
 * first song predicted to start after the break begins.
 */
export function queueRows(view: EventPublicView): QueueRow[] {
  const start = new Map(view.preview.items.map((i) => [i.requestId, i.predictedStartMs]));
  const breaks = view.breaks
    .filter((b) => b.actualEnd === null && b.startsAt !== null)
    .sort((a, b) => a.startsAt! - b.startsAt!);
  const rows: QueueRow[] = [];
  let next = 0;
  for (const q of view.queue) {
    const s = start.get(q.requestId) ?? null;
    while (next < breaks.length && s !== null && s >= breaks[next]!.startsAt!) {
      rows.push({ kind: 'break', b: breaks[next++]! });
    }
    rows.push({ kind: 'song', q });
  }
  // A break after the last queued song (or when nothing is queued) still shows.
  while (next < breaks.length) rows.push({ kind: 'break', b: breaks[next++]! });
  return rows;
}

export const breakMinutes = (b: BreakSpec) => Math.round(b.durationSec / 60);
