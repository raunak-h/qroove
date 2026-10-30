import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  rulesVersion: 3,
  segments: [
    {
      enabledStyles: ['salsa', 'bachata'],
      masterRunCap: 2,
      runCaps: { salsa: 2, bachata: 2 },
    },
  ],
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
      name: 'Mango Octopus Rye',
      joinUrl: 'http://x/e/ABC123#j=JOINKEYJOINKEYJOINKEY',
      adminUrl: 'http://x/a/ev1#k=SECRETSECRET',
      recoverySecret: 'RECOVERYRECOVERY',
      rules,
      seeded: 0,
    },
  };
  const wheel = (name: string) => screen.getByRole('spinbutton', { name });
  const styleBox = (name: string) => screen.getByRole('checkbox', { name });

  it('has no event-name field, a 2:00 time drum, and the default styles', async () => {
    respond = () => created;
    page('/new');
    expect(screen.queryByLabelText(/event name/i)).toBeNull();
    expect(wheel('Planned time')).toHaveAttribute('aria-valuetext', '2:00');
    expect(styleBox('Salsa')).toHaveAttribute('aria-checked', 'true');
    expect(styleBox('Non-Latin salsa-compatible')).toHaveAttribute('aria-checked', 'true');
    expect(styleBox('Bachata')).toHaveAttribute('aria-checked', 'true');
    expect(styleBox('Non-Latin bachata-compatible')).toHaveAttribute('aria-checked', 'true');
    expect(styleBox('Cha-cha')).toHaveAttribute('aria-checked', 'false');
    expect(styleBox('Other (Musicality Exercise)')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: 'Create event' })).toBeEnabled();
  });

  it('sends the drum choices and a break tapped on the bar, and shows the generated name', async () => {
    respond = () => created;
    Element.prototype.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 360,
        bottom: 52,
        width: 360,
        height: 52,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect;
    const user = userEvent.setup();
    page('/new');
    wheel('Planned time').focus();
    await user.keyboard('{ArrowDown}{ArrowDown}'); // 2:00 -> 2:30
    expect(wheel('Planned time')).toHaveAttribute('aria-valuetext', '2:30');
    await user.click(styleBox('Cha-cha'));
    wheel('Accepted songs per person').focus();
    await user.keyboard('{ArrowDown}{ArrowDown}'); // 5 -> 7
    // Press and hold the part: the break goes to its middle (2:30 -> 75 min, centred on 10).
    fireEvent.keyDown(screen.getAllByRole('button', { name: /^Part/ })[0]!, { key: 'b' });
    expect(screen.getAllByRole('button', { name: /^Part/ })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /^Part 2 of 2/ })); // a plain tap selects it
    await user.click(styleBox('Bachata')); // part two drops bachata
    await user.click(screen.getByRole('button', { name: 'Create event' }));
    expect(await screen.findByRole('heading', { name: 'Mango Octopus Rye' })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('JOINKEY');
    const body = calls[0]!.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('name');
    expect(body).toMatchObject({
      plannedDurationMin: 150,
      submissionLimit: 7,
      breaks: [{ startMin: 70, durationSec: 600 }],
    });
    const segs = body.segments as Array<{ enabledStyles: string[] }>;
    expect(segs).toHaveLength(2);
    expect(segs[0]!.enabledStyles).toEqual([
      'salsa',
      'salsa_nl',
      'bachata',
      'bachata_nl',
      'chacha',
    ]);
    expect(segs[1]!.enabledStyles).toEqual(['salsa', 'salsa_nl', 'bachata_nl', 'chacha']);
  });

  it('defaults to an equal split, and refuses a ratio below one part in ten', async () => {
    respond = () => created;
    const user = userEvent.setup();
    page('/new');
    await user.click(styleBox('Cha-cha')); // three genres
    await user.click(screen.getByLabelText('Ratio between genres'));
    for (const g of ['salsa', 'bachata', 'chacha']) {
      expect(wheel(`Ratio ${g}`)).toHaveAttribute('aria-valuenow', '2'); // equal to the master number
    }
    wheel('Ratio bachata').focus();
    await user.keyboard('{End}'); // 5
    wheel('Ratio chacha').focus();
    await user.keyboard('{End}'); // 5
    wheel('Ratio salsa').focus();
    await user.keyboard('{Home}'); // 1 : 5 : 5 is 1 part in 11
    expect(await screen.findByText(/at least 1 part in 10/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create event' })).toBeDisabled();
    wheel('Ratio chacha').focus();
    await user.keyboard('{Home}'); // 1 : 5 : 1
    expect(screen.queryByText(/at least 1 part in 10/)).toBeNull();
  });

  it('needs at least one style in every part', async () => {
    respond = () => created;
    const user = userEvent.setup();
    page('/new');
    for (const s of [
      'Salsa',
      'Non-Latin salsa-compatible',
      'Bachata',
      'Non-Latin bachata-compatible',
    ]) {
      await user.click(styleBox(s));
    }
    expect(await screen.findByText('Pick at least one style.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create event' })).toBeDisabled();
  });

  describe('playlists', () => {
    const SPOT = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
    const APPLE = 'https://music.apple.com/us/playlist/hits/pl.f4d106fed2bd41149aaacabb233eb5eb';
    const link = (style: string) => screen.getByLabelText(`Playlist link for ${style}`);

    it('lays the fields out like the style grid, one per active style', () => {
      respond = () => created;
      page('/new#playlist');
      const labels = screen
        .getAllByLabelText(/Playlist link for/)
        .map((i) => i.getAttribute('aria-label')!.replace('Playlist link for ', ''));
      expect(labels).toEqual([
        'Salsa',
        'Non-Latin salsa-compatible',
        'Bachata',
        'Non-Latin bachata-compatible',
      ]);
      expect(screen.getByRole('button', { name: 'Create event' })).toBeEnabled(); // none is fine
    });

    it('needs a playlist for every active genre once any playlist is added', async () => {
      respond = () => created;
      const user = userEvent.setup();
      page('/new#playlist');
      await user.type(link('Salsa'), SPOT);
      expect(await screen.findByText(/playlist for every genre/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create event' })).toBeDisabled();
      // A Latin style's playlist covers its non-Latin counterpart, and vice versa.
      await user.type(link('Non-Latin bachata-compatible'), APPLE);
      expect(screen.queryByText(/playlist for every genre/i)).toBeNull();
      expect(screen.getByRole('button', { name: 'Create event' })).toBeEnabled();
      await user.click(screen.getByRole('button', { name: 'Create event' }));
      await screen.findByText(/Save this link/);
      expect(calls[0]!.body).toMatchObject({
        playlists: [
          { url: SPOT, style: 'salsa' },
          { url: APPLE, style: 'bachata_nl' },
        ],
      });
    });

    it('asks for cha-cha too once it is selected, and for Other', async () => {
      respond = () => created;
      const user = userEvent.setup();
      page('/new#playlist');
      await user.type(link('Salsa'), SPOT);
      await user.type(link('Bachata'), SPOT);
      expect(screen.getByRole('button', { name: 'Create event' })).toBeEnabled();
      await user.click(styleBox('Cha-cha'));
      expect(screen.getByRole('button', { name: 'Create event' })).toBeDisabled();
      await user.type(link('Cha-cha'), APPLE);
      expect(screen.getByRole('button', { name: 'Create event' })).toBeEnabled();
      await user.click(styleBox('Other (Musicality Exercise)'));
      expect(screen.getByRole('button', { name: 'Create event' })).toBeDisabled();
      await user.type(link('Other (Musicality Exercise)'), APPLE);
      expect(screen.getByRole('button', { name: 'Create event' })).toBeEnabled();
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
    expect(screen.getAllByRole('img', { name: 'Salsa' }).length).toBeGreaterThan(0); // the run, as a swatch
    expect(screen.getByText(/1\/2/)).toBeInTheDocument();
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
    expect(screen.getAllByRole('img', { name: 'Bachata' })[0]).toBeInTheDocument(); // rules show swatches
    expect(screen.getByText(/songs each/)).toHaveTextContent('5');
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
