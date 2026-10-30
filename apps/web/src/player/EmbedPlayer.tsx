import { useEffect, useRef } from 'react';
import { mountEmbed, type EmbedEvents, type Source } from './embed';

/** Hosts one provider player for one song; a new song means a new player. */
export function EmbedPlayer({ source, ...events }: { source: Source } & EmbedEvents) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(events);
  useEffect(() => {
    latest.current = events;
  });
  const { kind, id } = source;
  useEffect(() => {
    if (!host.current) return;
    return mountEmbed(
      host.current,
      { kind, id },
      {
        onPlaying: (ms) => latest.current.onPlaying(ms),
        onEnded: () => latest.current.onEnded(),
        onFailed: (why) => latest.current.onFailed(why),
      },
    );
  }, [kind, id]);
  return <div ref={host} className="embed-host" />;
}
