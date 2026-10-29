import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminEntry from './AdminEntry';
import AdminPage from './AdminPage';
import CreateEvent from './CreateEvent';

type Call = { method: string; url: string; headers: Record<string, string>; body: unknown };
let calls: Call[];
let respond: (c: Call) => { status?: number; body: unknown };

beforeEach(() => {
  calls = [];
  vi.stubGlobal('EventSource', undefined);
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const c = {
      method: init.method ?? 'GET',
      url,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    };
    calls.push(c);
    const r = respond(c);
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const rules = {
  rulesVersion: 1,
  enabledStyles: ['salsa', 'bachata'],
  runCaps: { salsa: 2, bachata: 2 },
  submissionLimit: 5,
  minStyleTransitions: 1,
  noSameRequesterAdjacent: true,
  recordingUniquePerEvent: true,
  admissionOrder: 'fifo',
};
const track = (id: string, title: string, over = {}) => ({
  requestId: id,
  title,
  artist: 'A',
  style: 'salsa',
  durationMs: null,
  artworkUrl: null,
  ownerNickname: null,
  position: 1,
  overflow: false,
  ...over,
});
const state = (over: Record<string, unknown> = {}, viewOver: Record<string, unknown> = {}) => ({
  csrf: 'csrf-token',
  rulesHash: 'abcdef0123456789',
  rules,
  lease: null,
  requests: [
    {
      id: 'r1',
      state: 'RESERVED_NEXT',
      title: 'Next Song',
      artist: 'A',
      style: 'salsa',
      ownerNickname: 'Ana',
      ownerLabel: 'AB12',
      acceptedSeq: 1,
      possibleDuplicate: false,
      removedReason: null,
      sourceUrl: null,
    },
    {
      id: 'r2',
      state: 'PENDING_METADATA',
      title: 'Maybe Same',
      artist: 'B',
      style: 'bachata',
      ownerNickname: null,
      ownerLabel: 'CD34',
      acceptedSeq: 2,
      possibleDuplicate: true,
      removedReason: null,
      sourceUrl: null,
    },
    {
      id: 'r3',
      state: 'PLAYED',
      title: 'Old Song',
      artist: 'C',
      style: 'salsa',
      ownerNickname: null,
      ownerLabel: 'EF56',
      acceptedSeq: 0,
      possibleDuplicate: false,
      removedReason: null,
      sourceUrl: null,
    },
  ],
  view: {
    id: 'ev1',
    name: 'Friday Social',
    slug: 'ABC123',
    state: 'ACTIVE',
    timezone: 'UTC',
    endAt: null,
    serverNow: 0,
    version: 5,
    rules,
    nowPlaying: { track: track('p1', 'Playing Now'), startedAt: 1 },
    waitingReason: null,
    runIndicator: { style: 'salsa', runLength: 1, cap: 2 },
    breaks: [],
    preview: {
      revision: 1,
      items: [
        { requestId: 'r1', position: 1, predictedStartMs: 1, uncertain: false, overflow: false },
        { requestId: 'late', position: 2, predictedStartMs: null, uncertain: true, overflow: true },
      ],
      stoppedReason: 'EXHAUSTED',
      computedAt: 0,
    },
    queue: [track('r1', 'Next Song'), track('late', 'Late', { overflow: true, position: 2 })],
    ...viewOver,
  },
  ...over,
});

const page = (path = '/admin/ev1') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/:eventId" element={<AdminPage />} />
        <Route path="/a/:eventId" element={<AdminEntry mode="link" />} />
        <Route path="/new" element={<CreateEvent />} />
      </Routes>
    </MemoryRouter>,
  );

describe('CreateEvent', () => {
  it('needs two styles, sends the chosen rules, and shows the admin link once with a warning', async () => {
    respond = () => ({
      status: 201,
      body: {
        eventId: 'ev1',
        slug: 'ABC123',
        joinUrl: 'http://x/e/ABC123',
        adminUrl: 'http://x/a/ev1#k=SECRETSECRET',
        recoverySecret: 'RECOVERYRECOVERY',
        rules,
      },
    });
    const user = userEvent.setup();
    page('/new');
    expect(screen.getByRole('button', { name: 'Create event' })).toBeDisabled(); // no name
    await user.click(screen.getByRole('button', { name: 'Friday Social' }));
    expect(screen.getByLabelText('Event name')).toHaveValue('Friday Social');
    await user.click(screen.getByRole('checkbox', { name: 'Bachata' })); // drop to one style
    expect(screen.getByRole('button', { name: 'Create event' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'Bachata' }));
    await user.click(screen.getByRole('button', { name: 'Add 10-minute break' }));
    await user.clear(screen.getByLabelText('Accepted songs per person'));
    await user.type(screen.getByLabelText('Accepted songs per person'), '4');
    expect(screen.getByText(/Spacing rule \(fixed\)/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create event' }));
    expect(
      await screen.findByText(/Save this link — it is the only way to control the event/),
    ).toBeInTheDocument();
    expect(screen.getByText('http://x/a/ev1#k=SECRETSECRET')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open organiser page' })).toHaveAttribute(
      'href',
      '/a/ev1#k=SECRETSECRET',
    );
    expect(calls[0]!.body).toMatchObject({
      name: 'Friday Social',
      enabledStyles: ['salsa', 'bachata'],
      submissionLimit: 4,
      runCaps: { salsa: 2, bachata: 2 },
      breaks: [{ label: '10-minute break', durationSec: 600 }],
    });
  });
});

describe('AdminEntry', () => {
  it('exchanges the fragment secret and then removes it from the address bar', async () => {
    respond = (c) =>
      c.url.endsWith('/admin/session') ? { body: { ok: true, csrf: 'c' } } : { body: state() };
    const replace = vi.spyOn(history, 'replaceState');
    page('/a/ev1#k=' + 'S'.repeat(32));
    expect(await screen.findByRole('heading', { name: 'Friday Social' })).toBeInTheDocument();
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: '/api/events/ev1/admin/session',
      body: { secret: 'S'.repeat(32) },
    });
    expect(replace).toHaveBeenCalled();
    expect(String(replace.mock.calls[0]![2])).not.toContain('S'.repeat(32));
  });
  it('explains an incomplete link', async () => {
    respond = () => ({ body: {} });
    page('/a/ev1');
    expect(await screen.findByText(/must include everything after the “#”/)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});

describe('AdminPage', () => {
  const ok = (extra?: (c: Call) => { status?: number; body: unknown } | undefined) => {
    respond = (c) =>
      extra?.(c) ?? (c.method === 'GET' ? { body: state() } : { body: { ok: true, version: 6 } });
  };

  it('shows playback, the run indicator, overflow, moderation, rules and a QR for the public link only', async () => {
    ok();
    page();
    expect(await screen.findByText('Playing Now')).toBeInTheDocument();
    expect(screen.getByText(/Salsa run: 1 of 2/)).toBeInTheDocument();
    expect(screen.getByText(/1 song would run past the end time/)).toBeInTheDocument();
    expect(screen.getByText(/Next:/).parentElement).toHaveTextContent('Next Song');
    expect(
      screen.getByRole('img', { name: /QR code that opens .*\/e\/ABC123$/ }),
    ).toBeInTheDocument();
    const rules = screen.getByRole('heading', { name: 'Rules' }).closest('section')!;
    expect(rules).toHaveTextContent('abcdef012345');
    expect(rules).toHaveTextContent('Salsa (max 2 in a row)');
    expect(screen.queryByText(/change rules/i)).toBeNull();
    expect(document.body.textContent).not.toContain('csrf-token');
  });

  it('sends the CSRF header on commands, and confirms before skipping', async () => {
    ok();
    const user = userEvent.setup();
    page();
    await user.click(await screen.findByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/admin/pause'))).toBe(true));
    expect(calls.find((c) => c.url.endsWith('/admin/pause'))!.headers['x-qroove-csrf']).toBe(
      'csrf-token',
    );
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(calls.some((c) => c.url.endsWith('/admin/skip'))).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Yes, skip this song' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/admin/skip'))).toBe(true));
  });

  it('removes with confirmation, and resolves a possible duplicate', async () => {
    ok();
    const user = userEvent.setup();
    page();
    await user.click(await screen.findByRole('button', { name: 'Remove Next Song' }));
    expect(calls.some((c) => c.url.includes('/admin/remove/'))).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Yes, remove' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/admin/remove/r1'))).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Distinct' }));
    await waitFor(() =>
      expect(calls.find((c) => c.url.endsWith('/admin/duplicate/r2'))?.body).toEqual({
        decision: 'approve',
      }),
    );
    expect(screen.queryByRole('button', { name: /Remove Old Song/ })).toBeNull(); // played songs stay
  });

  it('ends the event only after typing END', async () => {
    ok();
    const user = userEvent.setup();
    page();
    const end = await screen.findByRole('button', { name: 'End event' });
    expect(end).toBeDisabled();
    await user.type(screen.getByLabelText('Type END to confirm'), 'end');
    expect(end).toBeEnabled();
    await user.click(end);
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/admin/end'))).toBe(true));
  });

  it('shows a handover link once, and rejects past or non-extending end times', async () => {
    ok((c) =>
      c.url.endsWith('/admin/handover')
        ? { body: { code: 'ABCD1234EFGH5678', expiresAt: 600_000 } }
        : undefined,
    );
    const user = userEvent.setup();
    page();
    await user.click(await screen.findByRole('button', { name: 'Hand over admin' }));
    await user.click(screen.getByRole('button', { name: 'Yes, create a handover link' }));
    expect(await screen.findByText(/\/claim\/ev1#c=ABCD1234EFGH5678/)).toBeInTheDocument();
    const input = screen.getByLabelText('Set an end time');
    await user.type(input, '2001-01-01T10:00');
    expect(screen.getByText(/Pick a real time later than now/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set' })).toBeDisabled();
  });

  it('runs breaks and shows the carry-over list after the event ends', async () => {
    const brk = {
      id: 'b1',
      label: '10-minute break',
      durationSec: 600,
      startsAt: null,
      actualStart: null,
      actualEnd: null,
    };
    ok((c) => {
      if (c.url.endsWith('/admin/carry-over'))
        return {
          body: {
            formatVersion: 1,
            name: 'Friday Social',
            rules,
            recommendations: [
              {
                title: 'Left Over',
                artist: null,
                style: 'salsa',
                durationMs: null,
                sourceUrl: null,
              },
            ],
          },
        };
      if (c.method === 'GET') return { body: state({}, { breaks: [brk], state: 'ENDED' }) };
      return undefined;
    });
    page();
    expect(await screen.findByText('Left Over')).toBeInTheDocument();
    expect(screen.getByLabelText('Shuffle within each style')).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Start break' })).toBeNull(); // ended: no break controls
    expect(screen.queryByRole('heading', { name: 'End the event' })).toBeNull();
    const user = userEvent.setup();
    respond = (c) =>
      c.url.endsWith('/events/import')
        ? {
            status: 201,
            body: {
              eventId: 'ev2',
              slug: 'ZZZ999',
              joinUrl: 'j',
              adminUrl: 'http://x/a/ev2#k=NEWSECRETNEWSECRET',
              recoverySecret: 'r'.repeat(20),
              seeded: 1,
            },
          }
        : c.url.endsWith('/carry-over')
          ? {
              body: {
                formatVersion: 1,
                name: 'Friday Social',
                rules,
                recommendations: [
                  {
                    title: 'Left Over',
                    artist: null,
                    style: 'salsa',
                    durationMs: null,
                    sourceUrl: null,
                  },
                ],
              },
            }
          : { body: state({}, { state: 'ENDED' }) };
    await user.click(screen.getByRole('button', { name: 'Create next event from these' }));
    const imp = calls.find((c) => c.url.endsWith('/events/import'))!;
    expect(imp.body).toMatchObject({
      shuffle: true,
      selectedIndexes: [0],
      name: 'Friday Social (next)',
    });
    expect(await screen.findByText(/Save this link/)).toBeInTheDocument();
    void within;
  });

  it('offers recovery when access is lost', async () => {
    respond = (c) =>
      c.url.endsWith('/admin/recover')
        ? { body: { ok: true, csrf: 'x' } }
        : {
            status: 401,
            body: {
              error: {
                code: 'UNAUTHORISED',
                message: 'You do not have permission to do that.',
                action: 'Open the link you were given, or ask the organiser.',
              },
            },
          };
    const user = userEvent.setup();
    page();
    expect(await screen.findByText(/You do not have organiser access/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Recovery secret'), 'R'.repeat(20));
    await user.click(screen.getByRole('button', { name: 'Recover access' }));
    await waitFor(() =>
      expect(calls.find((c) => c.url.endsWith('/admin/recover'))?.body).toEqual({
        recoverySecret: 'R'.repeat(20),
      }),
    );
  });
});
