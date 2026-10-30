import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Layout } from '../shared/Layout';
import { MenuProvider } from '../shared/menu';
import { EventPage } from './EventPage';

const baseView = {
  id: 'ev1',
  name: 'Friday Social',
  slug: 'ABC123',
  state: 'ACTIVE',
  timezone: 'UTC',
  endAt: null,
  serverNow: Date.now(),
  version: 1,
  rules: {
    rulesVersion: 3,
    segments: [
      { enabledStyles: ['salsa', 'bachata'], masterRunCap: 2, runCaps: { salsa: 2, bachata: 2 } },
    ],
    submissionLimit: 5,
  },
  nowPlaying: null,
  waitingReason: null,
  runIndicator: null,
  breaks: [],
  preview: { revision: 1, items: [], stoppedReason: 'EXHAUSTED', computedAt: 0 },
  queue: [
    {
      requestId: 'q1',
      title: 'Someone Else',
      artist: 'X',
      style: 'salsa',
      durationMs: null,
      artworkUrl: null,
      ownerNickname: 'Secret Name',
      position: 1,
      overflow: false,
    },
    {
      requestId: 'q2',
      title: 'Late Song',
      artist: null,
      style: 'bachata',
      durationMs: null,
      artworkUrl: null,
      ownerNickname: null,
      position: 2,
      overflow: true,
    },
  ],
};

type Handler = (url: string, init: RequestInit) => { status?: number; body: unknown };
let handler: Handler;
const calls: Array<{ url: string; init: RequestInit }> = [];

const KEY = 'K'.repeat(24);
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem('qroove:jk:ABC123', KEY);
  calls.length = 0;
  vi.stubGlobal('EventSource', undefined);
  vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const r = handler(url, init);
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/e/ABC123']}>
      <MenuProvider>
        <Layout>
          <Routes>
            <Route path="/e/:slug" element={<EventPage />} />
          </Routes>
        </Layout>
      </MenuProvider>
    </MemoryRouter>,
  );

describe('EventPage', () => {
  it('shows the live queue without other attendees’ names, and the overflow label', async () => {
    handler = (url) =>
      url.includes('by-slug') ? { body: { eventId: 'ev1', slug: 'ABC123' } } : { body: baseView };
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Friday Social' })).toBeInTheDocument();
    expect(screen.getByText('Someone Else')).toBeInTheDocument();
    expect(screen.queryByText(/Secret Name/)).toBeNull();
    expect(screen.getByText('After end time')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join this event' })).toBeInTheDocument();
  });

  it('shows the event name in the header: tiny, lower-case, hyphenated, and not selectable', async () => {
    handler = (url) =>
      url.includes('by-slug')
        ? { body: { eventId: 'ev1', slug: 'ABC123' } }
        : { body: { ...baseView, name: 'Mango Octopus Rye' } };
    const { container } = renderPage();
    await screen.findByText('Someone Else');
    const token = container.querySelector('.topbar .event-token')!;
    expect(token.textContent).toBe('mango-octopus-rye');
    expect(token.getAttribute('aria-hidden')).toBe('true'); // decorative; the heading carries the name
    expect(screen.getByRole('heading', { name: 'Mango Octopus Rye' })).toBeInTheDocument();
    expect(token.closest('a,button')).toBeNull(); // nothing to tap
  });

  it('cannot join without the QR secret, but can still watch the queue', async () => {
    sessionStorage.clear();
    handler = (url) =>
      url.includes('by-slug') ? { body: { eventId: 'ev1', slug: 'ABC123' } } : { body: baseView };
    renderPage();
    expect(await screen.findByText('Someone Else')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Join this event' })).toBeNull();
    expect(screen.getByText(/joining needs the organiser’s QR code/i)).toBeInTheDocument();
  });

  it('takes the join secret from the QR link and removes it from the address bar', async () => {
    sessionStorage.clear();
    window.location.hash = '#j=' + KEY;
    const joined: unknown[] = [];
    handler = (url, init) => {
      if (url.includes('by-slug')) return { body: { eventId: 'ev1', slug: 'ABC123' } };
      if (url.endsWith('/join')) {
        joined.push(JSON.parse(init.body as string));
        return { body: { participantId: 'p1', token: 'tok'.repeat(10) } };
      }
      if (url.endsWith('/my-requests')) return { body: { accepted: 0, limit: 5, requests: [] } };
      return { body: baseView };
    };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Join this event' }));
    await waitFor(() => expect(joined).toEqual([{ joinKey: KEY }]));
    expect(window.location.hash).toBe('');
  });

  it('shows a break in the queue where it falls', async () => {
    handler = (url) =>
      url.includes('by-slug')
        ? { body: { eventId: 'ev1', slug: 'ABC123' } }
        : {
            body: {
              ...baseView,
              breaks: [
                {
                  id: 'b1',
                  label: 'Break',
                  durationSec: 600,
                  startsAt: 5_000,
                  actualStart: null,
                  actualEnd: null,
                },
              ],
              preview: {
                revision: 1,
                items: [
                  {
                    requestId: 'q1',
                    position: 1,
                    predictedStartMs: 1_000,
                    uncertain: false,
                    overflow: false,
                  },
                  {
                    requestId: 'q2',
                    position: 2,
                    predictedStartMs: 9_000,
                    uncertain: false,
                    overflow: false,
                  },
                ],
                stoppedReason: 'EXHAUSTED',
                computedAt: 0,
              },
            },
          };
    renderPage();
    await screen.findByText('Someone Else');
    const items = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    const at = items.findIndex((t) => /Break · 10 min/.test(t));
    expect(at).toBeGreaterThan(items.findIndex((t) => t.includes('Someone Else')));
    expect(at).toBeLessThan(items.findIndex((t) => t.includes('Late Song')));
  });

  it('shows a clear message for an unknown event', async () => {
    handler = () => ({
      status: 404,
      body: {
        error: {
          code: 'NOT_FOUND',
          message: 'We could not find that.',
          action: 'Check the link or code and try again.',
        },
      },
    });
    renderPage();
    expect(await screen.findByText(/We could not find that event/)).toBeInTheDocument();
    expect(screen.getByText(/Check the link or code/)).toBeInTheDocument();
  });

  it('joins, adds a typed song with an idempotency key, and withdraws it', async () => {
    const mine = { accepted: 0, limit: 5, requests: [] as unknown[] };
    handler = (url, init) => {
      if (url.includes('by-slug')) return { body: { eventId: 'ev1', slug: 'ABC123' } };
      if (url.endsWith('/join')) return { body: { participantId: 'p1', token: 'tok'.repeat(10) } };
      if (url.endsWith('/my-requests')) return { body: mine };
      if (url.endsWith('/requests') && init.method === 'POST') {
        const r = {
          id: 'r1',
          state: 'RESERVED_NEXT',
          title: 'Mi Bachata',
          artist: 'Band',
          style: 'bachata',
          provider: 'manual',
          durationMs: null,
          artworkUrl: null,
          acceptedSeq: 1,
          position: 1,
          predictedStartMs: Date.now() + 5000,
          uncertain: false,
          statusText: 'Up next',
        };
        mine.requests.push(r);
        mine.accepted = 1;
        return { body: { request: r } };
      }
      if (init.method === 'DELETE') {
        mine.requests.length = 0;
        mine.accepted = 0;
        return { body: { ok: true } };
      }
      return { body: baseView };
    };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Join this event' }));
    const input = await screen.findByLabelText(/Paste a Spotify/);
    await user.type(input, 'Mi Bachata');
    expect(screen.getByRole('button', { name: 'Add to queue' })).toBeDisabled(); // no style yet
    await user.type(screen.getByLabelText(/Artist/), 'Band');
    await user.click(screen.getByRole('radio', { name: 'Bachata' }));
    await user.click(screen.getByRole('button', { name: 'Add to queue' }));
    expect(await screen.findByText(/Added “Mi Bachata”/)).toBeInTheDocument();
    const post = calls.find((c) => c.url.endsWith('/requests') && c.init.method === 'POST')!;
    expect((post.init.headers as Record<string, string>)['idempotency-key']).toBe('uuid-1');
    expect(JSON.parse(post.init.body as string)).toEqual({
      style: 'bachata',
      manual: { title: 'Mi Bachata', artist: 'Band' },
    });
    expect(await screen.findByText(/You’re up next: Mi Bachata/)).toBeInTheDocument();
    const list = screen.getByRole('heading', { name: 'My songs' }).closest('section')!;
    expect(
      within(list).getByText('1 of 5 accepted songs this event', { exact: false }),
    ).toBeInTheDocument();
    await user.click(within(list).getByRole('button', { name: 'Withdraw Mi Bachata' }));
    await user.click(within(list).getByRole('button', { name: 'Yes, remove' }));
    await waitFor(() =>
      expect(within(list).getByText('You have not added any songs yet.')).toBeInTheDocument(),
    );
  });

  it('shows the server’s message and next action when a submit is refused', async () => {
    localStorage.setItem(
      'qroove:p:ev1',
      JSON.stringify({ participantId: 'p1', token: 'tok'.repeat(10) }),
    );
    handler = (url, init) => {
      if (url.includes('by-slug')) return { body: { eventId: 'ev1', slug: 'ABC123' } };
      if (url.endsWith('/my-requests')) return { body: { accepted: 1, limit: 5, requests: [] } };
      if (init.method === 'POST')
        return {
          status: 409,
          body: {
            error: {
              code: 'DUPLICATE',
              message: 'Already queued as “X”.',
              action: 'Pick a different song or version.',
            },
          },
        };
      return { body: baseView };
    };
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText(/Paste a Spotify/), 'X');
    await user.click(screen.getByRole('radio', { name: 'Salsa' }));
    await user.click(screen.getByRole('button', { name: 'Add to queue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Already queued as “X”. Pick a different song or version.',
    );
  });

  it('drops a rejected stored pass and offers to join again', async () => {
    localStorage.setItem(
      'qroove:p:ev1',
      JSON.stringify({ participantId: 'p1', token: 'tok'.repeat(10) }),
    );
    handler = (url) => {
      if (url.includes('by-slug')) return { body: { eventId: 'ev1', slug: 'ABC123' } };
      if (url.endsWith('/my-requests'))
        return {
          status: 401,
          body: { error: { code: 'UNAUTHORISED', message: 'x', action: 'y' } },
        };
      return { body: baseView };
    };
    renderPage();
    expect(await screen.findByRole('button', { name: 'Join this event' })).toBeInTheDocument();
    expect(localStorage.getItem('qroove:p:ev1')).toBeNull();
  });
});
