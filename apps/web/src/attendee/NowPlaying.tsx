import type { EventPublicView } from '@qroove/contracts';
import { GenreSwatch } from '../shared/Genre';

export function NowPlaying({ view }: { view: EventPublicView }) {
  const np = view.nowPlaying;
  return (
    <section className="card now" aria-labelledby="np-h">
      <h2 id="np-h">Now playing</h2>
      {np ? (
        <>
          <p className="big">{np.track.title}</p>
          <p className="muted">
            {np.track.artist ? `${np.track.artist} ` : ''}
            <GenreSwatch style={np.track.style} />
          </p>
        </>
      ) : (
        <p className="muted">
          {view.state === 'PAUSED' || view.state === 'TRANSFERRING'
            ? 'Session paused'
            : (view.waitingReason ?? 'Nothing is playing right now.')}
        </p>
      )}
      {view.runIndicator && view.state === 'ACTIVE' ? (
        <p className="muted small">
          <GenreSwatch style={view.runIndicator.style} size={14} /> {view.runIndicator.runLength}/
          {view.runIndicator.cap}
        </p>
      ) : null}
    </section>
  );
}
