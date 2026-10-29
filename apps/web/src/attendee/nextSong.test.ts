import type { EventPublicView, MyRequests, RequestView } from '@qroove/contracts';
import { describe, expect, it } from 'vitest';
import { nextSong } from './nextSong';

const view = (over: Partial<EventPublicView> = {}): EventPublicView =>
  ({ state: 'ACTIVE', nowPlaying: null, waitingReason: null, ...over }) as EventPublicView;
const req = (over: Partial<RequestView> = {}): RequestView => ({
  id: 'r1',
  state: 'QUEUED',
  title: 'Obsesión',
  artist: null,
  style: 'bachata',
  provider: 'manual',
  durationMs: null,
  artworkUrl: null,
  acceptedSeq: 1,
  position: 3,
  predictedStartMs: 1_000_000 + 510_000,
  uncertain: false,
  statusText: null,
  ...over,
});
const mine = (...requests: RequestView[]): MyRequests => ({
  accepted: requests.length,
  limit: 5,
  requests,
});
const NOW = 1_000_000;

describe('nextSong', () => {
  it('counts songs before mine, including the one playing, with correct plurals', () => {
    const playing = { track: {}, startedAt: 0 } as EventPublicView['nowPlaying'];
    const a = nextSong(view({ nowPlaying: playing }), mine(req({ position: 2 })), NOW);
    expect(a.headline).toBe('2 songs until Obsesión');
    const b = nextSong(view({ nowPlaying: playing }), mine(req({ position: 1 })), NOW);
    expect(b.headline).toBe('1 song until Obsesión');
    const c = nextSong(view(), mine(req({ position: 1 })), NOW);
    expect(c.headline).toBe('You’re up next: Obsesión');
  });
  it('ticks down from the server-estimated clock', () => {
    expect(nextSong(view(), mine(req()), NOW).countdownMs).toBe(510_000);
    expect(nextSong(view(), mine(req()), NOW + 10_000).countdownMs).toBe(500_000);
    expect(nextSong(view(), mine(req()), NOW + 900_000).countdownMs).toBe(0);
  });
  it('flags estimates', () => {
    expect(nextSong(view(), mine(req({ uncertain: true })), NOW).estimated).toBe(true);
    expect(nextSong(view(), mine(req()), NOW).estimated).toBe(false);
  });
  it('picks the soonest song among several', () => {
    const n = nextSong(
      view(),
      mine(
        req({ id: 'a', position: 5, title: 'Later' }),
        req({ id: 'b', position: 2, title: 'Sooner' }),
      ),
      NOW,
    );
    expect(n.requestId).toBe('b');
  });
  it('shows the specified messages for each unavailable state', () => {
    expect(nextSong(view({ state: 'PAUSED' }), mine(req()), NOW)).toMatchObject({
      detail: 'Session paused',
      countdownMs: null,
    });
    expect(nextSong(view(), mine(req({ state: 'OVERFLOW', position: 4 })), NOW).detail).toBe(
      'Beyond planned end — admin must extend',
    );
    expect(
      nextSong(
        view({ waitingReason: 'x' }),
        mine(req({ state: 'INELIGIBLE_TEMPORARILY', position: null, predictedStartMs: null })),
        NOW,
      ).detail,
    ).toBe('Waiting for more eligible songs');
    expect(
      nextSong(view(), mine(req({ position: null, predictedStartMs: null })), NOW).detail,
    ).toBe('Position not yet predictable');
    expect(
      nextSong(
        view(),
        mine(req({ state: 'PENDING_METADATA', statusText: 'Possible duplicate — needs review' })),
        NOW,
      ).detail,
    ).toBe('Possible duplicate — needs review');
  });
  it('handles no songs, full quota, not started and ended', () => {
    expect(nextSong(view(), mine(), NOW).detail).toBe('Add a song to join the queue.');
    expect(
      nextSong(view(), { accepted: 5, limit: 5, requests: [req({ state: 'PLAYED' })] }, NOW).detail,
    ).toMatch(/used all/);
    expect(nextSong(view({ state: 'DRAFT' }), null, NOW).headline).toMatch(/not started/);
    expect(nextSong(view({ state: 'ENDED' }), null, NOW).headline).toMatch(/ended/);
  });
  it('ignores played and withdrawn songs', () => {
    expect(
      nextSong(view(), mine(req({ state: 'PLAYED' }), req({ id: 'w', state: 'WITHDRAWN' })), NOW)
        .requestId,
    ).toBeNull();
  });
});
