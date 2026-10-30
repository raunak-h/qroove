import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlayerPage from './PlayerPage';

type Events = import('./embed').EmbedEvents;
let embedEvents: Events | null = null;
vi.mock('./embed', async (real) => ({
  ...(await real<typeof import('./embed')>()),
  mountEmbed: (_el: HTMLElement, _s: unknown, ev: Events) => {
    embedEvents = ev;
    return () => undefined;
  },
}));
vi.mock('./tone', () => ({ playTone: async () => undefined }));
vi.mock('./store', () => ({
  loadTracks: async () => [],
  saveTracks: async () => undefined,
  clearTracks: async () => undefined,
}));

type Call = { method: string; url: string; body: Record<string, unknown> | undefined };
let calls: Call[];
let adminState: Record<string, unknown>;
let failPath: string | null;

const rules = { rulesVersion: 1, enabledStyles: ['salsa'], runCaps: {}, submissionLimit: 5 };
const mkState = (over: { reserved?: boolean; playing?: boolean; epoch?: number | null } = {}) => ({
  csrf: 'csrf',
  rules,
  rulesHash: 'h',
  lease: over.epoch ? { epoch: over.epoch, expiresAt: 1 } : null,
  requests: over.reserved
    ? [
        {
          id: 'r1',
          state: 'RESERVED_NEXT',
          title: 'Vivir Mi Vida',
          artist: 'Marc Anthony',
          style: 'salsa',
          sourceUrl: 'https://open.spotify.com/track/x',
        },
      ]
    : [],
  view: {
    id: 'ev1',
    name: 'Friday',
    slug: 'ABC',
    state: 'ACTIVE',
    version: 3,
    nowPlaying: over.playing
      ? { startedAt: 1, track: { requestId: 'r1', title: 'Vivir Mi Vida', artist: 'Marc Anthony' } }
      : null,
    waitingReason: null,
    queue: [
      { requestId: 'r1', title: 'Vivir Mi Vida', artist: 'Marc Anthony', durationMs: 240000 },
    ],
  },
});

beforeEach(() => {
  calls = [];
  embedEvents = null;
  failPath = null;
  sessionStorage.clear();
  adminState = mkState({ reserved: true });
  vi.stubGlobal('EventSource', undefined);
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const c: Call = {
      method: init.method ?? 'GET',
      url,
      body: init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined,
    };
    calls.push(c);
    if (failPath && url.endsWith(failPath)) {
      return new Response(
        JSON.stringify({ error: { code: 'STALE_LEASE', message: 'Stale.', action: 'Retry.' } }),
        { status: 409 },
      );
    }
    if (url.endsWith('/admin/state')) return new Response(JSON.stringify(adminState));
    if (url.endsWith('/player/claim')) {
      return new Response(JSON.stringify({ leaseToken: 'tok', lease: { epoch: 4, expiresAt: 1 } }));
    }
    return new Response(JSON.stringify({ ok: true }));
  });
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }),
  );
  HTMLMediaElement.prototype.play = vi.fn(async () => undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
  HTMLMediaElement.prototype.load = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const open = () =>
  render(
    <MemoryRouter initialEntries={['/player/ev1']}>
      <Routes>
        <Route path="/player/:eventId" element={<PlayerPage />} />
      </Routes>
    </MemoryRouter>,
  );

async function ready(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText(/Vivir Mi Vida — Marc Anthony/);
  await user.click(screen.getByRole('button', { name: 'Use this device as the player' }));
  await screen.findByText(/This device is playing/);
  await user.click(screen.getByRole('button', { name: 'Play test chime' }));
  await screen.findByText('Sound check done.');
}

describe('PlayerPage with a Spotify or YouTube link', () => {
  const withLink = () => {
    const st = mkState({ reserved: true });
    (st.requests[0] as { sourceUrl: string }).sourceUrl =
      `https://open.spotify.com/track/${'a'.repeat(22)}`;
    adminState = st;
  };

  it('plays in the provider player and reports the real start and end', async () => {
    withLink();
    const user = userEvent.setup();
    open();
    await ready(user);
    await screen.findByText(/Plays in the Spotify player/);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(embedEvents).not.toBeNull());
    expect(calls.some((c) => c.url.endsWith('/player/started'))).toBe(false); // not until audio plays
    act(() => embedEvents!.onPlaying(200_000));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/player/started'))).toBe(true));
    act(() => embedEvents!.onEnded());
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/player/finished'))).toBe(true));
  });

  it('falls back to the link and manual mode when only a preview is offered', async () => {
    withLink();
    const user = userEvent.setup();
    open();
    await ready(user);
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    await waitFor(() => expect(embedEvents).not.toBeNull());
    act(() => embedEvents!.onFailed('preview'));
    await screen.findByText(/only a 30-second preview/);
    expect(calls.some((c) => c.url.endsWith('/player/started'))).toBe(false);
    expect(screen.getByRole('button', { name: 'Mark started' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try the player again' })).toBeInTheDocument();
  });
});

describe('PlayerPage', () => {
  it('blocks Start until the lease is held and the sound check is done', async () => {
    open();
    await screen.findByText(/No matching file on this device/);
    expect(screen.getByRole('button', { name: 'Mark started' })).toBeDisabled();
    expect(screen.getByText('Take the player role first.')).toBeInTheDocument();
  });

  it('plays a matched file: reports started on "playing" and finished on "ended"', async () => {
    const user = userEvent.setup();
    const { container } = open();
    await ready(user);
    const input = container.querySelector('input[type=file][multiple]:not([webkitdirectory])')!;
    await user.upload(
      input as HTMLInputElement,
      new File(['x'], 'Marc Anthony - Vivir Mi Vida.mp3', { type: 'audio/mpeg' }),
    );
    await screen.findByText(/File found: Marc Anthony - Vivir Mi Vida.mp3/);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    const audio = container.querySelector('audio')!;
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    await act(async () => {
      fireEvent.playing(audio);
    });
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/player/started'))).toBe(true));
    const started = calls.find((c) => c.url.endsWith('/player/started'))!;
    expect(started.body).toMatchObject({ leaseToken: 'tok', epoch: 4, requestId: 'r1' });
    await act(async () => {
      fireEvent.ended(audio);
    });
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/player/finished'))).toBe(true));
    expect(calls.find((c) => c.url.endsWith('/player/finished'))!.body).toMatchObject({
      outcome: 'PLAYED',
      requestId: 'r1',
    });
  });

  it('manual mode: mark started, then mark ended; never auto-ends', async () => {
    const user = userEvent.setup();
    open();
    await ready(user);
    expect(screen.getByRole('link', { name: /requester's link/ })).toHaveAttribute(
      'href',
      'https://open.spotify.com/track/x',
    );
    await user.click(screen.getByRole('button', { name: 'Mark started' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/player/started'))).toBe(true));
  });

  it('stops and says so when the server reports a stale lease', async () => {
    const user = userEvent.setup();
    const { container } = open();
    await ready(user);
    failPath = '/player/started';
    const input = container.querySelector('input[type=file][multiple]:not([webkitdirectory])')!;
    await user.upload(
      input as HTMLInputElement,
      new File(['x'], 'Marc Anthony - Vivir Mi Vida.mp3', { type: 'audio/mpeg' }),
    );
    await screen.findByText(/File found/);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await act(async () => {
      fireEvent.playing(container.querySelector('audio')!);
    });
    expect(await screen.findByText('Another device took over playback')).toBeInTheDocument();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(sessionStorage.getItem('qroove:lease:ev1')).toBeNull();
  });
});
