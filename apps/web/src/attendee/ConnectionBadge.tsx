import type { Connection } from '../shared/useEventStream';

const TEXT: Record<Connection, string> = {
  live: '',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
};

/** A small status for the header: live is the green dot alone. */
export function ConnectionBadge({ connection }: { connection: Connection }) {
  return (
    <span className={`conn conn-${connection}`} role="status">
      <span aria-hidden="true" className="dot" />
      {connection === 'live' ? <span className="sr-only">Live</span> : TEXT[connection]}
    </span>
  );
}
