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
  rulesVersion: 2,
  enabledStyles: ['salsa', 'bachata'],
  masterRunCap: 2,
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
  plannedDurationMin: 120,
  joinUrl: 'http://x/e/ABC123#j=JOINKEYJOINKEYJOINKEY',
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
  const created = {
    status: 201,
    body: {
      eventId: 'ev1',
      slug: 'ABC123',
      joinUrl: 'http://x/e/ABC123#j=JOINKEYJOINKEYJOINKEY',
      adminUrl: 'http://x/a/ev1#k=SECRETSECRET',
      recoverySecret: 'RECOVERYRECOVERY',
      rules,
      seeded: 0,
    },
  };

  it('sets time like an oven timer, validates breaks and ratios, and shows the admin link once', async () => {
    respond = () => created;
    const user = userEvent.setup();
    page('/new');
    expect(screen.getByRole('button', { name: 'Create event' })).toBeDisabled(); // no name
    await user.type(screen.getByLabelText('Event name'), 'Friday Social');

    // 2 h to start; + hour, + 10 min steps, never past 8 h
    expect(screen.getByRole('status', { name: '' })).toBeDefined();
    for (let i = 0; i < 8; i++)
      await user.click(screen.getByRole('button', { name: 'More hours' }));
    expect(screen.getByRole('button', { name: 'More hours' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ten minutes more' })).toBeDisabled(); // 8 h is the ceiling
    for (let i = 0; i < 6; i++)
      await user.click(screen.getByRole('button', { name: 'Fewer hours' }));
    await user.click(screen.getByRole('button', { name: 'Ten minutes more' }));

    // six styles, one is enough
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThanOrEqual(6);
    await user.click(screen.getByRole('checkbox', { name: 'Bachata' }));
    expect(screen.getByRole('button', { name: 'Create event' })).toBeEnabled(); // single genre is allowed
    await user.click(screen.getByRole('checkbox', { name: 'Bachata' }));
    await user.click(screen.getByRole('checkbox', { name: 'Non-Latin salsa-compatible' }));

    // breaks: limits shown live
    await user.click(screen.getByRole('button', { name: 'Add 30-minute break' }));
    await user.click(screen.getByRole('button', { name: 'Add 30-minute break' }));
    expect(await screen.findByText(/between breaks|half of the planned/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create event' })).toBeDisabled();
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]!);
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Add 10-minute break' }));

    await user.clear(screen.getByLabelText('Accepted songs per person'));
    await user.type(screen.getByLabelText('Accepted songs per person'), '4');
    await user.click(screen.getByRole('button', { name: 'Create event' }));
    expect(
      await screen.findByText(/Save this link — it is the only way to control the event/),
    ).toBeInTheDocument();
    expect(screen.getByText('http://x/a/ev1#k=SECRETSECRET')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('JOINKEY'); // the QR secret is never shown
    expect(calls[0]!.body).toMatchObject({
      name: 'Friday Social',
      enabledStyles: ['salsa', 'salsa_nl', 'bachata'],
      masterRunCap: 2,
      submissionLimit: 4,
      plannedDurationMin: 130,
      breaks: [{ label: '10-minute break', durationSec: 600 }],
    });
  });

  it('refuses a ratio below one part in ten', async () => {
    respond = () => created;
    const user = userEvent.setup();
    page('/new');
    await user.type(screen.getByLabelText('Event name'), 'X');
    await user.click(screen.getByRole('checkbox', { name: 'Cha-cha' })); // three genres
    await user.click(screen.getByText(/Advanced: set a ratio/));
    await user.click(screen.getByRole('checkbox', { name: 'Use a ratio instead of one number' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Salsa' }), '1');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Bachata' }), '5');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cha-cha' }), '5');
    expect(await screen.findByText(/at least 1 part in 10/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create event' })).toBeDisabled();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cha-cha' }), '1'); // 1:5:1
    expect(screen.queryByText(/at least 1 part in 10/)).toBeNull();
  });

  it('sends a playlist link with the chosen style', async () => {
    respond = () => created;
    const user = userEvent.setup();
    page('/new#playlist');
    await user.type(screen.getByLabelText('Event name'), 'X');
    await user.type(
      screen.getByLabelText('Playlist link'),
      'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    );
    await user.click(screen.getByRole('button', { name: 'Create event' }));
    await screen.findByText(/Save this link/);
    expect(calls[0]!.body).toMatchObject({
      playlist: { url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', style: 'salsa' },
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

  it('is one screen with tabs; the QR is the only invitation and nothing can be copied', async () => {
    ok();
    const user = userEvent.setup();
    page();
    expect(await screen.findByText('Playing Now')).toBeInTheDocument();
    expect(screen.getByText(/Salsa run 1\/2/)).toBeInTheDocument();
    expect(screen.getByText(/1 song would run past the end/)).toBeInTheDocument();
    expect(screen.getByText(/Next: Next Song/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('ABC123'); // no room code on the organiser screen
    await user.click(screen.getByRole('tab', { name: 'Invite' }));
    expect(screen.getByRole('img', { name: /QR code to join Friday Social/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull();
    expect(document.body.textContent).not.toContain('JOINKEY');
    expect(document.body.textContent).not.toContain('/e/ABC123');
    await user.click(screen.getByRole('tab', { name: 'More' }));
    await user.click(screen.getByRole('button', { name: 'Rules' }));
    expect(screen.getByText(/abcdef012345/)).toBeInTheDocument();
    expect(screen.getByText(/Most songs in a row:/).closest('li')).toHaveTextContent(
      'Salsa 2 · Bachata 2',
    );
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
    await user.click(screen.getByRole('button', { name: 'Yes, skip' }));
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

  it('ends the event with two distinct clicks and no typing', async () => {
    ok();
    const user = userEvent.setup();
    page();
    await user.click(await screen.findByRole('tab', { name: 'More' }));
    await user.click(screen.getByRole('button', { name: 'End the event' })); // opens the section
    expect(screen.queryByRole('textbox')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'End event' })); // click 1
    expect(calls.some((c) => c.url.endsWith('/admin/end'))).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Yes, end the event now' })); // click 2
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
    await user.click(await screen.findByRole('tab', { name: 'More' }));
    await user.click(screen.getByRole('button', { name: 'Hand over' }));
    await user.click(screen.getByRole('button', { name: 'Hand over admin' }));
    await user.click(screen.getByRole('button', { name: 'Yes, create a handover link' }));
    expect(await screen.findByText(/\/claim\/ev1#c=ABCD1234EFGH5678/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Time' }));
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
    expect(screen.queryByRole('button', { name: 'End event' })).toBeNull();
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
    await user.click(screen.getByRole('button', { name: 'Create event from these' }));
    const imp = calls.find((c) => c.url.endsWith('/events/import'))!;
    expect(imp.body).toMatchObject({
      shuffle: true,
      selectedIndexes: [0],
      name: 'Friday Social (next)',
      plannedDurationMin: 120,
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
