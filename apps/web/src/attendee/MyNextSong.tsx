import type { EventPublicView, MyRequests } from '@qroove/contracts';
import { formatCountdown } from '../shared/time';
import { nextSong } from './nextSong';

export function MyNextSong({
  view,
  mine,
  serverNow,
}: {
  view: EventPublicView;
  mine: MyRequests | null;
  serverNow: number;
}) {
  const n = nextSong(view, mine, serverNow);
  return (
    <section className="card next" aria-labelledby="mn-h">
      <h2 id="mn-h">My next song</h2>
      <p className="big">{n.headline}</p>
      {n.countdownMs !== null ? (
        <p className="timer">
          <span aria-hidden="true">~{formatCountdown(n.countdownMs)}</span>
          <span className="sr-only">About {formatCountdown(n.countdownMs)} until your song</span>
          {n.estimated ? <span className="badge">Estimated</span> : null}
        </p>
      ) : null}
      {n.detail ? <p className="muted">{n.detail}</p> : null}
    </section>
  );
}
