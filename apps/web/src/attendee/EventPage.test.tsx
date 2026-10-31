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

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
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
    // The header is filled from an effect, which can land just after the page's own content.
    await waitFor(() => expect(container.querySelector('.topbar .event-token')).not.toBeNull());
    const token = container.querySelector('.topbar .event-token')!;
    const label = token.querySelector('[aria-hidden]')!;
    expect(label.textContent).toBe('mango-octopus-rye');
    expect(label.getAttribute('aria-hidden')).toBe('true'); // decorative; the heading carries the name
    expect(screen.getByRole('heading', { name: 'Mango Octopus Rye' })).toBeInTheDocument();
    expect(token.closest('a,button')).toBeNull(); // nothing to tap
  });

  it('lets anyone who opened the page join: no secret needed', async () => {
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
    const join = await screen.findByRole('button', { name: 'Join this event' });
    expect(join).toBeDisabled(); // a name is required
    await user.type(screen.getByLabelText('Your name'), ' Ana ');
    await user.click(join);
    await waitFor(() => expect(joined).toEqual([{ nickname: 'Ana' }]));
  });

  it('adds a whole playlist: only as many as are left can be added, the rest are greyed out', async () => {
    localStorage.setItem(
      'qroove:p:ev1',
      JSON.stringify({ participantId: 'p1', token: 'tok'.repeat(10) }),
    );
    const mine = { accepted: 3, limit: 5, requests: [] as unknown[] };
    let batch: { style: string; songs: Array<{ title: string }> } | undefined;
    handler = (url, init) => {
      if (url.includes('by-slug')) return { body: { eventId: 'ev1', slug: 'ABC123' } };
      if (url.endsWith('/my-requests')) return { body: mine };
      if (url.endsWith('/resolve-playlist')) {
        return {
          body: {
            tracks: ['A', 'B', 'C', 'D'].map((t) => ({
              title: `Song ${t}`,
              artist: null,
              durationMs: 180000,
              sourceUrl: null,
            })),
          },
        };
      }
      if (url.endsWith('/requests/batch')) {
        batch = JSON.parse(init.body as string);
        return {
          body: {
            results: [
              { index: 0, status: 'ADDED' },
              { index: 1, status: 'ADDED' },
            ],
            accepted: 2,
          },
        };
      }
      return { body: baseView };
    };
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Someone Else');
    await user.type(
      screen.getByLabelText('Search Spotify or paste a link'),
      'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    );
    const list = await screen.findByRole('list', { name: 'Songs to add' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    // 5 allowed - 3 already accepted = 2 left: the third and fourth are over the limit.
    expect(rows.map((r) => r.className.includes('over'))).toEqual([false, false, true, true]);
    // Send the last song to the top: it becomes active and pushes Song B past the limit.
    await user.click(screen.getByRole('button', { name: 'Move Song D to the top' }));
    const after = within(list).getAllByRole('listitem');
    expect(after[0]).toHaveAccessibleName(/^Song D/);
    expect(after.map((r) => r.className.includes('over'))).toEqual([false, false, true, true]);
    expect(screen.getByRole('button', { name: 'Choose a genre first' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Bachata' }));
    expect(
      screen.getByText('You selected BACHATA. Remove all SALSA, CHA-CHA, OTHER songs.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add 2' }));
    await screen.findByText(/2 added/);
    expect(batch!.style).toBe('bachata');
    expect(batch!.songs.map((x) => x.title)).toEqual(['Song D', 'Song A']);
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

  it('joins, adds a song by link with an idempotency key, and withdraws it', async () => {
    const mine = { accepted: 0, limit: 5, requests: [] as unknown[] };
    handler = (url, init) => {
      if (url.includes('by-slug')) return { body: { eventId: 'ev1', slug: 'ABC123' } };
      if (url.endsWith('/join')) return { body: { participantId: 'p1', token: 'tok'.repeat(10) } };
      if (url.endsWith('/my-requests')) return { body: mine };
      if (url.endsWith('/resolve-playlist'))
        return {
          body: {
            tracks: [{ title: 'Mi Bachata', artist: 'Band', durationMs: 200000, sourceUrl: null }],
          },
        };
      if (url.endsWith('/requests/batch')) {
        mine.requests.push({
          id: 'r1',
          state: 'RESERVED_NEXT',
          title: 'Mi Bachata',
          artist: 'Band',
          style: 'bachata',
          provider: 'manual',
          durationMs: 200000,
          artworkUrl: null,
          acceptedSeq: 1,
          position: 1,
          predictedStartMs: Date.now() + 5000,
          uncertain: false,
          statusText: 'Up next',
        });
        mine.accepted = 1;
        return { body: { results: [{ index: 0, status: 'ADDED' }], accepted: 1 } };
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
    await user.type(await screen.findByLabelText('Your name'), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Join this event' }));
    // No artist or length fields, and only one place to add music.
    await user.type(
      await screen.findByLabelText('Search Spotify or paste a link'),
      `Listen https://open.spotify.com/track/${'a'.repeat(22)}`,
    );
    await screen.findByRole('list', { name: 'Songs to add' });
    expect(screen.queryByLabelText(/Artist/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Length/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Bachata' }));
    await user.click(screen.getByRole('button', { name: 'Add 1' }));
    expect(await screen.findByText(/1 added/)).toBeInTheDocument();
    const post = calls.find((c) => c.url.endsWith('/requests/batch'))!;
    expect((post.init.headers as Record<string, string>)['idempotency-key']).toBe('uuid-1');
    expect(JSON.parse(post.init.body as string)).toEqual({
      style: 'bachata',
      songs: [{ title: 'Mi Bachata', artist: 'Band', durationMs: 200000, sourceUrl: null }],
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

  it('shows the server’s message and next action when a link is refused', async () => {
    localStorage.setItem(
      'qroove:p:ev1',
      JSON.stringify({ participantId: 'p1', token: 'tok'.repeat(10) }),
    );
    handler = (url, init) => {
      if (url.includes('by-slug')) return { body: { eventId: 'ev1', slug: 'ABC123' } };
      if (url.endsWith('/my-requests')) return { body: { accepted: 1, limit: 5, requests: [] } };
      if (init.method === 'POST')
        return {
          status: 400,
          body: {
            error: {
              code: 'UNSUPPORTED_LINK',
              message: 'We could not read that link.',
              action: 'Try another.',
            },
          },
        };
      return { body: baseView };
    };
    const user = userEvent.setup();
    renderPage();
    await user.type(
      await screen.findByLabelText('Search Spotify or paste a link'),
      'https://example.com/x',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not read that link. Try another.',
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
