import type { EventPublicView } from '@qroove/contracts';
import { STYLE_PRESETS } from '@qroove/config';

export const styleLabel = (id: string) => STYLE_PRESETS.find((s) => s.id === id)?.label ?? id;

export function NowPlaying({ view }: { view: EventPublicView }) {
  const np = view.nowPlaying;
  return (
    <section className="card now" aria-labelledby="np-h">
      <h2 id="np-h">Now playing</h2>
      {np ? (
        <>
          <p className="big">{np.track.title}</p>
          <p className="muted">
            {[np.track.artist, styleLabel(np.track.style)].filter(Boolean).join(' · ')}
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
          {styleLabel(view.runIndicator.style)} run: {view.runIndicator.runLength} of{' '}
          {view.runIndicator.cap}
        </p>
      ) : null}
    </section>
  );
}
