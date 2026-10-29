import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ImportEvent from './ImportEvent';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const rules = { rulesVersion: 1, enabledStyles: ['salsa'], runCaps: {}, submissionLimit: 5 };
const snapshot = {
  formatVersion: 1,
  name: 'Old night',
  rules,
  recommendations: [
    { title: 'One', artist: 'A', style: 'salsa', durationMs: null, sourceUrl: null },
    { title: 'Two', artist: null, style: 'salsa', durationMs: null, sourceUrl: null },
  ],
};

describe('ImportEvent', () => {
  it('rejects text that is not a playlist export', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ImportEvent />
      </MemoryRouter>,
    );
    await user.click(screen.getByLabelText('Or paste it here'));
    await user.paste('{"hello":1}');
    await user.click(screen.getByRole('button', { name: 'Read playlist' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/does not look like a Qroove/);
  });

  it('imports only the chosen songs', async () => {
    let sent: { selectedIndexes: number[]; name: string } | undefined;
    vi.stubGlobal('fetch', async (_u: string, init: RequestInit) => {
      sent = JSON.parse(init.body as string);
      return new Response(
        JSON.stringify({
          eventId: 'e2',
          slug: 'S',
          joinUrl: 'http://x/e/S',
          adminUrl: 'http://x/a/e2#k=Z',
          recoverySecret: 'R',
          seeded: 1,
        }),
        { status: 201 },
      );
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ImportEvent />
      </MemoryRouter>,
    );
    await user.click(screen.getByLabelText('Or paste it here'));
    await user.paste(JSON.stringify(snapshot));
    await user.click(screen.getByRole('button', { name: 'Read playlist' }));
    await user.click(await screen.findByRole('checkbox', { name: /Two/ })); // untick
    await user.click(screen.getByRole('button', { name: 'Create event from these' }));
    await screen.findByText(/Save this link/);
    expect(sent).toMatchObject({ selectedIndexes: [0], name: 'Old night' });
  });
});
