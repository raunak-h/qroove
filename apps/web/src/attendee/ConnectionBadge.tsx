import type { Connection } from '../shared/useEventStream';

const TEXT: Record<Connection, string> = {
  live: 'Live',
  reconnecting: 'Reconnecting — checking every 10 seconds',
  offline: 'Offline — showing the last update',
};

export function ConnectionBadge({ connection }: { connection: Connection }) {
  return (
    <p className={`conn conn-${connection}`} role="status">
      <span aria-hidden="true" className="dot" /> {TEXT[connection]}
    </p>
  );
}
